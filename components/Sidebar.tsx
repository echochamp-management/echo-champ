'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, ShoppingCart, PhoneIncoming, History, Menu, X, Shield } from 'lucide-react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  // Menu visible par le personnel opérationnel
  const menuItems = [
    { label: 'Prise de Commande', href: '/commande', icon: ShoppingCart },
    { label: 'Stock (Boissons)', href: '/stock', icon: Package },
    { label: 'Commandes Reçues', href: '/commandes-recues', icon: PhoneIncoming },
    { label: 'Clôture Journalière', href: '/historique', icon: History },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-3 bg-slate-900 text-white rounded-lg fixed top-3 left-3 z-50 md:hidden"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white p-5 z-40 transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col justify-between`}>
        <div>
          <div className="text-2xl font-black text-amber-400 mb-8 border-b border-slate-700 pb-4">
            ECHO-CHAMP
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition text-slate-200 font-medium"
                >
                  <Icon size={20} className="text-amber-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Lien discret Présidence tout en bas */}
        <div className="border-t border-slate-800 pt-4">
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-amber-400 transition"
          >
            <Shield size={16} />
            <span>Espace Présidence</span>
          </Link>
        </div>
      </aside>
    </>
  );
}