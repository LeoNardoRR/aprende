import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const origin = Deno.env.get('APP_ORIGIN') ?? 'http://127.0.0.1:3000';
const redirect = Deno.env.get('APP_INVITATION_URL') ?? `${origin}/?invitation=`;
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('{}', { status: 405, headers });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return new Response('{}', { status: 401, headers });
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const caller = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await caller.auth.getUser();
  if (authError || !identity.user) return new Response('{}', { status: 401, headers });
  try {
    const body = await req.json();
    // Server-side authorization and persistence run before contacting Auth.
    const { data, error } = await caller.rpc('manage_institutional_invitation', {
      target_network: body.network_id, target_school: body.school_id || null,
      target_email: body.email, target_role: body.role,
      target_action: body.action ?? 'invite', invitation_id: body.invitation_id || null,
    });
    if (error) return new Response(JSON.stringify({ error: 'Convite não autorizado ou indisponível.' }), { status: 400, headers });
    if (body.action === 'revoke') return new Response(JSON.stringify(data), { headers });
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const sent = await auth.auth.signInWithOtp({ email: body.email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: redirect + data.id } });
    // Same response for an existing or new account; do not return Auth account details.
    if (sent.error) return new Response(JSON.stringify({ id: data.id, error: 'Convite registrado; envio indisponível. Tente reenviar mais tarde.' }), { status: 502, headers });
    return new Response(JSON.stringify({ id: data.id, status: 'pending', message: 'Solicitação de ativação enviada.' }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Solicitação inválida.' }), { status: 400, headers });
  }
});
