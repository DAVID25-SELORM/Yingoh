import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://mcbfqgyosdklnzbagobp.supabase.co';
const productionAppUrl = 'https://nursefaculty.org';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const superAdminEmail = (import.meta.env.VITE_SUPER_ADMIN_EMAIL?.trim() || 'cryxtalcfc@gmail.com').toLowerCase();
const isLocalDevelopment = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const authRedirectUrl = isLocalDevelopment
  ? (import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || window.location.origin)
  : productionAppUrl;

export const supabaseConfig = {
  url: supabaseUrl,
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  superAdminEmail,
  authRedirectUrl,
};

export function isConfiguredSuperAdmin(email) {
  return Boolean(email && email.toLowerCase() === superAdminEmail);
}

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const nurseFacultyTables = {
  profiles: 'profiles',
  roles: 'roles',
  userRoles: 'user_roles',
  courses: 'courses',
  lessons: 'lessons',
  questions: 'questions',
  attempts: 'attempts',
  subscriptions: 'subscriptions',
  liveSessions: 'live_sessions',
  questionBookmarks: 'question_bookmarks',
  flashcardDecks: 'flashcard_decks',
  flashcards: 'flashcards',
  userFlashcardProgress: 'user_flashcard_progress',
  examSessions: 'exam_sessions',
  examSessionAnswers: 'exam_session_answers',
  notebooks: 'notebooks',
  studyPlans: 'study_plans',
  studyCoachConversations: 'study_coach_conversations',
  savedItems: 'saved_items',
  userProgress: 'user_progress',
  notifications: 'notifications',
  videoLessons: 'video_lessons',
  videoProgress: 'video_progress',
  forumThreads: 'forum_threads',
  forumReplies: 'forum_replies',
  assignments: 'assignments',
  assignmentSubmissions: 'assignment_submissions',
  userCertificates: 'user_certificates',
  certificateTemplates: 'certificate_templates',
  certificateRules: 'certificate_rules',
  transcriptRecords: 'transcript_records',
  institutionBranding: 'institution_branding',
  paymentPlans: 'payment_plans',
  invoices: 'invoices',
  promoCodes: 'promo_codes',
  classSchedules: 'class_schedules',
  pendingInvites: 'pending_invites',
  auditLogs: 'audit_logs',
  adminAuditLogs: 'admin_audit_logs',
};

// ─── Auth ──────────────────────────────────────────────────
export async function getCurrentSession() {
  if (!supabase) return { data: { session: null }, error: null };
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

export async function signInWithEmail(email, password) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail({ email, password, fullName }) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: authRedirectUrl,
    },
  });
}

export async function sendPasswordResetEmail(email) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl,
  });
}

export async function resendEmailConfirmation(email) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl },
  });
}

export async function updatePassword(password) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.updateUser({ password });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

// ─── Questions ─────────────────────────────────────────────
export async function getQuestions({ topic, type, limit = 500, includeUnpublished = false } = {}) {
  if (!supabase) return { data: null, error: new Error('Not configured') };
  const pageSize = 1000;
  const requested = Number.isFinite(limit) ? Math.max(0, limit) : Infinity;
  const rows = [];
  let offset = 0;
  while (rows.length < requested) {
    const take = Math.min(pageSize, requested - rows.length);
    let query = supabase.from('questions').select('*');
    if (!includeUnpublished) query = query.eq('status', 'published');
    if (topic) query = query.eq('topic', topic);
    if (type) query = query.eq('question_type', type);
    const { data, error } = await query.order('created_at', { ascending: true }).range(offset, offset + take - 1);
    if (error) return { data: rows.length ? rows : null, error };
    rows.push(...(data ?? []));
    if (!data?.length || data.length < take) break;
    offset += data.length;
  }
  return { data: rows, error: null };
}

export async function getBookmarkedQuestionIds(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('question_bookmarks')
    .select('question_id')
    .eq('user_id', userId);
  return { data: data?.map((r) => r.question_id) ?? [], error };
}

export async function bookmarkQuestion(userId, questionId) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('question_bookmarks').insert({ user_id: userId, question_id: questionId });
}

export async function unbookmarkQuestion(userId, questionId) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('question_bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);
}

// ─── Attempts ──────────────────────────────────────────────
export async function submitAttempt(userId, questionId, answer, isCorrect) {
  if (!supabase) return { error: new Error('Not configured') };
  const result = await supabase.from('attempts').insert({ user_id: userId, question_id: questionId, answer, is_correct: isCorrect });
  await incrementQuestionProgress(userId);
  return result;
}

export async function getAttemptStats(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('attempts')
    .select('is_correct, question_id, created_at, questions(topic)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  return { data, error };
}

export async function getRecentAttempts(userId, limit = 20) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('attempts')
    .select('*, questions(topic, question_type)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

// ─── Exam Sessions ─────────────────────────────────────────
export async function createExamSession(userId, mode, questionIds, timeLimitSeconds) {
  if (!supabase) return { data: null, error: new Error('Not configured') };
  return supabase.from('exam_sessions').insert({
    user_id: userId, mode,
    question_ids: questionIds,
    total_questions: questionIds.length,
    time_limit_seconds: timeLimitSeconds ?? null,
    status: 'active',
  }).select().single();
}

export async function submitExamAnswer(sessionId, questionId, answer, isCorrect, timeTakenSeconds) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('exam_session_answers').insert({
    session_id: sessionId, question_id: questionId,
    answer, is_correct: isCorrect, time_taken_seconds: timeTakenSeconds,
  });
}

export async function completeExamSession(sessionId, { correctCount, totalQuestions, scorePercent, passProbability, timeUsedSeconds }) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('exam_sessions').update({
    status: 'completed',
    correct_count: correctCount,
    score_pct: scorePercent,
    pass_probability: passProbability,
    time_used_seconds: timeUsedSeconds,
    completed_at: new Date().toISOString(),
  }).eq('id', sessionId);
}

export async function getExamHistory(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('exam_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20);
}

// Empirical difficulty proxy for the CAT Simulator: raw per-question correctness
// rows, aggregated client-side by adaptiveEngine.js (no stored difficulty column
// exists, so this stands in for calibrated item difficulty).
export async function getQuestionDifficultyStats(questionIds) {
  if (!supabase || !questionIds?.length) return { data: [], error: null };
  const idBatchSize = 1000;
  const rowPageSize = 1000;
  const rows = [];
  for (let offset = 0; offset < questionIds.length; offset += idBatchSize) {
    const idsPage = questionIds.slice(offset, offset + idBatchSize);
    let rowOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('exam_session_answers')
        .select('question_id, is_correct')
        .in('question_id', idsPage)
        .range(rowOffset, rowOffset + rowPageSize - 1);
      if (error) return { data: rows.length ? rows : null, error };
      rows.push(...(data ?? []));
      if (!data?.length || data.length < rowPageSize) break;
      rowOffset += data.length;
    }
  }
  return { data: rows, error: null };
}

export async function getExamUsage(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('exam_sessions')
    .select('id, mode, status, started_at')
    .eq('user_id', userId)
    .in('status', ['active', 'completed']);
}

// ─── Flashcards ────────────────────────────────────────────
export async function getFlashcardDecks() {
  if (!supabase) return { data: null, error: new Error('Not configured') };
  return supabase.from('flashcard_decks').select('*').order('name');
}

export async function getFlashcardsForDeck(deckId) {
  if (!supabase) return { data: null, error: new Error('Not configured') };
  return supabase.from('flashcards').select('*').eq('deck_id', deckId);
}

export async function getUserFlashcardProgress(userId, deckId) {
  if (!supabase || !userId) return { data: [], error: null };
  const { data: cards } = await supabase.from('flashcards').select('id').eq('deck_id', deckId);
  if (!cards?.length) return { data: [], error: null };
  const cardIds = cards.map((c) => c.id);
  return supabase.from('user_flashcard_progress')
    .select('*')
    .eq('user_id', userId)
    .in('flashcard_id', cardIds);
}

export async function upsertFlashcardProgress(userId, flashcardId, easeFactor, intervalDays, repetitions, nextReviewAt) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('user_flashcard_progress').upsert({
    user_id: userId, flashcard_id: flashcardId,
    ease_factor: easeFactor, interval_days: intervalDays,
    repetitions, next_review_at: nextReviewAt,
    last_reviewed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,flashcard_id' });
}

// ─── Notebook ──────────────────────────────────────────────
export async function getAllNotes(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('notebooks')
    .select('*, questions(topic, prompt)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
}

export async function saveNote(userId, { id, questionId, title, content, topic }) {
  if (!supabase) return { error: new Error('Not configured') };
  if (id) {
    return supabase.from('notebooks').update({ title, content, topic, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single();
  }
  return supabase.from('notebooks').insert({ user_id: userId, question_id: questionId ?? null, title, content, topic }).select().single();
}

export async function deleteNote(userId, noteId) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('notebooks').delete().eq('id', noteId).eq('user_id', userId);
}

// ─── Study Plan ────────────────────────────────────────────
export async function getStudyPlan(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('study_plans').select('*').eq('user_id', userId).maybeSingle();
}

export async function saveStudyPlan(userId, examDate, dailyTarget, weakTopics) {
  if (!supabase) return { error: new Error('Not configured') };
  await upsertUserProgress(userId, { daily_goal_target: dailyTarget, weak_areas: weakTopics ?? [] });
  return supabase.from('study_plans').upsert({
    user_id: userId, exam_date: examDate,
    daily_question_target: dailyTarget,
    weak_topics: weakTopics,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// Saved items
export async function getSavedItems(userId, itemType) {
  if (!supabase || !userId) return { data: [], error: null };
  let query = supabase.from('saved_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (itemType) query = query.eq('item_type', itemType);
  return query;
}

export async function saveItem(userId, { item_type, item_id, title, summary, metadata = {} }) {
  if (!supabase || !userId) return { error: new Error('Not configured') };
  return supabase.from('saved_items').upsert({
    user_id: userId,
    item_type,
    item_id: String(item_id),
    title,
    summary,
    metadata,
  }, { onConflict: 'user_id,item_type,item_id' }).select().single();
}

export async function unsaveItem(userId, itemType, itemId) {
  if (!supabase || !userId) return { error: new Error('Not configured') };
  return supabase.from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .eq('item_id', String(itemId));
}

export async function isItemSaved(userId, itemType, itemId) {
  if (!supabase || !userId) return { data: false, error: null };
  const { data, error } = await supabase.from('saved_items')
    .select('id')
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .eq('item_id', String(itemId))
    .maybeSingle();
  return { data: Boolean(data), error };
}

// Study Coach conversations
export async function getStudyCoachConversations(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('study_coach_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);
}

export async function saveStudyCoachConversation(userId, { id, mode, title, messages, isSaved = false }) {
  if (!supabase || !userId) return { data: null, error: new Error('Not configured') };
  const payload = {
    user_id: userId,
    mode,
    title,
    messages,
    is_saved: isSaved,
    updated_at: new Date().toISOString(),
  };
  if (id) return supabase.from('study_coach_conversations').update(payload).eq('id', id).eq('user_id', userId).select().single();
  return supabase.from('study_coach_conversations').insert(payload).select().single();
}

export async function consumeStudyCoachQuestion() {
  if (!supabase) return { data: -1, error: null };
  if (import.meta.env.VITE_USE_STUDY_COACH_RPC !== 'true') {
    return { data: null, error: null };
  }
  const result = await supabase.rpc('consume_study_coach_question');
  if (result.error?.code === 'PGRST202' || result.error?.message?.includes('schema cache')) {
    return { data: null, error: null };
  }
  return result;
}

// RBAC permissions
export async function getMyEffectivePermissions() {
  if (!supabase) return { data: [], error: null };
  return supabase.rpc('my_effective_permissions');
}

export async function getUserPermissionOverrides(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase
    .from('user_permission_overrides')
    .select('permission_id,effect,reason,updated_at')
    .eq('user_id', userId);
}

export async function setUserPermissionOverride(userId, permission, effect, reason = null) {
  if (!supabase || !userId || !permission || !effect) return { error: new Error('Missing permission override details') };
  return supabase.rpc('admin_set_user_permission_override', {
    target_user_id: userId,
    permission,
    effect,
    reason,
  });
}

export async function clearUserPermissionOverride(userId, permission) {
  if (!supabase || !userId || !permission) return { error: new Error('Missing permission override details') };
  return supabase.rpc('admin_clear_user_permission_override', {
    target_user_id: userId,
    permission,
  });
}

// LMS courses and enrollment links
export async function getMyCourses(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase
    .from('course_memberships')
    .select('membership_role,status,course_id,courses(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
}

export async function createCourseWithOwner(payload) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };
  return supabase.rpc('create_course_with_owner', {
    p_title: payload.title,
    p_course_code: payload.course_code,
    p_description: payload.description,
    p_category: payload.category,
    p_academic_level: payload.academic_level,
    p_starts_at: payload.starts_at || null,
    p_ends_at: payload.ends_at || null,
    p_enrollment_method: payload.enrollment_method,
    p_max_students: payload.max_students ? Number(payload.max_students) : null,
    p_visibility: payload.visibility,
  });
}

export async function getCourseEnrollmentLinks(courseId) {
  if (!supabase || !courseId) return { data: [], error: null };
  return supabase
    .from('course_enrollment_links')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });
}

export async function generateCourseEnrollmentLink(courseId, options = {}) {
  if (!supabase || !courseId) return { data: null, error: new Error('Supabase not configured') };
  return supabase.rpc('generate_course_enrollment_link', {
    p_course_id: courseId,
    p_expires_at: options.expires_at || null,
    p_max_students: options.max_students ? Number(options.max_students) : null,
    p_enrollment_method: options.enrollment_method || 'approval_required',
    p_require_approval: options.require_approval ?? true,
  });
}

export async function getCourseByEnrollmentCode(code) {
  if (!supabase || !code) return { data: null, error: null };
  return supabase.rpc('get_course_by_enrollment_code', { p_code: code }).maybeSingle();
}

export async function joinCourseByEnrollmentCode(code, studentId = null) {
  if (!supabase || !code) return { data: null, error: new Error('Supabase not configured') };
  return supabase.rpc('join_course_by_enrollment_code', {
    p_code: code,
    p_student_id: studentId || null,
  });
}

export async function getCourseRoster(courseId) {
  if (!supabase || !courseId) return { data: [], error: null };
  return supabase.rpc('get_course_roster', { p_course_id: courseId });
}

export async function updateCourseMembershipStatus(courseId, userId, status) {
  if (!supabase || !courseId || !userId || !status) return { data: null, error: new Error('Missing enrollment status details') };
  return supabase.rpc('update_course_membership_status', {
    p_course_id: courseId,
    p_user_id: userId,
    p_status: status,
  });
}

export async function setCourseEnrollmentLinkActive(linkId, isActive) {
  if (!supabase || !linkId) return { data: null, error: new Error('Missing enrollment link') };
  return supabase.rpc('set_course_enrollment_link_active', {
    p_link_id: linkId,
    p_is_active: isActive,
  });
}

// Progress rollup
export async function getUserProgress(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('user_progress').select('*').eq('user_id', userId).maybeSingle();
}

export async function upsertUserProgress(userId, updates) {
  if (!supabase || !userId) return { error: null };
  return supabase.from('user_progress').upsert({
    user_id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function incrementQuestionProgress(userId) {
  if (!supabase || !userId) return { error: null };
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await getUserProgress(userId);
  const last = data?.last_activity_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const currentStreak = last === today
    ? (data?.current_streak ?? 0)
    : last === yesterday
      ? (data?.current_streak ?? 0) + 1
      : 1;
  const dailyDone = last === today ? (data?.daily_goal_completed ?? 0) + 1 : 1;
  return upsertUserProgress(userId, {
    completed_questions: (data?.completed_questions ?? 0) + 1,
    daily_goal_completed: dailyDone,
    daily_goal_target: data?.daily_goal_target ?? 25,
    current_streak: currentStreak,
    last_activity_date: today,
    weak_areas: data?.weak_areas ?? [],
  });
}

// ─── Admin helpers ─────────────────────────────────────────
export async function checkTableAvailability(tableNames) {
  if (!supabase) {
    return tableNames.map((name) => ({ name, status: 'not_configured', detail: 'Supabase key missing' }));
  }
  const checks = await Promise.all(tableNames.map(async (name) => {
    const { error } = await supabase.from(name).select('*', { count: 'exact', head: true }).limit(1);
    if (!error) return { name, status: 'ready', detail: 'Table reachable' };
    const missingCodes = new Set(['42P01', 'PGRST116', 'PGRST205']);
    if (missingCodes.has(error.code) || error.message?.toLowerCase().includes('does not exist')) {
      return { name, status: 'missing', detail: 'Apply schema migration' };
    }
    return { name, status: 'protected', detail: 'Table exists or is RLS-protected' };
  }));
  return checks;
}

// ─── Pass probability calculation ─────────────────────────
export function calculatePassProbability(recentAttempts) {
  if (!recentAttempts?.length) return null;
  const last75 = recentAttempts.slice(0, 75);
  const correct = last75.filter((a) => a.is_correct).length;
  const pct = (correct / last75.length) * 100;
  if (pct >= 80) return 95;
  if (pct >= 72) return Math.round(75 + (pct - 72) * 2.5);
  if (pct >= 60) return Math.round(50 + (pct - 60) * 2.1);
  if (pct >= 50) return Math.round(30 + (pct - 50) * 2);
  return Math.max(5, Math.round(pct * 0.5));
}

// ─── SM-2 Spaced Repetition Algorithm ─────────────────────
export function sm2(quality, repetitions, easeFactor, intervalDays) {
  if (quality < 3) {
    return { repetitions: 0, intervalDays: 1, easeFactor };
  }
  const newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let newInterval;
  if (repetitions === 0) newInterval = 1;
  else if (repetitions === 1) newInterval = 6;
  else newInterval = Math.round(intervalDays * easeFactor);
  return { repetitions: repetitions + 1, intervalDays: newInterval, easeFactor: newEF };
}
