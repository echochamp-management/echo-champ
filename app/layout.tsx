import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import ClientStorageCleanup from '@/components/ClientStorageCleanup';
import LegalFooter from '@/components/LegalFooter';
import RoleAccessGuard from '@/components/RoleAccessGuard';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ECO CHAMP MANAGEMENT',
  description: 'Système d’inventaire et de commande pour ECO CHAMP',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen antialiased text-white">
        <ClientStorageCleanup />
        <Sidebar />
        <RoleAccessGuard>
          <main>{children}</main>
        </RoleAccessGuard>
        <LegalFooter />
      </body>
    </html>
  );
}