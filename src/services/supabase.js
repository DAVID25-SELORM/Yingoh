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
