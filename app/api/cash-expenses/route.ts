import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

interface CashExpenseBody {
  responsible_name?: string;
  amount?: number | string | null;
  motive?: string;
  notes?: string | null;
  occurred_at?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const supabase = getSupabaseServer(request);

    let query = supabase
      .from('cash_expenses')
      .select('*')
      .order('occurred_at', { ascending: false });

    const limit = Number(limitParam ?? '0');
    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CashExpenseBody;
    const supabase = getSupabaseServer(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Connexion requise pour enregistrer une dépense.' }, { status: 401 });
    }

    const responsibleName = String(body.responsible_name ?? user.user_metadata?.full_name ?? user.email ?? 'Responsable').trim();
    const amount = Number(body.amount ?? 0);
    const motive = String(body.motive ?? '').trim();

    if (!responsibleName || !motive || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Veuillez renseigner le responsable, le motif et un montant valide.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cash_expenses')
      .insert([
        {
          user_id: user.id,
          responsible_name: responsibleName,
          amount,
          motive,
          notes: body.notes ?? null,
          occurred_at: body.occurred_at ?? new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
