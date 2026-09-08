import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egroulwtaofnnzenbwsr.supabase.co';
const supabasePublishableKey = 'sb_publishable_8SzfeiUXLTQ2XXX0Iv-06Q_HDsZLFrn';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

