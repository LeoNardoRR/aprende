import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Aprendê — Sala do Aluno', description:'Aprendê: atividades, calendário e um espaço de aprendizagem com a sua personalidade.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><head><meta name="theme-color" content="#7042e5"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="Aprendê"/><link rel="manifest" href="./manifest.webmanifest"/><link rel="apple-touch-icon" sizes="180x180" href="./icons/aprende-apple-touch-icon.png"/></head><body>{children}</body></html>}
