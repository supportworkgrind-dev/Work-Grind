export type UserStatus = 'online' | 'away' | 'busy' | 'offline';
export type UserRole = 'owner' | 'admin' | 'manager' | 'employee' | 'guest';
export type WorkspaceProfile = 'developer' | 'creative' | 'marketing' | 'sales' | 'project_manager' | 'freelancer' | 'executive' | 'student' | 'professional';
export type WorkGrindTheme = 'original' | 'midnight' | 'slate' | 'forest' | 'ocean' | 'sand' | 'plum' | 'high-contrast' | 'light' | 'aurora' | 'graphite' | 'dark' | 'neutral' | WorkspaceProfile;

export interface User {
  _id: string;
  callingId?: string;
  fullName: string;
  email: string;
  avatar?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  country?: string;
  timeZone?: string;
  bio?: string;
  skills?: string[];
  status: UserStatus;
  isVerified: boolean;
  notificationPreferences?: {
    taskAssigned: boolean;
    meetingReminder: boolean;
    newMessage: boolean;
    dealUpdate: boolean;
  };
  preferredLanguage?: 'en' | 'ur' | 'ar' | 'fr' | 'de' | 'es' | 'zh' | 'hi';
  theme?: WorkGrindTheme;
  workspaceProfile?: WorkspaceProfile;
  isDeleted?: boolean;
  companyId?: string | Company;
  role: UserRole;
  isActive: boolean;
  accountType?: 'company' | 'individual';
  isSuperAdmin?: boolean;
  mfaEnabled?: boolean;
  lastSeen?: string;
  lastLogin?: string;
  createdAt: string;
  // Subscription fields
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SupportTicketReply {
  _id?: string;
  replyText: string;
  sentBy: string;
  sentAt: string;
  emailMessageId?: string;
}

export interface SupportTicket {
  _id: string;
  type?: 'contact' | 'demo';
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
  status: 'new' | 'replied' | 'closed' | 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead?: boolean;
  replies?: SupportTicketReply[];
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  _id: string;
  name: string;
  logo?: string;
  industry?: string;
  size?: string;
  country?: string;
  timeZone: string;
  ownerId: string;
  inviteCode?: string;
  accountType?: 'company' | 'individual';
  /** Legacy plan field */
  plan: 'free' | 'starter' | 'pro';
  storage: {
    used: number;
    limit: number;
  };
  settings: {
    allowGuestAccess: boolean;
    defaultRole: string;
  };
  // ── Company subscription fields ──────────────────────────────────────
  subscriptionStatus?: CompanySubscriptionStatus;
  subscriptionPlan?:   SubscriptionPlan;
  subscriptionStartDate?: string;
  subscriptionEndDate?:   string;
  pendingSubscriptionPlan?: SubscriptionPlan;
  pendingSubscriptionPlanEffectiveDate?: string;
  trialStartDate?: string;
  trialEndDate?:   string;
  cancelAtPeriodEnd?: boolean;
  isLifetime?: boolean;
  polarCustomerId?:     string;
  polarSubscriptionId?: string;
  coupon?: {
    code:       string;
    type:       'three_months_free' | 'lifetime';
    redeemedAt: string;
    freeUntil?: string;
  };
}

export type CompanySubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'lifetime'
  | 'none'
  | 'no_plan'
  | 'never_subscribed';

export interface Channel {
  _id: string;
  companyId: string;
  projectId?: Project | { _id: string; name: string; color: string; status: string; progress: number; priority?: string; assigneeId?: User };
  name: string;
  description?: string;
  type: 'public' | 'private';
  createdBy: string;
  members: User[];
  pinnedMessages?: string[];
  isDefault?: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  _id: string;
  clientMutationId?: string;
  companyId: string;
  channelId?: string;
  conversationId?: string;
  senderId: User;
  content: string;
  type: 'text' | 'file' | 'image' | 'voice' | 'system';
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  parentId?: string | Message;
  threadCount?: number;
  isPinned?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  mentions?: User[];
  createdAt: string;
}

export interface Conversation {
  _id: string;
  companyId: string;
  participants: User[];
  lastMessage?: Message;
  lastMessageAt?: string;
  isGroup: boolean;
  groupName?: string;
  unreadCounts?: { userId: string; count: number }[];
  myUnreadCount?: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';

export interface Subtask {
  _id: string;
  title: string;
  isCompleted: boolean;
  assigneeId?: string;
}

export interface TaskComment {
  _id: string;
  userId: User;
  content: string;
  createdAt: string;
}

export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface TaskTimeEntry {
  _id: string;
  userId: string | User;
  startedAt: string;
  stoppedAt?: string | null;
  durationSeconds: number;
}

export interface TaskCustomField {
  key: string;
  value: string;
}

export interface Task {
  _id: string;
  companyId: string;
  projectId?: { _id: string; name: string; color: string };
  title: string;
  description?: string;
  assigneeId?: User;
  creatorId: User;
  priority: TaskPriority;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  recurrence?: TaskRecurrence;
  dependencyIds?: string[];
  estimatedMinutes?: number;
  customFields?: TaskCustomField[];
  timeEntries?: TaskTimeEntry[];
  tags?: string[];
  subtasks?: Subtask[];
  comments?: TaskComment[];
  createdAt: string;
}

export interface Project {
  _id: string;
  companyId: string;
  crmCompanyId?: string | { _id: string; name: string; domain?: string; logoUrl?: string };
  name: string;
  description?: string;
  color: string;
  priority?: TaskPriority;
  managerId: User;
  assigneeId?: User;
  channelId?: string | Channel | { _id: string; name: string; type?: string; isArchived?: boolean };
  members: { userId: User; role: string }[];
  startDate?: string;
  deadline?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  progress: number;
  createdAt: string;
}

export interface Meeting {
  _id: string;
  companyId: string;
  title: string;
  description?: string;
  hostId: User;
  participants: { userId: User; status: string }[];
  projectId?: { _id: string; name: string; color: string };
  crmCompanyId?: CrmCompany | { _id: string; name: string; domain?: string };
  crmContactIds?: CrmContact[] | { _id: string; firstName: string; lastName: string; email?: string }[];
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  meetingLink: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  permissions?: { isHost: boolean; canJoin: boolean };
  aiSummary?: {
    summary: string;
    keyPoints: string[];
    decisions: string[];
    actionItems: { title: string; assignedTo?: string; deadline?: string; taskId?: string }[];
    generatedAt: string;
  };
  createdAt: string;
}

export interface CalendarEvent {
  _id: string;
  companyId: string;
  creatorId: User;
  title: string;
  description?: string;
  type: 'meeting' | 'task' | 'deadline' | 'event' | 'reminder';
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  videoLink?: string;
  attendees: User[];
  color?: string;
  meetingId?: { _id: string; meetingLink: string; title: string };
  projectId?: { _id: string; name: string; color: string };
}

export interface FileItem {
  _id: string;
  companyId: string;
  uploaderId: User;
  folderId?: string;
  projectId?: string | { _id: string; name: string; color?: string; crmCompanyId?: string | { _id: string; name: string } };
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  isStarred: boolean;
  tags?: string[];
  createdAt: string;
}

export interface FolderItem {
  _id: string;
  name: string;
  parentId?: string;
  color?: string;
  creatorId: User;
  createdAt: string;
}

export interface DocumentItem {
  _id: string;
  companyId: string;
  creatorId: User;
  title: string;
  projectId?: string | { _id: string; name: string; color?: string; crmCompanyId?: string | { _id: string; name: string } };
  content: string;
  type: 'document' | 'meeting_notes' | 'sop' | 'policy' | 'report';
  icon?: string;
  isPublic: boolean;
  versionHistory?: { version: number; content: string; editedBy: User; editedAt: string }[];
  comments?: { _id: string; userId: User; content: string; createdAt: string }[];
  lastEditedBy?: User;
  updatedAt: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  companyId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM
// ─────────────────────────────────────────────────────────────────────────────

export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'churned' | 'inactive';

export type DealStage =
  | 'new_lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DealActivityType = 'note' | 'email' | 'call' | 'meeting' | 'stage_change';

export interface CrmContact {
  _id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  crmCompanyId?: CrmCompany | { _id: string; name: string; domain?: string; logoUrl?: string };
  ownerId: User | { _id: string; fullName: string; avatar?: string; email?: string };
  status: ContactStatus;
  tags: string[];
  notes?: string;
  linkedInUrl?: string;
  avatarUrl?: string;
  dealIds: string[] | CrmDeal[];
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCompany {
  _id: string;
  companyId: string;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  ownerId: User | { _id: string; fullName: string; avatar?: string; email?: string };
  tags: string[];
  notes?: string;
  linkedInUrl?: string;
  contactCount?: number;           // computed by backend
  contacts?: Pick<CrmContact, '_id' | 'firstName' | 'lastName' | 'email' | 'jobTitle' | 'status' | 'avatarUrl'>[];
  createdAt: string;
  updatedAt: string;
}

export interface DealActivity {
  _id?: string;
  type: DealActivityType;
  content: string;
  createdBy: User | { _id: string; fullName: string; avatar?: string };
  createdAt: string;
}

export interface CrmDeal {
  _id: string;
  companyId: string;
  title: string;
  value?: number;
  currency: string;
  stage: DealStage;
  priority: DealPriority;
  contactId?: CrmContact | { _id: string; firstName: string; lastName: string; email?: string; avatarUrl?: string; jobTitle?: string };
  crmCompanyId?: CrmCompany | { _id: string; name: string; domain?: string; logoUrl?: string };
  ownerId: User | { _id: string; fullName: string; avatar?: string; email?: string };
  closeDate?: string;
  probability?: number;
  description?: string;
  tags: string[];
  lostReason?: string;
  activities: DealActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmPipelineStats {
  stageMap: Record<DealStage, { count: number; totalValue: number }>;
  totalPipelineValue: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  contactCount: number;
  companyCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription / Billing
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'none'
  | 'no_plan'
  | 'never_subscribed';

export type SubscriptionPlan = 'free' | 'starter' | 'pro';

export interface SubscriptionInfo {
  status:               SubscriptionStatus | CompanySubscriptionStatus;
  plan:                 SubscriptionPlan;
  planName:             string;
  priceDisplay:         string;
  trialStartDate?:      string;
  trialEndDate?:        string;
  trialDaysRemaining:   number | null;
  subscriptionStartDate?: string;
  subscriptionEndDate?:   string;
  pendingSubscriptionPlan?: SubscriptionPlan;
  pendingSubscriptionPlanEffectiveDate?: string;
  cancelAtPeriodEnd:    boolean;
  hasActiveAccess:      boolean;
  entitlements:         Record<string, boolean>;
  limits:               PlanLimits;
  usage: {
    members: number;
    pendingInvites: number;
    memberSlotsUsed: number;
    storageBytes: number;
    aiRequests: number;
    aiRequestsByUser: number;
  };
  isLifetime?:          boolean;
  coupon?: {
    code:       string;
    type:       'three_months_free' | 'lifetime';
    redeemedAt: string;
    freeUntil?: string;
  };
}

export interface PlanFeature {
  label:    string;
  included: boolean;
}

export interface PlanLimits {
  members:    number;
  storage:    number;
  aiRequests: number;
}

export type EntitlementId = 'crm' | 'tasksProjects' | 'teamChat' | 'meetingsCalendar' |
  'fileStorage' | 'aiAssistant' | 'prioritySupport' | 'advancedAnalytics';

export interface PlanConfig {
  id:           SubscriptionPlan;
  name:         string;
  priceMonthly: number;
  priceDisplay: string;
  description:  string;
  highlighted:  boolean;
  badgeLabel?:  string;
  entitlements: Record<EntitlementId, boolean>;
  limits:       PlanLimits;
  features:     PlanFeature[];
}
