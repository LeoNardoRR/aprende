'use client';

import type { Preferences } from '@/lib/classroom';

export function StudentCharacter({
  preferences,
  size = 'hero',
}: {
  preferences: Preferences;
  size?: 'hero' | 'preview' | 'trail';
}) {
  const { hair, hairColor, eyes, outfit, outfitColor, skin } = preferences;
  return (
    <svg
      className={`student-character student-character-${size}`}
      viewBox="0 0 260 320"
      role="img"
      aria-label="Seu personagem personalizado"
    >
      <ellipse cx="130" cy="303" rx="82" ry="12" fill="#163153" opacity=".13" />
      <g className="character-body">
        <path d="M69 294c4-70 20-104 61-104s58 34 62 104" fill={outfitColor} />
        {outfit === 'hoodie' && (
          <>
            <path
              d="M87 212c10-18 26-28 43-28s34 10 44 28l-18 17c-8-13-17-20-26-20s-18 7-26 20z"
              fill="#fff"
              opacity=".2"
            />
            <path
              d="M126 213v68M134 213v68"
              stroke="#fff"
              strokeWidth="4"
              opacity=".75"
            />
          </>
        )}
        {outfit === 'jacket' && (
          <>
            <path d="M87 204l43 24 43-24-9 90H96z" fill="#fff" opacity=".18" />
            <path d="M130 228v66" stroke="#fff" strokeWidth="5" opacity=".8" />
          </>
        )}
        {outfit === 'tee' && (
          <path d="M96 198h68l-10 28h-48z" fill="#fff" opacity=".25" />
        )}
        {outfit === 'overalls' && (
          <>
            <rect
              x="103"
              y="218"
              width="54"
              height="76"
              rx="10"
              fill="#193e68"
              opacity=".7"
            />
            <path
              d="M106 220L96 194M154 220l10-26"
              stroke="#193e68"
              strokeWidth="9"
            />
          </>
        )}
        <rect x="112" y="175" width="36" height="36" rx="16" fill={skin} />
        <ellipse cx="130" cy="116" rx="65" ry="77" fill={skin} />
        <ellipse cx="66" cy="121" rx="13" ry="20" fill={skin} />
        <ellipse cx="194" cy="121" rx="13" ry="20" fill={skin} />
        {hair === 'waves' && (
          <path
            d="M69 107C55 49 88 22 132 27c48-9 74 34 59 83-14-19-27-32-46-39-18 18-47 24-76 19z"
            fill={hairColor}
          />
        )}
        {hair === 'short' && (
          <path
            d="M69 102C63 52 91 30 132 31c41-4 66 26 58 69-18-17-38-25-58-26-20 14-42 20-63 19z"
            fill={hairColor}
          />
        )}
        {hair === 'curls' && (
          <path
            d="M65 107c-12-14-2-29 10-30-9-17 6-30 21-27 0-18 22-24 34-12 12-14 34-5 34 11 19-5 32 15 22 29 17 5 18 25 6 35-15-25-34-36-62-38-23 15-43 22-65 19z"
            fill={hairColor}
          />
        )}
        {hair === 'ponytail' && (
          <>
            <ellipse
              cx="190"
              cy="78"
              rx="30"
              ry="42"
              fill={hairColor}
              transform="rotate(-22 190 78)"
            />
            <path
              d="M69 105C62 54 91 28 132 30c42-3 64 28 57 72-18-19-38-27-58-28-19 14-41 20-62 19z"
              fill={hairColor}
            />
          </>
        )}
        <path
          d="M88 104c12-9 25-10 36-3M136 101c12-8 25-7 36 3"
          stroke={hairColor}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {eyes === 'bright' && (
          <>
            <ellipse cx="106" cy="121" rx="10" ry="13" fill="#fff" />
            <ellipse cx="155" cy="121" rx="10" ry="13" fill="#fff" />
            <circle cx="108" cy="123" r="6" fill="#192333" />
            <circle cx="157" cy="123" r="6" fill="#192333" />
            <circle cx="110" cy="120" r="2" fill="#fff" />
            <circle cx="159" cy="120" r="2" fill="#fff" />
          </>
        )}
        {eyes === 'calm' && (
          <>
            <path
              d="M96 124q10 7 20 0M145 124q10 7 20 0"
              fill="none"
              stroke="#26303c"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </>
        )}
        {eyes === 'happy' && (
          <>
            <path
              d="M96 125q10-12 20 0M145 125q10-12 20 0"
              fill="none"
              stroke="#26303c"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </>
        )}
        <path
          d="M119 153q13 11 28-1"
          fill="none"
          stroke="#9e452f"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="85" cy="145" r="9" fill="#e97a65" opacity=".25" />
        <circle cx="177" cy="145" r="9" fill="#e97a65" opacity=".25" />
      </g>
    </svg>
  );
}
