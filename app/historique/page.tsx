'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getApiHeaders } from '@/lib/api-client';
import { 
  TrendingUp, 
  ShoppingBag, 
  Utensils, 
  PenTool, 
  RotateCcw, 
  Loader2,
  FileText,
  Download 
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';

interface ProductItem {
  quantity?: number;
  unit_price?: number;
  products?: { name?: string } | null;
}

interface OrderRecord {
  id: string;
  total_amount?: number;
  order_type?: string;
  status?: string;
  created_at?: string;
  order_items?: ProductItem[];
}

interface DailySummary {
  totalSales: number;
  surPlaceTotal: number;
  emporterTotal: number;
  totalExpenses: number;
  netCash: number;
  totalOrders: number;
  productSales: { name: string; quantity: number; total: number }[];
}

interface ClosureReport {
  id: string;
  closure_date: string;
  responsible_name: string;
  total_sales: number;
  total_expenses?: number;
  net_cash?: number;
  total_orders: number;
  closed_at: string;
}

interface ExpenseRecord {
  id: string;
  responsible_name: string;
  amount: number;
  motive: string;
  notes?: string | null;
  occurred_at: string;
}

export default function ClotureJournalierePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<ClosureReport[]>([]);
  const [todayExpenses, setTodayExpenses] = useState<ExpenseRecord[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailySummary>({
    totalSales: 0,
    surPlaceTotal: 0,
    emporterTotal: 0,
    totalExpenses: 0,
    netCash: 0,
    totalOrders: 0,
    productSales: [],
  });

  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isPresidence, setIsPresidence] = useState(false);

  const sigCanvas = useRef<SignatureCanvas | null>(null);

  const fetchReports = async () => {
    const response = await fetch('/api/closures', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { data?: ClosureReport[] };
    setReports(payload.data ?? []);
  };

  // 1. Récupération de l'utilisateur connecté Supabase
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsPresidence(user.user_metadata?.account_role === 'presidence' || user.email?.toLowerCase() === 'presidence@gmail.com');
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0];
        setResponsibleName(fullName || 'Responsable');
        const loginAt = user.user_metadata?.last_login_at as string | undefined;
        setLastLoginAt(loginAt || null);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    const fetchDailyData = async () => {
      setLoading(true);

      try {
        const deviceNow = new Date();
        const deviceDate = [deviceNow.getFullYear(), String(deviceNow.getMonth() + 1).padStart(2, '0'), String(deviceNow.getDate()).padStart(2, '0')].join('-');
        const timezoneOffset = deviceNow.getTimezoneOffset();
        const [ordersResponse, expensesResponse] = await Promise.all([
          fetch(`/api/orders?report=true&date=${deviceDate}&timezone_offset=${timezoneOffset}`),
          fetch('/api/cash-expenses', { cache: 'no-store' }),
        ]);

        const ordersPayload = await ordersResponse.json();

        if (!ordersResponse.ok) {
          throw new Error(ordersPayload.error || 'Erreur récupération commandes');
        }

        const expensesPayload = await expensesResponse.json();
        const expenses = Array.isArray(expensesPayload.data) ? expensesPayload.data : [];

        const today = deviceNow;
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const currentDayExpenses = expenses.filter((expense: ExpenseRecord) => {
          const occurredAt = expense.occurred_at ? new Date(expense.occurred_at) : null;
          return Boolean(occurredAt && occurredAt >= startOfDay && occurredAt <= endOfDay);
        });
        const totalExpenses = currentDayExpenses.reduce((sum: number, expense: ExpenseRecord) => sum + Number(expense.amount || 0), 0);
        setTodayExpenses(currentDayExpenses);

        const orders = (ordersPayload.data ?? []) as unknown as OrderRecord[];
        let totalSales = 0;
        let surPlaceTotal = 0;
        let emporterTotal = 0;
        let validOrdersCount = 0;
        const productMap: { [key: string]: { quantity: number; total: number } } = {};

        const validStatuses = ['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee'];

        orders.forEach((order) => {
          const currentStatus = (order.status || '').toString().toLowerCase().trim();

          if (validStatuses.includes(currentStatus) || !order.status) {
            const amount = Number(order.total_amount) || 0;
            totalSales += amount;
            validOrdersCount++;

            const type = (order.order_type || '').toString().toLowerCase().trim();
            if (type === 'emporter' || type === 'a_emporter' || type === 'takeaway') {
              emporterTotal += amount;
            } else {
              surPlaceTotal += amount;
            }

            order.order_items?.forEach((item) => {
              const pName = item.products?.name || 'Produit non spécifié';
              const qty = Number(item.quantity) || 0;
              const price = Number(item.unit_price) || 0;

              if (!productMap[pName]) {
                productMap[pName] = { quantity: 0, total: 0 };
              }
              productMap[pName].quantity += qty;
              productMap[pName].total += qty * price;
            });
          }
        });

        const productSales = Object.keys(productMap).map((name) => ({
          name,
          quantity: productMap[name].quantity,
          total: productMap[name].total,
        }));

        setSummary({
          totalSales,
          surPlaceTotal,
          emporterTotal,
          totalExpenses,
          netCash: totalSales - totalExpenses,
          totalOrders: validOrdersCount,
          productSales,
        });
      } catch (error) {
        console.error('Erreur récupération données journalières:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = window.setTimeout(() => {
      void fetchDailyData();
      void fetchReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSignatureData(null);
  };

  const saveSignatureState = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setSignatureData(sigCanvas.current.toDataURL('image/png'));
    }
  };

  const handleSubmitClosure = async () => {
    if (!responsibleName.trim()) {
      alert('Veuillez renseigner le nom du responsable.');
      return;
    }

    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Veuillez apposer votre signature sur le carré prévu.');
      return;
    }

    setSubmitting(true);

    try {
      const signatureBase64 = sigCanvas.current.toDataURL('image/png');
      setSignatureData(signatureBase64);

      const closureTimestamp = new Date();
      const closureDate = [closureTimestamp.getFullYear(), String(closureTimestamp.getMonth() + 1).padStart(2, '0'), String(closureTimestamp.getDate()).padStart(2, '0')].join('-');
      const payload = {
        closure_date: closureDate,
        timezone_offset: closureTimestamp.getTimezoneOffset(),
        responsible_name: responsibleName,
        total_sales: Number(summary.totalSales) || 0,
        sur_place_total: Number(summary.surPlaceTotal) || 0,
        emporter_total: Number(summary.emporterTotal) || 0,
        total_expenses: Number(summary.totalExpenses) || 0,
        net_cash: Number(summary.netCash) || 0,
        total_orders: Number(summary.totalOrders) || 0,
        notes: notes || '',
        signature_url: signatureBase64,
        closed_at: closureTimestamp.toISOString(),
      };

      const response = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getApiHeaders()) },
        body: JSON.stringify(payload),
      });

      const closurePayload = await response.json();

      if (!response.ok) {
        throw new Error(closurePayload.error || 'Erreur d\'enregistrement de la clôture');
      }

      await fetchReports();
      alert('Clôture enregistrée et rapport envoyé à la Présidence !');

    } catch (err: unknown) {
      const errorObject = err as Error;
      console.error('Erreur globale d\'exécution :', errorObject);
      alert(`Une erreur est survenue : ${errorObject?.message || 'Erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const todayDate = new Date().toISOString().split('T')[0];
  const todayReportCount = reports.filter((report) => report.closure_date === todayDate).length;

  const downloadCurrentClosurePdf = () => {
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const docDate = new Date();
      let y = 18;

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, 210, 18, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('ECO CHAMP S.A', 14, 12);

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Rapport officiel de clôture journalière', 14, 25);
    pdf.text(`Date : ${docDate.toLocaleDateString('fr-FR')}`, 140, 25);
    y = 34;

    pdf.setDrawColor(203, 213, 225);
    pdf.line(14, y, 196, y);
    y += 10;

    const rowSummary = [
      ['Sur place', `${summary.surPlaceTotal.toLocaleString()} HTG`],
      ['À emporter', `${summary.emporterTotal.toLocaleString()} HTG`],
      ['Dépenses caisse', `-${summary.totalExpenses.toLocaleString()} HTG`],
      ['TOTAL GÉNÉRAL', `${summary.totalSales.toLocaleString()} HTG`],
      ['NET DE CAISSE', `${summary.netCash.toLocaleString()} HTG`],
    ];

    pdf.setFont('helvetica', 'bold');
    pdf.text('1. Résumé financier', 14, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    rowSummary.forEach(([label, value]) => {
      pdf.text(label, 18, y);
      pdf.text(value, 160, y, { align: 'right' });
      y += 7;
    });

    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text('2. Ventes par produit', 14, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    if (summary.productSales.length > 0) {
      summary.productSales.forEach((item) => {
        pdf.text(item.name.slice(0, 36), 18, y);
        pdf.text(String(item.quantity), 125, y, { align: 'center' });
        pdf.text(`${item.total.toLocaleString()} HTG`, 190, y, { align: 'right' });
        y += 7;
      });
    } else {
      pdf.text('Aucun produit vendu aujourd\'hui', 18, y);
      y += 7;
    }

    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text('3. Présence et connexion', 14, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Type', 18, y);
    pdf.text('Date', 90, y);
    pdf.text('Heure', 150, y);
    y += 7;
    pdf.line(14, y, 196, y);
    y += 7;
    pdf.text('Connexion du responsable', 18, y);
    pdf.text(new Date(lastLoginAt || Date.now()).toLocaleDateString('fr-FR'), 90, y);
    pdf.text(new Date(lastLoginAt || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 150, y);
    y += 12;

    if (notes) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('4. Remarques', 14, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(notes, 170);
      pdf.text(lines, 18, y);
      y += lines.length * 6 + 8;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text(`Responsable : ${responsibleName || 'Non spécifié'}`, 14, y + 10);
    pdf.line(14, y + 18, 90, y + 18);
    pdf.text('Signature du responsable', 130, y + 10);
    pdf.line(130, y + 18, 190, y + 18);

      pdf.save(`Rapport_Cloture_${docDate.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* En-tête */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-amber-500">ECO CHAMP S.A</h1>
            <p className="text-xs text-slate-400">Rapport de Clôture Journalière</p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p className="font-bold">{new Date().toLocaleDateString('fr-FR')}</p>
            <p>Boulevard des 4 Chemins, Cayes</p>
          </div>
        </div>

        {/* Synthèse */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">Total Recette</p>
              <p className="text-xl font-black text-slate-900">{summary.totalSales.toLocaleString()} HTG</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Utensils size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">Sur Place</p>
              <p className="text-xl font-black text-slate-900">{summary.surPlaceTotal.toLocaleString()} HTG</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">À Emporter</p>
              <p className="text-xl font-black text-slate-900">{summary.emporterTotal.toLocaleString()} HTG</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">Dépenses du jour</p>
              <p className="text-xl font-black text-rose-600">{summary.totalExpenses.toLocaleString()} HTG</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-cyan-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">Net de caisse</p>
              <p className="text-xl font-black text-cyan-600">{summary.netCash.toLocaleString()} HTG</p>
            </div>
          </div>
        </div>

        {/* Signature & Formulaire */}
        {!isPresidence && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PenTool size={18} className="text-amber-500" /> Signature & Validation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Responsable :</label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Ex: ECO CHAMP"
                className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Observations :</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques éventuelles sur la journée..."
                className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none h-20"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">Signature Électronique :</label>
              <button
                onClick={clearSignature}
                type="button"
                className="text-xs text-rose-500 hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} /> Effacer
              </button>
            </div>
            <div className="border border-slate-300 rounded-xl bg-slate-50 overflow-hidden w-full">
              <SignatureCanvas
                ref={sigCanvas}
                penColor="#000000"
                onEnd={saveSignatureState}
                canvasProps={{ 
                  style: { width: '100%', height: '128px', display: 'block' } 
                }}
              />
            </div>
          </div>

          <button
            onClick={handleSubmitClosure}
            disabled={submitting || todayReportCount >= 4}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                {todayReportCount >= 4 ? 'Limite quotidienne atteinte' : 'Valider la Clôture & Envoyer à la Présidence'}
              </>
            )}
          </button>
          <p className="text-center text-xs font-bold text-slate-500">
            {todayReportCount}/4 rapport(s) envoyé(s) aujourd&apos;hui
          </p>
        </div>}

        {isPresidence && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 shadow-sm">
            <p className="font-black">Consultation Présidence</p>
            <p className="mt-1 text-xs">La création et la signature des clôtures restent réservées à la caisse.</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText size={18} className="text-amber-500" /> Historique des rapports envoyés
          </h2>
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun rapport envoyé.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report, index) => (
                <div key={report.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-800">Rapport #{reports.length - index}</p>
                    <p className="text-xs text-slate-500">{new Date(`${report.closure_date}T12:00:00`).toLocaleDateString('fr-FR')} · {report.responsible_name} · {new Date(report.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-emerald-600">Recette {Number(report.total_sales || 0).toLocaleString()} HTG</p>
                    <p className="text-rose-600">Dépenses -{Number(report.total_expenses || 0).toLocaleString()} HTG</p>
                    <p className="font-black text-cyan-600">Net {Number(report.net_cash ?? (Number(report.total_sales || 0) - Number(report.total_expenses || 0))).toLocaleString()} HTG</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShoppingBag size={18} className="text-rose-500" /> Dépenses du jour
          </h2>
          {todayExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune dépense enregistrée aujourd&apos;hui.</p>
          ) : (
            <div className="space-y-2">
              {todayExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-800">{expense.motive}</p>
                    <p className="text-xs text-slate-500">{expense.responsible_name} · {new Date(expense.occurred_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <span className="font-black text-rose-600">-{Number(expense.amount || 0).toLocaleString()} HTG</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aperçu du rapport envoyé à la Présidence */}
        <div
          className="p-8 rounded-2xl border shadow-xl space-y-6"
          data-pdf-report
          style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }}
        >
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: 0 }}>ECOCHAMP S.A</h1>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Boulevard des 4 Chemins, Les Cayes</p>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>38167604 / 40620206</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 'bold', fontSize: '12px', padding: '4px 12px', borderRadius: '9999px' }}>
                RAPPORT OFFICIEL DE CLÔTURE
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Date : {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px' }}>1. Résumé Financier</h3>
            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Mode</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Montant Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Sur Place</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{summary.surPlaceTotal.toLocaleString()} HTG</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>À Emporter</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{summary.emporterTotal.toLocaleString()} HTG</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Dépenses caisse</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: '#e11d48' }}>-{summary.totalExpenses.toLocaleString()} HTG</td>
                </tr>
                <tr style={{ backgroundColor: '#fffbeb', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>TOTAL GÉNÉRAL</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#b45309' }}>{summary.totalSales.toLocaleString()} HTG</td>
                </tr>
                <tr style={{ backgroundColor: '#ecfeff', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>NET DE CAISSE</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#0891b2' }}>{summary.netCash.toLocaleString()} HTG</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px' }}>2. Ventes par Produit</h3>
            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Article</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>Quantité</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Sous-Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.productSales.length > 0 ? (
                  summary.productSales.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{p.name}</td>
                      <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{p.quantity}</td>
                      <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{p.total.toLocaleString()} HTG</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>Aucun produit vendu aujourd&apos;hui</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '8px' }}>3. Présence et Connexion</h3>
            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Type</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Date</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Heure</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Connexion du responsable</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{lastLoginAt ? new Date(lastLoginAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{lastLoginAt ? new Date(lastLoginAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={downloadCurrentClosurePdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-400 disabled:opacity-50"
            >
              <Download size={15} />
              {downloadingPdf ? 'Téléchargement...' : 'Télécharger le rapport'}
            </button>
          </div>

          {notes && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '4px' }}>3. Remarques du Responsable</h3>
              <p style={{ fontSize: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontStyle: 'italic', margin: 0 }}>{notes}</p>
            </div>
          )}

          <div style={{ paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
            <div>
              <p style={{ fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Responsable : {responsibleName || '....................'}</p>
              {signatureData && (
                <Image
                  src={signatureData}
                  alt="Signature"
                  width={120}
                  height={56}
                  unoptimized
                  style={{ height: '56px', marginTop: '8px', borderBottom: '1px solid #94a3b8', display: 'block' }}
                />
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Pour le Président :</p>
              <p style={{ color: '#64748b', fontStyle: 'italic', marginTop: '4px', margin: 0 }}>President</p>
              <div style={{ marginTop: '24px', display: 'inline-block', borderBottom: '2px solid #0f172a', width: '128px' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}