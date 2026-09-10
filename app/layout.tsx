import type { Metadata } from 'next';
import { AnimatedFavicon } from '@/components/animated-favicon';
import './globals.css';
export const metadata: Metadata = { title:'Aprendê', description:'Aprendê: atividades, calendário e um espaço de aprendizagem com a sua personalidade.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><head><meta name="theme-color" content="#ff7900"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="Aprendê"/><link rel="manifest" href="./manifest.webmanifest"/><link rel="icon" type="image/png" sizes="64x64" href="./icons/aprende-favicon-64.png"/><link rel="apple-touch-icon" sizes="180x180" href="./icons/aprende-apple-touch-icon.png"/></head><body><AnimatedFavicon />{children}</body></html>}
