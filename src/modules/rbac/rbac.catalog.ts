import { PermissionScope } from './permission.model';

export type PermissionSeed = {
  code: string;
  label: string;
  description: string;
  module: string;
  scope: PermissionScope;
};

export const PERMISSION_CATALOG: PermissionSeed[] = [
  // Submissions — admin
  { code: 'submissions.view', label: 'View submissions', description: 'Browse technology transfer submissions', module: 'Submissions', scope: 'admin' },
  { code: 'submissions.review', label: 'Review submissions', description: 'Review and comment on submissions', module: 'Submissions', scope: 'admin' },
  { code: 'submissions.approve', label: 'Approve / reject', description: 'Approve or return submissions', module: 'Submissions', scope: 'admin' },
  // Submissions — partner
  { code: 'submissions.view', label: 'View submissions', description: 'Browse your organization submissions', module: 'Submissions', scope: 'partner' },
  { code: 'submissions.create', label: 'Create submissions', description: 'Submit new technology agreements', module: 'Submissions', scope: 'partner' },
  { code: 'submissions.edit', label: 'Edit submissions', description: 'Update draft or returned submissions', module: 'Submissions', scope: 'partner' },
  // Submissions — acquirer
  { code: 'submissions.view', label: 'View submissions', description: 'Browse your organization submissions', module: 'Submissions', scope: 'acquirer' },
  { code: 'submissions.create', label: 'Create submissions', description: 'Submit new technology agreements', module: 'Submissions', scope: 'acquirer' },
  { code: 'submissions.edit', label: 'Edit submissions', description: 'Update draft or returned submissions', module: 'Submissions', scope: 'acquirer' },
  // Payments
  { code: 'payments.view', label: 'View payments', description: 'View payment status and history', module: 'Payments', scope: 'partner' },
  { code: 'payments.view', label: 'View payments', description: 'View payment status and history', module: 'Payments', scope: 'acquirer' },
  { code: 'payments.initiate', label: 'Initiate payments', description: 'Pay compliance fees and renewals', module: 'Payments', scope: 'acquirer' },
  // Certificates
  { code: 'certificates.view', label: 'View certificates', description: 'View issued certificates', module: 'Certificates', scope: 'partner' },
  { code: 'certificates.view', label: 'View certificates', description: 'View issued certificates', module: 'Certificates', scope: 'acquirer' },
  { code: 'certificates.download', label: 'Download certificates', description: 'Download or print certificates', module: 'Certificates', scope: 'acquirer' },
  // Renewals
  { code: 'renewals.view', label: 'View renewals', description: 'View renewal status', module: 'Renewals', scope: 'acquirer' },
  { code: 'renewals.submit', label: 'Submit renewals', description: 'Submit certificate renewals', module: 'Renewals', scope: 'acquirer' },
  // Users — all scopes
  { code: 'users.view', label: 'View users', description: 'View team members', module: 'Users', scope: 'admin' },
  { code: 'users.invite', label: 'Invite users', description: 'Invite new team members', module: 'Users', scope: 'admin' },
  { code: 'users.edit', label: 'Edit users', description: 'Update or deactivate users', module: 'Users', scope: 'admin' },
  { code: 'users.manage_roles', label: 'Manage roles', description: 'Create and assign roles', module: 'Users', scope: 'admin' },
  { code: 'users.view', label: 'View users', description: 'View team members', module: 'Users', scope: 'partner' },
  { code: 'users.invite', label: 'Invite users', description: 'Invite new team members', module: 'Users', scope: 'partner' },
  { code: 'users.edit', label: 'Edit users', description: 'Update or deactivate users', module: 'Users', scope: 'partner' },
  { code: 'users.manage_roles', label: 'Manage roles', description: 'Create and assign roles', module: 'Users', scope: 'partner' },
  { code: 'users.view', label: 'View users', description: 'View team members', module: 'Users', scope: 'acquirer' },
  { code: 'users.invite', label: 'Invite users', description: 'Invite new team members', module: 'Users', scope: 'acquirer' },
  { code: 'users.edit', label: 'Edit users', description: 'Update or deactivate users', module: 'Users', scope: 'acquirer' },
  { code: 'users.manage_roles', label: 'Manage roles', description: 'Create and assign roles', module: 'Users', scope: 'acquirer' },
  // Admin-only modules
  { code: 'cms.manage', label: 'Manage CMS', description: 'Edit landing page and news', module: 'CMS', scope: 'admin' },
  { code: 'registrations.review', label: 'Review registrations', description: 'Approve organization registrations', module: 'Registrations', scope: 'admin' },
  { code: 'oem.manage', label: 'Manage OEM registry', description: 'Maintain OEM records', module: 'OEM', scope: 'admin' },
  { code: 'analytics.view', label: 'View analytics', description: 'Access analytics dashboards', module: 'Analytics', scope: 'admin' },
  { code: 'settings.compliance_fee', label: 'Compliance fee settings', description: 'Configure platform compliance fee', module: 'Settings', scope: 'admin' },
  { code: 'announcements.manage', label: 'Manage announcements', description: 'Send platform announcements', module: 'Announcements', scope: 'admin' },
  // Messaging & invitations
  { code: 'messaging.use', label: 'Use messaging', description: 'Send and receive messages', module: 'Messaging', scope: 'admin' },
  { code: 'messaging.use', label: 'Use messaging', description: 'Send and receive messages', module: 'Messaging', scope: 'partner' },
  { code: 'messaging.use', label: 'Use messaging', description: 'Send and receive messages', module: 'Messaging', scope: 'acquirer' },
  { code: 'invitations.send', label: 'Send invitations', description: 'Invite counterparties to submissions', module: 'Invitations', scope: 'partner' },
  { code: 'invitations.send', label: 'Send invitations', description: 'Invite counterparties to submissions', module: 'Invitations', scope: 'acquirer' },
];

export type DefaultRoleTemplate = {
  name: string;
  slug: string;
  description: string;
  isOwner?: boolean;
  permissionCodes: string[];
};

export const PLATFORM_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full platform access',
    isOwner: true,
    permissionCodes: [],
  },
  {
    name: 'Reviewer',
    slug: 'reviewer',
    description: 'Review and approve submissions',
    permissionCodes: [
      'submissions.view',
      'submissions.review',
      'submissions.approve',
      'messaging.use',
      'users.view',
    ],
  },
  {
    name: 'Content Editor',
    slug: 'content-editor',
    description: 'Manage CMS and announcements',
    permissionCodes: ['cms.manage', 'announcements.manage', 'users.view'],
  },
  {
    name: 'Support',
    slug: 'support',
    description: 'Messaging and registration support',
    permissionCodes: ['messaging.use', 'registrations.review', 'users.view'],
  },
];

export const PARTNER_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    name: 'Organization Owner',
    slug: 'organization-owner',
    description: 'Full access within your organization',
    isOwner: true,
    permissionCodes: [],
  },
  {
    name: 'Compliance Manager',
    slug: 'compliance-manager',
    description: 'Manage submissions and team',
    permissionCodes: [
      'submissions.view',
      'submissions.create',
      'submissions.edit',
      'payments.view',
      'certificates.view',
      'users.view',
      'users.invite',
      'users.edit',
      'messaging.use',
      'invitations.send',
    ],
  },
  {
    name: 'Submitter',
    slug: 'submitter',
    description: 'Create and edit submissions',
    permissionCodes: [
      'submissions.view',
      'submissions.create',
      'submissions.edit',
      'messaging.use',
      'invitations.send',
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access',
    permissionCodes: ['submissions.view', 'certificates.view', 'payments.view', 'messaging.use'],
  },
];

export const ACQUIRER_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    name: 'Organization Owner',
    slug: 'organization-owner',
    description: 'Full access within your organization',
    isOwner: true,
    permissionCodes: [],
  },
  {
    name: 'Finance',
    slug: 'finance',
    description: 'Payments, certificates, and renewals',
    permissionCodes: [
      'submissions.view',
      'payments.view',
      'payments.initiate',
      'certificates.view',
      'certificates.download',
      'renewals.view',
      'renewals.submit',
      'messaging.use',
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access',
    permissionCodes: [
      'submissions.view',
      'certificates.view',
      'payments.view',
      'renewals.view',
      'messaging.use',
    ],
  },
];
