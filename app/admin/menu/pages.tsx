'use client';

import { useEffect, useState } from 'react';
import { getApiHeaders } from '@/lib/api-client';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search, 
  UtensilsCrossed, 
  RefreshCw 
} from 'lucide-react';

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  is_available: boolean;
}

export default function AdminMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'Tous les plats' },
    { id: 'petit_dejeuner', label: 'Petit déjeuner' },
    { id: 'plat_du_jour', label: 'Plat du jour' },
    { id: 'plats', label: 'Plats' },
    { id: 'pizza', label: 'Pizza' },
    { id: 'boissons', label: 'Boissons' },
  ];

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur chargement menu');
      }

      setMenuItems(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error('Erreur chargement menu:', error);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchMenuItems(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleAvailability = async (item: MenuItem) => {
    setUpdatingId(item.id);
    const newStatus = !item.is_available;

    try {
      const authHeaders = await getApiHeaders();
      const response = await fetch(`/api/products/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ is_available: newStatus }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur de mise à jour');
      }

      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: newStatus } : i))
      );
    } catch (error) {
      alert(`Erreur de mise à jour: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 text-white">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-amber-400 flex items-center gap-2">
            <UtensilsCrossed size={24} /> Gestion de la Disponibilité du Menu
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Activez ou désactivez les plats. Seuls les plats **Disponibles** seront visibles sur la page client et de prise de commande.
          </p>
        </div>
        <button
          onClick={fetchMenuItems}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2.5 rounded-xl border border-slate-700 font-bold"
        >
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {/* Filtres & Recherche */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un plat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des plats */}
      {loading ? (
        <div className="p-12 flex justify-center text-amber-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                item.is_available
                  ? 'bg-slate-900/90 border-slate-800'
                  : 'bg-slate-950/50 border-rose-900/30 opacity-60'
              }`}
            >
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">{item.name}</p>
                <p className="text-xs text-amber-400 font-bold">{item.price} HTG</p>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    item.is_available
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {item.is_available ? (
                    <>
                      <CheckCircle2 size={10} /> Disponible
                    </>
                  ) : (
                    <>
                      <XCircle size={10} /> Indisponible
                    </>
                  )}
                </span>
              </div>

              {/* Bouton Toggle Switch */}
              <button
                onClick={() => toggleAvailability(item)}
                disabled={updatingId === item.id}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  item.is_available ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                {updatingId === item.id ? (
                  <Loader2 className="animate-spin text-white m-auto" size={14} />
                ) : (
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      item.is_available ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
