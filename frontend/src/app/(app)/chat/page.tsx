'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiErrorMessage';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { Channel, Conversation, Message, User } from '@/types';
import { useChatSound } from '@/lib/useChatSound';
import { useChatNotifications } from '@/lib/useChatNotifications';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { MessageAttachment } from '@/components/chat/MessageAttachment';
import { Avatar } from '@/components/common/Avatar';
import {
  Hash,
  Lock,
  Plus,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  Pin,
  Trash2,
  Edit2,
  Users,
  Search,
  MessageSquare,
  Sparkles,
  Briefcase,
  ArrowRight,
  ExternalLink,
  Reply,
  Volume2,
  VolumeX,
  Check,
  CheckCheck,
  X,
  FileText,
  UploadCloud,
  ChevronDown,
  Star,
  StarOff,
  Menu,
  UserRoundPlus,
  LoaderCircle,
  Bell,
  CornerDownRight,
  Clock,
  Circle,
  Flag,
} from 'lucide-react';
import { formatTimeAgo, formatDate, getInitials } from '@/lib/utils';

interface DmLookupUser {
  callingId: string;
  fullName: string;
  avatar?: string;
  jobTitle?: string;
}

function normalizeDmUserId(value: string): string {
  const trimmed = value.trim();
  if (/^\d{5,8}$/.test(trimmed)) return `WG-${trimmed}`;
  return trimmed.toUpperCase();
}

// Helper to render basic markdown (bold, italic, code, URLs)
function formatMessageContent(text: string) {
  if (!text) return null;

  // Split by inline code blocks first
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded px-1 py-0.5 font-mono text-[11px]" style={{ background: 'var(--bg-hover)', color: 'var(--accent-text)' }}>
          {part.slice(1, -1)}
        </code>
      );
    }

    // Replace bold **text** and italic *text*
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return <strong key={`${i}-${j}`} className="font-bold">{bPart.slice(2, -2)}</strong>;
      }

      // Check URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const subParts = bPart.split(urlRegex);
      return subParts.map((sPart, k) => {
        if (sPart.match(urlRegex)) {
          return (
            <a
              key={`${i}-${j}-${k}`}
              href={sPart}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center gap-0.5 break-all"
            >
              {sPart}
            </a>
          );
        }
        return sPart;
      });
    });
  });
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];

interface ChatSidebarResponses {
  channels: { success: boolean; channels: Channel[] };
  conversations: { success: boolean; conversations: Conversation[] };
}

const pendingChatSidebarRequests = new Map<string, Promise<ChatSidebarResponses>>();

function requestChatSidebar(userId: string): Promise<ChatSidebarResponses> {
  const pending = pendingChatSidebarRequests.get(userId);
  if (pending) return pending;

  const request = Promise.all([
    api.get<ChatSidebarResponses['channels']>('/channels'),
    api.get<ChatSidebarResponses['conversations']>('/direct-messages/conversations'),
  ]).then(([channels, conversations]) => ({
    channels: channels.data,
    conversations: conversations.data,
  })).finally(() => {
    if (pendingChatSidebarRequests.get(userId) === request) pendingChatSidebarRequests.delete(userId);
  });
  pendingChatSidebarRequests.set(userId, request);
  return request;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetChannelId = searchParams.get('channelId');
  const targetConversationId = searchParams.get('conversationId');

  const { user, isAtLimit, refreshSubscription } = useAuthStore();
  const storageLimitReached = isAtLimit('storage');
  const { openCreateModal } = useAppStore();
  const { isMuted, toggleMute, playChime } = useChatSound();
  const { notify } = useChatNotifications();

  // Primary Data
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Input & Reply State
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Attachments State
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ name: string; url: string; type: string; size: number }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time State
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> name
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [newDmUserId, setNewDmUserId] = useState('');
  const [newDmUser, setNewDmUser] = useState<DmLookupUser | null>(null);
  const [newDmError, setNewDmError] = useState('');
  const [newDmSearching, setNewDmSearching] = useState(false);
  const [newDmStarting, setNewDmStarting] = useState(false);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeMessageContextRef = useRef({ userId: user?._id || '', threadId: activeChannel?._id || activeConv?._id || '' });
  useEffect(() => {
    activeMessageContextRef.current = {
      userId: user?._id || '',
      threadId: activeChannel?._id || activeConv?._id || '',
    };
  }, [user?._id, activeChannel?._id, activeConv?._id]);

  // Load pinned IDs from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('workgrind_pinned_chat_ids');
        if (stored) setPinnedIds(new Set(JSON.parse(stored)));
      } catch (e) {}
    }
  }, []);

  const togglePinItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('workgrind_pinned_chat_ids', JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // Fetch Channels and Direct Messages
  const fetchSidebarData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const { channels: channelData, conversations: conversationData } = await requestChatSidebar(user._id);

      if (channelData.success) {
        const fetchedChannels = channelData.channels;
        setChannels(fetchedChannels);
      }
      if (conversationData.success) {
        const fetchedConversations = conversationData.conversations;
        setConversations(fetchedConversations);
        setUnreadCounts((current) => ({
          ...Object.fromEntries(
            fetchedConversations.map((conversation) => [
              conversation._id,
              current[conversation._id] ?? conversation.myUnreadCount ?? 0,
            ]),
          ),
        }));

        if (targetConversationId) {
          const matched = fetchedConversations.find((conversation) => conversation._id === targetConversationId);
          if (matched) {
            setActiveConv(matched);
            setActiveChannel(null);
            return;
          }
        }
      }

      if (targetChannelId && channelData.success) {
        const matched = channelData.channels.find((channel) => channel._id === targetChannelId);
        if (matched) {
          setActiveChannel(matched);
          setActiveConv(null);
          return;
        }
      }

      if (!activeChannel && !activeConv && channelData.success && channelData.channels.length > 0) {
        setActiveChannel(channelData.channels[0]);
      }
    } catch (err) {
      console.error(err);
    }
  }, [targetChannelId, targetConversationId, user?._id]);

  const findDmUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = normalizeDmUserId(newDmUserId);
    setNewDmUser(null);
    setNewDmError('');
    if (!/^WG-\d{5,8}$/.test(id)) {
      setNewDmError('Enter a valid WorkGrind User ID, such as WG-25724.');
      return;
    }
    setNewDmUserId(id);
    setNewDmSearching(true);
    try {
      const response = await api.get(`/users/public-id/${encodeURIComponent(id)}`);
      if (response.data?.success && response.data.user?.callingId === id) {
        setNewDmUser(response.data.user as DmLookupUser);
      } else {
        setNewDmError('That WorkGrind User ID could not be verified.');
      }
    } catch (error: unknown) {
      setNewDmError(getApiErrorMessage(
        error,
        'No active user was found with that WorkGrind User ID.',
      ));
    } finally {
      setNewDmSearching(false);
    }
  };

  const startDmWithFoundUser = async () => {
    if (!newDmUser || newDmStarting) return;
    setNewDmStarting(true);
    setNewDmError('');
    try {
      const response = await api.post('/direct-messages/conversations', { recipientCallingId: newDmUser.callingId });
      const conversation = response.data?.conversation as Conversation | undefined;
      if (!response.data?.success || !conversation?._id) {
        setNewDmError('The conversation could not be opened. Please try again.');
        return;
      }
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item._id !== conversation._id),
      ]);
      setActiveConv(conversation);
      setActiveChannel(null);
      setShowNewDm(false);
      setIsMobileSidebarOpen(false);
      setNewDmUserId('');
      setNewDmUser(null);
      router.push(`/chat?conversationId=${encodeURIComponent(conversation._id)}`);
    } catch (error: unknown) {
      setNewDmError(getApiErrorMessage(
        error,
        'This user is not currently available for direct messages.',
      ));
    } finally {
      setNewDmStarting(false);
    }
  };

  useEffect(() => {
    fetchSidebarData();
  }, [fetchSidebarData]);

  // Fetch Messages for active channel or conversation
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        if (activeChannel) {
          const res = await api.get(`/messages?channelId=${activeChannel._id}&limit=60`);
          if (res.data.success) setMessages(res.data.messages);
        } else if (activeConv) {
          const res = await api.get(`/direct-messages/${activeConv._id}/messages?limit=60`);
          if (res.data.success) setMessages(res.data.messages);
          // Mark conversation as read
          api.patch(`/direct-messages/${activeConv._id}/read`).catch(() => {});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
    setReplyingTo(null);
    setEditingMessageId(null);
    setShowScrollBottomPill(false);
    setIsMobileSidebarOpen(false);

    // Clear unread for current active
    const activeId = activeChannel?._id || activeConv?._id;
    if (activeId) {
      setUnreadCounts((prev) => ({ ...prev, [activeId]: 0 }));
    }
  }, [activeChannel, activeConv]);

  // Socket.io Setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join current room — joinRoom() is safe to call even before connect;
    // it will replay the join event once the connection is established.
    if (activeChannel) {
      joinRoom('channel:join', activeChannel._id);
    } else if (activeConv) {
      joinRoom('dm:join', activeConv._id);
    }

    // Online Status listeners
    const handleOnlineList = (ids: string[]) => {
      setOnlineUsers(new Set(ids));
    };

    const handleUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    };

    const handleUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    const handlePresenceSnapshot = ({ users }: { users: { userId: string; status: string }[] }) => {
      setOnlineUsers(new Set(users.filter((presence) => presence.status !== 'offline').map((presence) => presence.userId)));
    };
    const handlePresenceChanged = ({ userId, status }: { userId: string; status: string }) => {
      setOnlineUsers((previous) => {
        const next = new Set(previous);
        if (status === 'offline') next.delete(userId);
        else next.add(userId);
        return next;
      });
    };
    const requestPresenceSnapshot = () => socket.emit('presence:sync');

    // New Message handler — deduplicate by _id before appending
    const handleNewMessage = (msg: Message) => {
      const isForActiveChannel = activeChannel && msg.channelId === activeChannel._id;
      const isForActiveConv = activeConv && msg.conversationId === activeConv._id;

      if (isForActiveChannel || isForActiveConv) {
        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) =>
            m._id === msg._id ||
            (Boolean(msg.clientMutationId) && m.clientMutationId === msg.clientMutationId)
          );
          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = msg;
            return next;
          }
          return [...prev, msg];
        });

        // Play gentle chime if message is from another user
        if (msg.senderId?._id !== user?._id) {
          playChime();
          notify(
            activeChannel ? `#${activeChannel.name}` : (msg.senderId?.fullName || 'Direct Message'),
            `${msg.senderId?.fullName}: ${msg.content || 'Sent an attachment'}`
          );
        }
      } else {
        // Increment unread count for the other channel or DM
        const targetId = msg.channelId || msg.conversationId;
        if (targetId) {
          setUnreadCounts((prev) => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }));
          if (msg.senderId?._id !== user?._id) {
            playChime();
            notify(msg.senderId?.fullName || 'WorkGrind', msg.content || 'Sent an attachment');
          }
        }
      }
    };

    // Message updates
    const handleEditedMessage = (msg: Message) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    };

    const handleDeletedMessage = ({ _id }: { _id: string }) => {
      setMessages((prev) => prev.filter((m) => m._id !== _id));
    };

    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    const handlePin = ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isPinned } : m))
      );
    };

    // Typing indicators
    const handleTypingStart = ({ userId, userName, channelId, dmId }: any) => {
      const isForCurrent = (activeChannel && channelId === activeChannel._id) || (activeConv && dmId === activeConv._id);
      if (isForCurrent && userId !== user?._id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: userName || 'Someone' }));
      }
    };

    const handleTypingStop = ({ userId, channelId, dmId }: any) => {
      const isForCurrent = (activeChannel && channelId === activeChannel._id) || (activeConv && dmId === activeConv._id);
      if (isForCurrent) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };

    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('presence:snapshot', handlePresenceSnapshot);
    socket.on('user:presence', handlePresenceChanged);
    socket.on('connect', requestPresenceSnapshot);
    if (socket.connected) requestPresenceSnapshot();
    socket.on('message:new', handleNewMessage);
    socket.on('dm:message', handleNewMessage);
    socket.on('message:edited', handleEditedMessage);
    socket.on('message:deleted', handleDeletedMessage);
    socket.on('message:reaction', handleReaction);
    socket.on('message:pinned', handlePin);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    // dm:notification — backend emits this to non-active-conversation participants.
    // Increment unread count for the conversation so the sidebar badge updates.
    const handleDmNotification = ({ conversationId, message: incomingMsg }: any) => {
      if (!activeConv || activeConv._id !== conversationId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || 0) + 1,
        }));
        if (incomingMsg?.senderId?._id !== user?._id) {
          playChime();
          notify(
            incomingMsg?.senderId?.fullName || 'Direct Message',
            incomingMsg?.content || 'Sent an attachment'
          );
        }
      }
    };
    socket.on('dm:notification', handleDmNotification);

    return () => {
      if (activeChannel) leaveRoom('channel:leave', activeChannel._id);
      if (activeConv) leaveRoom('dm:leave', activeConv._id);
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('presence:snapshot', handlePresenceSnapshot);
      socket.off('user:presence', handlePresenceChanged);
      socket.off('connect', requestPresenceSnapshot);
      socket.off('message:new', handleNewMessage);
      socket.off('dm:message', handleNewMessage);
      socket.off('message:edited', handleEditedMessage);
      socket.off('message:deleted', handleDeletedMessage);
      socket.off('message:reaction', handleReaction);
      socket.off('message:pinned', handlePin);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('dm:notification', handleDmNotification);
    };
  }, [activeChannel, activeConv, user, playChime, notify]);

  // Smart Auto-scroll: Only scroll to bottom if user is near bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowScrollBottomPill(false);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom('smooth');
    } else if (messages.length > 0) {
      setShowScrollBottomPill(true);
    }
  }, [messages]);

  const handleContainerScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      setShowScrollBottomPill(false);
    }
  };

  // Typing Emitter
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Auto resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    const socket = getSocket();
    if (!socket) return;

    const payload = {
      channelId: activeChannel?._id,
      dmId: activeConv?._id,
      userName: user?.fullName,
    };

    socket.emit('typing:start', payload);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      const s = getSocket();
      if (s) s.emit('typing:stop', {
        channelId: activeChannel?._id,
        dmId: activeConv?._id,
      });
    }, 1500);
  };

  // File Upload Handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (storageLimitReached) {
      window.dispatchEvent(new CustomEvent('workgrind:upgrade-required', {
        detail: { message: 'Your workspace storage limit is reached. Upgrade your plan to attach more files.' },
      }));
      return;
    }
    setIsUploading(true);
    setUploadError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', 'root');

        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data.success && res.data.file) {
          void refreshSubscription();
          const uploaded = res.data.file;
          setPendingAttachments((prev) => [
            ...prev,
            {
              name: uploaded.name,
              url: uploaded.url,
              type: uploaded.mimeType || file.type,
              size: uploaded.size || file.size,
            },
          ]);
        }
      }
    } catch (err) {
      console.error('File upload error:', err);
      setUploadError(getApiErrorMessage(err, 'File could not be attached.'));
    } finally {
      setIsUploading(false);
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && pendingAttachments.length === 0) return;

    const content = inputText.trim();
    const attachments = [...pendingAttachments];
    const parentId = replyingTo?._id;
    const conversation = activeConv;
    const channel = activeChannel;
    const sender = user;
    if (!sender || (!conversation && !channel)) return;
    const threadId = channel?._id || conversation!._id;
    const clientMutationId = crypto.randomUUID();
    const companyId = typeof sender.companyId === 'string' ? sender.companyId : sender.companyId?._id || '';
    const optimisticMessage: Message = {
      _id: `optimistic:${clientMutationId}`,
      clientMutationId,
      companyId,
      ...(channel ? { channelId: channel._id } : { conversationId: conversation!._id }),
      senderId: sender,
      content,
      type: attachments.length ? (attachments[0].type.startsWith('image/') ? 'image' : 'file') : 'text',
      attachments,
      reactions: [],
      ...(parentId ? { parentId } : {}),
      createdAt: new Date().toISOString(),
    };

    // Reset inputs immediately for optimistic feel
    setInputText('');
    setPendingAttachments([]);
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((previous) => [...previous, optimisticMessage]);

    // Stop typing indicator immediately
    const socket = getSocket();
    if (socket) {
      socket.emit('typing:stop', {
        channelId: activeChannel?._id,
        dmId: activeConv?._id,
      });
    }

    try {
      const response = channel
        ? await api.post('/messages', {
          channelId: channel._id,
          content,
          attachments,
          parentId,
          clientMutationId,
        })
        : await api.post(`/direct-messages/${conversation!._id}/messages`, {
          content,
          attachments,
          parentId,
          clientMutationId,
        });
      const currentContext = activeMessageContextRef.current;
      if (currentContext.userId !== sender._id || currentContext.threadId !== threadId) return;
      const savedMessage = response.data?.message as Message | undefined;
      if (!savedMessage) throw new Error('The server did not return the saved message.');
      setMessages((previous) => {
        const existingIndex = previous.findIndex((message) =>
          message._id === optimisticMessage._id ||
          message._id === savedMessage._id ||
          message.clientMutationId === clientMutationId
        );
        if (existingIndex === -1) return [...previous, savedMessage];
        const next = [...previous];
        next[existingIndex] = savedMessage;
        return next;
      });
    } catch (err) {
      console.error(err);
      const currentContext = activeMessageContextRef.current;
      if (currentContext.userId === sender._id && currentContext.threadId === threadId) {
        setMessages((previous) => previous.filter((message) => message._id !== optimisticMessage._id));
        setInputText((previous) => previous || content);
        setPendingAttachments((previous) => previous.length ? previous : attachments);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Message Actions — route correctly to DM or channel endpoint
  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;
    try {
      const endpoint = activeConv
        ? `/direct-messages/${activeConv._id}/messages/${messageId}`
        : `/messages/${messageId}`;
      await api.patch(endpoint, { content: editContent.trim() });
      setEditingMessageId(null);
      setEditContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const endpoint = activeConv
        ? `/direct-messages/${activeConv._id}/messages/${messageId}`
        : `/messages/${messageId}`;
      await api.delete(endpoint);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const endpoint = activeConv
        ? `/direct-messages/${activeConv._id}/messages/${messageId}/react`
        : `/messages/${messageId}/react`;
      await api.post(endpoint, { emoji });
      setActiveReactionMsgId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      const endpoint = activeConv
        ? `/direct-messages/${activeConv._id}/messages/${messageId}/pin`
        : `/messages/${messageId}/pin`;
      await api.post(endpoint, {});
    } catch (err) {
      console.error(err);
    }
  };

  const handleReportMessage = async (messageId: string, content: string) => {
    const reason = prompt(
      'Report reason:\n1. harassment\n2. spam\n3. inappropriate_content\n4. hate_speech\n5. violence\n6. privacy_violation\n7. other\n\nType the reason:'
    );
    const validReasons = ['harassment','spam','inappropriate_content','hate_speech','violence','privacy_violation','other'];
    if (!reason || !validReasons.includes(reason.toLowerCase().replace(/\s+/g,'_'))) return;
    const details = prompt('Additional details (optional):') || undefined;
    try {
      await api.post('/moderation/reports', {
        targetType: 'message',
        targetId: messageId,
        reason: reason.toLowerCase().replace(/\s+/g,'_'),
        details,
      });
      alert('Report submitted. Our moderators will review it shortly.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to submit report.');
    }
  };

  const getRecipientUser = (conv: Conversation) => {
    return conv.participants?.find((p) => p._id !== user?._id);
  };

  const getRecipientName = (conv: Conversation) => {
    if (conv.isGroup && conv.groupName) return conv.groupName;
    const other = getRecipientUser(conv);
    return other?.fullName || 'Direct Message';
  };

  // Filtering and categorizing channels
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChannels = filteredChannels.filter((c) => pinnedIds.has(c._id));
  const projectChannels = filteredChannels.filter((c) => !!c.projectId && !pinnedIds.has(c._id));
  const regularChannels = filteredChannels.filter((c) => !c.projectId && !pinnedIds.has(c._id));

  const filteredConversations = conversations.filter((conv) =>
    getRecipientName(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const linkedProject =
    activeChannel && typeof activeChannel.projectId === 'object' && activeChannel.projectId
      ? (activeChannel.projectId as any)
      : null;

  const otherUserInDM = activeConv ? getRecipientUser(activeConv) : null;
  const isRecipientOnline = otherUserInDM ? onlineUsers.has(otherUserInDM._id) : false;

  const typingNames = Object.values(typingUsers);
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length > 1
      ? `${typingNames.join(', ')} are typing...`
      : null;

  return (
    <div
      className="chat-workspace relative flex h-[calc(100dvh-8rem)] min-h-[34rem] overflow-hidden rounded-2xl border shadow-[var(--shadow-lg)]"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-600/90 text-[var(--text-on-accent)] backdrop-blur-xs animate-in fade-in duration-150">
          <UploadCloud className="h-16 w-16 animate-bounce stroke-1" />
          <p className="mt-4 text-lg font-bold">Drop files here to upload & attach</p>
          <p className="text-xs text-indigo-200 mt-1">Images, PDFs, documents up to 50MB</p>
        </div>
      )}
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close conversations"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="absolute inset-0 z-20 bg-slate-950/35 backdrop-blur-[1px] md:hidden"
        />
      )}

      {/* ── SIDEBAR: Channels & Conversations ── */}
      <div
        className={`absolute inset-y-0 left-0 z-30 flex w-[min(20rem,88vw)] shrink-0 flex-col transition-transform duration-200 md:static md:w-72 ${
          isMobileSidebarOpen
            ? 'translate-x-0 shadow-2xl'
            : 'hidden md:flex'
        }`}
        style={{ borderRight: '1px solid var(--border-color)', background: 'var(--bg-sidebar)' }}
      >
        {/* Search Header */}
        <div className="border-b p-4 sm:p-5" style={{ borderColor: 'var(--border-color)' }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 theme-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Jump to channel or DM..."
              className="w-full rounded-xl border py-2 pl-9 pr-8 text-xs theme-text-primary outline-none transition-all placeholder:theme-text-muted focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)]"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Channels & DM Categories Feed */}
        <div className="flex-1 space-y-5 overflow-y-auto p-3 scrollbar-thin">
          {/* Pinned Section (if any) */}
          {pinnedChannels.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                <span>Pinned Channels</span>
              </div>
              <div className="space-y-1">
                {pinnedChannels.map((ch) => (
                  <div
                    key={ch._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveChannel(ch);
                      setActiveConv(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveChannel(ch);
                        setActiveConv(null);
                      }
                    }}
                    className={`group/ch flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                      activeChannel?._id === ch._id
                        ? 'bg-[var(--accent-subtle)] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent)]/15'
                        : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {unreadCounts[ch._id] > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                          {unreadCounts[ch._id]}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => togglePinItem(ch._id, e)}
                        className="opacity-0 group-hover/ch:opacity-100 p-0.5 hover:scale-110"
                        title="Unpin"
                      >
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Channels */}
          {projectChannels.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" />
                  <span>Projects</span>
                </span>
                <span className="text-[10px] font-medium text-slate-400">{projectChannels.length}</span>
              </div>
              <div className="space-y-1">
                {projectChannels.map((ch) => (
                  <div
                    key={ch._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveChannel(ch);
                      setActiveConv(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveChannel(ch);
                        setActiveConv(null);
                      }
                    }}
                    className={`group/ch flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                      activeChannel?._id === ch._id
                        ? 'bg-[var(--accent-subtle)] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent)]/15'
                        : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Briefcase className={`h-3.5 w-3.5 shrink-0 ${activeChannel?._id === ch._id ? 'text-white' : 'text-indigo-500'}`} />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {unreadCounts[ch._id] > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                          {unreadCounts[ch._id]}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => togglePinItem(ch._id, e)}
                        className="opacity-0 group-hover/ch:opacity-100 p-0.5 hover:scale-110 text-slate-400 hover:text-amber-500"
                        title="Pin Channel"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General & Public Channels */}
          <div>
            <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Channels</span>
              {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  onClick={() => openCreateModal('channel')}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  title="Create Channel"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {regularChannels.map((ch) => (
                <div
                  key={ch._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveChannel(ch);
                    setActiveConv(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveChannel(ch);
                      setActiveConv(null);
                    }
                  }}
                  className={`group/ch flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                    activeChannel?._id === ch._id
                    ? 'bg-[var(--accent-subtle)] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent)]/15'
                    : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {ch.type === 'private' ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{ch.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unreadCounts[ch._id] > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {unreadCounts[ch._id]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => togglePinItem(ch._id, e)}
                      className="opacity-0 group-hover/ch:opacity-100 p-0.5 hover:scale-110 text-slate-400 hover:text-amber-500"
                      title="Pin Channel"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div>
          <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span>Direct Messages</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-400">{filteredConversations.length}</span>
              <button
                type="button"
                onClick={() => { setShowNewDm(true); setNewDmError(''); }}
                className="rounded-lg p-1 theme-text-muted transition hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)]"
                title="Start a direct message by user ID"
                aria-label="Start a direct message by user ID"
              >
                <UserRoundPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
            <div className="space-y-1">
              {filteredConversations.length === 0 ? (
                <p className="px-2 text-[11px] text-slate-400 py-1 italic">No direct messages</p>
              ) : (
                filteredConversations.map((conv) => {
                  const otherUser = getRecipientUser(conv);
                  const isOnline = otherUser ? onlineUsers.has(otherUser._id) : false;

                  return (
                    <button
                      key={conv._id}
                      onClick={() => {
                        setActiveConv(conv);
                        setActiveChannel(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                        activeConv?._id === conv._id
                        ? 'bg-[var(--accent-subtle)] font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent)]/15'
                        : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="relative shrink-0">
                          <Avatar name={getRecipientName(conv)} src={otherUser?.avatar || undefined} size="xs" shape="circle" />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            style={{ ['--tw-ring-color' as string]: 'var(--bg-sidebar)' }}
                          />
                        </div>
                        <span className="truncate">{getRecipientName(conv)}</span>
                      </div>

                      {unreadCounts[conv._id] > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                          {unreadCounts[conv._id]}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showNewDm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewDm(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="new-dm-title" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl theme-bg-card theme-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-dm-title" className="text-base font-bold theme-text-primary">Start a direct message</h2>
                <p className="mt-1 text-xs theme-text-muted">Find an active user using their public WorkGrind User ID.</p>
              </div>
              <button type="button" onClick={() => setShowNewDm(false)} className="rounded-lg p-1.5 theme-text-muted hover:bg-[var(--bg-hover)]" aria-label="Close new direct message">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(event) => void findDmUser(event)} className="mt-4 space-y-2">
              <label htmlFor="new-dm-user-id" className="block text-xs font-medium theme-text-secondary">WorkGrind User ID</label>
              <div className="flex gap-2">
                <input
                  id="new-dm-user-id"
                  value={newDmUserId}
                  onChange={(event) => { setNewDmUserId(event.target.value.trim()); setNewDmUser(null); setNewDmError(''); }}
                  placeholder="WG-25724"
                  maxLength={11}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 font-mono text-xs theme-text-primary outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)]"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}
                />
                <button type="submit" disabled={newDmSearching} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white disabled:opacity-60">
                  {newDmSearching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Find
                </button>
              </div>
            </form>
            <p className="mt-2 text-[11px] theme-text-muted">Messaging is available with active WorkGrind users across workspaces.</p>
            {newDmError && <p role="alert" className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">{newDmError}</p>}
            {newDmUser && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sunken)' }}>
                <Avatar name={newDmUser.fullName} src={newDmUser.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold theme-text-primary">{newDmUser.fullName}</p>
                  <p className="truncate font-mono text-[10px] theme-text-muted">WorkGrind User ID · {newDmUser.callingId}</p>
                  <p className="truncate text-xs theme-text-muted">{newDmUser.jobTitle || 'WorkGrind user'}</p>
                  <p className="mt-1 text-[10px] font-medium text-emerald-600">Active WorkGrind user · direct message available</p>
                </div>
                <button type="button" onClick={() => void startDmWithFoundUser()} disabled={newDmStarting} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-white disabled:opacity-60">
                  {newDmStarting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  Open DM
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── MAIN CHAT AREA ── */}
      <div className="relative flex min-w-0 flex-1 flex-col" style={{ background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-sunken) 100%)' }}>
        {/* Top Header */}
        <div className="z-10 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-sm sm:px-6" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-navbar)' }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="rounded-lg border p-1.5 theme-text-secondary hover:bg-[var(--bg-hover)] md:hidden"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Menu className="h-4 w-4" />
            </button>

            {activeChannel ? (
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                  {activeChannel.type === 'private' ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold theme-text-primary">#{activeChannel.name}</h2>
                    {activeChannel.isDefault && (
                      <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-bold theme-text-muted">Default</span>
                    )}
                  </div>
                  {activeChannel.description && (
                    <p className="hidden max-w-md truncate text-[11px] theme-text-muted sm:block">
                      {activeChannel.description}
                    </p>
                  )}
                </div>
              </div>
            ) : activeConv ? (
              <div className="flex items-center gap-2.5 truncate">
                <div className="relative shrink-0">
                  <Avatar name={getRecipientName(activeConv)} src={otherUserInDM?.avatar || undefined} size="sm" shape="circle" />
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ${
                      isRecipientOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    style={{ ['--tw-ring-color' as string]: 'var(--bg-card)' }}
                  />
                </div>
                <div>
                  <h2 className="truncate text-sm font-bold theme-text-primary">{getRecipientName(activeConv)}</h2>
                  <p className="text-[10px] theme-text-muted">
                    {isRecipientOnline ? 'Active now' : 'Offline'}
                  </p>
                </div>
              </div>
            ) : (
              <h2 className="text-sm font-bold theme-text-primary">Select a conversation</h2>
            )}
          </div>

          {/* Action Bar (Audio Mute, Member count) */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            <button
              onClick={toggleMute}
              className={`rounded-xl border p-1.5 transition-colors ${
                isMuted
                  ? 'theme-text-muted hover:bg-[var(--bg-hover)]'
                  : 'text-[var(--accent-text)]'
              }`}
              style={{ borderColor: 'var(--border-color)', background: isMuted ? 'var(--bg-sunken)' : 'var(--accent-subtle)' }}
              title={isMuted ? 'Unmute chat sounds' : 'Mute chat sounds'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {activeChannel && (
              <span className="hidden items-center gap-1.5 rounded-xl border px-2.5 py-1 font-medium theme-text-secondary sm:flex" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sunken)' }}>
                <Users className="h-3.5 w-3.5 theme-text-muted" />
                <span>{activeChannel.members?.length || 1} members</span>
              </span>
            )}
          </div>
        </div>

        {/* Project Banner (if tied to project) */}
        {linkedProject && (
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50/50 to-slate-50 border-b border-indigo-100/80 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 shrink-0 text-xs">
            <div className="flex items-center gap-2.5 truncate">
              <span className="flex items-center gap-1 rounded-md bg-indigo-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 shrink-0">
                <Briefcase className="h-3 w-3" />
                Project
              </span>
              <span className="font-bold text-slate-900 truncate">{linkedProject.name}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 truncate">{linkedProject.progress || 0}% completed</span>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 rounded-xl bg-white border border-indigo-200/80 px-2.5 py-1 font-semibold text-indigo-600 shadow-2xs hover:bg-indigo-50 transition-colors shrink-0"
            >
              <span>View Roadmap</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── MESSAGE THREAD FEED ── */}
        <div
          ref={messagesContainerRef}
          onScroll={handleContainerScroll}
          className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin sm:px-8 sm:py-6"
        >
          {isLoadingMessages ? (
            /* Skeleton Loading */
            <div className="space-y-4 animate-pulse py-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="h-9 w-9 shrink-0 rounded-xl" style={{ background: 'var(--bg-hover)' }} />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-32 rounded" style={{ background: 'var(--bg-hover)' }} />
                    <div className="h-10 w-3/4 rounded-2xl" style={{ background: 'var(--bg-sunken)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
            <div className="flex h-full flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--accent-subtle)] text-[var(--accent)] shadow-sm">
                <MessageSquare className="h-7 w-7 stroke-1" />
              </div>
              <h3 className="text-base font-bold theme-text-primary">
                {activeChannel ? `Welcome to #${activeChannel.name}!` : 'Start this conversation!'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed theme-text-secondary">
                This is the very beginning of the thread. Send a message, share files, or brainstorm ideas with your team.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['👋 Say hello!', '🚀 Share sprint goals', '📋 Post an update'].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border px-3 py-1.5 text-xs font-medium theme-text-secondary transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-text)]"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List with Grouping */
            messages.map((msg, index) => {
              const isMe = msg.senderId?._id === user?._id;
              const isEditing = editingMessageId === msg._id;

              // Grouping Logic: Same sender within 5 minutes
              const prevMsg = messages[index - 1];
              const isSameSenderAsPrev = prevMsg && prevMsg.senderId?._id === msg.senderId?._id;
              const timeDiff = prevMsg
                ? Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime())
                : Infinity;
              const isGrouped = isSameSenderAsPrev && timeDiff < 5 * 60 * 1000;

              // Quoted parent message
              const parentMessage = typeof msg.parentId === 'object' ? (msg.parentId as any) : null;

              return (
                <div
                  key={msg._id}
                  className={`group relative rounded-2xl px-2.5 py-2 transition-colors animate-in fade-in-50 duration-150 hover:bg-[var(--bg-hover)] ${
                    isGrouped ? 'mt-0' : 'mt-2'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    {/* Avatar Column */}
                    <div className="flex w-8 shrink-0 justify-center">
                      {!isGrouped ? (
                        <Avatar name={msg.senderId?.fullName || 'User'} src={msg.senderId?.avatar || undefined} size="sm" />
                      ) : (
                        <span className="hidden group-hover:block text-[9px] text-slate-400 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Message Body */}
                    <div className="flex-1 min-w-0">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-bold theme-text-primary">
                            {msg.senderId?.fullName}
                          </span>
                          {isMe && (
                            <span className="rounded-md bg-[var(--accent-subtle)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-text)]">You</span>
                          )}
                          <span className="text-[10px] theme-text-muted">
                            {formatTimeAgo(msg.createdAt)}
                          </span>
                          {msg.isPinned && (
                            <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">
                              <Pin className="h-2.5 w-2.5" /> Pinned
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quoted Message (Reply Preview) */}
                      {parentMessage && !isGrouped && (
                        <div className="mb-1.5 flex max-w-xl items-center gap-2 rounded-xl border-l-2 border-[var(--accent)] px-3 py-1.5 text-xs theme-text-secondary" style={{ background: 'var(--bg-sunken)' }}>
                          <CornerDownRight className="h-3 w-3 text-indigo-500 shrink-0" />
                          <span className="truncate text-[11px] font-semibold theme-text-primary">
                            {parentMessage.senderId?.fullName || 'Original message'}:
                          </span>
                          <span className="truncate text-[11px] theme-text-muted">
                            {parentMessage.content || '[Attachment]'}
                          </span>
                        </div>
                      )}

                      {/* Content / Edit Mode */}
                      {isEditing ? (
                        <div className="mt-1 space-y-2 max-w-xl">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full rounded-xl border border-indigo-300 p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMessage(msg._id)}
                              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel (Esc)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`max-w-3xl break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                              isMe ? 'rounded-tr-md text-white shadow-sm' : 'rounded-tl-md theme-text-primary'
                            }`}
                            style={isMe ? { background: 'var(--accent)' } : { background: 'var(--bg-sunken)' }}
                          >
                            {formatMessageContent(msg.content)}
                            {msg.isEdited && (
                              <span className="ml-1.5 text-[10px] text-slate-400 italic">(edited)</span>
                            )}
                          </div>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-1.5 space-y-1.5">
                              {msg.attachments.map((att, attIdx) => (
                                <MessageAttachment key={attIdx} attachment={att} />
                              ))}
                            </div>
                          )}

                          {/* Reactions row */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.reactions.map((r, rIdx) => {
                                const hasReacted = r.users?.includes(user?._id as any);
                                return (
                                  <button
                                    key={rIdx}
                                    onClick={() => handleReaction(msg._id, r.emoji)}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-all ${
                                      hasReacted
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 font-bold'
                                        : 'theme-text-secondary hover:bg-[var(--bg-hover)]'
                                    }`}
                                    style={!hasReacted ? { borderColor: 'var(--border-color)', background: 'var(--bg-card)' } : {}}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.users?.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delivery ticks for my messages */}
                    {isMe && !isEditing && (
                      <div className="shrink-0 pt-0.5 opacity-60 group-hover:opacity-100" title="Delivered">
                        <CheckCheck className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                    )}
                  </div>

                  {/* ── Hover Action Bar (Slack / Discord style) ── */}
                  {!isEditing && (
                    <div className="absolute right-3 -top-3 hidden group-hover:flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-md z-20 animate-in fade-in-50 zoom-in-95 duration-100">
                      {/* Quick Reactions */}
                      {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg._id, emoji)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-sm hover:bg-slate-100 transition-transform active:scale-90"
                          title={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}

                      <div className="h-4 w-px bg-slate-200 mx-0.5" />

                      {/* Full Emoji Picker button */}
                      <button
                        onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg._id ? null : msg._id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title="Add Reaction"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>

                      {/* Reply */}
                      <button
                        onClick={() => {
                          setReplyingTo(msg);
                          textareaRef.current?.focus();
                        }}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title="Reply / Quote"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>

                      {/* Pin */}
                      <button
                        onClick={() => handlePin(msg._id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>

                      {/* Edit & Delete (My messages only) */}
                      {isMe && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessageId(msg._id);
                              setEditContent(msg.content);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            title="Edit message"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg._id)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-rose-500 hover:text-rose-700"
                            title="Delete message"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {/* Report (other people's messages only) */}
                      {!isMe && (
                        <button
                          onClick={() => handleReportMessage(msg._id, msg.content)}
                          className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Report message"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Emoji Picker Popover */}
                      {activeReactionMsgId === msg._id && (
                        <div className="absolute right-0 top-8 z-50">
                          <EmojiPicker
                            onSelect={(emoji) => handleReaction(msg._id, emoji)}
                            onClose={() => setActiveReactionMsgId(null)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom pill button */}
        {showScrollBottomPill && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-24 right-8 z-30 flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <ChevronDown className="h-4 w-4" />
            <span>New messages</span>
          </button>
        )}

        {/* Typing indicator */}
        <div className="flex h-5 shrink-0 items-center px-4 text-[11px] italic theme-text-muted sm:px-6">
          {typingText && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
              {typingText}
            </span>
          )}
        </div>

        {/* ── MESSAGE INPUT AREA (Modern Multi-line Box) ── */}
        <div className="shrink-0 border-t p-2.5 sm:p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          {/* Reply Quote Banner */}
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs animate-in fade-in duration-150 theme-text-secondary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sunken)' }}>
              <div className="flex items-center gap-2 truncate">
                <Reply className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="truncate font-bold theme-text-primary">
                  Replying to {replyingTo.senderId?.fullName}:
                </span>
                <span className="truncate theme-text-muted">{replyingTo.content || '[Attachment]'}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {uploadError && <p role="alert" className="mb-2 text-xs text-rose-600">{uploadError}</p>}

          {/* Pending Upload Attachments Chips */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs shadow-2xs theme-text-primary"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--accent-subtle)' }}
                >
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="truncate max-w-xs font-medium">{att.name}</span>
                  <button
                    onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input Form */}
          <div className="relative rounded-2xl border p-2.5 shadow-sm transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-glow)] sm:p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sunken)' }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}... (Shift+Enter for new line)`
                  : activeConv
                  ? `Message ${getRecipientName(activeConv)}...`
                  : 'Select a conversation to start typing...'
              }
              disabled={!activeChannel && !activeConv}
              rows={1}
              className="min-h-16 max-h-36 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 theme-text-primary placeholder:theme-text-muted focus:outline-none scrollbar-thin"
            />

            {/* Input Action Bar */}
            <div className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-1">
                {/* Paperclip upload button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  multiple
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || storageLimitReached || (!activeChannel && !activeConv)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg theme-text-secondary transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)] disabled:opacity-40"
                  title={storageLimitReached ? 'Storage limit reached; upgrade to attach files' : 'Attach Files'}
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Emoji Picker Toggle */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={!activeChannel && !activeConv}
                    className="flex h-8 w-8 items-center justify-center rounded-lg theme-text-secondary transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)] disabled:opacity-40"
                    title="Insert Emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute bottom-10 left-0 z-50">
                      <EmojiPicker
                        onSelect={(emoji) => {
                          setInputText((prev) => prev + emoji);
                          textareaRef.current?.focus();
                        }}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>

                {isUploading && (
                  <span className="ml-2 flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)]">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                    Uploading...
                  </span>
                )}
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputText.trim() && pendingAttachments.length === 0) || isUploading}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-sm transition-all hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                title="Send message (Enter)"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
