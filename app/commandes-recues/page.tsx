'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChefHat, Loader2, DollarSign, CheckCircle2, Printer } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  products: {
    name: string;
  } | { name: string }[] | null;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  total_amount: number;
  status: 'en_attente_paiement' | 'en_preparation' | 'payee_validee' | string;
  order_type: string;
  order_items: OrderItem[];
}

export default function CommandesRecuesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        customer_name,
        total_amount,
        status,
        order_type,
        order_items (
          id,
          quantity,
          unit_price,
          products ( name )
        )
      `)
      .order('created_at', { ascending: false });

    if (!error) setOrders((data as unknown as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('responsable-orders-recues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (err: any) {
      alert('Erreur lors du changement de statut : ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const getProductName = (products: OrderItem['products']) => {
    if (!products) return 'Produit';
    if (Array.isArray(products)) {
      return products[0]?.name || 'Produit';
    }
    return products.name || 'Produit';
  };

  const handlePrintReceipt = (order: Order) => {
    setSelectedReceiptOrder(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex items-center justify-center">
      {/* --- SECTION CACHÉE À L'ÉCRAN : REÇU FORMAT TICKET THERMIQUE --- */}
      {selectedReceiptOrder && (
        <div id="receipt-print-area" className="hidden print:block font-mono text-black text-xs p-2 max-w-[80mm] mx-auto">
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-500">
              {new Date(selectedReceiptOrder.created_at).toLocaleDateString('en-US')} {new Date(selectedReceiptOrder.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-right text-[10px]">Sales Receipt #{selectedReceiptOrder.id.slice(0, 4)}</p>
            
            <h2 className="text-base font-bold uppercase mt-2">ECOCHAMP S.A</h2>
            <p className="text-[11px]">Boulevard des 4 chemins</p>
            <p className="text-[11px]">Cayes</p>
            <p className="text-[11px]">38167604 / 40620206</p>
            
            <div className="text-left mt-3">
              <p>Cashier: Juliette</p>
              <p>Client: {selectedReceiptOrder.customer_name}</p>
            </div>
          </div>

          <div className="border-b border-black my-2"></div>

          {/* En-tête Tableau */}
          <div className="flex justify-between font-bold text-[11px]">
            <span>Item / Name</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-16 text-right">Ext Price</span>
          </div>

          <div className="border-b border-black my-1"></div>

          {/* Articles */}
          <div className="space-y-1">
            {selectedReceiptOrder.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-[11px]">
                <span className="flex-1 pr-1">{getProductName(item.products)}</span>
                <span className="w-8 text-center">{item.quantity}</span>
                <span className="w-16 text-right">${(item.quantity * item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          <div className="border-b border-black my-2"></div>

          {/* Totaux */}
          <div className="space-y-1 text-right text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${selectedReceiptOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>0% Tax:</span>
              <span>+$0.00</span>
            </div>
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
              <span>RECEIPT TOTAL:</span>
              <span>${selectedReceiptOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Cash:</span>
              <span>${selectedReceiptOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="text-center mt-6 space-y-2">
            <p className="text-[11px]">Merci de nous avoir choisi !!!</p>
            {/* Code-barres simulé */}
            <div className="font-barcode text-2xl tracking-widest leading-none mt-1">* {selectedReceiptOrder.id.slice(0, 6)} *</div>
          </div>
        </div>
      )}

      {/* --- PAGE INTERFACE GESTION (MASQUÉE PENDANT L'IMPRESSION) --- */}
      <div className="w-full max-w-4xl space-y-6 my-auto print:hidden">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Commandes Reçues</h1>
            <p className="text-xs text-slate-500 mt-1">Validez la préparation puis encaissez à la réception</p>
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            Actualiser
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 font-medium shadow-sm">
            Aucune commande enregistrée pour le moment.
          </div>
        ) : (
          <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {orders.map((order) => {
              const isPending = order.status === 'en_attente_paiement';
              const isPreparing = order.status === 'en_preparation';
              const isCompleted = order.status === 'payee_validee' || order.status === 'payée' || order.status === 'validee';

              return (
                <div
                  key={order.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-lg">
                        {order.customer_name}
                      </span>
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-100 text-amber-700' :
                        isPreparing ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isPending ? 'En attente ⏳' : isPreparing ? 'En préparation 👨‍🍳' : 'Encaissée ✅'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.quantity}x {getProductName(item.products)}</span>
                          <span className="font-semibold">{item.quantity * item.unit_price} HTG</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-400">
                      Montant total : <strong className="text-amber-600 text-sm">{order.total_amount} HTG</strong>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col gap-2 min-w-[200px]">
                    {isPending && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'en_preparation')}
                        disabled={updatingId === order.id}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {updatingId === order.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <>
                            <ChefHat size={16} />
                            <span>Valider la réception (En préparation)</span>
                          </>
                        )}
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'payee_validee')}
                        disabled={updatingId === order.id}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {updatingId === order.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <>
                            <DollarSign size={16} />
                            <span>Valider l'encaissement (Client présent)</span>
                          </>
                        )}
                      </button>
                    )}

                    {isCompleted && (
                      <div className="flex flex-col gap-2">
                        <div className="w-full py-2 px-4 bg-emerald-50 text-emerald-700 font-bold rounded-xl text-xs text-center border border-emerald-200 flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={16} />
                          <span>Commande finalisée & encaissée</span>
                        </div>
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Printer size={16} />
                          <span>Imprimer le reçu</span>
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
    </div>
  );
}