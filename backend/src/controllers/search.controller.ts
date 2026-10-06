/**
 * Universal Search Controller
 * Searches across all entity types within the authenticated user's company.
 * SECURITY: companyId always from req.user. DM content never exposed.
 */

import { Response } from 'express';
import User from '../models/User';
import Task from '../models/Task';
import Project from '../models/Project';
import Message from '../models/Message';
import File from '../models/File';
import Document from '../models/Document';
import Channel from '../models/Channel';
import Meeting from '../models/Meeting';
import CalendarEvent from '../models/CalendarEvent';
import { CrmContact } from '../models/CrmContact';
import { CrmDeal } from '../models/CrmDeal';
import { CrmCompany } from '../models/CrmCompany';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

export const globalSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, type } = req.query;

    const query = typeof q === 'string' ? q.trim() : '';
    if (!query || query.length < 2) {
      res.json({
        success: true,
        results: {
          people: [], tasks: [], projects: [], channels: [],
          messages: [], files: [], documents: [], meetings: [],
          calendarEvents: [], contacts: [], deals: [], crmCompanies: [],
        },
        total: 0,
      });
      return;
    }

    const companyId   = req.user!.companyId;
    const companyOId  = new mongoose.Types.ObjectId(companyId);

    // Escape regex special chars to prevent ReDoS
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queryRegex = { $regex: escaped, $options: 'i' };

    const should = (cat: string) => !type || type === 'all' || type === cat;

    const [
      people, tasks, projects, channels, messages,
      files, documents, meetings, calendarEvents,
      contacts, deals, crmCompanies,
    ] = await Promise.all([

      should('people') ? User.find({
        companyId: companyOId, isActive: true,
        $or: [{ fullName: queryRegex }, { email: queryRegex }, { jobTitle: queryRegex }, { department: queryRegex }, { callingId: queryRegex }],
      }).select('fullName avatar jobTitle department email status role callingId').limit(8).lean() : [],

      should('tasks') ? Task.find({
        companyId: companyOId, isArchived: false,
        $or: [{ title: queryRegex }, { description: queryRegex }],
      }).populate('assigneeId', 'fullName avatar').populate('projectId', 'name color')
        .select('title status priority dueDate').limit(8).lean() : [],

      should('projects') ? Project.find({
        companyId: companyOId, isArchived: false,
        $or: [{ name: queryRegex }, { description: queryRegex }],
      }).select('name description color status progress').limit(6).lean() : [],

      should('channels') ? Channel.find({
        companyId: companyOId, isArchived: false,
        $or: [{ name: queryRegex }, { description: queryRegex }],
      }).select('name description type').limit(6).lean() : [],

      should('messages') ? Message.find({
        companyId: companyOId, deletedAt: null, content: queryRegex,
        // SECURITY: Channel messages only — never expose private DM content in global search
        channelId: { $exists: true, $ne: null },
        conversationId: { $exists: false },
      }).select('content channelId senderId createdAt')
        .populate('senderId', 'fullName avatar')
        .populate('channelId', 'name')
        .sort({ createdAt: -1 }).limit(8).lean() : [],

      should('files') ? File.find({
        companyId: companyOId, isDeleted: false,
        $or: [{ name: queryRegex }, { originalName: queryRegex }],
      }).select('name mimeType size uploaderId createdAt')
        .populate('uploaderId', 'fullName avatar').limit(8).lean() : [],

      should('documents') ? Document.find({
        companyId: companyOId, isArchived: false,
        $or: [{ title: queryRegex }, { content: queryRegex }],
      }).select('title type icon creatorId updatedAt')
        .populate('creatorId', 'fullName avatar').limit(6).lean() : [],

      should('meetings') ? Meeting.find({
        companyId: companyOId,
        $or: [{ title: queryRegex }, { description: queryRegex }],
      }).select('title status scheduledAt meetingLink')
        .populate('hostId', 'fullName avatar')
        .sort({ scheduledAt: -1 }).limit(6).lean() : [],

      should('calendarEvents') ? CalendarEvent.find({
        companyId: companyOId,
        $or: [{ title: queryRegex }, { description: queryRegex }],
      }).select('title type startDate endDate color').limit(6).lean() : [],

      should('contacts') ? CrmContact.find({
        companyId: companyOId,
        $or: [
          { firstName: queryRegex }, { lastName: queryRegex },
          { email: queryRegex }, { jobTitle: queryRegex },
        ],
      }).select('firstName lastName email jobTitle status avatarUrl')
        .populate('crmCompanyId', 'name').limit(8).lean() : [],

      should('deals') ? CrmDeal.find({
        companyId: companyOId,
        $or: [{ title: queryRegex }],
      }).select('title value stage priority closeDate')
        .populate('crmCompanyId', 'name').limit(6).lean() : [],

      should('crmCompanies') ? CrmCompany.find({
        companyId: companyOId,
        $or: [{ name: queryRegex }, { domain: queryRegex }, { industry: queryRegex }],
      }).select('name domain industry country logoUrl').limit(6).lean() : [],
    ]);

    const total = (people as any[]).length + (tasks as any[]).length + (projects as any[]).length
      + (channels as any[]).length + (messages as any[]).length + (files as any[]).length
      + (documents as any[]).length + (meetings as any[]).length + (calendarEvents as any[]).length
      + (contacts as any[]).length + (deals as any[]).length + (crmCompanies as any[]).length;

    res.json({
      success: true,
      results: {
        people, tasks, projects, channels, messages,
        files, documents, meetings, calendarEvents,
        contacts, deals, crmCompanies,
      },
      total,
      query,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
