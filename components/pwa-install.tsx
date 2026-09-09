'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstalled(standalone);
    setIsIos(ios);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setInstalled(false);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  async function install() {
    if (isIos && !prompt) {
      setShowIosHelp(true);
      return;
    }
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  if (installed || (!prompt && !isIos)) return null;

  return (
    <>
      <button type="button" className="pwa-install-button" onClick={() => void install()}>
        <Download size={18} />
        Instalar Aprendê
      </button>
      {showIosHelp && (
        <div className="pwa-install-backdrop" role="presentation">
          <dialog open className="pwa-install-dialog" aria-labelledby="pwa-install-title">
            <button
              type="button"
              className="pwa-install-close"
              aria-label="Fechar"
              onClick={() => setShowIosHelp(false)}
            >
              <X size={19} />
            </button>
            <span><Share2 size={25} /></span>
            <h2 id="pwa-install-title">Instalar Aprendê no iPhone</h2>
            <p>
              No Safari, toque em <strong>Compartilhar</strong> e escolha
              <strong> Adicionar à Tela de Início</strong>.
            </p>
            <button type="button" className="teacher-primary" onClick={() => setShowIosHelp(false)}>
              Entendi
            </button>
          </dialog>
        </div>
      )}
    </>
  );
}
