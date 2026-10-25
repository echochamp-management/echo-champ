import Link from 'next/link';

export default function LegalFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-400 md:flex-row">
        <p>© 2026 ECO CHAMP. Tous droits réservés.</p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/conditions" className="transition hover:text-emerald-300">
            Conditions d&apos;utilisation
          </Link>
          <Link href="/confidentialite" className="transition hover:text-emerald-300">
            Politique de confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
