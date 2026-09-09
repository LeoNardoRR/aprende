'use client';

import { useState } from 'react';
import { LoaderCircle, Settings, ShieldAlert, Trash2 } from 'lucide-react';
import { studentSupabase, supabase } from '@/lib/supabase';
import { friendlySupabaseError } from '@/lib/connected-flow';

type AccountSettingsProps = {
  role: 'student' | 'teacher';
};

export function AccountSettings({ role }: AccountSettingsProps) {
  const authClient = role === 'student' ? studentSupabase : supabase;
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function deleteAccount() {
    if (confirmation !== 'EXCLUIR' || !password) return;
    setBusy(true);
    setError('');
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user?.email) {
      setError('Sua sessão expirou. Entre novamente para excluir a conta.');
      setBusy(false);
      return;
    }
    const { error: authError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (authError) {
      setError('Senha incorreta. Confirme sua senha e tente novamente.');
      setBusy(false);
      return;
    }
    const { error: deleteError } = await authClient.rpc('delete_my_account', {
      confirmation,
    });
    if (deleteError) {
      setError(friendlySupabaseError(deleteError.message));
      setBusy(false);
      return;
    }
    await authClient.auth.signOut();
    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        className="account-settings-trigger"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <Settings size={16} />
        Configurações
      </button>
      {open && (
        <div className="account-settings-backdrop" role="presentation">
          <dialog
            open
            className="account-settings-dialog"
            aria-modal="true"
            aria-labelledby="account-settings-title"
          >
            <div className="account-settings-heading">
              <span><Settings size={18} /></span>
              <div>
                <h2 id="account-settings-title">Configurações da conta</h2>
                <p>Gerencie sua sessão e seus dados do Aprendê.</p>
              </div>
              <button
                type="button"
                className="account-settings-close"
                aria-label="Fechar configurações"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <section className="account-delete-card">
              <div className="account-delete-icon"><ShieldAlert size={20} /></div>
              <div>
                <h3>Excluir minha conta</h3>
                <p>
                  {role === 'teacher'
                    ? 'Sua conta, turmas, atividades, recados e entregas vinculadas serão excluídos permanentemente.'
                    : 'Sua conta, participação nas turmas e atividades enviadas serão excluídas permanentemente.'}
                </p>
              </div>
            </section>
            <label className="account-settings-label">
              Digite EXCLUIR para continuar
              <input
                type="text"
                name="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
                placeholder="EXCLUIR"
                autoComplete="one-time-code"
                spellCheck={false}
              />
            </label>
            <label className="account-settings-label">
              Confirme sua senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha atual"
                autoComplete="current-password"
              />
            </label>
            {error && <p className="teacher-notice">{error}</p>}
            <div className="account-settings-actions">
              <button
                type="button"
                className="teacher-secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="account-delete-button"
                disabled={busy || confirmation !== 'EXCLUIR' || !password}
                onClick={() => void deleteAccount()}
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                Excluir conta
              </button>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
}
