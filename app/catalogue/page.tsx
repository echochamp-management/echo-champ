'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Plus, Minus, Loader2, Utensils, ShoppingBag as BagIcon, Clock, CheckCheck, Printer } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: { name: string } | null;
}

interface OrderStatus {
  id: string;
  status: string;
  total_amount: number;
  customer_name: string;
  created_at?: string;
  order_items?: OrderItem[];
}

export default function CatalogueClientPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Informations client
  const [customerName, setCustomerName] = useState('');
  const [consumptionMode, setConsumptionMode] = useState<'sur_place' | 'emporter'>('sur_place');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Suivi de la commande en cours
  const [currentOrder, setCurrentOrder] = useState<OrderStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (!error && isMounted) setProducts(data || []);
      if (isMounted) setLoading(false);
    };
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Écouteur Realtime Supabase pour suivre l'état de la commande
  useEffect(() => {
    if (!currentOrder?.id) return;

    const channel = supabase
      .channel(`order-status-${currentOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrder.id}`,
        },
        (payload) => {
          const updatedOrder = payload.new as OrderStatus;
          setCurrentOrder((prev) => (prev ? { ...prev, status: updatedOrder.status } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrder?.id]);

  const updateQuantity = useCallback((product: Product, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (!existing && delta > 0) {
        return [...prev, { product, quantity: 1 }];
      }
      return prev
        .map((item) => {
          if (item.product.id === product.id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !customerName.trim()) return;

    setSubmitting(true);

    try {
      const formattedCustomerName = consumptionMode === 'sur_place'
        ? `${customerName} (Sur place)`
        : `${customerName} (À emporter - Tél: ${phone || 'Non renseigné'})`;

      // 1. Enregistrement de la commande principale
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: formattedCustomerName,
          total_amount: totalAmount,
          status: 'en_attente_paiement',
          order_type: consumptionMode,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Enregistrement des articles
      const orderItemsToInsert = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // Déclenchement du suivi en direct
      setCurrentOrder({
        id: order.id,
        status: 'en_attente_paiement',
        total_amount: totalAmount,
        customer_name: customerName,
        created_at: order.created_at || new Date().toISOString(),
        order_items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          products: { name: item.product.name }
        }))
      });

      // Réinitialisation
      setCart([]);
      setCustomerName('');
      setPhone('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      alert('Erreur lors de l’envoi de la commande : ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- ÉCRAN DE SUIVI EN DIRECT ---
  if (currentOrder) {
    const isPending = currentOrder.status === 'en_attente_paiement';
    const isPaidOrValidated = ['payee_validee', 'payée', 'validee'].includes(currentOrder.status);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-6">
        
        {/* REÇU MASQUÉ À L'ÉCRAN / VISIBLE À L'IMPRESSION */}
        <div id="receipt-print-area" className="hidden print:block font-mono text-black text-xs p-2 max-w-[80mm] mx-auto">
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-500">
              {new Date(currentOrder.created_at || Date.now()).toLocaleDateString('en-US')} {new Date(currentOrder.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-right text-[10px]">Sales Receipt #{currentOrder.id.slice(0, 4)}</p>
            
            <h2 className="text-base font-bold uppercase mt-2">ECOCHAMP S.A</h2>
            <p className="text-[11px]">Boulevard des 4 chemins</p>
            <p className="text-[11px]">Cayes</p>
            <p className="text-[11px]">38167604 / 40620206</p>
            
            <div className="text-left mt-3">
              <p>Cashier: Juliette</p>
              <p>Client: {currentOrder.customer_name}</p>
            </div>
          </div>

          <div className="border-b border-black my-2"></div>

          <div className="flex justify-between font-bold text-[11px]">
            <span>Item / Name</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-16 text-right">Ext Price</span>
          </div>

          <div className="border-b border-black my-1"></div>

          <div className="space-y-1">
            {currentOrder.order_items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-[11px]">
                <span className="flex-1 pr-1">{item.products?.name || 'Produit'}</span>
                <span className="w-8 text-center">{item.quantity}</span>
                <span className="w-16 text-right">${(item.quantity * item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          <div className="border-b border-black my-2"></div>

          <div className="space-y-1 text-right text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${currentOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>0% Tax:</span>
              <span>+$0.00</span>
            </div>
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
              <span>RECEIPT TOTAL:</span>
              <span>${currentOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Cash:</span>
              <span>${currentOrder.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="text-center mt-6 space-y-2">
            <p className="text-[11px]">Merci de nous avoir choisi !!!</p>
            <div className="font-barcode text-2xl tracking-widest leading-none mt-1">* {currentOrder.id.slice(0, 6)} *</div>
          </div>
        </div>

        {/* INTERFACE CLIENT À L'ÉCRAN */}
        <div className="space-y-6 flex flex-col items-center print:hidden">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg ${
            isPending ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'
          }`}>
            {isPending ? <Clock size={40} /> : <CheckCheck size={40} />}
          </div>

          <div className="space-y-2 max-w-sm">
            <h1 className="text-2xl font-black text-slate-900">
              {isPending ? 'Commande en attente de validation' : 'Commande Validée ! 🎉'}
            </h1>
            <p className="text-sm text-slate-600">
              {isPending 
                ? 'Votre commande a bien été transmise au responsable. Veuillez patienter pendant sa vérification.'
                : 'Le responsable a validé votre commande. Elle est en cours de préparation / service !'
              }
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm w-full max-w-xs text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Client :</span>
              <span className="font-bold text-slate-800">{currentOrder.customer_name}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Montant total :</span>
              <span className="font-bold text-amber-600">{currentOrder.total_amount} HTG</span>
            </div>
            <div className="flex justify-between text-slate-500 pt-2 border-t">
              <span>Statut actuel :</span>
              <span className={`font-extrabold px-2 py-0.5 rounded-md ${
                isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {isPending ? 'En attente ⏳' : 'Validée ✅'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            {isPaidOrValidated && (
              <>
                <button
                  onClick={handlePrint}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Printer size={16} />
                  <span>Imprimer le reçu</span>
                </button>

                <button
                  onClick={() => setCurrentOrder(null)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-sm"
                >
                  Passer une autre commande
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-44 print:hidden">
      {/* Header client */}
      <header className="bg-slate-900 text-white p-5 sticky top-0 z-10 shadow-md">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-amber-500 tracking-tight">ECOCHAMP S.A</h1>
            <p className="text-[11px] text-slate-400">Catalogue & Commandes en ligne</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-700">
            <ShoppingBag size={14} className="text-amber-400" />
            <span>{cart.reduce((acc, i) => acc + i.quantity, 0)} articles</span>
          </div>
        </div>
      </header>

      {/* Liste des produits */}
      <main className="max-w-xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-12 text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          products.map((product) => {
            const inCart = cart.find((i) => i.product.id === product.id);
            return (
              <div
                key={product.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-bold text-slate-900">{product.name}</h3>
                  <p className="text-amber-600 font-extrabold text-sm mt-0.5">
                    {product.price} HTG
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl">
                  {inCart ? (
                    <>
                      <button
                        onClick={() => updateQuantity(product, -1)}
                        className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-700 shadow-sm"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-sm w-4 text-center">
                        {inCart.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product, 1)}
                        className="w-8 h-8 bg-amber-500 text-slate-950 rounded-lg flex items-center justify-center shadow-sm"
                      >
                        <Plus size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => updateQuantity(product, 1)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Panier & Choix du mode de retrait */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-2xl z-20">
          <form onSubmit={handleSubmitOrder} className="max-w-xl mx-auto space-y-3">
            
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setConsumptionMode('sur_place')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                  consumptionMode === 'sur_place'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Utensils size={14} />
                <span>À consommer sur place</span>
              </button>

              <button
                type="button"
                onClick={() => setConsumptionMode('emporter')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                  consumptionMode === 'emporter'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BagIcon size={14} />
                <span>À emporter</span>
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                required
                placeholder="Votre nom complet"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              {consumptionMode === 'emporter' && (
                <input
                  type="tel"
                  required
                  placeholder="Téléphone / WhatsApp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition flex justify-between items-center px-5 shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <div className="flex items-center gap-2 mx-auto">
                  <Loader2 className="animate-spin" size={18} />
                  <span>Traitement en cours...</span>
                </div>
              ) : (
                <>
                  <span>
                    Valider ({consumptionMode === 'sur_place' ? 'Sur place' : 'À emporter'})
                  </span>
                  <span className="bg-emerald-700 px-3 py-1 rounded-lg">
                    {totalAmount} HTG
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}