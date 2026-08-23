import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ECHO-CHAMP MANAGEMENT',
  description: 'Système d’inventaire et de commande pour ECHO-CHAMP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-slate-100 min-h-screen`}>
        <Sidebar />
        <main>{children}</main>
      </body>
    </html>
  );
}