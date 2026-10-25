'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, Clock3, Loader2, RefreshCw, TrendingUp } from 'lucide-react';

interface OrderRecord {
  total_amount?: number | string | null;
  status?: string | null;
  created_at: string;
}

interface ChartPoint {
  label: string;
  revenue: number;
  sales: number;
}

const paidStatuses = new Set(['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee']);
const chartWidth = 760;
const chartHeight = 250;
const chartPadding = { top: 20, right: 20, bottom: 42, left: 58 };

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} HTG`;
}

export default function AnalysePresidencePage() {
  const today = localDateValue(new Date());
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const payload = await response.json() as { data?: OrderRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Impossible de charger les ventes.');
      setOrders(payload.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les ventes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchOrders(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredOrders = useMemo(() => {
    const start = new Date(`${fromDate}T${fromTime}`).getTime();
    const end = new Date(`${toDate}T${toTime}`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];

    return orders.filter((order) => {
      if (!paidStatuses.has(String(order.status || '').toLowerCase().trim())) return false;
      const createdAt = new Date(order.created_at).getTime();
      return createdAt >= start && createdAt <= end;
    });
  }, [orders, fromDate, toDate, fromTime, toTime]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const start = new Date(`${fromDate}T${fromTime}`);
    const end = new Date(`${toDate}T${toTime}`);
    const buckets = new Map<string, ChartPoint>();

    filteredOrders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const current = buckets.get(key) ?? { label, revenue: 0, sales: 0 };
      current.revenue += Number(order.total_amount || 0);
      current.sales += 1;
      buckets.set(key, current);
    });

    const points: ChartPoint[] = [];
    const dayCursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (dayCursor <= lastDay) {
      const key = `${dayCursor.getFullYear()}-${dayCursor.getMonth()}-${dayCursor.getDate()}`;
      points.push(buckets.get(key) ?? {
        label: dayCursor.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        revenue: 0,
        sales: 0,
      });
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    if (points.length > 0) return points;
    return [{ label: start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), revenue: 0, sales: 0 }];
  }, [filteredOrders, fromDate, toDate, fromTime, toTime]);

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalSales = filteredOrders.length;
  const maxRevenue = Math.max(...chartPoints.map((point) => point.revenue), 0);
  const revenueTickStep = Math.max(100, Math.ceil(maxRevenue / 5 / 100) * 100);
  const revenueAxisMax = Math.max(500, revenueTickStep * 5);
  const revenueAxisTicks = Array.from({ length: 6 }, (_, index) => index * revenueTickStep);
  const maxSales = Math.max(...chartPoints.map((point) => point.sales), 0);
  const salesAxisMax = Math.max(10, Math.ceil(maxSales / 10) * 10);
  const salesAxisTicks = Array.from({ length: salesAxisMax + 1 }, (_, index) => index);

  const linePoints = chartPoints.map((point, index) => {
    const x = chartPoints.length === 1
      ? chartWidth / 2
      : chartPadding.left + (index / (chartPoints.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
    const y = chartHeight - chartPadding.bottom - (point.revenue / revenueAxisMax) * (chartHeight - chartPadding.top - chartPadding.bottom);
    return `${x},${y}`;
  }).join(' ');

  const resetFilters = () => {
    setFromDate(today);
    setToDate(today);
    setFromTime('00:00');
    setToTime('23:59');
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end">
          <div>
            <a href="/presidence" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 transition hover:text-emerald-200" aria-label="Retourner à la Présidence">
              <ArrowLeft size={18} /> Retour à la Présidence
            </a>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Pilotage Présidence</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black"><BarChart3 className="text-amber-400" /> Analyse de donnée</h1>
            <p className="mt-2 text-sm text-slate-400">Suivez l’évolution du chiffre d’affaires et du volume des ventes.</p>
          </div>
          <button type="button" onClick={() => void fetchOrders()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:border-emerald-400 hover:text-emerald-300">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </header>

        <form onSubmit={handleFilterSubmit} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-5">
          <label className="text-xs font-bold text-slate-300">Du
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs font-bold text-slate-300">Au
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs font-bold text-slate-300">Heure de début
            <input type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs font-bold text-slate-300">Heure de fin
            <input type="time" value={toTime} onChange={(event) => setToTime(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <button type="button" onClick={resetFilters} className="self-end rounded-xl border border-amber-400/50 px-4 py-2 text-xs font-black text-amber-300 hover:bg-amber-400/10">Réinitialiser</button>
        </form>

        {fromDate > toDate || (fromDate === toDate && fromTime > toTime) ? <p className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 text-sm text-rose-200">La période sélectionnée est invalide.</p> : null}
        {errorMessage && <p className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 text-sm text-rose-200">{errorMessage}</p>}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/30 p-5"><p className="text-xs font-bold text-slate-400">Chiffre d’affaires filtré</p><p className="mt-2 text-2xl font-black text-emerald-300">{formatAmount(totalRevenue)}</p></div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-950/30 p-5"><p className="text-xs font-bold text-slate-400">Nombre de ventes</p><p className="mt-2 text-2xl font-black text-amber-300">{totalSales}</p></div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/30 p-5"><p className="text-xs font-bold text-slate-400">Panier moyen</p><p className="mt-2 text-2xl font-black text-cyan-300">{formatAmount(totalSales ? totalRevenue / totalSales : 0)}</p></div>
        </div>

        {loading ? <div className="flex justify-center py-16 text-emerald-300"><Loader2 className="animate-spin" /></div> : <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-black text-emerald-300"><TrendingUp size={20} /> Évolution du chiffre d’affaires</h2>
            <div className="mt-5 overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[620px]" role="img" aria-label="Courbe du chiffre d’affaires">
                <line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke="#334155" />
                <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke="#334155" />
                {revenueAxisTicks.map((tick) => {
                  const y = chartHeight - chartPadding.bottom - (tick / revenueAxisMax) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  return <g key={tick}>
                    <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="#1e293b" strokeDasharray="4 6" />
                    <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{Math.round(tick).toLocaleString('fr-FR')}</text>
                  </g>;
                })}
                <polyline points={linePoints} fill="none" stroke="#34e89e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((point, index) => {
                  const x = chartPoints.length === 1 ? chartWidth / 2 : chartPadding.left + (index / (chartPoints.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
                  const y = chartHeight - chartPadding.bottom - (point.revenue / revenueAxisMax) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  return <g key={`${point.label}-${index}`}><circle cx={x} cy={y} r="5" fill="#00ffb2" /><text x={x} y={chartHeight - 16} textAnchor="middle" fill="#94a3b8" fontSize="11">{point.label}</text></g>;
                })}
              </svg>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-lg font-black text-amber-300"><BarChart3 size={20} /> Nombre de ventes</h2>
            <div className="mt-5 overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[620px]" role="img" aria-label="Barres du nombre de ventes">
                <line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke="#334155" />
                <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke="#334155" />
                {salesAxisTicks.map((tick) => {
                  const y = chartHeight - chartPadding.bottom - (tick / salesAxisMax) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  return <g key={tick}>
                    <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="#1e293b" strokeDasharray="4 6" />
                    <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{tick}</text>
                  </g>;
                })}
                {chartPoints.map((point, index) => {
                  const slot = (chartWidth - chartPadding.left - chartPadding.right) / chartPoints.length;
                  const barWidth = Math.max(12, slot * 0.62);
                  const x = chartPadding.left + index * slot + (slot - barWidth) / 2;
                  const barHeight = (point.sales / salesAxisMax) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  const y = chartHeight - chartPadding.bottom - barHeight;
                  return <g key={`${point.label}-${index}`}><rect x={x} y={y} width={barWidth} height={barHeight} rx="5" fill="#fbbf24" /><text x={x + barWidth / 2} y={chartHeight - 16} textAnchor="middle" fill="#94a3b8" fontSize="11">{point.label}</text></g>;
                })}
              </svg>
            </div>
          </section>
        </div>}

        <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Seules les commandes encaissées sont incluses. <Clock3 size={14} /> Les filtres utilisent l’heure locale de l’appareil.</p>
      </div>
    </main>
  );
}
