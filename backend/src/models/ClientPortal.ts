import mongoose, { Document, Schema } from 'mongoose';

// ── Client Portal User (external — never mixed with internal User model) ──────

export interface IClientUser extends Document {
  _id:          mongoose.Types.ObjectId;
  companyId:    mongoose.Types.ObjectId; // Internal WorkGrind company they belong to
  email:        string;
  fullName:     string;
  password:     string;                  // bcrypt
  avatar?:      string;
  isActive:     boolean;
  isVerified:   boolean;
  inviteToken?: string;
  inviteExpiry?: Date;
  lastSeen?:    Date;
  /** Which internal projects/files/meetings they can access */
  sharedProjects: mongoose.Types.ObjectId[];
  sharedFiles:    mongoose.Types.ObjectId[];
  sharedMeetings: mongoose.Types.ObjectId[];
  sharedDocs:     mongoose.Types.ObjectId[];
  refreshTokens:  string[];
  createdAt: Date;
  updatedAt: Date;
}

const ClientUserSchema = new Schema<IClientUser>({
  companyId:   { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  fullName:    { type: String, required: true, trim: true },
  password:    { type: String, required: true, select: false },
  avatar:      String,
  isActive:    { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
  inviteToken: { type: String, select: false },
  inviteExpiry: Date,
  lastSeen:    Date,
  sharedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
  sharedFiles:    [{ type: Schema.Types.ObjectId, ref: 'File'    }],
  sharedMeetings: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }],
  sharedDocs:     [{ type: Schema.Types.ObjectId, ref: 'Document'}],
  refreshTokens:  [String],
}, { timestamps: true });

ClientUserSchema.index({ companyId: 1, email: 1 }, { unique: true });
ClientUserSchema.index({ inviteToken: 1 }, { sparse: true });

// bcrypt on save
import bcrypt from 'bcryptjs';
ClientUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

ClientUserSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const ClientUser = mongoose.model<IClientUser>('ClientUser', ClientUserSchema);

// ── Client Portal Message (simple messaging between client & internal team) ──

export interface IClientMessage extends Document {
  _id:          mongoose.Types.ObjectId;
  companyId:    mongoose.Types.ObjectId;
  clientUserId: mongoose.Types.ObjectId;
  senderType:   'client' | 'team';
  senderId:     mongoose.Types.ObjectId;  // ClientUser._id or User._id
  senderName:   string;
  content:      string;
  isRead:       boolean;
  createdAt:    Date;
}

const ClientMessageSchema = new Schema<IClientMessage>({
  companyId:    { type: Schema.Types.ObjectId, ref: 'Company',    required: true },
  clientUserId: { type: Schema.Types.ObjectId, ref: 'ClientUser', required: true },
  senderType:   { type: String, enum: ['client','team'], required: true },
  senderId:     { type: Schema.Types.ObjectId, required: true },
  senderName:   { type: String, required: true },
  content:      { type: String, required: true, maxlength: 4000 },
  isRead:       { type: Boolean, default: false },
}, { timestamps: true });

ClientMessageSchema.index({ companyId: 1, clientUserId: 1, createdAt: 1 });

export const ClientMessage = mongoose.model<IClientMessage>('ClientMessage', ClientMessageSchema);
