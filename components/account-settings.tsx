'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageUp, LoaderCircle, Settings, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { studentSupabase, supabase } from '@/lib/supabase';
import { friendlySupabaseError } from '@/lib/connected-flow';

type AccountSettingsProps = {
  role: 'student' | 'teacher';
  avatarUrl?: string | null;
  onAvatarUpdated?: (url: string | null) => void;
};

function avatarStoragePath(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/teacher-avatars/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  return decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
}

async function prepareAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 10 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
      image.src = objectUrl;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    const sourceX = (image.naturalWidth - side) / 2;
    const verticalOverflow = image.naturalHeight - side;
    const sourceY = verticalOverflow > 0 ? verticalOverflow * 0.24 : 0;
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível salvar a imagem.')),
        'image/jpeg',
        0.86,
      ),
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AccountSettings({ role, avatarUrl = null, onAvatarUpdated }: AccountSettingsProps) {
  const authClient = role === 'student' ? studentSupabase : supabase;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState('');

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setAvatarNotice('Preparando sua foto...');
    try {
      const prepared = await prepareAvatar(file);
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
      const previousPath = avatarStoragePath(avatarUrl);
      const path = `${user.id}/profile-${Date.now()}.jpg`;
      setAvatarNotice('Enviando sua foto...');
      const { error: uploadError } = await authClient.storage
        .from('teacher-avatars')
        .upload(path, prepared, { contentType: 'image/jpeg', cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = authClient.storage.from('teacher-avatars').getPublicUrl(path);
      const nextUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await authClient
        .from('profiles')
        .update({ avatar_url: nextUrl })
        .eq('id', user.id);
      if (profileError) throw profileError;
      onAvatarUpdated?.(nextUrl);
      setAvatarNotice('Foto atualizada.');
      if (previousPath && previousPath !== path) {
        void authClient.storage.from('teacher-avatars').remove([previousPath]);
      }
    } catch (uploadError) {
      setAvatarNotice(uploadError instanceof Error ? friendlySupabaseError(uploadError.message) : 'Não foi possível atualizar a foto.');
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarNotice('');
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      setAvatarNotice('Sua sessão expirou. Entre novamente.');
      setAvatarBusy(false);
      return;
    }
    const currentPath = avatarStoragePath(avatarUrl);
    if (currentPath) {
      const { error: storageError } = await authClient.storage
        .from('teacher-avatars')
        .remove([currentPath]);
      if (storageError) {
        setAvatarNotice(friendlySupabaseError(storageError.message));
        setAvatarBusy(false);
        return;
      }
    }
    const { error: profileError } = await authClient
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);
    if (profileError) setAvatarNotice(friendlySupabaseError(profileError.message));
    else {
      onAvatarUpdated?.(null);
      setAvatarNotice('Foto removida.');
    }
    setAvatarBusy(false);
  }

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
      {open && createPortal(
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
            {role === 'teacher' && (
              <section className="account-avatar-card">
                <div className="account-avatar-preview">
                  {avatarUrl ? <img src={avatarUrl} alt="Sua foto de perfil" /> : <UserRound size={30} />}
                </div>
                <div>
                  <h3>Foto de perfil</h3>
                  <p>A imagem será cortada ao centro e otimizada automaticamente.</p>
                  <div className="account-avatar-actions">
                    <input
                      ref={fileInputRef}
                      className="account-avatar-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={avatarBusy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAvatar(file);
                      }}
                    />
                    <button
                      type="button"
                      className="teacher-primary compact"
                      disabled={avatarBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarBusy ? <LoaderCircle className="spin" size={16} /> : <ImageUp size={16} />}
                      {avatarBusy ? 'Enviando...' : 'Escolher foto'}
                    </button>
                    {avatarUrl && (
                      <button type="button" className="teacher-secondary compact" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                        Remover foto
                      </button>
                    )}
                  </div>
                  {avatarNotice && <output className="account-avatar-notice">{avatarNotice}</output>}
                </div>
              </section>
            )}
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
        </div>,
        document.body,
      )}
    </>
  );
}
