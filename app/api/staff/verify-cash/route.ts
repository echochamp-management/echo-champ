import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providedPassword = String(body?.password ?? '').trim();

    const supabase = getSupabaseServer(request);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }

    const role = user.user_metadata?.account_role;
    if (role !== 'caissiere') {
      return NextResponse.json({ error: 'Accès refusé : cette page est réservée à la caisse.' }, { status: 403 });
    }

    const expectedPassword =
      process.env.CAISSIERE_ACCESS_PASSWORD ||
      process.env.CASHIER_PASSWORD ||
      'caissiere';

    if (!providedPassword || providedPassword !== expectedPassword) {
      return NextResponse.json({ error: 'Mot de passe caisse incorrect.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inattendue.' },
      { status: 500 }
    );
  }
}
