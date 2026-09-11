'use client';
import { useState } from 'react';
import { Check, X, Save, Sparkles, Image, UserRound, Dices, RotateCcw, Scissors, Eye, Shirt, Glasses } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StudentCharacter } from './student-character';
import { defaultPreferences, type Preferences } from '@/lib/classroom';

const hairColors=[['#171717','Preto'],['#3b241d','Castanho'],['#68402b','Chocolate'],['#8a4d25','Cobre'],['#d6a23e','Loiro'],['#c85d35','Ruivo'],['#77736f','Gris'],['#f1eadc','Branco'],['#315caa','Azul'],['#d94e91','Rosa'],['#7a3f78','Roxo'],['#2f855a','Verde']];
const skinColors=[['#f8d8bd','Porcelana'],['#f6c49b','Claro'],['#f2a06b','Dourado'],['#d98251','Quente'],['#b8643e','Moreno'],['#945333','Canela'],['#7c422d','Escuro'],['#4c2b22','Profundo']];
const eyeColors=[['#38231c','Castanho'],['#8a5b38','Mel'],['#141b29','Preto'],['#276caa','Azul'],['#3b865d','Verde'],['#66717f','Cinza'],['#b78335','Âmbar']];
const outfitColors=[['#244b82','Azul'],['#7a4eb3','Roxo'],['#248069','Verde'],['#d95736','Laranja'],['#cc4778','Rosa'],['#202632','Preto'],['#e8e1d7','Claro'],['#d9a323','Mostarda'],['#347fc4','Celeste']];
const presentations=[['masculine','Masculino','♂'],['feminine','Feminino','♀'],['neutral','Neutro','◇']];
const hairStyles=[['waves','Original'],['long','Longo'],['bob','Médio'],['ponytail','Rabo de cavalo'],['bun','Coque']];
const accessories=[['none','Sem acessório'],['round-glasses','Óculos redondo'],['square-glasses','Óculos quadrado'],['sunglasses','Óculos escuro'],['earrings','Brincos'],['necklace','Colar'],['headphones','Headphone'],['headband','Tiara']];
const accessoryColors=[['#26354a','Grafite'],['#7d4b32','Marrom'],['#d4a229','Dourado'],['#e8e1d7','Claro'],['#cc4778','Rosa'],['#347fc4','Azul'],['#248069','Verde']];
const presets:Record<string,Partial<Preferences>>={
 'Clássico':{hairColor:'#3b241d',outfitColor:'#244b82'},
 'Urbano':{hairColor:'#171717',outfitColor:'#202632'},
 'Criativo':{hairColor:'#7a3f78',outfitColor:'#d95736'},
 'Natureza':{hairColor:'#68402b',outfitColor:'#248069'},
};

export function RoomEditor({open,onClose,draft,onChange,onSave,saving,accountConnected,initialTab='profile'}:{
 open:boolean;onClose:()=>void;draft:Preferences;onChange:(p:Preferences)=>void;onSave:()=>void|Promise<void>;saving:boolean;accountConnected:boolean;owned:string[];coins:number;initialTab?:string;
}){
 const [tab,setTab]=useState(initialTab==='banner'?'banner':'profile');
 const [category,setCategory]=useState<'identity'|'face'|'hair'|'clothes'|'accessories'>('identity');
 const select=(key:keyof Preferences,value:string)=>onChange({...draft,[key]:value});
 const pick=(items:string[][])=>items[Math.floor(Math.random()*items.length)][0];
 const randomize=()=>onChange({...draft,presentation:pick(presentations),hair:pick(hairStyles),hairColor:pick(hairColors),skin:pick(skinColors),eyeColor:pick(eyeColors),outfit:'hoodie',outfitColor:pick(outfitColors),accessory:pick(accessories),accessoryColor:pick(accessoryColors)});
 const reset=()=>{if(window.confirm('Recomeçar o personagem e apagar as alterações desta edição?'))onChange({...draft,presentation:defaultPreferences.presentation,hair:defaultPreferences.hair,hairColor:defaultPreferences.hairColor,skin:defaultPreferences.skin,eyeColor:defaultPreferences.eyeColor,outfit:defaultPreferences.outfit,outfitColor:defaultPreferences.outfitColor,accessory:defaultPreferences.accessory,accessoryColor:defaultPreferences.accessoryColor})};
 const selectPresentation=(value:string)=>onChange({...draft,presentation:value,hair:value==='feminine'&&draft.hair==='waves'?'long':value==='masculine'&&['long','bob','ponytail','bun'].includes(draft.hair)?'waves':draft.hair});
 return <Sheet open={open} onOpenChange={value=>{if(!value)onClose()}} modal>
  <SheetContent className="room-editor student-character-editor" showCloseButton={false}>
   <header className="editor-heading"><div className="editor-kicker"><Sparkles size={17}/> ESTÚDIO DO PERSONAGEM</div><div className="editor-title-row"><SheetTitle>Seu personagem</SheetTitle><button className="icon-button" aria-label="Fechar editor e descartar alterações" onClick={onClose}><X/></button></div><SheetDescription>Personalize sem mudar a identidade do personagem. Toda escolha aparece na hora.</SheetDescription></header>
   <Tabs value={tab} onValueChange={value=>setTab(String(value))} className="editor-tabs"><TabsList className="editor-tab-list" aria-label="Categorias de personalização"><TabsTrigger value="profile"><UserRound size={18}/>Personagem</TabsTrigger><TabsTrigger value="banner"><Image size={18}/>Banner</TabsTrigger></TabsList>
    <div className="editor-scroll">
     <TabsContent value="profile">
      <div className="avatar-studio">
       <section className="avatar-preview-stage">
        <span className="avatar-preview-label"><i/> PRÉVIA AO VIVO</span>
        <span className="avatar-presentation-badge">{presentations.find(([id])=>id===draft.presentation)?.[1]??'Neutro'}</span>
        <StudentCharacter preferences={draft} size="preview"/>
        <div className="avatar-preview-actions"><button type="button" onClick={randomize}><Dices/>Gerar personagem</button><button type="button" onClick={reset}><RotateCcw/>Recomeçar</button></div>
       </section>
       <section className="avatar-controls">
        <nav className="avatar-category-nav" aria-label="Partes do personagem">
         <button className={category==='identity'?'active':''} onClick={()=>setCategory('identity')}><UserRound/><span>Identidade</span></button>
         <button className={category==='face'?'active':''} onClick={()=>setCategory('face')}><Eye/><span>Rosto</span></button>
         <button className={category==='hair'?'active':''} onClick={()=>setCategory('hair')}><Scissors/><span>Cabelo</span></button>
         <button className={category==='clothes'?'active':''} onClick={()=>setCategory('clothes')}><Shirt/><span>Roupa</span></button>
         <button className={category==='accessories'?'active':''} onClick={()=>setCategory('accessories')}><Glasses/><span>Acessórios</span></button>
        </nav>
        <div className="avatar-category-panel">
         {category==='identity'&&<><div className="character-category-title"><UserRound/><div><h3>Identidade do personagem</h3><p>Escolha uma apresentação inicial e continue personalizando livremente.</p></div></div><fieldset className="character-option-row"><legend>Sexo do personagem</legend><div className="presentation-options">{presentations.map(([id,name,symbol])=><button type="button" key={id} className={draft.presentation===id?'chosen':''} aria-pressed={draft.presentation===id} onClick={()=>selectPresentation(id)}><b>{symbol}</b><span>{name}</span>{draft.presentation===id&&<Check/>}</button>)}</div></fieldset><fieldset className="character-option-row"><legend>Combinações prontas</legend><div className="avatar-presets">{Object.entries(presets).map(([name,preset])=><button key={name} onClick={()=>onChange({...draft,...preset})}>{name}</button>)}</div></fieldset></>}
         {category==='face'&&<><div className="character-category-title"><Eye/><div><h3>Pele e olhos</h3><p>Cores organizadas em uma única etapa.</p></div></div><Colors label="Tom de pele" value={draft.skin} options={skinColors} onSelect={v=>select('skin',v)}/><Colors label="Cor dos olhos" value={draft.eyeColor} options={eyeColors} onSelect={v=>select('eyeColor',v)}/></>}
         {category==='hair'&&<><div className="character-category-title"><Scissors/><div><h3>Cabelo</h3><p>Escolha entre cortes curtos, médios e longos.</p></div></div><Choices label="Estilo do cabelo" value={draft.hair} options={hairStyles} onSelect={v=>select('hair',v)}/><Colors label="Cor do cabelo" value={draft.hairColor} options={hairColors} onSelect={v=>select('hairColor',v)}/></>}
         {category==='clothes'&&<><div className="character-category-title"><Shirt/><div><h3>Roupa</h3><p>Personalize a cor mantendo o modelo e as proporções originais.</p></div></div><Colors label="Cor da roupa" value={draft.outfitColor} options={outfitColors} onSelect={v=>select('outfitColor',v)}/></>}
         {category==='accessories'&&<><div className="character-category-title"><Glasses/><div><h3>Acessórios</h3><p>Combine óculos, joias, tiara ou headphone com qualquer visual.</p></div></div><Choices label="Escolha um acessório" value={draft.accessory} options={accessories} onSelect={v=>select('accessory',v)}/><Colors label="Cor do acessório" value={draft.accessoryColor} options={accessoryColors} onSelect={v=>select('accessoryColor',v)}/></>}
        </div>
       </section>
      </div>
     </TabsContent>
     <TabsContent value="banner"><div className="category-title"><h3>Cor do banner</h3><p>Um novo cenário para a sua jornada.</p></div><div className="editor-banner-options">{[['creative','Azul céu','#a2dff8'],['cosmos','Lilás','#d4c5ff'],['aurora','Verde','#c0ecd5'],['candy','Rosa','#f9d1df']].map(([id,name,color])=><button key={id} aria-pressed={draft.banner===id} onClick={()=>select('banner',id)}><i style={{background:color}}/>{name}</button>)}</div></TabsContent>
    </div>
   </Tabs>
   <footer className="editor-footer"><button className="primary-button" disabled={saving} onClick={()=>void onSave()}><Save size={18}/>{saving?'Salvando...':'Salvar personagem'}</button><button className="cancel-editor" onClick={onClose}>Cancelar alterações</button><small>{accountConnected?'O personagem e o banner ficam salvos na sua conta.':'O personagem e o banner ficam salvos neste navegador.'}</small></footer>
  </SheetContent>
 </Sheet>;
}
function Choices({label,value,options,onSelect}:{label:string;value:string;options:string[][];onSelect:(v:string)=>void}){return <fieldset className="character-option-row"><legend>{label}</legend><div className="trait-buttons avatar-choice-grid">{options.map(([id,name])=><button type="button" key={id} className={value===id?'chosen':''} aria-pressed={value===id} onClick={()=>onSelect(id)}>{name}{value===id&&<Check/>}</button>)}</div></fieldset>}
function Colors({label,value,options,onSelect}:{label:string;value:string;options:string[][];onSelect:(v:string)=>void}){return <fieldset className="character-option-row"><legend>{label}</legend><div className="trait-swatches">{options.map(([id,name])=><button type="button" key={id} title={name} aria-label={`${label}: ${name}`} className={value===id?'chosen':''} style={{background:id}} aria-pressed={value===id} onClick={()=>onSelect(id)}>{value===id&&<Check/>}</button>)}</div></fieldset>}
