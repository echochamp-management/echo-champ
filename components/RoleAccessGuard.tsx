'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCanonicalRole } from '@/lib/account-role';

const publicPrefixes = ['/login', '/catalogue', '/profil', '/conditions', '/confidentialite'];
const presidencePrefixes = ['/presidence', '/historique'];

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function RoleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (hasPrefix(pathname, publicPrefixes)) {
      return;
    }

    let cancelled = false;
    const verifyAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        router.replace('/login');
        return;
      }

      const canonicalRole = getCanonicalRole(user);
      const isPresidence = canonicalRole === 'presidence';
      if (canonicalRole && user.user_metadata?.account_role !== canonicalRole) {
        await supabase.auth.updateUser({ data: { account_role: canonicalRole } });
      }
      const isPresidenceRoute = hasPrefix(pathname, presidencePrefixes);
      const isPresidenceAllowed = pathname === '/presidence' || pathname.startsWith('/presidence/') || pathname === '/historique';

      if (isPresidence && !isPresidenceAllowed) {
        router.replace('/presidence');
        return;
      }

      if (canonicalRole === 'client') {
        router.replace('/catalogue');
        return;
      }

      if (!isPresidence && isPresidenceRoute && pathname !== '/historique') {
        router.replace('/dashboard');
        return;
      }

      setChecked(true);
    };

    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!checked && !hasPrefix(pathname, publicPrefixes)) return null;
  return children;
}
