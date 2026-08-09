import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nursefaculty.org';
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? appUrl).split(',').map((v) => v.trim());

function headers(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function respond(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(req), 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req) });
  if (req.method !== 'POST') return respond(req, 405, { error: 'Method not allowed' });
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) return respond(req, 403, { error: 'Origin not allowed' });
  if (!url || !anonKey || !serviceKey) return respond(req, 503, { error: 'User administration is unavailable.' });

  const authorization = req.headers.get('authorization') ?? '';
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return respond(req, 401, { error: 'Your session has expired.' });

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actorRoles } = await service.from('user_roles').select('roles(name)').eq('user_id', auth.user.id);
  const roles = (actorRoles ?? []).map((row: any) => row.roles?.name).filter(Boolean);
  if (!roles.some((role: string) => ['admin', 'super_admin'].includes(role))) return respond(req, 403, { error: 'Administrator access is required.' });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return respond(req, 400, { error: 'Invalid request body.' }); }
  const action = body.action;
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.fullName ?? '').trim();
  const roleName = String(body.role ?? '').trim();
  const allowedRoles = ['student','instructor','admin','finance','content_reviewer','department_admin','exam_officer','question_bank_manager','support_officer','academic_registrar','library_manager','analytics_manager','guest_reviewer'];
  if (roles.includes('super_admin')) allowedRoles.push('super_admin');
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !fullName || !allowedRoles.includes(roleName)) {
    return respond(req, 400, { error: 'Valid name, email, and permitted role are required.' });
  }

  try {
    let created;
    if (action === 'invite') {
      const result = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: appUrl,
        data: { full_name: fullName, invited_role: roleName },
      });
      if (result.error) throw result.error;
      created = result.data.user;
    } else if (action === 'create') {
      const password = String(body.password ?? '');
      if (password.length < 10) return respond(req, 400, { error: 'Temporary password must be at least 10 characters.' });
      const result = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
      if (result.error) throw result.error;
      created = result.data.user;
    } else return respond(req, 400, { error: 'Unsupported action.' });

    if (!created) throw new Error('The authentication account was not created.');
    await service.from('profiles').upsert({ id: created.id, email, full_name: fullName }, { onConflict: 'id' });
    const { data: role } = await service.from('roles').select('id').eq('name', roleName).single();
    if (!role) throw new Error('Selected role is not configured.');
    await service.from('user_roles').upsert({ user_id: created.id, role_id: role.id }, { onConflict: 'user_id,role_id' });

    if (roleName === 'instructor') {
      await service.from('instructor_profiles').upsert({
        user_id: created.id,
        department: body.department || null,
        nursing_specialty: body.nursingSpecialty || null,
        professional_title: body.professionalTitle || null,
        institution: body.institution || null,
        staff_id: body.staffId || null,
        account_status: action === 'invite' ? 'invitation_pending' : 'active',
        onboarding_email_sent: action === 'invite' || Boolean(body.sendOnboardingEmail),
        updated_at: new Date().toISOString(),
      });
    }
    if (action === 'invite') {
      await service.from('pending_invites').upsert({
        email, full_name: fullName, role_name: roleName, invited_by: auth.user.id,
        invite_type: 'platform_role', department: body.department || null,
        institution: body.institution || null, professional_title: body.professionalTitle || null,
        staff_id: body.staffId || null, status: 'pending', expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }, { onConflict: 'email' });
    }
    await service.from('audit_logs').insert({
      user_id: auth.user.id, user_email: auth.user.email,
      action: action === 'invite' ? 'user.invited' : 'user.created', entity_type: 'user', entity_id: created.id,
      metadata: { target_email: email, role: roleName },
    });
    return respond(req, 200, { user: { id: created.id, email, full_name: fullName }, action });
  } catch (error) {
    console.error('admin-users failure', { action, actor: auth.user.id, message: error instanceof Error ? error.message : String(error) });
    return respond(req, 400, { error: error instanceof Error ? error.message : 'Could not create user.' });
  }
});
