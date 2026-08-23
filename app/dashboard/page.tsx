'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Lock, DollarSign, ShoppingBag, Flame, Users, LogOut, RefreshCw } from 'lucide-react';

export default function DashboardPresidentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const [stats, setStats] = useState({
    ordersCount: 0,
    drinksSold: 0,
    customersCount: 0,
    totalRevenue: 0,
  });
  const [closings, setClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Code secret du Président (Modifiable ici)
  const PRESIDENT_PIN = '2026';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PRESIDENT_PIN) {
      setIsAuthenticated(true);
      setError(false);
      loadPresidentData();
    } else {
      setError(true);
    }
  };

  const loadPresidentData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // 1. Recette, commandes et nombre réel de clients (ajout de guests_count)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, guests_count')
      .gte('created_at', today)
      .eq('status', 'payee_validee');

    // 2. Boissons vendues uniquement sur les commandes validées
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, products!inner(category), orders!inner(status)')
      .eq('products.category', 'boisson')
      .eq('orders.status', 'payee_validee');

    // 3. Fiches de clôture signées par les responsables
    const { data: closingData } = await supabase
      .from('daily_closing')
      .select('*')
      .order('closed_at', { ascending: false });

    const totalDrinks = items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
    const revenue = orders?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0;

    // Calcul exact de la somme des clients saisis par le responsable
    const totalCustomers = orders?.reduce((acc, curr) => {
      return acc + (curr.guests_count || 1);
    }, 0) || 0;

    setStats({
      ordersCount: orders?.length || 0,
      drinksSold: totalDrinks,
      customersCount: totalCustomers, // Nombre exact de clients transmis
      totalRevenue: revenue,
    });
    setClosings(closingData || []);
    setLoading(false);
  };

  // 1. Écran de Verrouillage
  if (!isAuthenticated) {
    return (
      <div className="p-6 md:ml-64 min-h-screen flex items-center justify-center bg-slate-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-lg border max-w-sm w-full space-y-5 text-center">
          <div className="w-16 h-16 bg-slate-900 text-amber-400 rounded-full flex items-center justify-center mx-auto">
            <Lock size={30} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Espace Réservé Présidence</h1>
            <p className="text-xs text-slate-500 mt-1">Saisissez le code d'accès restreint</p>
          </div>
          <input
            type="password"
            maxLength={6}
            placeholder="Code PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center text-2xl font-black tracking-widest border-2 border-slate-300 p-3 rounded-xl focus:border-amber-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600 font-bold">Code incorrect. Accès refusé.</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition"
          >
            Accéder au Panel Présidence
          </button>
        </form>
      </div>
    );
  }

  // 2. Vue Présidentielle Déverrouillée
  return (
    <div className="p-6 md:ml-64 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 mb-1">
            <ShieldCheck size={20} />
            <span className="text-xs font-black uppercase tracking-wider">Accès Exclusif Président</span>
          </div>
          <h1 className="text-2xl font-black">Supervision Financière & Validations</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadPresidentData}
            className="p-2.5 bg-slate-800 text-amber-400 rounded-xl border border-slate-700 hover:bg-slate-700"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
          >
            <LogOut size={16} />
            <span>Verrouiller</span>
          </button>
        </div>
      </div>

      {/* Cartes financières réservées */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-white border rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><DollarSign size={28} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Recette Totale du Jour</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalRevenue} HTG</p>
          </div>
        </div>

        <div className="p-5 bg-white border rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><ShoppingBag size={28} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Commandes</p>
            <p className="text-2xl font-black text-slate-900">{stats.ordersCount}</p>
          </div>
        </div>

        <div className="p-5 bg-white border rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Flame size={28} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Boissons Écoulées</p>
            <p className="text-2xl font-black text-amber-600">{stats.drinksSold}</p>
          </div>
        </div>

        <div className="p-5 bg-white border rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Users size={28} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Clients Servis</p>
            <p className="text-2xl font-black text-slate-900">{stats.customersCount}</p>
          </div>
        </div>
      </div>

      {/* Fiches de Clôture avec Signature du Responsable */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Rapports de Clôture Journalière (Transmis par les Responsables)</h2>
        <div className="space-y-4">
          {closings.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Aucune clôture signée enregistrée pour le moment.</p>
          ) : (
            closings.map((c) => (
              <div key={c.id} className="p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
                <div>
                  <p className="font-bold text-slate-900">Responsable : {c.responsible_name}</p>
                  <p className="text-xs text-slate-500">
                    Date : {new Date(c.closed_at).toLocaleDateString()} à {new Date(c.closed_at).toLocaleTimeString()}
                  </p>
                  <p className="text-sm font-black text-emerald-600 mt-1">Chiffre Clôturé : {c.total_revenue} HTG ({c.total_orders} commandes)</p>
                </div>
                {c.signature_url && (
                  <div className="border bg-white p-2 rounded-lg text-center">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">Signature Numérique :</p>
                    <img src={c.signature_url} alt="Signature" className="h-12 object-contain" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}