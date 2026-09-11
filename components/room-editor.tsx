'use client';
import { useState } from 'react';
import { Check, X, Save, Sparkles, Image, UserRound } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StudentCharacter } from './student-character';
import type { Preferences } from '@/lib/classroom';

export function RoomEditor({open,onClose,draft,onChange,onSave,saving,accountConnected,initialTab='profile'}:{
  open:boolean; onClose:()=>void; draft:Preferences; onChange:(p:Preferences)=>void;
  onSave:()=>void|Promise<void>; saving:boolean; accountConnected:boolean; owned:string[]; coins:number; initialTab?:string;
}) {
  const [tab,setTab]=useState(initialTab==='banner'?'banner':'profile');
  const select=(key:keyof Preferences,value:string)=>onChange({...draft,[key]:value});
  return <Sheet open={open} onOpenChange={(value)=>{if(!value)onClose();}} modal={true}>
    <SheetContent className="room-editor student-character-editor" showCloseButton={false}>
      <header className="editor-heading"><div className="editor-kicker"><Sparkles size={17}/> SEU ESPAÇO, SEU JEITO</div><div className="editor-title-row"><SheetTitle>Personalizar sala</SheetTitle><button className="icon-button" aria-label="Fechar editor e descartar alterações" onClick={onClose}><X/></button></div><SheetDescription>Escolha seu visual e salve quando ficar a sua cara.</SheetDescription></header>
      <Tabs value={tab} onValueChange={(value)=>setTab(String(value))} className="editor-tabs"><TabsList className="editor-tab-list" aria-label="Categorias de personalização"><TabsTrigger value="profile"><UserRound size={18}/>Personagem</TabsTrigger><TabsTrigger value="banner"><Image size={18}/>Banner</TabsTrigger></TabsList>
      <div className="editor-scroll">
        <TabsContent value="profile"><div className="character-editor-preview"><StudentCharacter preferences={draft} size="preview"/></div>
          <Choices label="Estilo de cabelo" value={draft.hair} options={[["waves","Original"],["short","Curto"],["curls","Cacheado"]]} onSelect={(v)=>select('hair',v)}/>
          <Colors label="Cor do cabelo" value={draft.hairColor} options={[["#3b241d","Castanho"],["#171717","Preto"],["#8a4d25","Ruivo"],["#d6a23e","Loiro"],["#7a3f78","Violeta"]]} onSelect={(v)=>select('hairColor',v)}/>
          <Colors label="Cor de pele" value={draft.skin} options={[["#f6c49b","Clara"],["#f2a06b","Original"],["#d98251","Dourada"],["#b8643e","Morena"],["#7c422d","Escura"]]} onSelect={(v)=>select('skin',v)}/>
          <Colors label="Cor dos olhos" value={draft.eyeColor} options={[["#38231c","Castanho"],["#276caa","Azul"],["#3b865d","Verde"],["#9282be","Violeta"],["#141b29","Preto"]]} onSelect={(v)=>select('eyeColor',v)}/>
          <Choices label="Roupa" value={draft.outfit} options={[["hoodie","Moletom"],["jacket","Jaqueta"],["tee","Camiseta"]]} onSelect={(v)=>select('outfit',v)}/>
          <Colors label="Cor da roupa" value={draft.outfitColor} options={[["#244b82","Original"],["#7a4eb3","Roxo"],["#248069","Verde"],["#d95736","Laranja"],["#cc4778","Rosa"]]} onSelect={(v)=>select('outfitColor',v)}/>
        </TabsContent>
        <TabsContent value="banner"><div className="category-title"><h3>Cor do banner</h3><p>Um novo cenário para a sua jornada.</p></div><div className="editor-banner-options">{[['creative','Azul céu','#a2dff8'],['cosmos','Lilás','#d4c5ff'],['aurora','Verde','#c0ecd5'],['candy','Rosa','#f9d1df']].map(([id,name,color])=><button key={id} aria-pressed={draft.banner===id} onClick={()=>select('banner',id)}><i style={{background:color}}/>{name}</button>)}</div></TabsContent>
      </div></Tabs>
      <footer className="editor-footer"><button className="primary-button" disabled={saving} onClick={()=>void onSave()}><Save size={18}/>{saving?'Salvando...':'Salvar minha sala'}</button><button className="cancel-editor" onClick={onClose}>Cancelar alterações</button><small>{accountConnected?'Personagem e banner ficam salvos na sua conta.':'Personagem e banner ficam salvos neste navegador.'}</small></footer>
    </SheetContent>
  </Sheet>;
}
function Choices({label,value,options,onSelect}:{label:string;value:string;options:string[][];onSelect:(value:string)=>void}){
 return <fieldset className="character-option-row"><legend>{label}</legend><div className="trait-buttons">{options.map(([id,name])=><button type="button" key={id} className={value===id?'chosen':''} aria-pressed={value===id} onClick={()=>onSelect(id)}>{name}</button>)}</div></fieldset>;
}
function Colors({label,value,options,onSelect}:{label:string;value:string;options:string[][];onSelect:(value:string)=>void}){
 return <fieldset className="character-option-row"><legend>{label}</legend><div className="trait-swatches">{options.map(([id,name])=><button type="button" key={id} title={name} aria-label={`${label}: ${name}`} className={value===id?'chosen':''} style={{background:id}} aria-pressed={value===id} onClick={()=>onSelect(id)}>{value===id&&<Check size={18}/>}</button>)}</div></fieldset>;
}
