import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Sala do Aluno | Escola do Saber', description:'Sua sala de estudos: atividades, cronograma, calendário e um espaço com a sua personalidade.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
