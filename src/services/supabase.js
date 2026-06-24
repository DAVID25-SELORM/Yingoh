import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://mcbfqgyosdklnzbagobp.supabase.co';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const superAdminEmail = (import.meta.env.VITE_SUPER_ADMIN_EMAIL?.trim() || 'cryxtalcfc@gmail.com').toLowerCase();
const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  || (typeof window !== 'undefined' ? window.location.origin : 'https://yingoh.vercel.app');

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

export const yingohTables = {
  profiles: 'profiles',
  roles: 'roles',
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
  return supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
}

export async function sendPasswordResetEmail(email) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl,
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
export async function getQuestions({ topic, type, bookmarked, userId, limit = 50 } = {}) {
  if (!supabase) return { data: null, error: new Error('Not configured') };
  let query = supabase.from('questions').select('*').eq('status', 'published').limit(limit);
  if (topic) query = query.eq('topic', topic);
  if (type) query = query.eq('question_type', type);
  return query;
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
  return supabase.from('attempts').insert({ user_id: userId, question_id: questionId, answer, is_correct: isCorrect });
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
  return supabase.from('study_plans').select('*').eq('user_id', userId).single();
}

export async function saveStudyPlan(userId, examDate, dailyTarget, weakTopics) {
  if (!supabase) return { error: new Error('Not configured') };
  return supabase.from('study_plans').upsert({
    user_id: userId, exam_date: examDate,
    daily_question_target: dailyTarget,
    weak_topics: weakTopics,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
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
