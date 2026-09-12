'use client';

import { useEffect, useRef, useState } from 'react';
import type { Preferences } from '@/lib/classroom';
import { renderCharacter, characterSource } from '@/lib/student-character-renderer';

export function StudentCharacter({ preferences, size = 'hero' }: {
  preferences: Preferences;
  size?: 'hero' | 'preview' | 'trail';
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    let current = true;
    setRendered(false);
    if (canvas.current) {
      void renderCharacter(canvas.current, preferences, size === 'trail')
        .then(() => { if (current) setRendered(true); })
        .catch(() => { /* Keep the supplied original visible if an asset cannot load. */ });
    }
    return () => { current = false; };
  }, [preferences.presentation, preferences.hair, preferences.hairColor, preferences.skin, preferences.eyeColor, preferences.outfit, preferences.outfitColor, size]);
  return (
    <span className={`student-character student-character-${size}`} role="img" aria-label="Seu personagem personalizado">
      <img src={characterSource(size === 'trail')} alt="" className={rendered ? 'character-fallback is-rendered' : 'character-fallback'} />
      <canvas ref={canvas} className={rendered ? 'character-canvas is-rendered' : 'character-canvas'} aria-hidden="true" />
    </span>
  );
}
