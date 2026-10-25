'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Calendar, ChevronRight, CircleDollarSign, Crown, Download, FileSpreadsheet, Loader2, RefreshCw, ShoppingBag, TrendingUp, User, UtensilsCrossed } from 'lucide-react';
import jsPDF from 'jspdf';

interface OrderRecord { id: string; status?: string | null; total_amount?: number | string | null; order_type?: string | null; payment_method?: string | null; created_at: string; order_items?: Array<{ quantity?: number | string | null; unit_price?: number | string | null; products?: { name?: string | null } | null }> }
interface DailyClosure {
  id: string;
  closure_date: string;
  responsible_name: string;
  total_sales: number;
  total_expenses?: number | null;
  net_cash?: number | null;
  total_orders: number;
  sur_place_total: number;
  emporter_total: number;
  notes?: string | null;
  signature_url?: string | null;
  closed_at: string;
}
interface ProductRow { id: string; name: string; is_available?: boolean }
interface ExpenseRecord { id: string; responsible_name: string; amount: number; motive: string; notes?: string | null; occurred_at: string; created_at: string }

const paidStatuses = new Set(['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee']);
const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} HTG`;

export default function PresidenceDashboardPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch('/api/orders?summary=true&period=all', { cache: 'no-store' }),
        fetch('/api/closures', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/cash-expenses?limit=10', { cache: 'no-store' }),
      ]);
      const payloads = await Promise.all(responses.map((response) => response.json()));
      if (responses[0].ok) setOrders(Array.isArray(payloads[0].orders) ? payloads[0].orders : []);
      if (responses[1].ok) setClosures(Array.isArray(payloads[1].data) ? payloads[1].data : []);
      if (responses[2].ok) setProducts(Array.isArray(payloads[2].data) ? payloads[2].data : []);
      if (responses[3].ok) setExpenses(Array.isArray(payloads[3].data) ? payloads[3].data : []);
    } catch (error) { console.error('Erreur lors du chargement du tableau de bord :', error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    const interval = window.setInterval(() => { void loadDashboard(); }, 15000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const paidOrders = useMemo(() => orders.filter((order) => paidStatuses.has(String(order.status || '').toLowerCase().trim())), [orders]);
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const netCash = revenue - totalExpenses;
  const averageBasket = paidOrders.length ? revenue / paidOrders.length : 0;
  const takeawayRevenue = paidOrders.filter((order) => ['emporter', 'a_emporter'].includes(String(order.order_type).toLowerCase())).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const onSiteRevenue = revenue - takeawayRevenue;
  const unavailableProducts = products.filter((product) => product.is_available === false).length;
  const dailyData = useMemo(() => Array.from({ length: 7 }, (_, index) => { const today = new Date(); const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index)); const dayOrders = paidOrders.filter((order) => new Date(order.created_at).toDateString() === date.toDateString()); return { label: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), value: dayOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) }; }), [paidOrders]);
  const chartMax = Math.max(...dailyData.map((day) => day.value), 1);
  const topProducts = useMemo(() => { const totals = new Map<string, number>(); paidOrders.forEach((order) => order.order_items?.forEach((item) => { const name = item.products?.name || 'Produit'; totals.set(name, (totals.get(name) || 0) + Number(item.quantity || 0)); })); return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [paidOrders]);

  const downloadClosureReport = (closure: DailyClosure) => {
    setDownloadingId(closure.id);
    try {
      const closureDate = closure.closure_date || closure.closed_at.slice(0, 10);
      const productMap = new Map<string, { quantity: number; total: number }>();
      paidOrders.filter((order) => {
        const date = new Date(order.created_at);
        const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return localDate === closureDate;
      }).forEach((order) => order.order_items?.forEach((item) => {
        const name = item.products?.name || 'Produit non spécifié';
        const current = productMap.get(name) || { quantity: 0, total: 0 };
        current.quantity += Number(item.quantity || 0);
        current.total += Number(item.quantity || 0) * Number(item.unit_price || 0);
        productMap.set(name, current);
      }));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const date = new Date(`${closureDate}T12:00:00`);
      let y = 18;
      pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, 210, 18, 'F');
      pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('ECO CHAMP S.A', 14, 12);
      pdf.setTextColor(15, 23, 42); pdf.setFontSize(12); pdf.setFont('helvetica', 'normal'); pdf.text('Rapport officiel de clôture journalière', 14, 25); pdf.text(`Date : ${date.toLocaleDateString('fr-FR')}`, 140, 25);
      pdf.setDrawColor(203, 213, 225); pdf.line(14, 34, 196, 34);
      pdf.setFont('helvetica', 'bold'); pdf.text('1. Résumé financier', 14, 44); y = 52;
      pdf.setFont('helvetica', 'normal');
      [
        ['Sur place', money(Number(closure.sur_place_total || 0))],
        ['À emporter', money(Number(closure.emporter_total || 0))],
        ['Dépenses caisse', `-${money(Number(closure.total_expenses || 0))}`],
        ['TOTAL GÉNÉRAL', money(Number(closure.total_sales || 0))],
        ['NET DE CAISSE', money(Number(closure.net_cash || 0))],
      ].forEach(([label, value], index) => {
        const rowY = y + index * 8;
        if (index === 3 || index === 4) { pdf.setFillColor(255, 251, 235); pdf.rect(14, rowY - 5, 182, 8, 'F'); }
        pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', index >= 3 ? 'bold' : 'normal'); pdf.text(label, 18, rowY); pdf.text(value, 190, rowY, { align: 'right' });
      });
      y += 34;
      pdf.setFont('helvetica', 'bold'); pdf.text('2. Ventes par produit', 14, y); y += 8; pdf.setFont('helvetica', 'normal');
      pdf.setDrawColor(226, 232, 240); pdf.line(14, y - 4, 196, y - 4); pdf.setFont('helvetica', 'bold'); pdf.text('Article', 18, y); pdf.text('Quantité', 125, y, { align: 'center' }); pdf.text('Sous-total', 190, y, { align: 'right' }); y += 7; pdf.setFont('helvetica', 'normal');
      const products = [...productMap.entries()];
      if (products.length === 0) { pdf.text('Aucun produit vendu pour cette clôture', 18, y); y += 7; } else products.forEach(([name, item]) => { pdf.text(name.slice(0, 42), 18, y); pdf.text(String(item.quantity), 125, y, { align: 'center' }); pdf.text(money(item.total), 190, y, { align: 'right' }); y += 7; });
      y += 8; pdf.setFont('helvetica', 'bold'); pdf.text('3. Présence et connexion', 14, y); y += 8; pdf.setFont('helvetica', 'normal'); pdf.text('Type', 18, y); pdf.text('Date', 90, y); pdf.text('Heure', 150, y); y += 7; pdf.line(14, y, 196, y); y += 7; pdf.text('Clôture de la caisse', 18, y); pdf.text(date.toLocaleDateString('fr-FR'), 90, y); pdf.text(new Date(closure.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 150, y); y += 12;
      if (closure.notes) { pdf.setFont('helvetica', 'bold'); pdf.text('4. Remarques', 14, y); y += 8; pdf.setFont('helvetica', 'normal'); const lines = pdf.splitTextToSize(closure.notes, 170); pdf.text(lines, 18, y); y += lines.length * 6 + 8; }
      pdf.setFont('helvetica', 'bold'); pdf.text(`Responsable : ${closure.responsible_name || 'Non spécifié'}`, 14, y + 8); pdf.text('Pour le Président :', 130, y + 8); pdf.setFont('helvetica', 'normal'); pdf.text('Saint-Ulysse Durand', 130, y + 15); pdf.line(14, y + 16, 90, y + 16); pdf.line(130, y + 30, 190, y + 30);
      if (closure.signature_url) { try { pdf.addImage(closure.signature_url, 'PNG', 14, y + 10, 45, 18); } catch { /* Signature distante ou invalide. */ } }
      pdf.save(`Rapport_Cloture_${closureDate}.pdf`);
    } finally { setDownloadingId(null); }
  };

  const cards = [{ label: "Chiffre d'affaires", value: money(revenue), icon: CircleDollarSign, color: 'text-emerald-300' }, { label: 'Dépenses caisse', value: money(totalExpenses), icon: ShoppingBag, color: 'text-rose-300' }, { label: 'Disponible net', value: money(netCash), icon: TrendingUp, color: 'text-cyan-300' }, { label: 'Produits disponibles', value: `${Math.max(products.length - unavailableProducts, 0)} / ${products.length}`, icon: UtensilsCrossed, color: 'text-violet-300' }];
  return <main className="min-h-screen bg-[#071711] p-4 text-white md:p-8"><div className="mx-auto max-w-[1440px] space-y-6">
    <header className="flex flex-col justify-between gap-5 rounded-2xl border border-emerald-400/20 bg-[#10261e]/90 p-5 shadow-2xl md:flex-row md:items-center md:p-7"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Pilotage exécutif</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black"><Crown className="text-amber-400" size={30} /> Tableau de bord Présidence</h1><p className="mt-2 text-sm text-slate-400">Les chiffres sont synchronisés avec la caisse, les commandes et le stock.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadDashboard()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/10"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser</button><Link href="/presidence/analyse" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300"><BarChart3 size={15} /> Analyse détaillée</Link></div></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-white/10 bg-[#111f1b] p-5 shadow-lg"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400"><span>{card.label}</span><Icon size={20} className={card.color} /></div><p className={`mt-3 text-2xl font-black ${card.color}`}>{loading ? '...' : card.value}</p><p className="mt-2 text-[11px] text-slate-500">Données en temps réel</p></article>; })}</section>
    <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5 shadow-xl md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-white">Dynamique des ventes</h2><p className="text-xs text-slate-500">Chiffre d&apos;affaires des 7 derniers jours</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{money(revenue)}</span></div><div className="mt-7 flex h-56 items-end gap-2 sm:gap-4">{dailyData.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-slate-500">{day.value ? Math.round(day.value / 1000) + 'k' : '0'}</span><div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-emerald-500 to-cyan-300" style={{ height: `${Math.max((day.value / chartMax) * 82, day.value ? 8 : 2)}%` }} /><span className="text-[10px] uppercase text-slate-500">{day.label}</span></div>)}</div></article><article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5 shadow-xl md:p-6"><h2 className="text-lg font-black">Répartition des ventes</h2><p className="text-xs text-slate-500">Selon le type de commande</p><div className="mt-7 flex items-center gap-6"><div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#fbbf24 0 ${revenue ? (onSiteRevenue / revenue) * 100 : 0}%, #3b82f6 ${revenue ? (onSiteRevenue / revenue) * 100 : 0}% 100%)` }}><div className="grid h-24 w-24 place-items-center rounded-full bg-[#111f1b] text-center"><strong className="text-lg">{paidOrders.length}</strong><span className="text-[10px] text-slate-500">commandes</span></div></div><div className="space-y-4 text-xs"><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />Sur place<strong className="mt-1 block text-base text-white">{money(onSiteRevenue)}</strong></p><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />À emporter<strong className="mt-1 block text-base text-white">{money(takeawayRevenue)}</strong></p></div></div></article></section>
    <section className="grid gap-6 lg:grid-cols-[1fr_1fr]"><article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5"><h2 className="flex items-center gap-2 font-black"><ShoppingBag size={18} className="text-amber-300" /> Produits les plus vendus</h2><div className="mt-5 space-y-4">{topProducts.length ? topProducts.map(([name, quantity], index) => <div key={name} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-xs font-black text-emerald-300">0{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-slate-200">{name}</span><strong className="text-sm text-white">{quantity}</strong></div>) : <p className="text-sm text-slate-500">Aucune vente encaissée.</p>}</div></article><article className="rounded-2xl border border-white/10 bg-[#111f1b] p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><FileSpreadsheet size={18} className="text-amber-300" /> Dépenses enregistrées</h2><Link href="/dashboard/depenses" className="text-xs font-bold text-emerald-300">Voir <ChevronRight size={13} className="inline" /></Link></div><div className="mt-5 space-y-3">{expenses.length ? expenses.slice(0, 4).map((expense) => <div key={expense.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-bold text-white">{expense.responsible_name}</p><span className="text-xs font-black text-rose-300">-{money(Number(expense.amount || 0))}</span></div><p className="mt-1 text-xs text-slate-400">{expense.motive}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">{new Date(expense.occurred_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p></div>) : <p className="text-sm text-slate-500">Aucune dépense enregistrée.</p>}</div></article></section>
    <section className="rounded-2xl border border-white/10 bg-[#111f1b] p-5 shadow-xl md:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black"><FileSpreadsheet size={19} className="text-amber-300" /> Dernières clôtures</h2><p className="text-xs text-slate-500">Rapports générés depuis la caisse</p></div><Link href="/historique" className="text-xs font-bold text-emerald-300">Ouvrir l&apos;historique <ChevronRight size={13} className="inline" /></Link></div>{closures.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Responsable</th><th className="px-3 py-3 text-right">Commandes</th><th className="px-3 py-3 text-right">Recette</th><th className="px-3 py-3 text-center">Rapport</th></tr></thead><tbody className="divide-y divide-white/5">{closures.slice(0, 6).map((closure) => <tr key={closure.id} className="text-slate-300"><td className="px-3 py-3"><Calendar size={14} className="mr-2 inline text-amber-300" />{new Date(closure.closure_date || closure.closed_at).toLocaleDateString('fr-FR')}</td><td className="px-3 py-3"><User size={14} className="mr-2 inline text-slate-500" />{closure.responsible_name || 'Non spécifié'}</td><td className="px-3 py-3 text-right">{closure.total_orders || 0}</td><td className="px-3 py-3 text-right font-bold text-emerald-300">{money(Number(closure.total_sales || 0))}</td><td className="px-3 py-3 text-center"><button type="button" onClick={() => downloadClosureReport(closure)} disabled={downloadingId === closure.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-950 disabled:opacity-50">{downloadingId === closure.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF</button></td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-sm text-slate-500">Aucune clôture enregistrée.</div>}</section>
  </div></main>;
}