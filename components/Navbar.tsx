import Link from 'next/link';

export default function AdminNavbar() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 p-4 text-xs font-bold text-slate-300 flex gap-4">
      <Link href="/catalogue" className="hover:text-amber-400">🛒 Catalogue Client</Link>
      <Link href="/admin/commandes" className="hover:text-amber-400">📥 Commandes Reçues</Link>
      <Link href="/admin/menu" className="hover:text-amber-400">🍽️ Disponibilité Menu</Link>
      <Link href="/admin/presidence" className="hover:text-amber-400">👑 Espace Présidence</Link>
    </nav>
  );
}