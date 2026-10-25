'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCanonicalRole } from '@/lib/account-role';
import {
  Package,
  ShoppingCart,
  PhoneIncoming,
  History,
  Home,
  LogOut,
  PanelLeftClose,
  Menu,
  UtensilsCrossed,
  UserRound,
  BarChart3,
  CircleDollarSign,
  WalletCards,
} from 'lucide-react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [catalogueOrderCount, setCatalogueOrderCount] = useState(0);
  const [accountRole, setAccountRole] = useState<'presidence' | 'caissiere' | 'client' | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isPresidenceRoute = pathname === '/presidence' || pathname.startsWith('/presidence/');

  useEffect(() => {
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const canonicalRole = getCanonicalRole(user);
      const isPresidence = isPresidenceRoute || canonicalRole === 'presidence';
      if (user && canonicalRole && user.user_metadata?.account_role !== canonicalRole) {
        await supabase.auth.updateUser({ data: { account_role: canonicalRole } });
      }
      setAccountRole(isPresidence ? 'presidence' : canonicalRole);
    };
    void loadRole();
  }, [isPresidenceRoute]);

  useEffect(() => {
    if (accountRole !== 'caissiere') return;

    const fetchCatalogueOrderCount = async () => {
      const response = await fetch('/api/orders?source=catalogue', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { data?: Array<{ id: string; status?: string }> };
      const pendingCatalogueOrders = (payload.data ?? []).filter(
        (order) => order.status === 'en_attente_paiement'
      );
      setCatalogueOrderCount(pendingCatalogueOrders.length);
    };

    void fetchCatalogueOrderCount();
    const interval = window.setInterval(() => { void fetchCatalogueOrderCount(); }, 15000);
    return () => window.clearInterval(interval);
  }, [accountRole, pathname]);

  if (pathname.startsWith('/login') || pathname === '/catalogue' || pathname === '/profil') {
    return null;
  }

  if (!accountRole) return null;
  if (accountRole === 'client') return null;

  const presidenceMenuItems = [
    { label: 'Tableau de bord', href: '/presidence', icon: Home },
    { label: 'Analyse de donnée', href: '/presidence/analyse', icon: BarChart3 },
    { label: 'Clôtures & Historique', href: '/historique', icon: History },
  ];
  const caissiereMenuItems = [
    { label: 'Accueil & À Propos', href: '/dashboard', icon: Home },
    { label: 'Prise de Commande', href: '/commande', icon: ShoppingCart },
    { label: 'Dépenses de caisse', href: '/dashboard/depenses', icon: CircleDollarSign },
    { label: 'Dettes', href: '/dashboard/dettes', icon: WalletCards },
    { label: 'Stock (Produits)', href: '/stock', icon: Package },
    { label: 'Commandes Reçues', href: '/commandes-recues', icon: PhoneIncoming },
    { label: 'Disponibilité du menu', href: '/admin/menu', icon: UtensilsCrossed },
    { label: 'Clôture & Historique', href: '/historique', icon: History },
  ];
  const menuItems = accountRole === 'presidence' || isPresidenceRoute ? presidenceMenuItems : caissiereMenuItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-3 top-3 z-[9999] rounded-2xl border border-emerald-400/30 bg-[#0d221a]/90 p-3 text-[#00ffb2] shadow-[0_0_24px_rgba(0,255,178,0.18)] backdrop-blur-sm transition hover:border-emerald-300 hover:text-emerald-200 sm:left-4 sm:top-4"
          title="Ouvrir le menu"
        >
          <Menu size={24} />
        </button>
      )}

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[9998] bg-[#020d09]/70 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[9999] flex h-screen w-[82vw] max-w-72 flex-col justify-between overflow-y-auto border-r border-[#1d3b2f] bg-[#0b1d17]/90 p-4 text-white shadow-[0_0_40px_rgba(0,255,178,0.08)] backdrop-blur-xl transition-transform duration-300 ease-in-out sm:w-64 sm:p-5 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="mb-8 flex items-center justify-between border-b border-[#1d3b2f] pb-4 text-[#00ffb2]">
            <Image
              src="/ChatGPT%20Image%20Sep%2016,%202026,%2007_33_26%20PM.png"
              alt="ECO CHAMP S.A."
              width={150}
              height={72}
              className="h-12 w-auto object-contain"
              priority
            />
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-[#a3b8ac] transition hover:bg-[#112d25] hover:text-white"
              title="Fermer le menu"
            >
              <PanelLeftClose size={22} />
            </button>
          </div>

          <nav className="space-y-2">
            <Link
              href="/profil"
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-3 rounded-xl border border-transparent p-3 text-sm font-medium text-[#dfeae3] transition hover:border-[#2d4832] hover:bg-[#122a22] hover:text-white"
            >
              <UserRound size={20} className="text-[#00ffb2]" />
              <span>Mon profil</span>
            </Link>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-3 rounded-xl border border-transparent p-3 text-sm font-medium text-[#dfeae3] transition hover:border-[#2d4832] hover:bg-[#122a22] hover:text-white"
                >
                  <Icon size={20} className="text-[#00ffb2]" />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {item.label}
                    {item.href === '/commandes-recues' && catalogueOrderCount > 0 && (
                      <span className="min-w-5 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[10px] font-black text-slate-950">
                        {catalogueOrderCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#1d3b2f] pt-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-2 rounded-xl border border-[#2d4832] bg-[#112d25] p-2.5 text-left text-xs font-semibold text-[#ff7a7a] transition hover:border-[#6d8d5f] hover:bg-[#18342b] hover:text-[#ff9a9a]"
          >
            <LogOut size={16} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
}