import type { Preferences } from './classroom';

// All asset paths are relative so the same character works under /aprende/ on Pages.
const base = './student-assets/';
export const characterSource = (fullBody = false) => `${base}${fullBody ? 'character-fullbody.png' : 'character-original.png'}`;
const loaded = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let promise = loaded.get(src);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { loaded.delete(src); reject(new Error('Personagem indisponível')); };
      img.src = src;
    });
    loaded.set(src, promise);
  }
  return promise;
}
function hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  return [h, max ? d / max : 0, max];
}
function rgb(h: number, s: number, v: number) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6].map(x => Math.round(x * 255));
}
function hexHsv(hex: string) { return hsv(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)); }

export async function renderCharacter(canvas: HTMLCanvasElement, p: Preferences, fullBody = false) {
  const bodyName = p.outfit === 'jacket' ? 'character-jacket.png' : p.outfit === 'tee' ? 'character-tee.png' : 'character-original.png';
  const hairName = p.hair === 'short' ? 'character-short.png' : p.hair === 'curls' ? 'character-curls.png' : 'character-original.png';
  const [body, hair] = await Promise.all([
    loadImage(fullBody ? characterSource(true) : base + bodyName),
    fullBody || hairName === bodyName ? Promise.resolve(null) : loadImage(base + hairName),
  ]);
  const width = fullBody ? 240 : 680;
  canvas.width = width;
  canvas.height = Math.round(width * body.naturalHeight / body.naturalWidth);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(body, 0, 0, canvas.width, canvas.height);
  // The alternate portraits retain the same framing and neck position. Their upper
  // portion is composed with the selected outfit; color changes are applied afterwards.
  if (hair && !fullBody) {
    const split = Math.round(canvas.height * .60);
    ctx.clearRect(0, 0, canvas.width, split);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, split); ctx.clip();
    ctx.drawImage(hair, 0, 0, canvas.width, canvas.height); ctx.restore();
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Remove the neutral exterior matte at render time, preserving enclosed whites
  // (eyes, shirt highlights). The uploaded original already has an alpha channel.
  const pixels = data.data, w = canvas.width, h = canvas.height;
  const visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  function enqueue(index:number) {
    if (index < 0 || index >= visited.length || visited[index]) return;
    visited[index] = 1;
    const n=index*4, r=pixels[n], g=pixels[n+1], b=pixels[n+2];
    if (pixels[n+3]<8 || (Math.max(r,g,b)-Math.min(r,g,b)<27 && Math.min(r,g,b)>150)) queue[tail++]=index;
  }
  for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x);}
  for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1);}
  while(head<tail){const index=queue[head++];pixels[index*4+3]=0;const x=index%w;if(x>0)enqueue(index-1);if(x<w-1)enqueue(index+1);enqueue(index-w);enqueue(index+w);}
  const colors = { hair:hexHsv(p.hairColor), skin:hexHsv(p.skin), eye:hexHsv(p.eyeColor), outfit:hexHsv(p.outfitColor) };
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3] < 8) continue;
    const x = (i / 4 % canvas.width) / canvas.width, y = Math.floor(i / 4 / canvas.width) / canvas.height;
    const [h,s,v] = hsv(data.data[i],data.data[i+1],data.data[i+2]);
    let kind: keyof typeof colors | null = null;
    if (fullBody) {
      if (y < .29 && h < .12 && v < .46) kind = 'hair';
      else if (y < .39 && h > .025 && h < .14 && s > .3 && v > .5) kind = 'skin';
      else if (y > .29 && y < .68 && h > .48 && h < .78 && s > .2) kind = 'outfit';
    } else {
      const leftEye = ((x-.543)/.025)**2 + ((y-.337)/.028)**2 < 1;
      const rightEye = ((x-.68)/.024)**2 + ((y-.365)/.032)**2 < 1;
      if ((leftEye || rightEye) && v > .07 && v < .55 && s > .12) kind = 'eye';
      else if (y < .56 && h < .13 && v < .48 && !(leftEye || rightEye)) kind = 'hair';
      else if (y < .78 && h > .025 && h < .14 && s > .33 && v > .53) kind = 'skin';
      else if (y > .51 && s > .25 && ((h > .52 && h < .79) || (p.outfit === 'jacket' && h > .32 && h < .58) || (p.outfit === 'tee' && h > .015 && h < .13))) kind = 'outfit';
    }
    if (!kind) continue;
    // The initial look uses the original pixels exactly. Shading and highlights are
    // retained when a color is changed, rather than tinting the whole character.
    const defaults = {hair:'#3b241d',skin:'#f2a06b',eye:'#38231c',outfit:'#244b82'};
    const selected = {hair:p.hairColor,skin:p.skin,eye:p.eyeColor,outfit:p.outfitColor}[kind];
    if (selected === defaults[kind]) continue;
    const [nh,ns,nv] = colors[kind];
    const value = kind === 'skin' ? Math.min(1, v * (nv / .95)) : kind === 'hair' ? Math.min(1, v * (nv / .25)) : kind === 'eye' ? Math.min(.85, v * (nv / .3)) : Math.min(1, v * (nv / .52));
    const [r,g,b] = rgb(nh, Math.min(1, ns * (.7 + s * .4)), value);
    data.data[i]=r; data.data[i+1]=g; data.data[i+2]=b;
  }
  ctx.putImageData(data,0,0);
}
