import { defineMessages } from '../core';

/** Team page. */
export const team = defineMessages(
  {
    header: {
      title: {
        company: 'Team Directory',
        education: 'Institution Directory',
      },
      subtitle: {
        company: 'Browse your team, check availability, and start conversations',
        school: 'Browse your school’s staff, students, and parents, check availability, and start conversations',
        college: 'Browse your college’s faculty, students, and parents, check availability, and start conversations',
        university: 'Browse your university’s faculty, students, and parents, check availability, and start conversations',
      },
    },
    actions: {
      instantMeeting: 'Instant Meeting',
      starting: 'Starting...',
      inviteMember: 'Invite Member',
      memberLimit: 'Member limit reached · Upgrade',
      upgradePlan: 'Upgrade Plan',
      dm: 'DM',
      call: 'Call',
      callById: 'Call by ID',
      callByIdLabel: 'Open Calling ID for {{name}}',
      join: 'Join',
    },
    live: {
      count: { one: '{{count}} live meeting in progress', other: '{{count}} live meetings in progress' },
      badge: 'LIVE',
      host: 'Host: {{name}}',
      teamMember: 'Team Member',
    },
    filters: {
      searchPlaceholder: 'Search name, role, email, or user ID...',
      searchLabel: 'Search members',
      allDepartments: 'All Departments',
      departmentLabel: 'Filter by department',
      allRoles: 'All Roles',
      roleLabel: 'Filter by role',
      allStatuses: 'All Statuses',
      statusLabel: 'Filter by status',
      status: { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' },
    },
    dmNote: 'Direct messages are available to active users in this workspace. User IDs are searchable within this directory.',
    errors: {
      noUserId: 'This user does not have an available WorkGrind User ID.',
      conversationFailed: 'The conversation could not be opened. Please try again.',
      dmUnavailable: 'This user is not currently available for direct messages.',
      loadFailed: 'The member directory could not be loaded.',
      meetingFailed: 'The meeting could not be started. Please try again.',
      inviteFailed: 'The invitation could not be sent.',
    },
    empty: {
      title: 'No members found',
      company: 'Invite team members to collaborate on projects and tasks.',
      education: 'Invite staff, students, and parents to join your institution workspace.',
    },
    card: {
      teamMember: 'Team Member',
      general: 'General',
      userId: 'User ID',
      unavailable: 'Unavailable',
    },
    meeting: {
      instantTitle: '{{name}}’s Instant Meeting',
      instantTitleFallback: 'Team’s Instant Meeting',
      callTitle: 'Call with {{name}}',
    },
    invite: {
      title: {
        company: 'Invite Team Member',
        education: 'Invite Member',
      },
      close: 'Close invitation',
      sent: 'Invitation sent!',
      sentBody: 'Your colleague will receive an email shortly.',
      sentBodyEducation: 'They will receive an email invitation shortly.',
      email: 'Email Address',
      emailPlaceholder: {
        company: 'colleague@company.com',
        education: 'name@institution.edu',
      },
      role: 'Role',
      roleHint: 'Only roles available for this workspace type are listed.',
      cancel: 'Cancel',
      sending: 'Sending...',
      send: 'Send Invite',
    },
  },
);
