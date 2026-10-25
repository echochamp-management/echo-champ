'use client';

import { useEffect, useState } from 'react';
import { getApiHeaders } from '@/lib/api-client';
import { Save, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  initial: number;
  inputVal: number;
  sold: number;
  remaining: number;
}

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStockData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/stock');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur chargement stock');
      }

      const calculated = (payload.data ?? []).map((p: {
        id: string;
        name: string;
        stock_initial?: number | null;
        sold?: number | null;
        remaining?: number | null;
      }) => ({
        id: p.id,
        name: p.name,
        initial: Number(p.stock_initial || 0),
        inputVal: Number(p.stock_initial || 0),
        sold: Number(p.sold || 0),
        remaining: Number(p.remaining || 0),
      }));

      setStocks(calculated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMsg('Erreur de connexion : ' + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchStockData(); }, 0);
    return () => window.clearTimeout(timer);
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
    try {
      const authHeaders = await getApiHeaders();
      const response = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ stock_initial: newInitial }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur de mise à jour du stock');
      }

      setMessage('Stock mis à jour avec succès');
      setTimeout(() => setMessage(null), 3000);
      await fetchStockData();
    } catch (error) {
      alert(`Erreur de mise à jour du stock : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 md:ml-64 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Gestion du Stock Produits</h1>
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