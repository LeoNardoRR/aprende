import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egroulwtaofnnzenbwsr.supabase.co';
const supabasePublishableKey = 'sb_publishable_8SzfeiUXLTQ2XXX0Iv-06Q_HDsZLFrn';
const callbackMode = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('auth');

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storageKey: 'aprende-teacher-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: callbackMode === 'teacher',
  },
});

export const studentSupabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storageKey: 'aprende-student-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: callbackMode === 'student',
  },
});
