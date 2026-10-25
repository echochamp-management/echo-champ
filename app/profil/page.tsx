'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, KeyRound, Loader2, LockKeyhole, Mail, User } from 'lucide-react';

async function hashPin(pin: string) {
  const encodedPin = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', encodedPin);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function ProfilPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinConfigured, setPinConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [returnPath, setReturnPath] = useState('/dashboard');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      setEmail(user.email ?? '');
      setFullName(user.user_metadata?.full_name ?? '');
      setPinConfigured(Boolean(user.user_metadata?.pin_hash));
      const requestedReturnPath = new URLSearchParams(window.location.search).get('returnTo');
      const defaultReturnPath = user.user_metadata?.account_role === 'presidence'
        || user.email?.toLowerCase() === 'presidence@gmail.com'
        ? '/presidence'
        : '/dashboard';
      setReturnPath(requestedReturnPath === '/catalogue' ? '/catalogue' : defaultReturnPath);
      setLoading(false);
    };

    void loadProfile();
  }, [router]);

  const clearFeedback = () => {
    setMessage('');
    setErrorMessage('');
  };

  const updateName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir votre nom complet.');
      return;
    }

    setSavingName(true);
    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts.shift() ?? '';
    const lastName = nameParts.join(' ');
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: trimmedName,
        first_name: firstName,
        last_name: lastName,
        profile_name_configured: true,
      },
    });
    setSavingName(false);

    if (error) {
      setErrorMessage('Impossible de mettre à jour le nom.');
      return;
    }

    setMessage('Nom mis à jour.');
  };

  const updateEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage('Veuillez saisir une adresse email.');
      return;
    }

    setSavingEmail(true);
    const { data: { user } } = await supabase.auth.getUser();
    const accountRole = user?.user_metadata?.account_role
      ?? (user?.email?.toLowerCase() === 'presidence@gmail.com' ? 'presidence' : 'caissiere');
    const { error } = await supabase.auth.updateUser({
      email: trimmedEmail,
      data: { account_role: accountRole, profile_email_configured: true },
    });
    setSavingEmail(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage('Un email de confirmation a été envoyé à la nouvelle adresse.');
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    if (newPassword.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.profile_name_configured === true && user.user_metadata.profile_email_configured === true) {
      await supabase.auth.updateUser({
        data: { profile_configured: true, profile_password_configured: true },
      });
    }
    setMessage('Mot de passe mis à jour.');
  };

  const updatePin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    if (!/^\d{4,6}$/.test(pin)) {
      setErrorMessage('Le code PIN doit contenir entre 4 et 6 chiffres.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage('Les deux codes PIN ne correspondent pas.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.auth.updateUser({ data: { pin_hash: await hashPin(pin) } });
    if (error) {
      setErrorMessage('Impossible de sauvegarder le code PIN.');
      return;
    }
    setPin('');
    setConfirmPin('');
    setPinConfigured(true);
    setMessage('Code PIN configuré dans votre compte.');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-emerald-300"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <button
            type="button"
            onClick={() => router.push(returnPath)}
            className="mb-5 flex items-center gap-2 text-sm font-bold text-emerald-300 transition hover:text-emerald-200"
          >
            <ArrowLeft size={18} /> Retour
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Compte sécurisé</p>
          <h1 className="mt-2 text-3xl font-black">Mon profil</h1>
          <p className="mt-1 text-sm text-slate-400">Modifiez vos informations de connexion et votre nom.</p>
        </header>

        {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-3 text-sm text-emerald-200"><CheckCircle size={18} />{message}</div>}
        {errorMessage && <div className="rounded-xl border border-rose-400/30 bg-rose-950/50 p-3 text-sm text-rose-200">{errorMessage}</div>}

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={updateName} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><User size={20} className="text-emerald-300" />Nom</h2>
            <label className="block text-xs font-bold text-slate-300">Nom complet
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400" />
            </label>
            <button type="submit" disabled={savingName} className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{savingName ? 'Enregistrement...' : 'Enregistrer le nom'}</button>
          </form>

          <form onSubmit={updateEmail} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Mail size={20} className="text-emerald-300" />Adresse email</h2>
            <label className="block text-xs font-bold text-slate-300">Nouvelle adresse email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400" />
            </label>
            <p className="text-xs text-slate-400">Une confirmation sera demandée par email.</p>
            <button type="submit" disabled={savingEmail} className="w-full rounded-xl border border-emerald-400/50 py-3 text-sm font-black text-emerald-300 disabled:opacity-50">{savingEmail ? 'Envoi...' : 'Modifier l’email'}</button>
          </form>

          <form onSubmit={updatePassword} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><LockKeyhole size={20} className="text-emerald-300" />Mot de passe</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold text-slate-300">Nouveau mot de passe
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400" />
              </label>
              <label className="block text-xs font-bold text-slate-300">Confirmer le mot de passe
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400" />
              </label>
            </div>
            <button type="submit" disabled={savingPassword} className="w-full rounded-xl border border-emerald-400/50 py-3 text-sm font-black text-emerald-300 disabled:opacity-50">{savingPassword ? 'Enregistrement...' : 'Modifier le mot de passe'}</button>
          </form>

          <form onSubmit={updatePin} className="space-y-4 rounded-2xl border border-amber-400/30 bg-slate-900 p-6 md:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound size={20} className="text-amber-300" />Code PIN rapide</h2>
            <p className="text-xs text-slate-400">{pinConfigured ? 'Un PIN est déjà configuré sur cet appareil. Vous pouvez le remplacer.' : 'Définissez un PIN de 4 à 6 chiffres pour accéder rapidement à votre session sur cet appareil.'}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="Nouveau PIN" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
              <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))} placeholder="Confirmer le PIN" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
            </div>
            <button type="submit" className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-slate-950">Enregistrer le PIN</button>
          </form>
        </div>
      </div>
    </main>
  );
}
