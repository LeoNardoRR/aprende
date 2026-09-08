'use client';
import { House, ClipboardList, ChartColumn, BookOpen, CalendarDays, Palette, Bell, Trophy, Star, CheckCircle, GraduationCap } from 'lucide-react';
import { HouseIcon, ClipboardTextIcon, ChartBarIcon, BookOpenIcon, CalendarDotsIcon, PaletteIcon, BellIcon, TrophyIcon, StarIcon, CheckCircleIcon, GraduationCapIcon } from '@phosphor-icons/react';
const line={home:House,attendance:ClipboardList,grades:ChartColumn,tasks:BookOpen,calendar:CalendarDays,palette:Palette,bell:Bell,trophy:Trophy,star:Star,check:CheckCircle,school:GraduationCap};
const duo={home:HouseIcon,attendance:ClipboardTextIcon,grades:ChartBarIcon,tasks:BookOpenIcon,calendar:CalendarDotsIcon,palette:PaletteIcon,bell:BellIcon,trophy:TrophyIcon,star:StarIcon,check:CheckCircleIcon,school:GraduationCapIcon};
export type IconName=keyof typeof line;
export function AppIcon({name,pack='duotone',size=24,className=''}:{name:IconName;pack?:string;size?:number;className?:string}){if(pack==='lucide'){const Icon=line[name];return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden/>}const Icon=duo[name];return <Icon size={size} weight={pack==='bold'?'bold':pack==='fill'?'fill':'duotone'} className={className} aria-hidden/>}
