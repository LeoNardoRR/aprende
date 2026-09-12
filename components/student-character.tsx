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
    {type==='round-glasses'&&<g fill="none" stroke={color} strokeWidth="13"><ellipse cx="738" cy="399" rx="61" ry="52" transform="rotate(8 738 399)"/><ellipse cx="916" cy="429" rx="59" ry="52" transform="rotate(9 916 429)"/><path d="M800 408q27-10 56 5M678 389l-55-21m352 70 48 1" strokeLinecap="round"/></g>}
    {type==='square-glasses'&&<g fill="none" stroke={color} strokeWidth="13" strokeLinejoin="round"><rect x="674" y="350" width="132" height="96" rx="18" transform="rotate(8 740 398)"/><rect x="851" y="380" width="128" height="94" rx="18" transform="rotate(9 915 427)"/><path d="M805 407q25-9 48 5M675 385l-53-20m356 71 46 1" strokeLinecap="round"/></g>}
    {type==='sunglasses'&&<g fill="#202735" fillOpacity=".82" stroke={color} strokeWidth="10"><rect x="674" y="351" width="134" height="94" rx="22" transform="rotate(8 741 398)"/><rect x="850" y="380" width="130" height="94" rx="22" transform="rotate(9 915 427)"/><path d="M806 406q25-9 47 5M675 385l-53-20m356 71 46 1" fill="none" strokeLinecap="round"/></g>}
    {type==='earrings'&&<g fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"><circle cx="486" cy="535" r="15"/><path d="M486 550v15"/><circle cx="1034" cy="565" r="15"/><path d="M1034 580v15"/></g>}
    {type==='necklace'&&<g fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"><path d="M588 795q92 88 190 17"/><circle cx="691" cy="856" r="14" fill={color}/></g>}
    {type==='headphones'&&<g fill="none" stroke={color} strokeWidth="20" strokeLinecap="round"><path d="M469 443q12-258 276-276 250-15 305 213"/><rect x="442" y="423" width="55" height="139" rx="24" fill={color}/><rect x="1009" y="447" width="55" height="139" rx="24" fill={color}/></g>}
    {type==='headband'&&<g fill="none" stroke={color} strokeLinecap="round"><path d="M506 292q208-151 425-2" strokeWidth="22"/><path d="M689 188l32-42 31 43 45-19-11 49" strokeWidth="13" strokeLinejoin="round"/></g>}
  </svg>;
}
