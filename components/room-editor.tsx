'use client';
import { useState } from 'react';
import {
  Check,
  RotateCcw,
  X,
  Coins,
  Save,
  MousePointer2,
  Sparkles,
  Star,
  Heart,
  ArrowUpRight,
  Image,
  Type,
  Shapes,
  Palette,
  UserRound,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppIcon } from '@/components/classroom-icon';
import {
  themes,
  fonts,
  banners,
  iconPacks,
  cursors,
  defaultPreferences,
  preferenceCost,
  type Preferences,
} from '@/lib/classroom';
const cursorIcons = {
  default: MousePointer2,
  star: Star,
  heart: Heart,
  sparkle: Sparkles,
  pointer: ArrowUpRight,
};
export function RoomEditor({
  open,
  onClose,
  draft,
  onChange,
  onSave,
  owned,
  coins,
  initialTab = 'theme',
}: {
  open: boolean;
  onClose: () => void;
  draft: Preferences;
  onChange: (p: Preferences) => void;
  onSave: () => void;
  owned: string[];
  coins: number;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const cost = preferenceCost(draft, owned);
  const select = (key: keyof Preferences, value: string | number) =>
    onChange({ ...draft, [key]: value });
  const price = (key: string, id: string, value: number) =>
    value === 0
      ? 'Grátis'
      : owned.includes(`${key}:${id}`)
        ? 'Na sua coleção'
        : `${value} moedas`;
  const mark = (selected: boolean) =>
    selected ? (
      <span className="choice-check">
        <Check size={13} />
      </span>
    ) : null;
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal={false}
    >
      <SheetContent className="room-editor" showCloseButton={false}>
        <div className="editor-heading">
          <div className="editor-kicker">
            <Sparkles size={16} /> SEU ESPAÇO, SEU JEITO
          </div>
          <div className="editor-title-row">
            <SheetTitle>Personalizar sala</SheetTitle>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Fechar editor e descartar alterações"
            >
              <X size={21} />
            </button>
          </div>
          <SheetDescription>
            Experimente na tela. Salve quando ficar a sua cara.
          </SheetDescription>
          <div className="editor-balance">
            <Coins size={19} />
            <strong>{coins.toLocaleString('pt-BR')}</strong>
            <span>moedas disponíveis</span>
          </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(String(v))}
          className="editor-tabs"
        >
          <TabsList
            className="editor-tab-list"
            aria-label="Categorias de personalização"
          >
            {[
              { id: 'theme', name: 'Cores', icon: Palette },
              { id: 'banner', name: 'Banners', icon: Image },
              { id: 'font', name: 'Fontes', icon: Type },
              { id: 'icons', name: 'Ícones', icon: Shapes },
              { id: 'cursor', name: 'Cursores', icon: MousePointer2 },
              { id: 'profile', name: 'Perfil', icon: UserRound },
            ].map(({ id, name, icon: Icon }) => (
              <TabsTrigger value={id} key={id}>
                <Icon size={18} />
                <span>{name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="editor-scroll">
            <TabsContent value="theme">
              <div className="category-title">
                <h3>Uma nova cor para cada dia</h3>
                <p>A paleta muda a sala inteira, incluindo os botões.</p>
              </div>
              <div className="choice-grid">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    className={`choice theme-choice ${draft.theme === t.id ? 'chosen' : ''}`}
                    onClick={() => select('theme', t.id)}
                    aria-pressed={draft.theme === t.id}
                  >
                    <span
                      className="theme-sample"
                      style={{ background: t.swatches[2] }}
                    >
                      <span
                        className="mini-sidebar"
                        style={{ background: t.swatches[1] }}
                      />
                      <span className="mini-content">
                        <i style={{ background: t.swatches[0] }} />
                        <b />
                        <b />
                      </span>
                    </span>
                    <span className="choice-title">
                      {t.name}
                      {mark(draft.theme === t.id)}
                    </span>
                    <small>{price('theme', t.id, t.price)}</small>
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="banner">
              <div className="category-title">
                <h3>Abra uma janela para suas ideias</h3>
                <p>Ilustrações em alta resolução e gradientes nítidos.</p>
              </div>
              <div className="banner-choices">
                {banners.map((b) => (
                  <button
                    key={b.id}
                    className={`choice ${draft.banner === b.id ? 'chosen' : ''}`}
                    onClick={() => select('banner', b.id)}
                    aria-pressed={draft.banner === b.id}
                  >
                    <span className={`banner-sample banner-${b.id}`}>
                      {b.src && <img src={b.src} alt={b.name} />}
                      <span>
                        Seu próximo
                        <br />
                        grande aprendizado.
                      </span>
                    </span>
                    <span className="choice-title">
                      {b.name}
                      {mark(draft.banner === b.id)}
                    </span>
                    <small>{price('banner', b.id, b.price)}</small>
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="font">
              <div className="category-title">
                <h3>Palavras com personalidade</h3>
                <p>Fontes completas, com acentos e diferentes pesos.</p>
              </div>
              <div className="font-choices">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    className={`choice font-choice ${draft.font === f.id ? 'chosen' : ''}`}
                    onClick={() => select('font', f.id)}
                    aria-pressed={draft.font === f.id}
                  >
                    <span
                      className="font-specimen"
                      style={{ fontFamily: f.family }}
                    >
                      Aa <small>Aprender é descobrir.</small>
                    </span>
                    <span className="choice-title">
                      {f.name}
                      {mark(draft.font === f.id)}
                    </span>
                    <p>{f.detail}</p>
                    <small>{price('font', f.id, f.price)}</small>
                  </button>
                ))}
              </div>
              <p className="asset-credit">
                Fontes distribuídas por Fontsource, carregadas junto com a sala.
              </p>
            </TabsContent>
            <TabsContent value="icons">
              <div className="category-title">
                <h3>Pequenos detalhes, outra cara</h3>
                <p>O pack é aplicado à navegação e aos ícones da sala.</p>
              </div>
              <div className="choice-grid">
                {iconPacks.map((p) => (
                  <button
                    key={p.id}
                    className={`choice icon-choice ${draft.icons === p.id ? 'chosen' : ''}`}
                    onClick={() => select('icons', p.id)}
                    aria-pressed={draft.icons === p.id}
                  >
                    <span className="icon-specimen">
                      {(['home', 'tasks', 'calendar', 'star'] as const).map(
                        (name) => (
                          <AppIcon
                            key={name}
                            name={name}
                            pack={p.id}
                            size={28}
                          />
                        ),
                      )}
                    </span>
                    <span className="choice-title">
                      {p.name}
                      {mark(draft.icons === p.id)}
                    </span>
                    <p>{p.detail}</p>
                    <small>{price('icons', p.id, p.price)}</small>
                  </button>
                ))}
              </div>
              <p className="asset-credit">
                Bibliotecas vetoriais Lucide e Phosphor Icons.
              </p>
            </TabsContent>
            <TabsContent value="cursor">
              <div className="category-title">
                <h3>Seu mouse também entra na brincadeira</h3>
                <p>Selecione e mova o mouse pela sala para experimentar.</p>
              </div>
              <div className="choice-grid">
                {cursors.map((c) => {
                  const Icon = cursorIcons[c.id];
                  return (
                    <button
                      key={c.id}
                      className={`choice cursor-choice ${draft.cursor === c.id ? 'chosen' : ''}`}
                      onClick={() => select('cursor', c.id)}
                      aria-pressed={draft.cursor === c.id}
                    >
                      <span className={`cursor-specimen cursor-${c.id}`}>
                        <Icon size={36} />
                      </span>
                      <span className="choice-title">
                        {c.name}
                        {mark(draft.cursor === c.id)}
                      </span>
                      <small>{price('cursor', c.id, c.price)}</small>
                    </button>
                  );
                })}
              </div>
              <div className="cursor-test">
                Passe o mouse aqui <MousePointer2 size={17} />
              </div>
              <p className="asset-credit">
                Os cursores aparecem em dispositivos com mouse. No celular, os
                controles continuam funcionando por toque.
              </p>
            </TabsContent>
            <TabsContent value="profile">
              <div className="category-title">
                <h3>Prazer, você!</h3>
                <p>Escolha seu avatar e como quer aparecer na sala.</p>
              </div>
              <label className="form-label" htmlFor="profile-name">
                Seu nome
              </label>
              <input
                id="profile-name"
                className="text-input"
                maxLength={40}
                value={draft.name}
                onChange={(e) => select('name', e.target.value)}
              />
              <h4 className="avatar-label">Escolha um avatar</h4>
              <div className="avatar-choices">
                {Array.from({ length: 8 }, (_, i) => (
                  <button
                    key={i}
                    className={`avatar-choice ${draft.avatar === i ? 'chosen' : ''}`}
                    aria-label={`Selecionar avatar ${i + 1}`}
                    aria-pressed={draft.avatar === i}
                    onClick={() => select('avatar', i)}
                  >
                    <img src={`./avatars/avatar-${i}.svg`} alt="" />
                    {mark(draft.avatar === i)}
                  </button>
                ))}
              </div>
              <p className="asset-credit">
                Adventurer por Lisa Wischofsky, via{' '}
                <a
                  href="https://www.dicebear.com/styles/adventurer/"
                  target="_blank"
                  rel="noreferrer"
                >
                  DiceBear
                </a>{' '}
                · CC BY 4.0.
              </p>
            </TabsContent>
            <button
              className="reset-style"
              onClick={() =>
                onChange({
                  ...defaultPreferences,
                  name: draft.name,
                  avatar: draft.avatar,
                })
              }
            >
              <RotateCcw size={15} /> Voltar ao visual original
            </button>
          </div>
        </Tabs>
        <footer className="editor-footer">
          <div className="editor-total">
            <span>{cost ? 'Itens novos' : 'Tudo na sua coleção'}</span>
            <strong>{cost ? `${cost} moedas` : 'Sem custo'}</strong>
          </div>
          {cost > coins && (
            <p className="form-error">
              Faltam {cost - coins} moedas. Conclua atividades para ganhar mais.
            </p>
          )}
          <button
            className="primary-button"
            disabled={cost > coins || !draft.name.trim()}
            onClick={onSave}
          >
            <Save size={17} /> Salvar minha sala
          </button>
          <button className="cancel-editor" onClick={onClose}>
            Cancelar alterações
          </button>
          <small>Salvo somente neste navegador.</small>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
