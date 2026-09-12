'use client';
import { useEffect, useState } from 'react';
import { InstitutionalPedagogy } from './institutional-pedagogy';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
export function TeacherItemBank({
  profile,
  preview = false,
}: {
  profile: { id: string; display_name: string; avatar_url: string | null };
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [networks, setNetworks] = useState<Tables<'networks'>[]>([]),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || preview) return;
    let active = true;
    setLoading(true);
    void supabase
      .from('networks')
      .select('*')
      .order('name')
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return;
        setNetworks(data ?? []);
        setNotice(error ? 'Não foi possível carregar suas redes.' : '');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, preview]);
  return (
    <section className="phase12-box">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        Banco de itens da rede
      </button>
      {open &&
        (loading ? (
          <p role="status">Carregando redes…</p>
        ) : notice ? (
          <p role="alert">{notice}</p>
        ) : networks.length ? (
          <InstitutionalPedagogy
            profile={{ ...profile, role: 'teacher' }}
            networks={networks}
          />
        ) : (
          <p>
            {preview
              ? 'Modo DEMO. O banco institucional exige vínculo real com uma rede.'
              : 'Seu acesso ao banco depende de um vínculo institucional ativo. Solicite o convite à gestão.'}
          </p>
        ))}
    </section>
  );
}
