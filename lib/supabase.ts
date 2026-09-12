import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = 'https://egroulwtaofnnzenbwsr.supabase.co';
const supabasePublishableKey = 'sb_publishable_8SzfeiUXLTQ2XXX0Iv-06Q_HDsZLFrn';
const callbackMode = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('auth');
export const initialAuthCallbackType =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.hash.slice(1)).get('type');

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storageKey: 'aprende-teacher-auth',
    persistSession: true,
    autoRefreshToken: true,
    // GitHub Pages is a client-only app; implicit flow lets confirmation links
    // finish on another browser/device without a local PKCE verifier.
    flowType: 'implicit',
    detectSessionInUrl: callbackMode === 'teacher',
  },
});

export const studentSupabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storageKey: 'aprende-student-auth',
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'implicit',
    detectSessionInUrl: callbackMode === 'student',
  },
});
