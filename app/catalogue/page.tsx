'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getApiHeaders } from '@/lib/api-client';
import { LogOut, ShoppingBag, Plus, Minus, Check, Utensils, UserRound, Menu, X } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  is_available: boolean;
  stock_initial?: number;
  stock_remaining?: number;
  image_url?: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface OrderStatus {
  status: string;
  customer_message?: string | null;
  estimated_ready_minutes?: number | null;
  confirmed_at?: string | null;
}

const categoryOrder = ['petit_dejeuner', 'plat_du_jour', 'plats', 'pizza', 'boissons'] as const;

const categoryLabels: Record<string, string> = {
  petit_dejeuner: 'Petit Déjeuner',
  plat_du_jour: 'Plat du Jour',
  plats: 'Plats',
  pizza: 'Pizza',
  boissons: 'Boissons',
};

const sortProducts = (items: Product[]) =>
  [...items].sort((a, b) => {
    const aCategoryIndex = categoryOrder.indexOf((a.category ?? 'boissons') as (typeof categoryOrder)[number]);
    const bCategoryIndex = categoryOrder.indexOf((b.category ?? 'boissons') as (typeof categoryOrder)[number]);

    if (aCategoryIndex !== bCategoryIndex) {
      return aCategoryIndex - bCategoryIndex;
    }

    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });

export default function CatalogueClientPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerFirstname, setCustomerFirstname] = useState('');
  const [orderType, setOrderType] = useState<'sur_place' | 'emporter'>('sur_place');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'carte' | 'virement_bancaire' | 'credit'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [profileConfigured, setProfileConfigured] = useState(false);
  const [isCategorySidebarOpen, setIsCategorySidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const router = useRouter();

  async function fetchProducts() {
    setLoading(true);
    try {
      const response = await fetch('/api/products?available=true');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur chargement catalogue');
      }

      setProducts(sortProducts((payload.data ?? []) as Product[]));
    } catch (error) {
      console.error('Erreur chargement catalogue:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const checkCatalogueAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?next=/catalogue');
        return;
      }

      const metadata = user.user_metadata ?? {};
      setProfileConfigured(metadata.profile_configured === true);
      setCustomerName(metadata.last_name || metadata.full_name || '');
      setCustomerFirstname(metadata.first_name || '');
    };

    void checkCatalogueAccess();
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchProducts(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkOrder = async () => {
      const response = await fetch('/api/orders?mine=true&source=catalogue', {
        headers: await getApiHeaders(),
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = await response.json() as { data?: Array<OrderStatus & { id: string }> };
        const latestOrder = payload.data?.[0];
        setOrderId(latestOrder?.id ?? null);
        setOrderStatus(latestOrder ?? null);
      }
    };

    void checkOrder();
    const interval = window.setInterval(() => { void checkOrder(); }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const addToCart = (product: Product) => {
    if (!profileConfigured) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const trackedStock = Number(product.stock_initial || 0) > 0;
      if (trackedStock && (existing?.quantity || 0) >= Number(product.stock_remaining || 0)) return prev;
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const canAddProduct = (product: Product) => Number(product.stock_initial || 0) === 0 || Number(product.stock_remaining || 0) > (cart.find((item) => item.id === product.id)?.quantity || 0);

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const groupedProducts = categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      items: products.filter((product) => product.category === category),
    }))
    .filter((group) => group.items.length > 0);

  const visibleProductGroups = selectedCategory === 'all'
    ? groupedProducts
    : groupedProducts.filter((group) => group.category === selectedCategory);

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    setIsCategorySidebarOpen(false);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileConfigured || !customerName.trim() || cart.length === 0) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getApiHeaders()) },
        body: JSON.stringify({
          customer_name: customerName,
          customer_firstname: customerFirstname,
          total_amount: totalAmount,
          status: 'en_attente_paiement',
          order_type: orderType,
          payment_method: paymentMethod,
          source: 'catalogue',
          items: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur lors de la création de la commande');
      }

      setOrderSuccess(true);
      const createdOrderId = payload.data?.id as string | undefined;
      if (createdOrderId) {
        setOrderId(createdOrderId);
      }
      setCart([]);
      setCustomerName('');
      setCustomerFirstname('');
      setPaymentMethod('cash');
    } catch (error) {
      alert(`Erreur lors de la création de la commande : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950/40 text-white p-3 md:p-5 max-w-7xl mx-auto space-y-5">
      {/* En-tête */}
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-amber-500 flex items-center gap-2">
            <Utensils size={22} /> Menu & Carte
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">Choisissez vos plats et passez votre commande en direct.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCategorySidebarOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-300 transition hover:bg-amber-400/20"
          >
            <Menu size={15} /> Catégories
          </button>
          <Link href="/profil?returnTo=/catalogue" className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-emerald-400 hover:text-emerald-300">
            <UserRound size={15} /> Profil
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2 text-[11px] font-bold text-rose-300 transition hover:border-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
          >
            <LogOut size={15} /> Déconnexion
          </button>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] font-bold text-amber-400">
            🛒 {cart.reduce((a, b) => a + b.quantity, 0)} Plats sélectionnés
          </div>
        </div>
      </header>

      {orderSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-2xl flex items-center justify-between text-emerald-300">
          <div className="flex items-center gap-3">
            <Check className="bg-emerald-500 text-slate-950 rounded-full p-1" size={24} />
            <div>
              <p className="font-extrabold text-sm">Commande envoyée avec succès !</p>
              <p className="text-xs text-emerald-400">Elle est transmise à la caisse pour préparation.</p>
            </div>
          </div>
          <button onClick={() => setOrderSuccess(false)} className="text-xs underline font-bold">Fermer</button>
        </div>
      )}

      {orderId && orderStatus?.confirmed_at && (
        <div className="rounded-2xl border border-cyan-400/40 bg-cyan-950/50 p-4 text-cyan-100">
          <p className="text-sm font-black">Votre commande a été reçue par la caisse.</p>
          <p className="mt-1 text-xs text-cyan-200">
            {orderStatus.customer_message || 'La préparation va commencer.'}
            {orderStatus.estimated_ready_minutes ? ` Préparation estimée : ${orderStatus.estimated_ready_minutes} minutes.` : ''}
          </p>
        </div>
      )}

      <div
        className={`fixed inset-0 z-50 bg-slate-950/70 transition-opacity duration-300 ${isCategorySidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setIsCategorySidebarOpen(false)}
        aria-hidden={!isCategorySidebarOpen}
      >
          <aside
            className={`h-full w-[min(20rem,88vw)] overflow-y-auto border-r border-slate-700 bg-slate-900 p-5 shadow-2xl transition-transform duration-300 ease-out ${isCategorySidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Menu</p>
                <h2 className="mt-1 text-lg font-black text-white">Catégories</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCategorySidebarOpen(false)}
                aria-label="Fermer les catégories"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>
            <nav className="space-y-2">
              <button
                type="button"
                onClick={() => selectCategory('all')}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${selectedCategory === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
              >
                Tout le menu
              </button>
              {categoryOrder.map((category) => {
                const count = groupedProducts.find((group) => group.category === category)?.items.length ?? 0;
                return (
                  <button
                    key={category}
                    type="button"
                    disabled={count === 0}
                    onClick={() => selectCategory(category)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition ${selectedCategory === category ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span>{categoryLabels[category]}</span>
                    <span className="text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
      </div>

      {!profileConfigured && (
        <section className="rounded-3xl border-2 border-amber-400 bg-amber-950/60 p-8 text-center shadow-xl shadow-amber-950/20">
          <h2 className="text-2xl font-black text-amber-300">Configurez votre compte avant de commander</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-100">
            Pour protéger votre compte et permettre le suivi de vos commandes, vous devez d’abord définir votre nom, votre adresse email et votre mot de passe.
          </p>
          <Link href="/profil?returnTo=/catalogue" className="mt-6 inline-flex rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
            Configurer mon compte
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Grille des produits */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Plats disponibles</h2>
          {loading ? (
            <p className="text-xs text-slate-500">Chargement du menu...</p>
          ) : (
            <div className="space-y-4">
              {visibleProductGroups.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">{group.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map((product) => (
                      <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex justify-between items-center hover:border-slate-700 transition gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white truncate">{product.name}</h4>
                          <p className="text-amber-400 font-black text-sm mt-1">{product.price} HTG</p>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={!profileConfigured || !canAddProduct(product)}
                          className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-extrabold text-slate-950 shadow-md transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {canAddProduct(product) ? <Plus size={14} /> : null}
                          <span>{canAddProduct(product) ? 'Ajouter' : 'Épuisé'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panier Client */}
        <aside className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 h-fit lg:sticky lg:top-5 self-start max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShoppingBag size={18} className="text-amber-400" /> Mon Panier
          </h2>

          {!profileConfigured ? (
            <p className="py-6 text-center text-xs font-bold text-amber-300">Configurez votre compte pour utiliser le panier.</p>
          ) : cart.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Votre panier est vide pour le moment.</p>
          ) : (
            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">{item.name}</p>
                      <p className="text-slate-400">{item.price} HTG x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => removeFromCart(item.id)} className="p-1 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300">
                        <Minus size={12} />
                      </button>
                      <span className="font-black text-amber-400">{item.quantity}</span>
                      <button type="button" onClick={() => addToCart(item)} className="p-1 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulaire Client */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div>
                  <label className="text-[11px] font-bold text-slate-400">Nom du client :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jean Dupont"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400">Prénom :</label>
                  <input
                    type="text"
                    required
                    value={customerFirstname}
                    onChange={(e) => setCustomerFirstname(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400">Type de commande :</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as 'sur_place' | 'emporter')}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="sur_place">Sur Place</option>
                    <option value="emporter">À Emporter</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400">Mode de paiement :</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'carte' | 'virement_bancaire')}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="carte">Carte</option>
                    <option value="virement_bancaire">Virement bancaire</option>
                  </select>
                </div>

                <div className="flex justify-between items-center text-sm font-black pt-2">
                  <span>Total :</span>
                  <span className="text-emerald-400 text-base">{totalAmount} HTG</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg disabled:opacity-50"
                >
                  {submitting ? 'Validation...' : 'Confirmer et Envoyer'}
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}