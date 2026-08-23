'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, 
  ShoppingBag, 
  Utensils, 
  PenTool, 
  RotateCcw, 
  Download, 
  Loader2 
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DailySummary {
  totalSales: number;
  surPlaceTotal: number;
  emporterTotal: number;
  totalOrders: number;
  productSales: { name: string; quantity: number; total: number }[];
}

export default function ClotureJournalierePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailySummary>({
    totalSales: 0,
    surPlaceTotal: 0,
    emporterTotal: 0,
    totalOrders: 0,
    productSales: [],
  });

  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');

  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  // 1. Récupération des données du jour
  useEffect(() => {
    const fetchDailyData = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          order_type,
          status,
          created_at,
          order_items (
            quantity,
            unit_price,
            products ( name )
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (!error && orders) {
        let totalSales = 0;
        let surPlaceTotal = 0;
        let emporterTotal = 0;
        const productMap: { [key: string]: { quantity: number; total: number } } = {};

        orders.forEach((order) => {
          if (['payee_validee', 'validee', 'payée'].includes(order.status)) {
            totalSales += order.total_amount || 0;

            if (order.order_type === 'emporter') {
              emporterTotal += order.total_amount || 0;
            } else {
              surPlaceTotal += order.total_amount || 0;
            }

            order.order_items?.forEach((item: any) => {
              const pName = item.products?.name || 'Produit';
              if (!productMap[pName]) {
                productMap[pName] = { quantity: 0, total: 0 };
              }
              productMap[pName].quantity += item.quantity;
              productMap[pName].total += item.quantity * item.unit_price;
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
          totalOrders: orders.length,
          productSales,
        });
      }
      setLoading(false);
    };

    fetchDailyData();
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

  // 2. Sauvegarde & Génération PDF sans crash CSS
  const handleGeneratePDF = async () => {
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

      // Enregistrement dans Supabase
      const { error: dbError } = await supabase
        .from('daily_closures')
        .insert([
          {
            closure_date: new Date().toISOString().split('T')[0],
            responsible_name: responsibleName,
            total_sales: summary.totalSales,
            sur_place_total: summary.surPlaceTotal,
            emporter_total: summary.emporterTotal,
            total_orders: summary.totalOrders,
            notes: notes,
            signature_url: signatureBase64,
          }
        ]);

      if (dbError) {
        console.error('Erreur Supabase:', dbError);
        alert('Erreur lors de la sauvegarde dans la base de données.');
        setSubmitting(false);
        return;
      }

      // Génération PDF sécurisée pour html2canvas
      if (reportRef.current) {
        const canvas = await html2canvas(reportRef.current, { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Rapport_Cloture_${new Date().toISOString().split('T')[0]}.pdf`);
      }

      alert('Clôture enregistrée et PDF généré avec succès !');

    } catch (err) {
      console.error(err);
      alert('Erreur lors du traitement de la clôture.');
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-black text-amber-500">ECOCHAMP S.A</h1>
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
        </div>

        {/* Signature & Formulaire */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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
                placeholder="Ex: Juliette"
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
            onClick={handleGeneratePDF}
            disabled={submitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Download size={18} /> Valider la Clôture & Télécharger le PDF
              </>
            )}
          </button>
        </div>

        {/* Zone capturée par html2canvas */}
        <div className="bg-white p-8 rounded-2xl border border-slate-300 shadow-xl space-y-6" ref={reportRef}>
          <div className="border-b pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase text-slate-900">ECOCHAMP S.A</h1>
              <p className="text-xs text-slate-500">Boulevard des 4 Chemins, Les Cayes</p>
              <p className="text-xs text-slate-500">38167604 / 40620206</p>
            </div>
            <div className="text-right">
              <span className="bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1 rounded-full">
                RAPPORT OFFICIEL DE CLÔTURE
              </span>
              <p className="text-xs text-slate-500 mt-2">Date : {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase">1. Résumé Financier</h3>
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-2 border">Mode</th>
                  <th className="p-2 border text-right">Montant Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border">Sur Place</td>
                  <td className="p-2 border text-right font-bold">{summary.surPlaceTotal.toLocaleString()} HTG</td>
                </tr>
                <tr>
                  <td className="p-2 border">À Emporter</td>
                  <td className="p-2 border text-right font-bold">{summary.emporterTotal.toLocaleString()} HTG</td>
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className="p-2 border">TOTAL GÉNÉRAL</td>
                  <td className="p-2 border text-right text-amber-700">{summary.totalSales.toLocaleString()} HTG</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase">2. Ventes par Produit</h3>
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-2 border">Article</th>
                  <th className="p-2 border text-center">Quantité</th>
                  <th className="p-2 border text-right">Sous-Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.productSales.map((p, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 border">{p.name}</td>
                    <td className="p-2 border text-center">{p.quantity}</td>
                    <td className="p-2 border text-right">{p.total.toLocaleString()} HTG</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {notes && (
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase">3. Remarques du Responsable</h3>
              <p className="text-xs bg-slate-50 p-3 rounded-lg border italic">{notes}</p>
            </div>
          )}

          <div className="pt-6 border-t grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold text-slate-800">Responsable : {responsibleName || '....................'}</p>
              {signatureData && (
                <img
                  src={signatureData}
                  alt="Signature"
                  className="h-14 mt-2 border-b border-slate-400 block"
                />
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">Pour le Président :</p>
              <p className="text-slate-500 italic mt-1">Saint-Ulysse Durand</p>
              <div className="mt-6 inline-block border-b-2 border-slate-900 w-32"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}