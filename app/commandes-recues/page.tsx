'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiHeaders } from '@/lib/api-client';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  User,
  Utensils,
  ShoppingBag as BagIcon,
  Printer
  ,Bell
  ,Send
} from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  products: { name: string } | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_firstname?: string | null;
  total_amount: number;
  status: string;
  order_type?: string;
  source?: 'catalogue' | 'interne';
  customer_message?: string | null;
  estimated_ready_minutes?: number | null;
  confirmed_at?: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

interface RawOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  products: { name: string } | { name: string }[] | null;
}

interface RawOrder extends Omit<Order, 'order_items'> {
  order_items?: RawOrderItem[];
}

export default function CommandesRecuesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('en_attente');
  const [notification, setNotification] = useState<string | null>(null);
  const [confirmationOrderId, setConfirmationOrderId] = useState<string | null>(null);
  const [readyMinutes, setReadyMinutes] = useState('20');
  const [customerMessage, setCustomerMessage] = useState('Votre commande est bien reçue et part en préparation.');
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const knownOrderIds = useRef<Set<string> | null>(null);
  const notificationAudio = useRef<HTMLAudioElement | null>(null);
  const fetchingOrders = useRef(false);

  const fetchOrders = async (showLoader = false) => {
    if (fetchingOrders.current) return;
    fetchingOrders.current = true;
    if (showLoader) setLoading(true);
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur lors de la récupération des commandes');
      }

      const formattedOrders: Order[] = (payload.data ?? []).map((order: RawOrder) => ({
        ...order,
        order_items: order.order_items?.map((item: RawOrderItem) => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] ?? null : item.products,
        })),
      }));

      setOrders(formattedOrders);
      const catalogueOrders = formattedOrders.filter(
        (order) => order.source === 'catalogue' && order.status === 'en_attente_paiement'
      );
      if (knownOrderIds.current) {
        const newOrder = catalogueOrders.find((order) => !knownOrderIds.current?.has(order.id));
        if (newOrder) {
          setNotification(`Nouvelle commande catalogue de ${newOrder.customer_name}`);
          notificationAudio.current?.play().catch(() => undefined);
        }
      }
      knownOrderIds.current = new Set(formattedOrders.map((order) => order.id));
    } catch (error) {
      console.error('Erreur API commandes:', error);
      setOrders([]);
    } finally {
      fetchingOrders.current = false;
      if (showLoader) setLoading(false);
    }
  };

  const confirmCatalogueOrder = async (orderId: string) => {
    const minutes = Number(readyMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240 || !customerMessage.trim()) {
      alert('Saisissez un délai entre 1 et 240 minutes et un message.');
      return;
    }

    setUpdatingId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getApiHeaders()) },
        body: JSON.stringify({
          estimated_ready_minutes: minutes,
          customer_message: customerMessage.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erreur de confirmation');

      setOrders((prev) => prev.map((order) => order.id === orderId
        ? { ...order, estimated_ready_minutes: minutes, customer_message: customerMessage.trim(), confirmed_at: new Date().toISOString() }
        : order));
      setConfirmationOrderId(null);
    } catch (error) {
      alert(`Erreur de confirmation : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchOrders(true); }, 0);
    const interval = window.setInterval(() => { void fetchOrders(); }, 15000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const authHeaders = await getApiHeaders();
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: newStatus }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur de mise à jour');
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (error) {
      alert(`Erreur de mise à jour: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Impression du reçu de caisse
  const handlePrintReceipt = (order: Order) => {
    setPreviewOrder(order);
  };

  const printPreview = () => {
    document.body.classList.add('printing-receipt');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-receipt'), 500);
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'tous') return true;
    if (filterStatus === 'en_attente') return o.status === 'en_attente_paiement';
    if (filterStatus === 'validees') return ['payee_validee', 'validee', 'payée', 'paye'].includes(o.status);
    if (filterStatus === 'annulees') return o.status === 'annulee';
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-white">
      <audio ref={notificationAudio} src="/sounds/notifications.mp3" preload="auto" />
      {previewOrder && (
        <div className="receipt-modal fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Aperçu du ticket</h2>
                <p className="text-xs text-slate-400">Vérifiez les informations avant impression.</p>
              </div>
              <button type="button" onClick={() => setPreviewOrder(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white">Fermer</button>
            </div>
            <div className="receipt-print-area mx-auto w-full max-w-[320px] bg-white p-5 font-mono text-xs text-black shadow-lg">
              <div className="border-b border-dashed border-black pb-3 text-center">
                <h3 className="text-lg font-black">ECO CHAMP</h3>
                <p>REÇU DE CAISSE</p>
                <p className="mt-1 leading-5">Réf. #{previewOrder.id.slice(0, 8)}<br />{new Date(previewOrder.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="border-b border-dashed border-black py-3 leading-5">
                <p><strong>Client :</strong> {[previewOrder.customer_name, previewOrder.customer_firstname].filter(Boolean).join(' ') || 'Non renseigné'}</p>
                <p><strong>Type :</strong> {previewOrder.order_type === 'emporter' ? 'À emporter' : 'Sur place'}</p>
                <p><strong>Origine :</strong> {previewOrder.source === 'catalogue' ? 'Commande catalogue' : 'Commande interne'}</p>
              </div>
              <div className="py-3">
                {previewOrder.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-1">
                    <span><strong>{item.quantity}x</strong> {item.products?.name || 'Produit'}<small className="block text-[10px] text-slate-600">{Number(item.unit_price).toLocaleString('fr-FR')} HTG / unité</small></span>
                    <span className="whitespace-nowrap">{(item.quantity * item.unit_price).toLocaleString('fr-FR')} HTG</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black pt-3 text-center">
                <div className="flex justify-between text-base font-black"><span>TOTAL</span><span>{Number(previewOrder.total_amount || 0).toLocaleString('fr-FR')} HTG</span></div>
                <p className="mt-2 font-black">{previewOrder.status === 'payee_validee' ? 'PAYÉ / VALIDÉ' : previewOrder.status === 'annulee' ? 'ANNULÉE' : 'EN ATTENTE DE PAIEMENT'}</p>
                <p className="mt-3">Merci de votre visite !</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPreviewOrder(null)} className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700">Annuler</button>
              <button type="button" onClick={printPreview} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"><Printer size={14} /> Imprimer</button>
            </div>
          </div>
        </div>
      )}
      {notification && (
        <div className="fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-amber-400/50 bg-[#10261e] p-4 text-amber-100 shadow-2xl">
          <Bell className="text-amber-400" size={20} />
          <span className="flex-1 text-sm font-bold">{notification}</span>
          <button onClick={() => setNotification(null)} className="text-xs text-amber-300 underline">Fermer</button>
        </div>
      )}
      {/* En-tête */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider">Caisse & Validation</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShoppingBag size={26} className="text-amber-500" /> Commandes Reçues
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Les commandes restent en attente jusqu&apos;à encaissement et confirmation à la caisse.
          </p>
        </div>

        <button
          onClick={() => void fetchOrders(true)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2.5 rounded-xl border border-slate-700 font-bold transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'en_attente', label: '⏳ En attente de paiement' },
          { id: 'validees', label: '✅ Validées / Encaissées' },
          { id: 'annulees', label: '❌ Annulées' },
          { id: 'tous', label: 'Toutes' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterStatus === f.id
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grille des commandes */}
      {loading ? (
        <div className="p-16 flex justify-center text-amber-500">
          <Loader2 className="animate-spin" size={36} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
          <ShoppingBag className="mx-auto opacity-30" size={48} />
          <p className="font-bold">Aucune commande dans cette catégorie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'en_attente_paiement';
            const isValidated = ['payee_validee', 'validee', 'payée', 'paye'].includes(order.status);
            const isCancelled = order.status === 'annulee';

            return (
              <div
                key={order.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all ${
                  isPending
                    ? 'border-amber-500/50 shadow-amber-500/5 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20'
                    : isCancelled
                    ? 'border-red-900/40 opacity-60'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Statut + Date */}
                  <div className="flex justify-between items-center text-xs">
                    <span
                      className={`font-black px-2.5 py-1 rounded-lg uppercase text-[10px] tracking-wider flex items-center gap-1 ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                          : isCancelled
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isPending && <Clock size={12} />}
                      {isValidated && <CheckCircle size={12} />}
                      {isCancelled && <XCircle size={12} />}
                      {isPending ? 'En attente caisse' : isCancelled ? 'Annulée' : 'Validée & Payée'}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(order.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Infos client */}
                  <div className="border-b border-slate-800 pb-3">
                    <p className="font-extrabold text-base text-white flex items-center gap-2">
                      <User size={16} className="text-amber-400" /> {order.customer_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      {order.order_type === 'emporter' ? <BagIcon size={14} /> : <Utensils size={14} />}
                      <span>{order.order_type === 'emporter' ? 'À emporter' : 'Sur place'}</span>
                    </p>
                  </div>

                  {/* Articles */}
                  <div className="space-y-1.5 py-1">
                    {order.order_items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-300">
                        <span>
                          <strong className="text-amber-400">{item.quantity}x</strong> {item.products?.name || 'Produit'}
                        </span>
                        <span className="text-slate-400">{item.quantity * item.unit_price} HTG</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total et Actions */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase">Total :</span>
                    <span className="text-xl font-black text-emerald-400">{order.total_amount} HTG</span>
                  </div>

                  {/* Boutons d'action en attente */}
                  {isPending && (
                    <div className="space-y-2">
                      {order.source === 'catalogue' && (
                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-3 space-y-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-cyan-300">Réponse au client catalogue</p>
                          <input
                            type="number"
                            min="1"
                            max="240"
                            value={confirmationOrderId === order.id ? readyMinutes : '20'}
                            onChange={(event) => { setConfirmationOrderId(order.id); setReadyMinutes(event.target.value); }}
                            className="w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-xs text-white"
                            placeholder="Délai en minutes"
                          />
                          <textarea
                            value={customerMessage}
                            onChange={(event) => { setConfirmationOrderId(order.id); setCustomerMessage(event.target.value); }}
                            className="min-h-16 w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-xs text-white"
                            placeholder="Message envoyé au client"
                          />
                          <button
                            onClick={() => void confirmCatalogueOrder(order.id)}
                            disabled={updatingId === order.id}
                            className="w-full rounded-lg bg-cyan-500 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                          >
                            <Send size={14} className="mr-1 inline" /> Confirmer et prévenir le client
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'payee_validee')}
                        disabled={updatingId === order.id}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 shadow-lg transition disabled:opacity-50"
                      >
                        {updatingId === order.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <>
                            <CheckCircle size={16} /> Confirmer & Encaisser
                          </>
                        )}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Printer size={14} /> Ticket
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'annulee')}
                          disabled={updatingId === order.id}
                          className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 font-bold rounded-xl text-xs flex justify-center items-center border border-red-900/50 transition"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Boutons et statut pour commandes traitées */}
                  {isValidated && (
                    <div className="space-y-2">
                      <div className="text-center text-xs text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/50 py-2 rounded-xl">
                        Encaissement Confirmé ✅
                      </div>
                      <button
                        onClick={() => handlePrintReceipt(order)}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex justify-center items-center gap-2 border border-slate-700 transition"
                      >
                        <Printer size={14} /> Re-imprimer le ticket
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}