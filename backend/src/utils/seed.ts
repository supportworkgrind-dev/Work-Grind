import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User';
import { createWorkGrindUser } from '../services/callingId';
import Company from '../models/Company';
import Channel from '../models/Channel';
import Message from '../models/Message';
import Task from '../models/Task';
import Project from '../models/Project';
import Meeting from '../models/Meeting';
import CalendarEvent from '../models/CalendarEvent';
import Document from '../models/Document';
import { getPlan } from '../config/subscription';

dotenv.config();

export const seedDatabase = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_URI?.trim();
      if (!uri) {
        console.warn('⚠️ MONGODB_URI not found. Skipping seeding.');
        return;
      }
      await mongoose.connect(uri);
    }
    console.log('🌱 Connected to MongoDB for seeding...');

    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('⚡ Database already contains records. Skipping seed.');
      return;
    }

    console.log('🚀 Seeding rich initial SaaS workspace data...');

    // 1. Create Company
    const company = await Company.create({
      name: 'Apex Technologies',
      industry: 'Technology',
      size: '51-200',
      country: 'United States',
      timeZone: 'America/New_York',
      inviteCode: 'APEX-2024',
      plan: 'pro',
      subscriptionStatus: 'active',
      subscriptionPlan: 'pro',
      storage: { used: 15420000, limit: getPlan('pro').limits.storage },
      ownerId: new mongoose.Types.ObjectId(), // placeholder, updated next
    });

    // 2. Create Users with hashed passwords ('Password123!')
    const defaultPassword = 'Password123!';

    const sarah = await createWorkGrindUser({
      fullName: 'Sarah Jenkins',
      email: 'sarah@apextech.io',
      password: defaultPassword,
      jobTitle: 'VP of Product Engineering',
      department: 'Engineering',
      companyId: company._id,
      role: 'owner',
      status: 'online',
      isVerified: true,
      bio: 'Leading distributed engineering teams building scalable cloud platforms.',
      skills: ['System Design', 'React', 'Node.js', 'Team Leadership'],
    });

    // Update company owner
    company.ownerId = sarah._id;
    await company.save();

    const alex = await createWorkGrindUser({
      fullName: 'Alex Rivera',
      email: 'alex@apextech.io',
      password: defaultPassword,
      jobTitle: 'Senior Frontend Architect',
      department: 'Engineering',
      companyId: company._id,
      role: 'admin',
      status: 'online',
      isVerified: true,
      bio: 'Frontend enthusiast passionate about modern web performance, React, and UX design.',
      skills: ['TypeScript', 'Next.js', 'Tailwind CSS', 'WebRTC'],
    });

    const maya = await createWorkGrindUser({
      fullName: 'Maya Lin',
      email: 'maya@apextech.io',
      password: defaultPassword,
      jobTitle: 'Lead Product Designer',
      department: 'Design',
      companyId: company._id,
      role: 'manager',
      status: 'away',
      isVerified: true,
      bio: 'Crafting intuitive digital experiences and unified SaaS design systems.',
      skills: ['Figma', 'UI/UX', 'Design Systems', 'Prototyping'],
    });

    const ali = await createWorkGrindUser({
      fullName: 'Ali Khan',
      email: 'ali@apextech.io',
      password: defaultPassword,
      jobTitle: 'Full-Stack Developer',
      department: 'Engineering',
      companyId: company._id,
      role: 'employee',
      status: 'busy',
      isVerified: true,
      bio: 'Full-stack builder shipping features across API and clientside.',
      skills: ['MongoDB', 'Express', 'React', 'Docker'],
    });

    // 3. Channels
    const generalChannel = await Channel.create({
      companyId: company._id,
      name: 'general',
      description: 'Company-wide announcements and team discussions',
      type: 'public',
      createdBy: sarah._id,
      members: [sarah._id, alex._id, maya._id, ali._id],
      isDefault: true,
    });

    const engineeringChannel = await Channel.create({
      companyId: company._id,
      name: 'engineering',
      description: 'Technical architecture, sprint reviews, and deployment updates',
      type: 'public',
      createdBy: alex._id,
      members: [sarah._id, alex._id, ali._id],
      isDefault: true,
    });

    const designChannel = await Channel.create({
      companyId: company._id,
      name: 'design',
      description: 'UI/UX explorations, design critiques, and typography specs',
      type: 'public',
      createdBy: maya._id,
      members: [sarah._id, alex._id, maya._id],
      isDefault: false,
    });

    // 4. Sample Messages
    await Message.create([
      {
        companyId: company._id,
        channelId: generalChannel._id,
        senderId: sarah._id,
        content: 'Good morning everyone! Welcome to our new WorkGrind collaboration platform 🚀',
        type: 'text',
        reactions: [{ emoji: '🎉', users: [alex._id, maya._id, ali._id] }],
      },
      {
        companyId: company._id,
        channelId: generalChannel._id,
        senderId: alex._id,
        content: 'Everything is running smoothly! The unified chat, meetings, and tasks are looking great.',
        type: 'text',
      },
      {
        companyId: company._id,
        channelId: engineeringChannel._id,
        senderId: alex._id,
        content: 'Ali, could you check the responsive navbar styling on mobile viewport sizes?',
        type: 'text',
      },
      {
        companyId: company._id,
        channelId: engineeringChannel._id,
        senderId: ali._id,
        content: 'On it! I will finish the homepage redesign and responsive polish by Friday.',
        type: 'text',
      },
    ]);

    // 5. Sample Projects
    const projectWebsite = await Project.create({
      companyId: company._id,
      name: 'WorkGrind 2.0 Web Platform',
      description: 'All-in-one digital workplace unifying communications, video, files, and tasks.',
      color: '#4F46E5',
      managerId: sarah._id,
      members: [
        { userId: sarah._id, role: 'manager' },
        { userId: alex._id, role: 'member' },
        { userId: maya._id, role: 'member' },
      ],
      startDate: new Date(),
      deadline: new Date(Date.now() + 14 * 86400000),
      status: 'active',
      progress: 68,
    });

    const projectBrand = await Project.create({
      companyId: company._id,
      name: 'SaaS Design System Overhaul',
      description: 'Creating cohesive typography, minimalist palettes, and reusable components.',
      color: '#7C3AED',
      managerId: maya._id,
      members: [
        { userId: maya._id, role: 'manager' },
        { userId: alex._id, role: 'member' },
      ],
      startDate: new Date(),
      deadline: new Date(Date.now() + 21 * 86400000),
      status: 'active',
      progress: 45,
    });

    // 6. Sample Tasks
    await Task.create([
      {
        companyId: company._id,
        projectId: projectWebsite._id,
        creatorId: sarah._id,
        assigneeId: ali._id,
        title: 'Finish homepage redesign and responsive testing',
        description: 'Ensure clean navigation drawer on tablet and mobile viewports.',
        priority: 'urgent',
        status: 'in_progress',
        dueDate: new Date(Date.now() + 2 * 86400000),
        subtasks: [
          { title: 'Test iPhone 14 breakpoint', isCompleted: true },
          { title: 'Check dropdown z-index layering', isCompleted: false },
        ],
      },
      {
        companyId: company._id,
        projectId: projectWebsite._id,
        creatorId: sarah._id,
        assigneeId: alex._id,
        title: 'Optimize WebRTC video streaming latency',
        description: 'Verify peer-to-peer signaling state and camera fallbacks.',
        priority: 'high',
        status: 'review',
        dueDate: new Date(Date.now() + 3 * 86400000),
      },
      {
        companyId: company._id,
        projectId: projectBrand._id,
        creatorId: maya._id,
        assigneeId: maya._id,
        title: 'Publish design system tokens and component specs',
        description: 'Document button states, modal overlays, and empty state illustrations.',
        priority: 'medium',
        status: 'todo',
        dueDate: new Date(Date.now() + 5 * 86400000),
      },
      {
        companyId: company._id,
        projectId: projectWebsite._id,
        creatorId: sarah._id,
        assigneeId: alex._id,
        title: 'Implement JWT refresh rotation & rate limiting',
        description: 'Enforce company-level data isolation across all endpoints.',
        priority: 'high',
        status: 'completed',
        completedAt: new Date(),
      },
    ]);

    // 7. Sample Meetings
    const meetingSync = await Meeting.create({
      companyId: company._id,
      hostId: sarah._id,
      title: 'Weekly All-Hands & Sprint Planning',
      description: 'Synchronize project deadlines, demo new features, and review AI summaries.',
      meetingLink: 'apex-weekly-sync',
      scheduledAt: new Date(Date.now() + 24 * 3600000),
      participants: [
        { userId: sarah._id, status: 'joined' },
        { userId: alex._id, status: 'invited' },
        { userId: maya._id, status: 'invited' },
        { userId: ali._id, status: 'invited' },
      ],
      status: 'scheduled',
      aiSummary: {
        summary: 'During the previous sprint retrospective, the engineering team aligned on Q4 architecture requirements and role-based permissions.',
        keyPoints: [
          'Agreed on responsive design standards for mobile and desktop views',
          'Confirmed local file storage with S3 migration readiness',
          'Enabled AI meeting summary generation',
        ],
        decisions: [
          'Proceed with Next.js 14 App Router and Express backend',
          'Deploy staging environment next week',
        ],
        actionItems: [
          { title: 'Complete mobile testing pass', assignedTo: 'Ali Khan', deadline: 'Friday' },
          { title: 'Publish design guidelines', assignedTo: 'Maya Lin', deadline: 'Monday' },
        ],
        generatedAt: new Date(),
      },
    });

    // 8. Calendar Events
    await CalendarEvent.create([
      {
        companyId: company._id,
        creatorId: sarah._id,
        title: 'Meeting: Weekly All-Hands & Sprint Planning',
        type: 'meeting',
        startDate: new Date(Date.now() + 24 * 3600000),
        endDate: new Date(Date.now() + 25 * 3600000),
        videoLink: `/meetings/apex-weekly-sync`,
        attendees: [sarah._id, alex._id, maya._id, ali._id],
        meetingId: meetingSync._id,
      },
      {
        companyId: company._id,
        creatorId: sarah._id,
        title: 'Milestone: WorkGrind Beta Release',
        type: 'deadline',
        startDate: new Date(Date.now() + 5 * 86400000),
        endDate: new Date(Date.now() + 5 * 86400000 + 3600000),
        attendees: [sarah._id, alex._id],
      },
    ]);

    // 9. Sample Documents
    await Document.create([
      {
        companyId: company._id,
        creatorId: sarah._id,
        title: 'WorkGrind Product Vision & Architecture Guide',
        type: 'document',
        content: `# WorkGrind Product Vision & Architecture

## Overview
WorkGrind is a modern, unified workspace that seamlessly combines:
- **Chat & Channels**
- **Video Meetings & AI Summaries** (Zoom)
- **Task & Project Management** (Trello / Asana)
- **Cloud File Storage**
- **Collaborative Docs** (Notion)

## Design Principles
1. **Clean & Minimal**: No visual clutter, subtle borders and shadows.
2. **Speed & Scalability**: Fast loading times with instant Socket.io updates.
3. **Data Isolation**: Strict multi-tenant company level partitioning.
`,
        versionHistory: [
          {
            version: 1,
            content: 'Initial draft of architecture specifications.',
            editedBy: sarah._id,
            editedAt: new Date(),
          },
        ],
      },
      {
        companyId: company._id,
        creatorId: maya._id,
        title: 'Company Remote Work SOP & Communication Etiquette',
        type: 'sop',
        content: `# Remote Work SOP & Team Etiquette

## Working Hours & Status
- Keep your status updated: **Online**, **Away**, or **Busy** during deep-focus blocks.
- Respond to direct messages within standard core business hours.

## Meetings & Syncs
- Default to 25-minute or 50-minute meeting durations.
- Review AI-generated action items after each call to convert deliverables into tasks.
`,
        versionHistory: [
          {
            version: 1,
            content: 'Initial policy published.',
            editedBy: maya._id,
            editedAt: new Date(),
          },
        ],
      },
    ]);

    console.log('✅ Seed complete! Pre-configured users:');
    console.log('👉 sarah@apextech.io (Owner) — Password: Password123!');
    console.log('👉 alex@apextech.io (Admin) — Password: Password123!');
    console.log('👉 maya@apextech.io (Designer) — Password: Password123!');
    console.log('👉 ali@apextech.io (Engineer) — Password: Password123!');
  } catch (err) {
    console.error('Seeding error:', err);
  }
};
