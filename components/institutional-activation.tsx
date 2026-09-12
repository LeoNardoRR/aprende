'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
export function InstitutionalActivation({
  invitation,
}: {
  invitation: string;
}) {
  const [ready, setReady] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const access_token = hash.get('access_token'),
          refresh_token = hash.get('refresh_token');
        if (access_token && refresh_token) {
          const result = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (result.error) throw result.error;
          history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search,
          );
        }
        const result = await supabase.auth.getUser();
        if (active && result.data.user) {
          setEmail(result.data.user.email ?? '');
          setReady(true);
        } else if (active)
          setNotice(
            'Abra o link de ativação recebido por e-mail ou entre com sua conta para aceitar o convite.',
          );
      } catch (error) {
        if (active) setNotice(operationError(error));
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);
  async function activate() {
    setBusy(true);
    setNotice('');
    try {
      if (!ready) {
        const signed = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signed.error) throw signed.error;
        setReady(true);
        setPassword('');
        setNotice(
          'Conta autenticada. Defina sua senha para concluir a ativação.',
        );
        return;
      }
      if (password !== confirm)
        throw new Error('As senhas precisam coincidir.');
      await institutionalRpc('institutional_invitation_context', {
        invitation_id: invitation,
      });
      const changed = await supabase.auth.updateUser({ password });
      if (changed.error) throw changed.error;
      await institutionalRpc('accept_institutional_invitation', {
        invitation_id: invitation,
      });
      setAccepted(true);
      setNotice('Convite aceito. Seu acesso institucional está ativo.');
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="phase12-box" style={{ maxWidth: 560, margin: '8vh auto' }}>
      <h1>Ative seu acesso ao Aprendê</h1>
      <p>
        Confirme sua identidade e defina uma senha pessoal para aceitar o
        vínculo institucional.
      </p>
      {!accepted && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void activate();
          }}
        >
          <label>
            E-mail
            <input
              type="email"
              value={email}
              readOnly={ready}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {ready ? 'Defina sua senha' : 'Senha atual'}
            <input
              type="password"
              autoComplete={ready ? 'new-password' : 'current-password'}
              minLength={ready ? 12 : 1}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {ready && (
            <label>
              Repita a nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          <button disabled={busy}>
            {busy
              ? 'Aguarde…'
              : ready
                ? 'Definir senha e aceitar convite'
                : 'Entrar'}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {accepted && (
        <a
          href={typeof window === 'undefined' ? './' : window.location.pathname}
        >
          Abrir Aprendê
        </a>
      )}
    </main>
  );
}
