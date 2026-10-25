'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getCanonicalRole, isPresidenceUser, type AccountRole } from '@/lib/account-role';
import { Lock, Mail, Loader2, LogIn, ShieldCheck, User, UserPlus } from 'lucide-react';

type StaffRole = 'presidence' | 'caissiere';

interface StaffLoginFormProps {
  role: StaffRole;
}

const roleConfig: Record<StaffRole, { title: string; subtitle: string; destination: string; email: string | null }> = {
  presidence: {
    title: 'Connexion Présidence',
    subtitle: 'Accès sécurisé aux résultats et clôtures.',
    destination: '/presidence',
    email: 'presidence@gmail.com',
  },
  caissiere: {
    title: 'Connexion Caissière',
    subtitle: 'Accès sécurisé à la caisse et aux commandes.',
    destination: '/dashboard',
    email: null,
  },
};

export default function StaffLoginForm({ role }: StaffLoginFormProps) {
  const config = roleConfig[role];
  const [email, setEmail] = useState(config.email ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setErrorMessage('Identifiants incorrects. Vérifiez votre email et votre mot de passe.');
      setLoading(false);
      return;
    }

    const accountRole = data.user.user_metadata?.account_role;
    const isLegacyPresidence = isPresidenceUser(data.user);

    if (role === 'presidence' && accountRole !== 'presidence' && !isLegacyPresidence) {
      await supabase.auth.signOut();
      setErrorMessage('Ce compte n’a pas accès à l’espace Présidence.');
      setLoading(false);
      return;
    }

    if (role === 'caissiere' && accountRole !== 'caissiere') {
      await supabase.auth.signOut();
      setErrorMessage('Ce compte n’a pas accès à la caisse. Créez ou utilisez un compte caissière.');
      setLoading(false);
      return;
    }

    const canonicalRole = role === 'presidence' ? getCanonicalRole(data.user, role as AccountRole) : 'caissiere';
    if (role === 'presidence' && canonicalRole && accountRole !== canonicalRole) {
      await supabase.auth.updateUser({ data: { account_role: canonicalRole } });
    }

    router.replace(config.destination);
  };

  const handleRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (fullName.trim().length < 2 || password.length < 6 || password !== confirmPassword || !inviteCode.trim()) {
      setErrorMessage('Nom valide, mot de passe de 6 caractères minimum, confirmation et code d’invitation requis.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/staff/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, inviteCode }),
    });
    const payload = await response.json() as { error?: string; message?: string };
    if (!response.ok) {
      setErrorMessage(payload.error || 'Impossible de créer le compte caissière.');
      setLoading(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
    setIsRegistering(false);
    setSuccessMessage(payload.message || 'Compte créé. Vous pouvez vous connecter.');
    setLoading(false);
  };

  return (
    <main className="login-scene relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061a13] p-4 text-white">
      <div className="login-scene-image pointer-events-none absolute inset-[-4%]" />
      <div className="login-wind login-wind-one pointer-events-none absolute inset-0" />
      <div className="login-wind login-wind-two pointer-events-none absolute inset-0" />
      <div className="login-scene-shade pointer-events-none absolute inset-0" />
      <section className="relative z-10 w-full max-w-md space-y-6 rounded-3xl border border-emerald-200/30 bg-[#0d221a]/90 p-8 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="space-y-2 text-center">
          <Image
            src="/ChatGPT%20Image%20Sep%2016,%202026,%2007_33_26%20PM.png"
            alt="ECO CHAMP S.A."
            width={260}
            height={117}
            className="mx-auto h-auto w-64"
            priority
          />
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
            <ShieldCheck size={14} /> Connexion sécurisée
          </div>
          <p className="mt-1 text-sm font-bold text-emerald-300">{config.title}</p>
          <p className="mt-2 text-xs text-slate-400">{config.subtitle}</p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 text-xs text-rose-200">
            {errorMessage}
          </div>
        )}

        {successMessage && <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">{successMessage}</div>}

        {isRegistering && role === 'caissiere' ? (
          <form onSubmit={handleRegistration} className="space-y-4">
            <label className="block text-xs font-bold text-slate-300">Nom complet
              <span className="relative mt-1 block"><User className="absolute left-3 top-2.5 text-slate-500" size={18} /><input type="text" required value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></span>
            </label>
            <label className="block text-xs font-bold text-slate-300">Adresse email
              <span className="relative mt-1 block"><Mail className="absolute left-3 top-2.5 text-slate-500" size={18} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></span>
            </label>
            <label className="block text-xs font-bold text-slate-300">Mot de passe<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
            <label className="block text-xs font-bold text-slate-300">Confirmer le mot de passe<input type="password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
            <label className="block text-xs font-bold text-slate-300">Code d’invitation<input type="password" required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Créer le compte caissière</button>
            <button type="button" onClick={() => { setIsRegistering(false); setErrorMessage(''); }} className="w-full text-xs font-bold text-slate-300 hover:text-white">J’ai déjà un compte</button>
          </form>
        ) : <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-xs font-bold text-slate-300">
            Adresse email
            <span className="relative mt-1 block">
              <Mail className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2.5 text-sm text-white outline-none focus:border-emerald-400 read-only:opacity-70"
              />
            </span>
          </label>

          <label className="block text-xs font-bold text-slate-300">
            Mot de passe
            <span className="relative mt-1 block">
              <Lock className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>}
        {role === 'caissiere' && !isRegistering && <button type="button" onClick={() => { setIsRegistering(true); setErrorMessage(''); setSuccessMessage(''); }} className="w-full text-xs font-bold text-emerald-300 hover:text-emerald-200">Créer un compte caissière</button>}
      </section>
    </main>
  );
}
