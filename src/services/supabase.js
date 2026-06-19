import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://mcbfqgyosdklnzbagobp.supabase.co';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const supabaseConfig = {
  url: supabaseUrl,
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
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
};

export async function getCurrentSession() {
  if (!supabase) {
    return { data: { session: null }, error: null };
  }

  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange(callback);
}

export async function signInWithEmail(email, password) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') };
  }

  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail({ email, password, fullName }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') };
  }

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
}

export async function signOut() {
  if (!supabase) {
    return { error: null };
  }

  return supabase.auth.signOut();
}

export async function checkTableAvailability(tableNames) {
  if (!supabase) {
    return tableNames.map((name) => ({
      name,
      status: 'not_configured',
      detail: 'Supabase key missing',
    }));
  }

  const checks = await Promise.all(tableNames.map(async (name) => {
    const { error } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (!error) {
      return { name, status: 'ready', detail: 'Table reachable' };
    }

    const missingCodes = new Set(['42P01', 'PGRST116', 'PGRST205']);
    if (missingCodes.has(error.code) || error.message?.toLowerCase().includes('does not exist')) {
      return { name, status: 'missing', detail: 'Apply schema migration' };
    }

    return { name, status: 'protected', detail: 'Table exists or is RLS-protected' };
  }));

  return checks;
}
