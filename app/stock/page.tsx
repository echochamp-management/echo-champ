'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function StockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStockData = async () => {
    setLoading(true);
    setErrorMsg(null);
    
    try {
      // 1. Récupérer les boissons
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, stock_initial')
        .eq('category', 'boisson')
        .order('name', { ascending: true });

      if (prodErr) {
        setErrorMsg('Erreur Supabase (Produits) : ' + prodErr.message);
        setLoading(false);
        return;
      }

      // 2. Récupérer les ventes réelles
      const { data: sales, error: salesErr } = await supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(status)')
        .eq('orders.status', 'payee_validee');

      if (salesErr) {
        console.warn('Information ventes non disponibles:', salesErr.message);
      }

      // 3. Calculer automatiquement le stock
      const calculated = (products || []).map((p) => {
        const sold = (sales || [])
          .filter((s) => s.product_id === p.id)
          .reduce((acc, curr) => acc + curr.quantity, 0);

        return {
          id: p.id,
          name: p.name,
          initial: p.stock_initial,
          inputVal: p.stock_initial,
          sold: sold,
          remaining: p.stock_initial - sold,
        };
      });

      setStocks(calculated);
    } catch (err: any) {
      setErrorMsg('Erreur de connexion : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleInputChange = (id: string, value: string) => {
    const num = parseInt(value, 10);
    setStocks((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, inputVal: isNaN(num) ? 0 : num }
          : item
      )
    );
  };

  const saveSingleStock = async (id: string, newInitial: number) => {
    setSavingId(id);
    const { error } = await supabase
      .from('products')
      .update({ stock_initial: newInitial })
      .eq('id', id);

    if (error) {
      alert('Erreur de mise à jour du stock : ' + error.message);
    } else {
      setMessage('Stock mis à jour avec succès');
      setTimeout(() => setMessage(null), 3000);
      await fetchStockData();
    }
    setSavingId(null);
  };

  return (
    <div className="p-6 md:ml-64 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Gestion du Stock Boissons</h1>
          <p className="text-sm text-slate-500 mt-1">
            Saisissez les quantités reçues. Les ventes sont déduites automatiquement.
          </p>
        </div>
        <button
          onClick={fetchStockData}
          disabled={loading}
          className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition self-start sm:self-auto"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-bold flex items-center space-x-2">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-bold flex items-center space-x-2">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Boisson / Produit</th>
                <th className="p-4 text-center">Stock Initial Saisi</th>
                <th className="p-4 text-center">Ventes Automatiques</th>
                <th className="p-4 text-center">Reste en Stock</th>
                <th className="p-4 text-center">État</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {stocks.map((item) => {
                const isLow = item.remaining <= 5 && item.remaining > 0;
                const isOut = item.remaining <= 0;
                const isChanged = item.inputVal !== item.initial;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-800">{item.name}</td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          value={item.inputVal}
                          onChange={(e) => handleInputChange(item.id, e.target.value)}
                          className="w-20 border-2 border-slate-300 rounded-lg p-2 text-center font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-medium">unités</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-black text-sm">
                        {item.sold}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-base font-black px-3 py-1 rounded-lg ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : isLow
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.remaining}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                          <AlertTriangle size={14} />
                          <span>Épuisé</span>
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertTriangle size={14} />
                          <span>Critique</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 size={14} />
                          <span>Disponible</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => saveSingleStock(item.id, item.inputVal)}
                        disabled={savingId === item.id || !isChanged}
                        className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${
                          isChanged
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Save size={14} />
                        <span>{savingId === item.id ? '...' : 'Enregistrer'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}