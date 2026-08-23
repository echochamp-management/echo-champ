import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, PhoneIncoming, Package, History } from 'lucide-react';

export default function Home() {
  const modules = [
    { label: 'Tableau de Bord (Présidence)', href: '/dashboard', icon: LayoutDashboard, color: 'bg-blue-600' },
    { label: 'Prise de Commande Caisse', href: '/commande', icon: ShoppingCart, color: 'bg-amber-500' },
    { label: 'Commandes Extérieures Reçues', href: '/commandes-recues', icon: PhoneIncoming, color: 'bg-emerald-600' },
    { label: 'Gestion du Stock Boissons', href: '/stock', icon: Package, color: 'bg-indigo-600' },
    { label: 'Historique & Clôture', href: '/historique', icon: History, color: 'bg-slate-800' },
  ];

  return (
    <div className="p-6 md:ml-64 min-h-screen flex flex-col items-center justify-center space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-900">ECHOCHAMP S.A</h1>
        <p className="text-slate-600 font-medium">Système Intégré de Gestion & Point de Vente (POS)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="p-6 bg-white border rounded-xl shadow-sm hover:shadow-md transition flex flex-col items-center space-y-3 text-center"
            >
              <div className={`p-4 ${m.color} text-white rounded-full`}>
                <Icon size={28} />
              </div>
              <span className="font-bold text-slate-800">{m.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}