import assert from 'node:assert/strict';
import { assignableRoles, isPrivilegedRole, ORDINARY_ROLES } from '../supabase/functions/admin-users/roles.ts';

Deno.test('admins can assign only ordinary roles', () => {
  const roles = assignableRoles(['admin']);
  assert.equal(roles.includes('admin'), false);
  assert.equal(roles.includes('super_admin'), false);
  for (const role of ['student', 'instructor', 'finance', 'department_admin', 'guest_reviewer']) assert.ok(roles.includes(role), role);
});
Deno.test('only a super admin can assign the privileged tier', () => {
  const roles = assignableRoles(['super_admin']);
  assert.ok(roles.includes('admin') && roles.includes('super_admin'));
  assert.equal(roles.length, ORDINARY_ROLES.length + 2);
});
Deno.test('non-admin actors and mixed roles never gain privileged assignment', () => {
  assert.equal(assignableRoles([]).includes('admin'), false);
  assert.equal(assignableRoles(['student', 'admin', 'instructor']).includes('super_admin'), false);
  assert.ok(isPrivilegedRole('admin') && isPrivilegedRole('super_admin') && !isPrivilegedRole('finance'));
});
