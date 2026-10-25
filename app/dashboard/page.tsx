'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Coffee, 
  Utensils, 
  Award, 
  Pizza, 
  GlassWater, 
  ChevronRight,
  ShoppingCart
} from 'lucide-react';

export default function DashboardMenuSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const menuCategories = [
    {
      id: 'petit_dejeuner',
      title: 'Petit déjeuner / Déjeuner',
      badge: 'Matin & Midi',
      icon: <Coffee size={22} className="text-amber-400" />,
      description: 'Votre journée idéale commence avec nos délicieux petits déjeuners !',
      bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      borderColor: 'border-amber-500/30',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'plat_du_jour',
      title: 'Plat du jour',
      badge: 'Fait Maison',
      icon: <Utensils size={22} className="text-emerald-400" />,
      description: 'Découvrez nos savoureuses recettes faites maison, préparées avec soin. Rapidité et bon goût sont au rendez-vous pour varier les plaisirs !',
      bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      borderColor: 'border-emerald-500/30',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'plats',
      title: 'Plats',
      badge: 'Générosité Locale',
      icon: <Award size={22} className="text-blue-400" />,
      description: 'Goûtez à la qualité et à la générosité de nos recettes locales et variées !',
      bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
      borderColor: 'border-blue-500/30',
      tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'pizza',
      title: 'Pizza',
      badge: 'Irrésistible',
      icon: <Pizza size={22} className="text-rose-400" />,
      description: 'Savourez l\'instant, une part à la fois ! Dégustez nos irrésistibles pizzas alliant saveurs gourmandes et fromage fondant à souhait.',
      bgGradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
      borderColor: 'border-rose-500/30',
      tagColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      id: 'boissons',
      title: 'Boissons',
      badge: 'Rafraîchissant',
      icon: <GlassWater size={22} className="text-purple-400" />,
      description: 'Une large sélection de boissons pour satisfaire toutes vos envies.',
      bgGradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
      borderColor: 'border-purple-500/30',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
  ];

  const filteredCategories = selectedCategory === 'all' 
    ? menuCategories 
    : menuCategories.filter(cat => cat.id === selectedCategory);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* En-tête de la section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest mb-2">
            <span>RESTAURANT</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Plezi Kreyòl <span className="text-amber-400 text-sm font-semibold">by ECO CHAMP S.A</span>
          </h2>
        </div>

        {/* Boutons d'affichage rapide */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Tout afficher
          </button>
          {menuCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat.title.split('/')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Cartes cliquables vers /commande */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {filteredCategories.map((item) => (
          <Link
            key={item.id}
            href={`/commande?category=${item.id}`}
            className={`group relative bg-gradient-to-br ${item.bgGradient} bg-slate-950 border ${item.borderColor} p-6 rounded-2xl shadow-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:border-amber-400/50 flex flex-col justify-between overflow-hidden block`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl group-hover:scale-110 group-hover:border-amber-500/50 transition-transform duration-300">
                  {item.icon}
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${item.tagColor}`}>
                  {item.badge}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mt-2.5">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Bouton d'action vers la prise de commande */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
              <span className="flex items-center space-x-2">
                <ShoppingCart size={14} />
                <span>Commander maintenant</span>
              </span>
              <ChevronRight size={16} className="transform group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}