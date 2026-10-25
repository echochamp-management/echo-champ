import Link from 'next/link';

export const metadata = {
  title: 'Conditions d’utilisation | ECO CHAMP',
  description: 'Conditions d’utilisation de l’application ECO CHAMP.',
};

export default function ConditionsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-200 md:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl md:p-10">
        <header className="space-y-3 border-b border-slate-800 pb-6">
          <Link href="/login" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">← Retour à la connexion</Link>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">ECO CHAMP S.A.</p>
          <h1 className="text-3xl font-black text-white">Conditions d&apos;utilisation</h1>
          <p className="text-sm text-slate-400">Dernière mise à jour : 17 septembre 2026</p>
        </header>

        <section className="space-y-3"><h2 className="text-xl font-black text-white">1. Objet</h2><p>Ces conditions encadrent l’utilisation de l’application ECO CHAMP pour la consultation du catalogue, la prise de commandes, la gestion opérationnelle et le suivi des rapports.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">2. Accès au service</h2><p>L’accès nécessite un compte créé par l’administrateur de l’établissement. Chaque utilisateur doit garder ses identifiants et son code PIN confidentiels et ne pas les partager. L’accès rapide par PIN dépend de la session et de l’appareil utilisés.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">3. Commandes</h2><p>Les informations saisies pour une commande doivent être exactes. Une commande catalogue est transmise à la caisse pour traitement et paiement. L’envoi d’une commande ne vaut pas confirmation définitive : son statut dépend de la validation de la caisse.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">4. Prix et disponibilité</h2><p>Les produits, prix et disponibilités peuvent être modifiés par l’établissement. Une commande peut être ajustée ou refusée lorsqu’un article n’est plus disponible. Les conditions de paiement et de retrait sont communiquées par la caisse.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">5. Utilisation acceptable</h2><p>Il est interdit de tenter d’accéder à un espace qui ne vous est pas attribué, de contourner les contrôles, de perturber le service, de transmettre des informations fausses ou d’utiliser l’application à des fins illégales.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">6. Disponibilité</h2><p>ECO CHAMP S.A. met en œuvre des moyens raisonnables pour maintenir le service, mais ne garantit pas une disponibilité permanente en cas de maintenance, de panne réseau ou de problème affectant un fournisseur tiers.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">7. Suspension et responsabilité</h2><p>Un accès peut être suspendu en cas d’utilisation abusive ou de risque pour la sécurité. Chaque utilisateur reste responsable de l’utilisation faite avec son compte. Les présentes conditions peuvent évoluer pour accompagner le service.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-black text-white">8. Contact</h2><p>Pour toute question sur le service, une commande ou ces conditions, contactez l’administrateur de l’établissement ou ECO CHAMP S.A. via les coordonnées officielles communiquées par l’entreprise.</p></section>
      </article>
    </main>
  );
}
