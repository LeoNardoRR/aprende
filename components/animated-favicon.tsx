'use client';

import { useEffect } from 'react';

const faviconSource = './icons/aprende-favicon-64.png';

export function AnimatedFavicon() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!link || reducedMotion.matches) return;

    const image = new Image();
    let timer: number | undefined;
    let frame = 0;
    let cancelled = false;
    let cleanupListeners = () => {};

    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
      link.href = faviconSource;
    };

    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) return;

      const frames = [
        { angle: -1.2, offsetY: 1, scale: 0.96 },
        { angle: 0, offsetY: 0, scale: 1 },
        { angle: 1.2, offsetY: -1, scale: 0.97 },
        { angle: 0, offsetY: 0, scale: 1 },
      ].map(({ angle, offsetY, scale }) => {
        context.clearRect(0, 0, 64, 64);
        context.save();
        context.translate(32, 32 + offsetY);
        context.rotate((angle * Math.PI) / 180);
        const size = 58 * scale;
        context.drawImage(image, -size / 2, -size / 2, size, size);
        context.restore();
        return canvas.toDataURL('image/png');
      });

      const play = () => {
        stop();
        if (document.hidden || reducedMotion.matches) return;
        link.href = frames[frame % frames.length];
        timer = window.setInterval(() => {
          frame += 1;
          link.href = frames[frame % frames.length];
        }, 900);
      };

      document.addEventListener('visibilitychange', play);
      reducedMotion.addEventListener('change', play);
      cleanupListeners = () => {
        document.removeEventListener('visibilitychange', play);
        reducedMotion.removeEventListener('change', play);
      };
      play();
    };

    image.src = faviconSource;

    return () => {
      cancelled = true;
      stop();
      cleanupListeners();
    };
  }, []);

  return null;
}
