import { Response } from 'express';
import mongoose from 'mongoose';
import Channel from '../models/Channel';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { emitToChannel, emitToUser, emitToCompany, emitToDM } from '../utils/socket';
import { shouldDeliverNotification } from '../utils/notificationPreferences';
import { refreshAvatarUrls } from '../services/avatarUrls';

const findAccessibleMessage = async (req: AuthRequest, messageId: string) => {
  const message = await Message.findById(messageId);
  if (!message) return null;

  if (message.conversationId) {
    if (req.params.conversationId && message.conversationId.toString() !== req.params.conversationId) return null;
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user!.userId,
      $or: [
        { isGroup: false },
        { isGroup: true, companyId: req.user!.companyId },
      ],
    }).select('_id');
    return conversation ? message : null;
  }

  return message.companyId.toString() === req.user!.companyId ? message : null;
};

export const createNotification = async (data: { companyId: string; userId: string; type: any; title: string; body: string; actionUrl?: string; metadata?: any }) => {
  if (!(await shouldDeliverNotification(data.userId, data.type))) return null;
  const n = await Notification.create(data);
  emitToUser(data.userId, 'notification:new', n);
  return n;
};

export const getChannels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.userId;
    const cid = req.user!.companyId;
    const channels = await Channel.find({
      companyId: cid,
      isArchived: false,
      $or: [{ type: 'public' }, { members: uid }],
    })
      .populate('members', 'fullName avatar status jobTitle')
      .populate({
        path: 'projectId',
        select: 'name color status progress priority assigneeId',
        populate: { path: 'assigneeId', select: 'fullName avatar' },
      })
      .sort({ isDefault: -1, name: 1 })
      .lean();

    res.json({ success: true, channels });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, type = 'public', memberIds = [], projectId } = req.body;
    if (!name) { res.status(400).json({ success: false, message: 'Channel name required' }); return; }
    const uid = req.user!.userId;
    const cid = req.user!.companyId;
    const existing = await Channel.findOne({ companyId: cid, name: name.toLowerCase() });
    if (existing) { res.status(409).json({ success: false, message: 'Channel name already exists' }); return; }
    const members = [...new Set([uid, ...memberIds])];
    const channel = await Channel.create({
      companyId: cid,
      projectId: projectId || undefined,
      name: name.toLowerCase(),
      description,
      type,
      createdBy: uid,
      members,
    });
    const populated = await channel.populate([
      { path: 'members', select: 'fullName avatar status jobTitle' },
      {
        path: 'projectId',
        select: 'name color status progress priority assigneeId',
        populate: { path: 'assigneeId', select: 'fullName avatar' },
      },
    ]);
    emitToCompany(cid, 'channel:created', populated);
    res.status(201).json({ success: true, channel: populated });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const getChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, companyId: req.user!.companyId })
      .populate('members', 'fullName avatar status jobTitle')
      .populate({
        path: 'projectId',
        select: 'name color status progress priority assigneeId',
        populate: { path: 'assigneeId', select: 'fullName avatar' },
      });
    if (!channel) { res.status(404).json({ success: false, message: 'Channel not found' }); return; }
    res.json({ success: true, channel });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const updateChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const channel = await Channel.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      { $set: { description: req.body.description, name: req.body.name?.toLowerCase() } },
      { new: true }
    )
      .populate('members', 'fullName avatar status jobTitle')
      .populate({
        path: 'projectId',
        select: 'name color status progress priority assigneeId',
        populate: { path: 'assigneeId', select: 'fullName avatar' },
      });
    if (!channel) { res.status(404).json({ success: false, message: 'Channel not found' }); return; }
    emitToChannel(req.params.id, 'channel:updated', channel);
    res.json({ success: true, channel });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const joinChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.userId;
    const channel = await Channel.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId, type: 'public' },
      { $addToSet: { members: uid } }, { new: true }
    )
      .populate('members', 'fullName avatar status jobTitle')
      .populate({
        path: 'projectId',
        select: 'name color status progress priority assigneeId',
        populate: { path: 'assigneeId', select: 'fullName avatar' },
      });
    if (!channel) { res.status(404).json({ success: false, message: 'Channel not found' }); return; }
    emitToChannel(req.params.id, 'channel:member-joined', { userId: uid });
    res.json({ success: true, channel });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const leaveChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.userId;
    await Channel.findOneAndUpdate({ _id: req.params.id, companyId: req.user!.companyId }, { $pull: { members: new mongoose.Types.ObjectId(uid) } });
    emitToChannel(req.params.id, 'channel:member-left', { userId: uid });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId, page = 1, limit = 50, parentId } = req.query;
    const filter: any = { companyId: req.user!.companyId, deletedAt: null };
    if (channelId) filter.channelId = channelId;
    if (parentId) filter.parentId = parentId;

    const [total, messages] = await Promise.all([
      Message.countDocuments(filter),
      Message.find(filter)
        .populate('senderId', 'fullName avatar avatarStorageKey status')
        .populate('mentions', 'fullName')
        .populate({
          path: 'parentId',
          select: 'content senderId createdAt attachments',
          populate: { path: 'senderId', select: 'fullName avatar avatarStorageKey' },
        })
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
    ]);

    res.json({
      success: true,
      messages: await refreshAvatarUrls(messages.reverse()),
      total,
      hasMore: Number(page) * Number(limit) < total,
    });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId, content = '', type = 'text', parentId, mentions = [], attachments = [], clientMutationId } = req.body;
    if (!channelId || (!content.trim() && (!attachments || attachments.length === 0))) {
      res.status(400).json({ success: false, message: 'Message content or attachment required' });
      return;
    }
    const uid = req.user!.userId;
    const cid = req.user!.companyId;

    // ── Security: verify channel belongs to this company and user is a member ──
    const channel = await Channel.findOne({
      _id: channelId,
      companyId: cid,
      isArchived: false,
      $or: [{ type: 'public' }, { members: uid }],
    }).select('_id').lean();

    if (!channel) {
      res.status(403).json({ success: false, message: 'Channel not found or access denied' });
      return;
    }
    if (clientMutationId !== undefined && (typeof clientMutationId !== 'string' || !/^[\w-]{16,64}$/.test(clientMutationId))) {
      res.status(400).json({ success: false, message: 'Invalid message request ID.' });
      return;
    }
    if (clientMutationId) {
      const existing = await Message.findOne({ senderId: uid, clientMutationId }).populate([
        { path: 'senderId', select: 'fullName avatar avatarStorageKey status' },
        { path: 'parentId', select: 'content senderId createdAt attachments', populate: { path: 'senderId', select: 'fullName avatar avatarStorageKey' } },
      ]);
      if (existing) {
        res.status(200).json({ success: true, message: await refreshAvatarUrls(existing.toObject()) });
        return;
      }
    }

    // ── Input validation ──────────────────────────────────────────────────────
    const trimmedContent = String(content).trim().slice(0, 4000);
    if (!trimmedContent && (!attachments || attachments.length === 0)) {
      res.status(400).json({ success: false, message: 'Message content or attachment required' });
      return;
    }

    const resolvedType = attachments && attachments.length > 0
      ? (attachments[0].type?.startsWith('image/') ? 'image' : 'file')
      : type;

    const msg = await Message.create({
      companyId: cid,
      channelId,
      senderId: uid,
      clientMutationId,
      content: trimmedContent,
      type: resolvedType,
      parentId: parentId || null,
      mentions,
      attachments,
    });

    if (parentId) await Message.findByIdAndUpdate(parentId, { $inc: { threadCount: 1 } });

    const populated = await msg.populate([
      { path: 'senderId', select: 'fullName avatar avatarStorageKey status' },
      {
        path: 'parentId',
        select: 'content senderId createdAt attachments',
        populate: { path: 'senderId', select: 'fullName avatar avatarStorageKey' },
      },
    ]);

    const messageWithFreshAvatars = await refreshAvatarUrls(populated.toObject());
    emitToChannel(channelId, 'message:new', messageWithFreshAvatars);

    // notify mentions
    for (const muid of mentions) {
      await createNotification({
        companyId: cid,
        userId: muid.toString(),
        type: 'mention',
        title: 'You were mentioned',
        body: `${(populated.senderId as any).fullName} mentioned you in a channel`,
        actionUrl: `/chat?channelId=${channelId}`,
      });
    }
    res.status(201).json({ success: true, message: messageWithFreshAvatars });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await findAccessibleMessage(req, req.params.id);
    if (!msg || msg.senderId.toString() !== req.user!.userId) {
      res.status(404).json({ success: false, message: 'Message not found or not authorised' });
      return;
    }
    msg.content = req.body.content;
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    await msg.populate('senderId', 'callingId fullName avatar');
    // Emit to both channel rooms and DM rooms so both contexts get live updates
    if (msg.channelId) emitToChannel(msg.channelId.toString(), 'message:edited', msg);
    if (msg.conversationId) emitToDM(msg.conversationId.toString(), 'message:edited', msg);
    res.json({ success: true, message: msg });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await findAccessibleMessage(req, req.params.id);
    if (!msg) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    // Allow sender OR owner/admin to delete
    const isOwnerAdmin = ['owner', 'admin'].includes(req.user!.role);
    const isLocalWorkspaceAdmin = isOwnerAdmin && msg.companyId.toString() === req.user!.companyId;
    if (msg.senderId.toString() !== req.user!.userId && !isLocalWorkspaceAdmin) {
      res.status(403).json({ success: false, message: 'Not authorised to delete this message' }); return;
    }
    await Message.findByIdAndUpdate(req.params.id, { deletedAt: new Date(), content: 'This message was deleted' });
    if (msg.channelId) emitToChannel(msg.channelId.toString(), 'message:deleted', { _id: msg._id });
    if (msg.conversationId) emitToDM(msg.conversationId.toString(), 'message:deleted', { _id: msg._id });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const reactToMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { emoji } = req.body;
    const uid = req.user!.userId;
    const msg = await findAccessibleMessage(req, req.params.id);
    if (!msg) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    const existingReaction = msg.reactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      const uidObj = new mongoose.Types.ObjectId(uid);
      if (existingReaction.users.some(u => u.equals(uidObj))) {
        existingReaction.users = existingReaction.users.filter(u => !u.equals(uidObj));
        if (!existingReaction.users.length) msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      } else { existingReaction.users.push(new mongoose.Types.ObjectId(uid)); }
    } else { msg.reactions.push({ emoji, users: [new mongoose.Types.ObjectId(uid)] }); }
    await msg.save();
    if (msg.channelId) emitToChannel(msg.channelId.toString(), 'message:reaction', { messageId: msg._id, reactions: msg.reactions });
    if (msg.conversationId) emitToDM(msg.conversationId.toString(), 'message:reaction', { messageId: msg._id, reactions: msg.reactions });
    res.json({ success: true, reactions: msg.reactions });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

export const pinMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msg = await findAccessibleMessage(req, req.params.id);
    if (!msg) { res.status(404).json({ success: false, message: 'Message not found' }); return; }
    msg.isPinned = !msg.isPinned;
    await msg.save();
    if (msg.channelId) {
      await Channel.findByIdAndUpdate(msg.channelId, msg.isPinned ? { $addToSet: { pinnedMessages: msg._id } } : { $pull: { pinnedMessages: msg._id } });
      emitToChannel(msg.channelId.toString(), 'message:pinned', { messageId: msg._id, isPinned: msg.isPinned });
    }
    if (msg.conversationId) {
      emitToDM(msg.conversationId.toString(), 'message:pinned', { messageId: msg._id, isPinned: msg.isPinned });
    }
    res.json({ success: true, isPinned: msg.isPinned });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};
