'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiHeaders } from '@/lib/api-client';
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, Wallet } from 'lucide-react';

interface DebtRecord {
  id: string;
  customer_name: string;
  customer_firstname?: string | null;
  amount: number;
  remaining_amount: number;
  status: 'ouvert' | 'partiellement_regle' | 'regle';
  payment_method: 'credit';
  order_id?: string | null;
  created_at: string;
  paid_at?: string | null;
}

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} HTG`;

export default function CashDebtsPage() {
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadDebts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/customer-debts', { cache: 'no-store', headers: await getApiHeaders() });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Erreur lors du chargement des dettes');
      }
      setDebts(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error('Erreur dettes :', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDebts();
  }, []);

  const totals = useMemo(() => {
    const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0);
    const openDebt = debts.filter((debt) => debt.status !== 'regle').length;
    return { totalDebt, openDebt };
  }, [debts]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setUnlocking(true);
    try {
      const response = await fetch('/api/staff/verify-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getApiHeaders()) },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Mot de passe incorrect');
      }
      setIsUnlocked(true);
      setPassword('');
    } catch (error) {
      alert(`Accès refusé : ${error instanceof Error ? error.message : 'Mot de passe incorrect'}`);
    } finally {
      setUnlocking(false);
    }
  };

  const applyPayment = async (debtId: string) => {
    const value = Number(paymentInputs[debtId] || 0);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Saisissez un montant de remboursement valide.');
      return;
    }

    setProcessingId(debtId);
    try {
      const response = await fetch('/api/customer-debts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getApiHeaders()) },
        body: JSON.stringify({ id: debtId, amount_paid: value }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Erreur de remboursement');
      }

      setPaymentInputs((previous) => ({ ...previous, [debtId]: '' }));
      await loadDebts();
    } catch (error) {
      alert(`Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#071711] p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-500/20 bg-[#0d1f1a] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Caisse</p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">Dettes clients</h1>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200">
              {money(totals.totalDebt)} à recouvrer
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              <span>Dettes ouvertes</span>
              <Wallet className="text-amber-300" size={18} />
            </div>
            <p className="mt-3 text-2xl font-black text-amber-300">{totals.openDebt}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              <span>Montant restant</span>
              <AlertTriangle className="text-rose-300" size={18} />
            </div>
            <p className="mt-3 text-2xl font-black text-rose-300">{money(totals.totalDebt)}</p>
          </article>
        </section>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="rounded-3xl border border-white/10 bg-[#111f1b] p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3 text-amber-300">
              <Lock size={22} />
              <h2 className="text-xl font-black">Accès réservé à la caisse</h2>
            </div>

            <p className="mb-4 text-sm text-slate-400">Saisissez le mot de passe caisse pour consulter et valider les remboursements.</p>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe caisse"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={unlocking}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {unlocking ? 'Vérification...' : 'Déverrouiller'}
              </button>
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-[#111f1b] p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-3 text-emerald-300">
              <ShieldCheck size={22} />
              <h2 className="text-xl font-black">Liste des dettes clients</h2>
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-400">Chargement...</div>
            ) : debts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                Aucune dette enregistrée.
              </div>
            ) : (
              <div className="space-y-3">
                {debts.map((debt) => (
                  <article key={debt.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-black text-white">
                          {debt.customer_firstname ? `${debt.customer_firstname} ${debt.customer_name}` : debt.customer_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Créée le {new Date(debt.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Total</p>
                        <p className="font-black text-amber-300">{money(Number(debt.amount || 0))}</p>
                        <p className="text-xs text-rose-300">Reste : {money(Number(debt.remaining_amount || 0))}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                          debt.status === 'regle'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : debt.status === 'partiellement_regle'
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'bg-rose-500/10 text-rose-300'
                        }`}>
                          {debt.status === 'regle' ? 'Règlement complet' : debt.status === 'partiellement_regle' ? 'Partiellement réglé' : 'Ouvert'}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{debt.payment_method}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={paymentInputs[debt.id] ?? ''}
                          onChange={(event) => setPaymentInputs((previous) => ({ ...previous, [debt.id]: event.target.value }))}
                          placeholder="Montant"
                          className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          disabled={processingId === debt.id}
                          onClick={() => void applyPayment(debt.id)}
                          className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-60"
                        >
                          {processingId === debt.id ? '...' : 'Valider'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
