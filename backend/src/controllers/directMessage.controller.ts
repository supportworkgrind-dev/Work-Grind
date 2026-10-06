import { Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User, { IUser } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { emitToDM, emitToUser, publishUserPresence } from '../utils/socket';
import { shouldDeliverNotification } from '../utils/notificationPreferences';
import { createNotification } from './channel.controller';
import { refreshAvatarUrls } from '../services/avatarUrls';
import { isValidCallingId, normalizeCallingId } from '../services/callingId';

// ── Helper: verify requester is a participant ─────────────────────────────────
const assertParticipant = async (
  conversationId: string,
  userId: string,
  companyId: string
): Promise<InstanceType<typeof Conversation> | null> => {
  const conv = await Conversation.findOne({
    _id: conversationId,
    participants: new mongoose.Types.ObjectId(userId),
    $or: [
      { isGroup: false },
      { isGroup: true, companyId },
    ],
  });
  return conv;
};

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user!.userId);
    const companyId = new mongoose.Types.ObjectId(req.user!.companyId);

    const conversations = await Conversation.find({
      participants: uid,
      $or: [
        { isGroup: false },
        { isGroup: true, companyId },
      ],
    })
      .populate('participants', 'callingId fullName avatar avatarStorageKey status jobTitle')
      .populate({
        path: 'lastMessage',
        select: 'content senderId createdAt type attachments deletedAt',
        populate: { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Attach unread count for the requesting user
    const enriched = await Promise.all(conversations.map(async (c) => {
      const unread = c.unreadCounts.find((u) => u.userId.toString() === uid.toString());
      return refreshAvatarUrls({ ...c, myUnreadCount: unread?.count ?? 0 });
    }));

    res.json({ success: true, conversations: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientCallingId, isGroup = false, groupName, participantIds = [] } = req.body;
    const uid = new mongoose.Types.ObjectId(req.user!.userId);
    const companyId = new mongoose.Types.ObjectId(req.user!.companyId);

    if (!isGroup) {
      let recipient = null;
      if (recipientCallingId) {
        const normalized = normalizeCallingId(String(recipientCallingId));
        if (!isValidCallingId(normalized)) {
          res.status(400).json({ success: false, message: 'Enter a valid WorkGrind User ID.' });
          return;
        }
        recipient = await User.findOne({
          callingId: normalized,
          isActive: true,
          isDeleted: { $ne: true },
        }).select('_id companyId');
      } else {
        res.status(400).json({ success: false, message: 'A WorkGrind User ID is required.' });
        return;
      }
      if (!recipient) {
        res.status(404).json({ success: false, message: 'No active WorkGrind user was found for that ID.' });
        return;
      }
      if (recipient._id.toString() === uid.toString()) {
        res.status(400).json({ success: false, message: 'You cannot start a direct message with yourself.' });
        return;
      }
      const [requester, recipientAccount] = await Promise.all([
        User.findById(uid).select('blockedUsers'),
        User.findById(recipient._id).select('blockedUsers'),
      ]);
      const targetId = recipient._id as mongoose.Types.ObjectId;
      const requesterBlocked = requester?.blockedUsers?.some((blockedId) => blockedId.equals(targetId));
      const recipientBlocked = recipientAccount?.blockedUsers?.some((blockedId) => blockedId.equals(uid));
      if (requesterBlocked || recipientBlocked) {
        res.status(404).json({ success: false, message: 'No active WorkGrind user was found for that ID.' });
        return;
      }

      let existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: [uid, targetId], $size: 2 },
      }).populate('participants', 'callingId fullName avatar avatarStorageKey status jobTitle');

      if (existing) {
        res.json({ success: true, conversation: await refreshAvatarUrls(existing.toObject()) });
        return;
      }

      const conv = await Conversation.create({
        companyId,
        participants: [uid, targetId],
        isGroup: false,
        unreadCounts: [
          { userId: uid, count: 0 },
          { userId: targetId, count: 0 },
        ],
      });
      const populated = await conv.populate('participants', 'callingId fullName avatar avatarStorageKey status jobTitle');
      await Promise.all([
        publishUserPresence(uid.toString()),
        publishUserPresence(targetId.toString()),
      ]);
      res.status(201).json({ success: true, conversation: await refreshAvatarUrls(populated.toObject()) });
      return;
    }

    // Group conversation
    const validParticipantIds = Array.from(
      new Set([uid.toString(), ...participantIds])
    ).map((id) => new mongoose.Types.ObjectId(id as string));

    const groupConv = await Conversation.create({
      companyId,
      participants: validParticipantIds,
      isGroup: true,
      groupName: groupName || 'Group Chat',
      createdBy: uid,
      unreadCounts: validParticipantIds.map((id) => ({ userId: id, count: 0 })),
    });
    const populatedGroup = await groupConv.populate('participants', 'callingId fullName avatar avatarStorageKey status jobTitle');
    res.status(201).json({ success: true, conversation: await refreshAvatarUrls(populatedGroup.toObject()) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDMMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 60 } = req.query;

    // ── Security: verify requester is a participant ──
    const conv = await assertParticipant(conversationId, req.user!.userId, req.user!.companyId);
    if (!conv) {
      res.status(403).json({ success: false, message: 'Access denied to this conversation' });
      return;
    }

    const filter: any = {
      conversationId,
      companyId: conv.companyId,
      deletedAt: null,
    };

    const total = await Message.countDocuments(filter);
    const messages = await Message.find(filter)
      .populate('senderId', 'callingId fullName avatar avatarStorageKey status')
      .populate({
        path: 'parentId',
        select: 'content senderId createdAt attachments type',
        populate: { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey' },
      })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      messages: await refreshAvatarUrls(messages.reverse().map((message) => message.toObject())),
      total,
      hasMore: Number(page) * Number(limit) < total,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendDMMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { content = '', type = 'text', attachments = [], parentId, clientMutationId } = req.body;
    const uid = req.user!.userId;

    // ── Security: verify requester is a participant ──
    const conv = await assertParticipant(conversationId, uid, req.user!.companyId);
    if (!conv) {
      res.status(403).json({ success: false, message: 'Access denied to this conversation' });
      return;
    }
    let otherUsers: IUser[] = [];
    if (!conv.isGroup) {
      otherUsers = await User.find({
        _id: { $in: conv.participants.filter((participantId) => participantId.toString() !== uid) },
        isActive: true,
        isDeleted: { $ne: true },
      }).select('_id companyId blockedUsers');
      const requester = await User.findById(uid).select('blockedUsers');
      if (otherUsers.length !== conv.participants.length - 1 ||
          otherUsers.some((other) => other.blockedUsers?.some((blockedId) => blockedId.toString() === uid)) ||
          requester?.blockedUsers?.some((blockedId) => otherUsers.some((other) => blockedId.equals(other._id)))) {
        res.status(403).json({ success: false, message: 'This user is not currently available for direct messages.' });
        return;
      }
    }
    if (clientMutationId !== undefined && (typeof clientMutationId !== 'string' || !/^[\w-]{16,64}$/.test(clientMutationId))) {
      res.status(400).json({ success: false, message: 'Invalid message request ID.' });
      return;
    }
    if (clientMutationId) {
      const existing = await Message.findOne({ senderId: uid, clientMutationId }).populate([
        { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey status' },
        { path: 'parentId', select: 'content senderId createdAt attachments type', populate: { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey' } },
      ]);
      if (existing) {
        res.status(200).json({ success: true, message: await refreshAvatarUrls(existing.toObject()) });
        return;
      }
    }

    if (!content.trim() && (!attachments || attachments.length === 0)) {
      res.status(400).json({ success: false, message: 'Message content or attachment required' });
      return;
    }

    const resolvedType =
      attachments && attachments.length > 0
        ? attachments[0].type?.startsWith('image/') ? 'image' : 'file'
        : type;

    const msg = await Message.create({
      companyId: conv.companyId,
      conversationId,
      senderId: uid,
      clientMutationId,
      content: content.trim(),
      type: resolvedType,
      attachments,
      parentId: parentId || null,
    });

    const populated = await msg.populate([
      { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey status' },
      {
        path: 'parentId',
        select: 'content senderId createdAt attachments type',
        populate: { path: 'senderId', select: 'callingId fullName avatar avatarStorageKey' },
      },
    ]);

    // Update conversation metadata + increment unread for all OTHER participants
    const bulkOps: any[] = [
      {
        updateOne: {
          filter: { _id: conversationId },
          update: { lastMessage: msg._id, lastMessageAt: new Date() },
        },
      },
    ];

    conv.participants.forEach((pId) => {
      if (pId.toString() !== uid) {
        bulkOps.push({
          updateOne: {
            filter: { _id: conversationId, 'unreadCounts.userId': pId },
            update: { $inc: { 'unreadCounts.$.count': 1 } },
          },
        });
      }
    });
    await Conversation.bulkWrite(bulkOps);

    // Broadcast new message to the DM room
    const messageWithFreshAvatars = await refreshAvatarUrls(populated.toObject());
    emitToDM(conversationId, 'dm:message', messageWithFreshAvatars);

    // Push notification to offline/non-subscribed participants
    await Promise.all(conv.participants.filter((pId) => pId.toString() !== uid).map(async (pId) => {
      if (await shouldDeliverNotification(pId.toString(), 'message')) {
        await createNotification({
          companyId: otherUsers.find((other) => other._id.equals(pId))?.companyId?.toString() || conv.companyId.toString(),
          userId: pId.toString(),
          type: 'message',
          title: 'New direct message',
          body: 'You received a new direct message.',
          actionUrl: `/chat?conversationId=${encodeURIComponent(conversationId)}`,
          metadata: { conversationId },
        });
        emitToUser(pId.toString(), 'dm:notification', {
          conversationId,
          message: messageWithFreshAvatars,
        });
      }
    }));

    res.status(201).json({ success: true, message: messageWithFreshAvatars });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markDMAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const uid = new mongoose.Types.ObjectId(req.user!.userId);

    // Ensure the user is a participant before allowing read-mark
    const conv = await assertParticipant(conversationId, req.user!.userId, req.user!.companyId);
    if (!conv) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await Conversation.updateOne(
      { _id: conversationId, 'unreadCounts.userId': uid },
      { $set: { 'unreadCounts.$.count': 0 } }
    );

    emitToDM(conversationId, 'dm:read', {
      conversationId,
      userId: req.user!.userId,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
