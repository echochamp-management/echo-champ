import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

interface RegistrationBody {
  email?: string;
  password?: string;
  fullName?: string;
  inviteCode?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegistrationBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password || '';
    const fullName = body.fullName?.trim() || '';
    const inviteCode = body.inviteCode || '';
    const expectedInviteCode = process.env.CAISSIERE_INVITE_CODE;

    if (!expectedInviteCode) {
      return NextResponse.json({ error: 'L’inscription caissière n’est pas configurée. Ajoutez CAISSIERE_INVITE_CODE dans les variables serveur.' }, { status: 503 });
    }

    if (inviteCode !== expectedInviteCode) {
      return NextResponse.json({ error: 'Code d’invitation caissière incorrect.' }, { status: 403 });
    }

    if (!email || !email.includes('@') || password.length < 6 || fullName.length < 2) {
      return NextResponse.json({ error: 'Nom, email et mot de passe valide requis.' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const firstName = fullName.split(/\s+/)[0] || fullName;
    const lastName = fullName.split(/\s+/).slice(1).join(' ');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        account_role: 'caissiere',
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        profile_configured: true,
        profile_name_configured: true,
        profile_email_configured: true,
        profile_password_configured: true,
      },
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Impossible de créer le compte caissière.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Compte caissière créé. Vous pouvez maintenant vous connecter.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur inattendue.' }, { status: 500 });
  }
}
