'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ShoppingCart, 
  Coffee, 
  Utensils, 
  Award, 
  Pizza, 
  GlassWater, 
  Loader2, 
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  Search,
  X,
  Send,
  User
} from 'lucide-react';

interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

function CommandeContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allAvailableMenuItems, setAllAvailableMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerFirstname, setCustomerFirstname] = useState<string>('');
  const [orderType, setOrderType] = useState<'sur_place' | 'emporter'>('sur_place');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'carte' | 'virement_bancaire' | 'credit'>('cash');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const categories = [
    { id: 'all', label: 'Tout le Menu', icon: ShoppingCart },
    { id: 'petit_dejeuner', label: 'Petit déjeuner', icon: Coffee },
    { id: 'plat_du_jour', label: 'Plat du jour', icon: Utensils },
    { id: 'plats', label: 'Plats', icon: Award },
    { id: 'pizza', label: 'Pizza', icon: Pizza },
    { id: 'boissons', label: 'Boissons', icon: GlassWater },
  ];

  const fetchAvailableMenu = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products?available=true');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur de chargement du menu');
      }

      setAllAvailableMenuItems(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error('Erreur produits API:', error);
      setAllAvailableMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAvailableMenu(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeCategory = selectedCategory ?? categoryParam;

  const displayedProducts = (() => {
    let filtered = allAvailableMenuItems;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(query));
    }

    return filtered;
  })();

  const addToCart = (product: MenuItem) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSendToCashier = async () => {
    if (cart.length === 0) return;
    if (!customerName.trim()) {
      alert('Veuillez saisir le nom du client ou du serveur.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_firstname: customerFirstname.trim(),
          total_amount: Number(totalAmount),
          status: 'en_attente_paiement',
          order_type: orderType,
          payment_method: paymentMethod,
          items: cart.map((item) => ({
            id: item.id,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Impossible de transmettre la commande');
      }

      setCart([]);
      setCustomerName('');
      setCustomerFirstname('');
      setOrderType('sur_place');
      setPaymentMethod('cash');
      setSuccessMessage('Commande transmise à la caisse ! Le client peut passer au guichet pour effectuer le paiement.');
      setTimeout(() => setSuccessMessage(''), 7000);
    } catch (error: unknown) {
      console.error('Erreur API commande :', error);
      const message = error instanceof Error ? error.message : 'Impossible de contacter le serveur.';
      alert(`Erreur d'envoi : ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-white">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-amber-400">Passer votre Commande</h1>
          <p className="text-xs text-slate-400 mt-1">Sélectionnez vos articles puis envoyez votre commande à la caisse</p>
        </div>
        {successMessage && (
          <div className="flex items-center space-x-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold max-w-md">
            <CheckCircle size={20} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un plat, une boisson, une pizza..."
          className="w-full pl-11 pr-10 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSearchQuery('');
              }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="p-12 flex justify-center text-amber-400">
              <Loader2 className="animate-spin" size={36} />
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              Aucun article disponible pour cette recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-amber-500/50 transition-all shadow-md"
                >
                  <h3 className="font-bold text-white text-base">{product.name}</h3>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-amber-400 font-black text-lg">{product.price} HTG</span>
                    <button
                      onClick={() => addToCart(product)}
                      className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 h-fit sticky top-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="font-black text-lg text-white">Ma Commande</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              {cart.reduce((a, c) => a + c.quantity, 0)} articles
            </span>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">Votre panier est vide.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs">
                  <div>
                    <p className="font-bold text-white">{item.name}</p>
                    <p className="text-amber-400 font-semibold">{item.price * item.quantity} HTG</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    >
                      {item.quantity === 1 ? <Trash2 size={14} className="text-rose-400" /> : <Minus size={14} />}
                    </button>
                    <span className="font-bold text-white px-1">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Saisie Client / Serveur */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <User size={14} className="text-amber-400" />
              <span>Identification client / serveur</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nom *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Prénom"
                value={customerFirstname}
                onChange={(e) => setCustomerFirstname(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <label className="block text-xs font-bold text-slate-400">
              Type de commande
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'sur_place' | 'emporter')}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="sur_place">Sur place</option>
                <option value="emporter">À emporter</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-400">
              Mode de paiement
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'carte' | 'virement_bancaire' | 'credit')}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="carte">Carte</option>
                <option value="virement_bancaire">Virement bancaire</option>
                <option value="credit">Crédit</option>
              </select>
            </label>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-4">
            <div className="flex justify-between items-center text-lg font-black">
              <span className="text-slate-400">Total :</span>
              <span className="text-amber-400">{totalAmount} HTG</span>
            </div>

            <button
              onClick={handleSendToCashier}
              disabled={cart.length === 0 || !customerName.trim() || submitting}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black py-3 rounded-xl transition flex items-center justify-center space-x-2 text-xs cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <Send size={16} />
                  <span>Envoyer la commande à la caisse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommandePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-amber-400"><Loader2 className="animate-spin mx-auto" size={32} /></div>}>
      <CommandeContent />
    </Suspense>
  );
}