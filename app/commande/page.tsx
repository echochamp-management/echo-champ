'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, CheckCircle, Clock, Users, Plus, Minus } from 'lucide-react';

export default function CommandePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [guestsCount, setGuestsCount] = useState<number>(1);

  const fetchProductsAndOrders = async () => {
    const { data: prodData } = await supabase.from('products').select('*');
    setProducts(prodData || []);

    const { data: ordData } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name))')
      .eq('status', 'en_attente_paiement')
      .order('created_at', { ascending: false });
    setPendingOrders(ordData || []);
  };

  useEffect(() => {
    fetchProductsAndOrders();
  }, []);

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setCart(cart.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const submitPendingOrder = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

    // Insertion avec la colonne guests_count
    const { data: order, error } = await supabase
      .from('orders')
      .insert([
        {
          order_type: 'sur_place',
          total_amount: total,
          guests_count: guestsCount,
          status: 'en_attente_paiement',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création de la commande:', error);
      return;
    }

    const items = cart.map((c) => ({
      order_id: order.id,
      product_id: c.id,
      quantity: c.qty,
      unit_price: c.price,
    }));

    await supabase.from('order_items').insert(items);
    setCart([]);
    setGuestsCount(1); // Réinitialiser le compteur à 1
    fetchProductsAndOrders();
  };

  const validatePayment = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'payee_validee' }).eq('id', orderId);
    fetchProductsAndOrders();
  };

  return (
    <div className="p-6 md:ml-64 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Menu Plats & Boissons */}
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Menu ECHO-CHAMP</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="p-4 bg-white border rounded-xl shadow-sm hover:border-amber-500 text-left transition"
            >
              <p className="font-bold text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500 capitalize">{p.category}</p>
              <p className="text-amber-600 font-black mt-2">{p.price} HTG</p>
            </button>
          ))}
        </div>
      </div>

      {/* Panier & Commandes en Attente */}
      <div className="space-y-6">
        <div className="bg-white p-4 border rounded-xl shadow-sm space-y-4">
          <h2 className="font-bold text-lg border-b pb-2 flex items-center space-x-2">
            <ShoppingCart size={20} className="text-amber-500" />
            <span>Commande en cours</span>
          </h2>

          {cart.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.name} x{item.qty}
              </span>
              <span className="font-bold">{item.price * item.qty} HTG</span>
            </div>
          ))}

          {/* Compteur de clients */}
          <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
              <Users size={14} className="text-slate-500" />
              <span>Nombre de clients</span>
            </label>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setGuestsCount(Math.max(1, guestsCount - 1))}
                className="p-1 bg-white border rounded hover:bg-slate-100"
              >
                <Minus size={16} />
              </button>
              <span className="font-black text-slate-900 text-base">{guestsCount}</span>
              <button
                type="button"
                onClick={() => setGuestsCount(guestsCount + 1)}
                className="p-1 bg-white border rounded hover:bg-slate-100"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <button
            onClick={submitPendingOrder}
            disabled={cart.length === 0}
            className="w-full bg-amber-500 text-white font-bold py-3 rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            Placer en Attente de Paiement
          </button>
        </div>

        {/* Liste En Attente de Paiement */}
        <div className="bg-white p-4 border rounded-xl shadow-sm space-y-3">
          <h2 className="font-bold text-lg border-b pb-2 text-slate-800">En Attente de Paiement</h2>
          {pendingOrders.map((o) => (
            <div key={o.id} className="p-3 bg-slate-50 border rounded-lg space-y-2">
              <div className="flex justify-between items-center font-bold text-sm">
                <span>Total : {o.total_amount} HTG</span>
                <span className="text-amber-600 text-xs flex items-center gap-1">
                  <Clock size={12} /> En attente
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Users size={12} />
                <span>{o.guests_count || 1} client(s)</span>
              </div>
              <button
                onClick={() => validatePayment(o.id)}
                className="w-full bg-emerald-600 text-white py-2 rounded text-xs font-bold flex items-center justify-center space-x-1"
              >
                <CheckCircle size={14} />
                <span>Valider le Paiement</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}