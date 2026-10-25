import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

interface OrderUpdateBody {
  status?: 'en_attente_paiement' | 'payee_validee' | 'annulee';
  customer_message?: string;
  estimated_ready_minutes?: number;
  payment_method?: 'cash' | 'carte' | 'virement_bancaire' | 'credit';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServer(request);
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as OrderUpdateBody;
    const supabase = getSupabaseServer(request);

    if (body.status && !['en_attente_paiement', 'payee_validee', 'annulee'].includes(body.status)) {
      return NextResponse.json({ error: 'Statut de commande invalide' }, { status: 400 });
    }

    if (body.estimated_ready_minutes !== undefined &&
      (!Number.isInteger(body.estimated_ready_minutes) || body.estimated_ready_minutes < 1 || body.estimated_ready_minutes > 240)) {
      return NextResponse.json({ error: 'Le délai doit être compris entre 1 et 240 minutes' }, { status: 400 });
    }

    if (body.payment_method && !['cash', 'carte', 'virement_bancaire', 'credit'].includes(body.payment_method)) {
      return NextResponse.json({ error: 'Mode de paiement invalide' }, { status: 400 });
    }

    const update = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.customer_message !== undefined ? { customer_message: body.customer_message.trim() } : {}),
      ...(body.estimated_ready_minutes !== undefined ? { estimated_ready_minutes: body.estimated_ready_minutes } : {}),
      ...(body.payment_method ? { payment_method: body.payment_method } : {}),
      ...(body.customer_message !== undefined || body.estimated_ready_minutes !== undefined
        ? { confirmed_at: new Date().toISOString() }
        : {}),
    };

    const { data, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
