export const PERMISSION_GROUPS = [
  {
    key: 'users',
    label: 'User Management',
    permissions: [
      ['users.view', 'View users'],
      ['users.create', 'Create/invite users'],
      ['users.edit', 'Edit users'],
      ['users.suspend', 'Suspend/activate users'],
      ['users.reset_password', 'Reset passwords'],
      ['users.delete', 'Delete users'],
      ['roles.assign', 'Assign roles'],
    ],
  },
  {
    key: 'questions',
    label: 'Question Bank',
    permissions: [
      ['questions.view', 'View questions'],
      ['questions.create', 'Create questions'],
      ['questions.edit', 'Edit questions'],
      ['questions.delete', 'Delete questions'],
      ['questions.review', 'Review questions'],
      ['questions.approve', 'Approve/reject questions'],
      ['questions.publish', 'Publish questions'],
      ['questions.lock', 'Lock approved questions'],
      ['questions.archive', 'Archive questions'],
    ],
  },
  {
    key: 'exams',
    label: 'Exams',
    permissions: [
      ['exams.practice', 'Take practice exams'],
      ['exams.create', 'Create exams'],
      ['exams.edit', 'Edit exams'],
      ['exams.schedule', 'Schedule exams'],
      ['exams.publish', 'Publish exams'],
      ['exams.grade', 'Grade manually marked exams'],
      ['exams.results', 'View results'],
    ],
  },
  {
    key: 'courses',
    label: 'Courses & Learning',
    permissions: [
      ['courses.view', 'View courses'],
      ['courses.create', 'Create courses'],
      ['courses.edit', 'Edit courses'],
      ['courses.publish', 'Publish courses'],
      ['courses.archive', 'Archive courses'],
      ['resources.upload', 'Upload learning resources'],
      ['resources.manage', 'Manage resource library'],
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    permissions: [
      ['payments.view', 'View payments'],
      ['payments.refund', 'Process refunds'],
      ['subscriptions.manage', 'Manage subscriptions'],
      ['invoices.issue', 'Issue invoices'],
      ['revenue.view', 'View revenue'],
      ['finance.export', 'Export financial reports'],
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    permissions: [
      ['analytics.own', 'Own analytics'],
      ['analytics.department', 'Department analytics'],
      ['analytics.global', 'Global analytics'],
      ['reports.view', 'View reports'],
      ['reports.export', 'Export reports'],
    ],
  },
  {
    key: 'system',
    label: 'System',
    permissions: [
      ['settings.view', 'View settings'],
      ['settings.edit', 'Edit settings'],
      ['integrations.manage', 'Manage integrations'],
      ['roles.manage', 'Manage roles/permissions'],
      ['audit.view', 'View audit logs'],
      ['audit.configure', 'Configure audit logs'],
      ['security.manage', 'Manage security'],
      ['branding.manage', 'Manage branding'],
      ['feature_flags.manage', 'Manage feature flags'],
    ],
  },
];

const STUDENT = [
  'courses.view', 'exams.practice', 'exams.results', 'questions.view',
  'analytics.own', 'resources.upload',
];

const INSTRUCTOR = [
  'users.view', 'questions.view', 'questions.create', 'questions.edit',
  'exams.create', 'exams.edit', 'exams.schedule', 'exams.grade', 'exams.results',
  'courses.view', 'courses.create', 'courses.edit', 'resources.upload',
  'analytics.own', 'analytics.department',
];

const CONTENT_REVIEWER = [
  'questions.view', 'questions.review', 'questions.approve', 'questions.lock',
  'questions.publish', 'questions.archive', 'reports.view',
];

const FINANCE = [
  'payments.view', 'payments.refund', 'subscriptions.manage', 'invoices.issue',
  'revenue.view', 'finance.export', 'reports.view', 'reports.export',
];

const ADMIN = [
  'users.view', 'users.create', 'users.edit', 'users.suspend', 'users.reset_password',
  'roles.assign', 'questions.view', 'questions.create', 'questions.edit',
  'questions.publish', 'exams.create', 'exams.edit', 'exams.schedule',
  'courses.view', 'courses.create', 'courses.edit', 'courses.publish',
  'payments.view', 'subscriptions.manage', 'analytics.global', 'reports.view',
  'reports.export', 'settings.view',
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map(([key]) => key));

export const RBAC_ROLES = [
  {
    name: 'student',
    label: 'Student',
    color: '#2b8a7d',
    responsibility: 'Learning',
    desc: 'Access assigned learning content, practice questions, flashcards, planner, progress, certificates, and own profile.',
    permissions: STUDENT,
  },
  {
    name: 'instructor',
    label: 'Instructor',
    color: '#e3a72f',
    responsibility: 'Teaching',
    desc: 'Create teaching content, build exams, support assigned students, grade work, and view class-level analytics.',
    permissions: INSTRUCTOR,
  },
  {
    name: 'content_reviewer',
    label: 'Content Reviewer',
    color: '#e94868',
    responsibility: 'Quality assurance',
    desc: 'Review submitted questions and rationales, approve/reject items, request changes, and lock approved content.',
    permissions: CONTENT_REVIEWER,
  },
  {
    name: 'finance',
    label: 'Finance',
    color: '#8b5cf6',
    responsibility: 'Payments',
    desc: 'Manage payments, subscriptions, invoices, refunds, revenue reports, and finance exports.',
    permissions: FINANCE,
  },
  {
    name: 'admin',
    label: 'Admin',
    color: '#c17f44',
    responsibility: 'Operations management',
    desc: 'Day-to-day platform operations: users, content, courses, questions, reports, announcements, and limited settings.',
    permissions: ADMIN,
  },
  {
    name: 'super_admin',
    label: 'Super Admin',
    color: '#8a2c21',
    responsibility: 'Entire platform',
    desc: 'Full owner access including roles, permissions, security, integrations, audit logs, billing, branding, and feature flags.',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: 'department_admin',
    label: 'Department Admin',
    color: '#2563eb',
    responsibility: 'Department operations',
    desc: 'Manages one nursing department: users, instructors, classes, reports, and learning operations within scope.',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.suspend', 'courses.view', 'courses.edit', 'exams.schedule', 'analytics.department', 'reports.view'],
  },
  {
    name: 'exam_officer',
    label: 'Exam Officer',
    color: '#0f766e',
    responsibility: 'Exam administration',
    desc: 'Creates, schedules, publishes, and reviews exams without managing payments or platform security.',
    permissions: ['questions.view', 'exams.create', 'exams.edit', 'exams.schedule', 'exams.publish', 'exams.results', 'reports.view'],
  },
  {
    name: 'question_bank_manager',
    label: 'Question Bank Manager',
    color: '#7c3aed',
    responsibility: 'Question repository',
    desc: 'Owns the full question workflow from draft intake through review, publishing, archiving, and quality control.',
    permissions: ['questions.view', 'questions.create', 'questions.edit', 'questions.review', 'questions.approve', 'questions.publish', 'questions.lock', 'questions.archive', 'reports.view'],
  },
  {
    name: 'support_officer',
    label: 'Support Officer',
    color: '#0891b2',
    responsibility: 'User support',
    desc: 'Assists users with account access, password resets, basic user updates, and support triage.',
    permissions: ['users.view', 'users.edit', 'users.reset_password', 'reports.view'],
  },
  {
    name: 'academic_registrar',
    label: 'Academic Registrar',
    color: '#b45309',
    responsibility: 'Student records',
    desc: 'Manages student records, enrollment status, graduation readiness, certificates, and academic reports.',
    permissions: ['users.view', 'users.edit', 'courses.view', 'exams.results', 'analytics.department', 'reports.view', 'reports.export'],
  },
  {
    name: 'library_manager',
    label: 'Library Manager',
    color: '#4f46e5',
    responsibility: 'Learning resources',
    desc: 'Uploads, organizes, reviews, and archives documents, videos, drug guides, and learning materials.',
    permissions: ['courses.view', 'resources.upload', 'resources.manage', 'courses.edit', 'reports.view'],
  },
  {
    name: 'analytics_manager',
    label: 'Analytics Manager',
    color: '#db2777',
    responsibility: 'Read-only intelligence',
    desc: 'Read-only access to dashboards, performance analytics, pass-readiness trends, and exportable reports.',
    permissions: ['analytics.department', 'analytics.global', 'reports.view', 'reports.export'],
  },
  {
    name: 'guest_reviewer',
    label: 'Guest Reviewer',
    color: '#64748b',
    responsibility: 'External review',
    desc: 'Temporary external reviewer access for accreditation or content quality review.',
    permissions: ['questions.view', 'questions.review', 'reports.view'],
  },
];

export const RBAC_ROLE_NAMES = RBAC_ROLES.map((role) => role.name);
export const ROLE_COLORS = Object.fromEntries(RBAC_ROLES.map((role) => [role.name, role.color]));
export const ROLE_LOOKUP = Object.fromEntries(RBAC_ROLES.map((role) => [role.name, role]));
export const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map(([key, label]) => [key, label]))
);

export function getEffectivePermissions(roles = []) {
  const keys = new Set();
  roles.forEach((roleName) => {
    ROLE_LOOKUP[roleName]?.permissions?.forEach((permission) => keys.add(permission));
  });
  return [...keys].sort();
}

export function getPermissionGroupsForRoles(roles = []) {
  const effective = new Set(getEffectivePermissions(roles));
  return PERMISSION_GROUPS
    .map((group) => ({
      ...group,
      granted: group.permissions.filter(([key]) => effective.has(key)),
    }))
    .filter((group) => group.granted.length > 0);
}
