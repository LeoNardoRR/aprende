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
      {size !== 'trail' && <CharacterAccessory type={preferences.accessory} color={preferences.accessoryColor}/>}
    </span>
  );
}

function CharacterAccessory({type,color}:{type:string;color:string}){
  if(type==='none') return null;
  return <svg className="character-accessory" viewBox="0 0 1348 1167" aria-hidden="true">
    {type==='round-glasses'&&<g fill="none" stroke={color} strokeWidth="20"><ellipse cx="733" cy="395" rx="72" ry="63"/><ellipse cx="919" cy="427" rx="69" ry="62"/><path d="M803 405q25-12 49 5M663 387l-66-24m391 72 63-2"/></g>}
    {type==='square-glasses'&&<g fill="none" stroke={color} strokeWidth="18" strokeLinejoin="round"><path d="M657 329l151 25-14 112-145-23Zm211 36 143 26-19 109-139-25Z"/><path d="M802 399q28-12 55 7M657 376l-62-22m414 83 55 2"/></g>}
    {type==='sunglasses'&&<g fill="#19202b" fillOpacity=".86" stroke={color} strokeWidth="13"><path d="M650 339l159 25-16 106-143-25Z"/><path d="M861 375l155 26-22 105-143-26Z"/><path d="M800 403q31-13 61 8" fill="none"/></g>}
    {type==='earrings'&&<g fill="none" stroke={color} strokeWidth="13"><circle cx="473" cy="524" r="25"/><circle cx="1040" cy="559" r="25"/></g>}
    {type==='necklace'&&<g fill="none" stroke={color} strokeWidth="12"><path d="M565 800q113 145 248 5"/><circle cx="690" cy="914" r="22" fill={color}/></g>}
    {type==='headphones'&&<g fill="none" stroke={color} strokeWidth="30"><path d="M449 439q-3-294 280-322 278-27 341 244"/><rect x="423" y="411" width="67" height="171" rx="30" fill={color}/><rect x="1016" y="444" width="67" height="171" rx="30" fill={color}/></g>}
    {type==='headband'&&<path d="M474 252q238-169 470 18" fill="none" stroke={color} strokeWidth="34" strokeLinecap="round"/>}
  </svg>;
}
