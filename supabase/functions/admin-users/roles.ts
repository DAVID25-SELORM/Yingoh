// Roles an actor may assign when creating or inviting a user.
// The privileged tier (admin, super_admin) can only be granted by a Super Admin. This mirrors the
// database rule in admin_assign_role / admin_invite_user so the two layers cannot disagree.
export const ORDINARY_ROLES = [
  'student', 'instructor', 'finance', 'content_reviewer', 'department_admin', 'exam_officer',
  'question_bank_manager', 'support_officer', 'academic_registrar', 'library_manager',
  'analytics_manager', 'guest_reviewer',
];
export const PRIVILEGED_ROLES = ['admin', 'super_admin'];

export function assignableRoles(actorRoles: string[]): string[] {
  return actorRoles.includes('super_admin') ? [...ORDINARY_ROLES, ...PRIVILEGED_ROLES] : [...ORDINARY_ROLES];
}
export const isPrivilegedRole = (role: string) => PRIVILEGED_ROLES.includes(role);
