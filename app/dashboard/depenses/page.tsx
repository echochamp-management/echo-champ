'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiHeaders } from '@/lib/api-client';
import { CircleDollarSign, FileText, Loader2, PlusCircle, TrendingDown, Wallet } from 'lucide-react';

interface ExpenseRecord {
  id: string;
  responsible_name: string;
  amount: number;
  motive: string;
  notes?: string | null;
  occurred_at: string;
  created_at: string;
}

interface OrderSummary {
  totalRevenue: number;
  totalOrders: number;
  averageBasket: number;
  orders: Array<{ total_amount?: number | string | null; status?: string | null }>; 
}

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} HTG`;

export default function CashExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<OrderSummary | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    responsible_name: '',
    amount: '',
    motive: '',
    notes: '',
    occurred_at: new Date().toISOString().slice(0, 16),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [expensesResponse, salesResponse] = await Promise.all([
        fetch('/api/cash-expenses?limit=20', { cache: 'no-store' }),
        fetch('/api/orders?summary=true&period=today', { cache: 'no-store' }),
      ]);

      const expensesPayload = await expensesResponse.json();
      const salesPayload = await salesResponse.json();

      if (expensesResponse.ok) setExpenses(Array.isArray(expensesPayload.data) ? expensesPayload.data : []);
      if (salesResponse.ok) setRevenueSummary(salesPayload as OrderSummary);
    } catch (error) {
      console.error('Erreur chargement dépenses :', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const readUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const resolvedName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Responsable');
      setUserName(resolvedName);
      setForm((current) => ({ ...current, responsible_name: resolvedName }));
    };

    void readUser();
    void loadData();
  }, []);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses]
  );

  const totalRevenue = revenueSummary?.totalRevenue ?? 0;
  const netCash = totalRevenue - totalExpenses;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.responsible_name.trim() || !form.motive.trim() || !form.amount) {
      alert('Renseignez le nom du responsable, le motif et le montant.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/cash-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getApiHeaders()),
        },
        body: JSON.stringify({
          responsible_name: form.responsible_name,
          amount: Number(form.amount),
          motive: form.motive,
          notes: form.notes,
          occurred_at: new Date(form.occurred_at).toISOString(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Erreur lors de l’enregistrement de la dépense');
      }

      setForm({
        responsible_name: userName,
        amount: '',
        motive: '',
        notes: '',
        occurred_at: new Date().toISOString().slice(0, 16),
      });
      await loadData();
    } catch (error) {
      alert(`Impossible d’enregistrer la dépense : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#071711] p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-emerald-500/20 bg-[#0d1f1a] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Caisse</p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">Dépenses de la caisse</h1>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200">
              {loading ? '...' : `Net caisse : ${money(netCash)}`}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              <span>Ventes du jour</span>
              <CircleDollarSign className="text-emerald-300" size={18} />
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-300">{money(totalRevenue)}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              <span>Dépenses</span>
              <TrendingDown className="text-rose-300" size={18} />
            </div>
            <p className="mt-3 text-2xl font-black text-rose-300">{money(totalExpenses)}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              <span>Disponible</span>
              <Wallet className="text-cyan-300" size={18} />
            </div>
            <p className="mt-3 text-2xl font-black text-cyan-300">{money(netCash)}</p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-[#111f1b] p-5 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <PlusCircle className="text-emerald-300" size={24} />
              <h2 className="text-xl font-black">Nouvelle dépense</h2>
            </div>

            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Nom du responsable</span>
                <input
                  value={form.responsible_name}
                  onChange={(event) => setForm({ ...form, responsible_name: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
                  placeholder="Ex. Jean Claude"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Montant</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
                    placeholder="2500"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Date / heure</span>
                  <input
                    type="datetime-local"
                    value={form.occurred_at}
                    onChange={(event) => setForm({ ...form, occurred_at: event.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
                  />
                </label>
              </div>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Motif de la dépense</span>
                <input
                  value={form.motive}
                  onChange={(event) => setForm({ ...form, motive: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
                  placeholder="Achat de produits, transport, entretien..."
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Notes / détail</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400"
                  placeholder="Détail utile pour la présidence"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                Enregistrer la dépense
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-[#111f1b] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">Historique récent</h2>
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{expenses.length} enregistrements</span>
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center text-emerald-300">
                <Loader2 className="animate-spin" size={26} />
              </div>
            ) : expenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                Aucune dépense enregistrée pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <article key={expense.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{expense.responsible_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(expense.occurred_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-black text-rose-200">
                        - {money(Number(expense.amount || 0))}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-emerald-300">{expense.motive}</p>
                    {expense.notes && <p className="mt-2 text-xs leading-relaxed text-slate-400">{expense.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
