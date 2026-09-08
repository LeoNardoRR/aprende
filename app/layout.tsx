import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Aprendê — Sala do Aluno', description:'Aprendê: atividades, calendário e um espaço de aprendizagem com a sua personalidade.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
