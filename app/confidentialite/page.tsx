import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité | ECO CHAMP',
  description: 'Politique de confidentialité de l’application ECO CHAMP.',
};

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-200 md:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl md:p-10">
        <header className="space-y-3 border-b border-slate-800 pb-6">
          <Link href="/login" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">
            ← Retour à la connexion
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">ECO CHAMP S.A.</p>
          <h1 className="text-3xl font-black text-white">Politique de confidentialité</h1>
          <p className="text-sm text-slate-400">Dernière mise à jour : 17 septembre 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">1. Données collectées</h2>
          <p>
            Nous collectons les informations nécessaires au bon fonctionnement de l’application : identifiants d’accès,
            données de profil, historique de commandes, informations de paiement et éléments techniques liés à l’usage du service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">2. Finalité du traitement</h2>
          <p>
            Les données sont utilisées pour permettre la connexion des utilisateurs, la gestion des commandes, la supervision des
            ventes, l’analyse interne et le maintien de la sécurité du système.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">3. Sécurité</h2>
          <p>
            Nous mettons en place des mesures raisonnables pour protéger les données contre l’accès non autorisé, la perte ou la
            modification. Toutefois, aucun système n’est totalement infallible et les utilisateurs doivent garder leurs identifiants,
            leur code PIN et leurs accès confidentiels.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">4. Conservation</h2>
          <p>
            Les données sont conservées le temps nécessaire à la gestion des commandes, au suivi administratif et aux obligations
            légales applicables. Les informations non nécessaires peuvent être supprimées ou anonymisées.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">5. Droits</h2>
          <p>
            Les utilisateurs peuvent demander la mise à jour de leurs informations personnelles, la correction d’erreurs ou le
            retrait de certains accès selon les procédures internes de l’établissement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">6. Contact</h2>
          <p>
            Pour toute question sur cette politique, contactez l’administrateur de l’établissement ou l’équipe ECHO-CHAMP selon les
            coordonnées officielles communiquées par l’entreprise.
          </p>
        </section>
      </article>
    </main>
  );
}
