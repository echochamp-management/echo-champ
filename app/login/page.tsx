'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getCanonicalRole, isPresidenceUser } from '@/lib/account-role';
import { KeyRound, Lock, Mail, Loader2, LogIn, User, UserPlus } from 'lucide-react';

const PIN_LOGIN_TTL_MS = 48 * 60 * 60 * 1000;
const PIN_LOGIN_STORAGE_KEY = 'echochamp_pin_login_session';

async function hashPin(pin: string) {
  const encodedPin = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', encodedPin);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getStoredPinSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PIN_LOGIN_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { userId?: string; expiresAt?: number };
    if (!parsed.userId || !parsed.expiresAt) {
      window.localStorage.removeItem(PIN_LOGIN_STORAGE_KEY);
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(PIN_LOGIN_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(PIN_LOGIN_STORAGE_KEY);
    return null;
  }
}

function storePinSession(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    PIN_LOGIN_STORAGE_KEY,
    JSON.stringify({ userId, expiresAt: Date.now() + PIN_LOGIN_TTL_MS })
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [quickPin, setQuickPin] = useState('');
  const [quickPinAvailable, setQuickPinAvailable] = useState(false);
  const [showFullLogin, setShowFullLogin] = useState(true);
  const [quickPinLoading, setQuickPinLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const router = useRouter();

  const recordSuccessfulLogin = async (userId: string, user: { user_metadata?: Record<string, unknown> } | undefined, source: 'password' | 'pin') => {
    const now = new Date().toISOString();
    const currentLoginCount = Number(user?.user_metadata?.login_count ?? 0);

    await supabase.auth.updateUser({
      data: {
        last_login_at: now,
        last_login_source: source,
        login_count: currentLoginCount + 1,
      },
    });

    storePinSession(userId);
  };

  useEffect(() => {
    const loadQuickPin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const storedPinSession = getStoredPinSession();

      const sessionPinAvailable = Boolean(session?.user?.user_metadata?.pin_hash);
      const validStoredSession = Boolean(
        storedPinSession && session?.user?.id && storedPinSession.userId === session.user.id
      );

      if (sessionPinAvailable && (validStoredSession || storedPinSession === null)) {
        setQuickPinAvailable(true);
        setShowFullLogin(false);
        return;
      }

      setQuickPinAvailable(Boolean(sessionPinAvailable));
      setShowFullLogin(!sessionPinAvailable);
    };
    void loadQuickPin();
  }, []);

  const handleQuickPinLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setQuickPinLoading(true);
    setErrorMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    const storedHash = session?.user?.user_metadata?.pin_hash;
    if (!session || !storedHash || (await hashPin(quickPin)) !== storedHash) {
      setErrorMsg('Code PIN incorrect. Utilisez vos identifiants complets.');
      setQuickPinLoading(false);
      return;
    }

    await recordSuccessfulLogin(session.user.id, session.user, 'pin');

    const pinRole = isPresidenceUser(session.user) ? 'presidence' : (session.user.user_metadata?.account_role || 'client');
    if (session.user.user_metadata?.account_role !== pinRole) {
      await supabase.auth.updateUser({ data: { account_role: pinRole } });
    }

    const nextPath = new URLSearchParams(window.location.search).get('next');
    if (nextPath === '/catalogue') {
      router.push('/catalogue');
    } else if (pinRole === 'presidence') {
      router.push('/presidence');
    } else if (pinRole === 'client') {
      router.push('/catalogue');
    } else {
      router.push('/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      setLoading(false);
      return;
    }

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    if (fullName.trim()) {
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), first_name: firstName, last_name: lastName },
      });
    }

    await recordSuccessfulLogin(data.user.id, data.user, 'password');

    const nextPath = new URLSearchParams(window.location.search).get('next');
    if (nextPath === '/catalogue') {
      router.push('/catalogue');
      return;
    }

    const userRole = getCanonicalRole(data.user);

    if (userRole && data.user.user_metadata?.account_role !== userRole) {
      await supabase.auth.updateUser({ data: { account_role: userRole } });
    }

    if (userRole === 'presidence') {
      router.push('/presidence');
    } else if (userRole === 'client') {
      router.push('/catalogue');
    } else {
      router.push('/dashboard');
    }
  };

  const handleRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setRegistrationMessage('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setErrorMsg('Veuillez saisir votre nom complet.');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      setLoading(false);
      return;
    }
    if (trimmedEmail === 'presidence@gmail.com') {
      setErrorMsg('Cette adresse est réservée à l’espace Présidence.');
      setLoading(false);
      return;
    }

    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          account_role: 'client',
          full_name: trimmedName,
          first_name: firstName,
          last_name: lastName,
          profile_configured: true,
          profile_name_configured: true,
          profile_email_configured: true,
          profile_password_configured: true,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message.includes('already registered') ? 'Cette adresse email possède déjà un compte.' : error.message);
      setLoading(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    if (data.session) {
      router.replace('/catalogue');
      router.refresh();
      return;
    }

    setRegistrationMessage('Compte créé. Consultez votre email pour confirmer votre adresse avant de vous connecter.');
    setIsRegistering(false);
    setLoading(false);
  };

  return (
    <div className="login-scene relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061a13] p-4">
      <div className="login-scene-image pointer-events-none absolute inset-[-4%]" />
      <div className="login-wind login-wind-one pointer-events-none absolute inset-0" />
      <div className="login-wind login-wind-two pointer-events-none absolute inset-0" />
      <div className="login-scene-shade pointer-events-none absolute inset-0" />
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-3xl border border-emerald-200/30 bg-[#0d221a]/90 p-8 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="text-center space-y-2">
          <Image src="/ChatGPT%20Image%20Sep%2016,%202026,%2007_33_26%20PM.png" alt="ECO CHAMP S.A." width={260} height={117} className="mx-auto h-auto w-64" priority />
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
            <Lock size={14} /> Connexion sécurisée
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl font-medium">
            {errorMsg}
          </div>
        )}

        {quickPinAvailable && (
          <div className="space-y-3">
            {!showFullLogin && (
              <form onSubmit={handleQuickPinLogin} className="space-y-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-amber-200"><KeyRound size={18} className="text-amber-300" />Accès rapide</p>
                <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={quickPin} onChange={(event) => setQuickPin(event.target.value.replace(/\D/g, ''))} placeholder="Votre code PIN" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-amber-500" />
                <button type="submit" disabled={quickPinLoading} className="w-full rounded-xl border border-amber-400 py-2 text-xs font-black text-amber-300 disabled:opacity-50">{quickPinLoading ? 'Vérification...' : 'Se connecter avec le PIN'}</button>
              </form>
            )}

            {showFullLogin && (
              <button
                type="button"
                onClick={() => setShowFullLogin(false)}
                className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200"
              >
                Utiliser le PIN de 48h à la place du login complet
              </button>
            )}
          </div>
        )}

        {registrationMessage && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-3 text-xs font-medium text-emerald-200">
            {registrationMessage}
          </div>
        )}

        {isRegistering ? (
          <form onSubmit={handleRegistration} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nom et prénom :</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Jean Dupont" className="w-full border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email :</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.com" className="w-full border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-300">Mot de passe
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" className="mt-1 w-full border border-slate-700 bg-slate-950 px-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500" />
            </label>
            <label className="block text-xs font-bold text-slate-300">Confirmer le mot de passe
              <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500" />
            </label>
            <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Créer mon compte client
            </button>
            <button type="button" onClick={() => { setIsRegistering(false); setErrorMsg(''); }} className="w-full text-xs font-bold text-slate-300 hover:text-white">J’ai déjà un compte</button>
          </form>
        ) : (!quickPinAvailable || showFullLogin) ? (
          <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nom et prénom :</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="w-full border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email :</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@ecochamp.com"
                className="w-full border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Mot de Passe :</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <> <LogIn size={18} /> Se Connecter</>}
          </button>
          </form>
        ) : null}

        {!isRegistering && (
          <button type="button" onClick={() => { setIsRegistering(true); setErrorMsg(''); setRegistrationMessage(''); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-3 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/10">
            <UserPlus size={16} /> Créer un compte client
          </button>
        )}

      </div>
    </div>
  );
}