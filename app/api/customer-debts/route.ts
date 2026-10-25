import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const isMissingCustomerDebtsTableError = (message?: string) => {
  if (!message) return false;
  return /relation .*customer_debts.* does not exist|could not find the table .*customer_debts/i.test(message);
};

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServer(request);
    const { data, error } = await supabase
      .from('customer_debts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingCustomerDebtsTableError(error.message)) {
        console.warn('customer_debts table is missing in Supabase. Apply the migration before using debts.');
        return NextResponse.json({ data: [] }, { status: 200 });
      }

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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseServer(request);
    const { id, status, amount_paid } = body;

    if (!id) {
      return NextResponse.json({ error: 'Identifiant de dette requis.' }, { status: 400 });
    }

    const { data: currentDebt, error: debtError } = await supabase
      .from('customer_debts')
      .select('*')
      .eq('id', id)
      .single();

    if (debtError || !currentDebt) {
      if (isMissingCustomerDebtsTableError(debtError?.message)) {
        return NextResponse.json(
          { error: 'La table customer_debts n’est pas encore créée dans Supabase. Appliquez la migration.' },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: debtError?.message || 'Dette introuvable.' }, { status: 404 });
    }

    const nextRemaining = Number(currentDebt.remaining_amount || 0) - Number(amount_paid || 0);
    const normalizedStatus = status || (nextRemaining <= 0 ? 'regle' : 'partiellement_regle');

    const { data, error } = await supabase
      .from('customer_debts')
      .update({
        remaining_amount: Math.max(nextRemaining, 0),
        status: normalizedStatus,
        paid_at: normalizedStatus === 'regle' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isMissingCustomerDebtsTableError(error.message)) {
        return NextResponse.json(
          { error: 'La table customer_debts n’est pas encore créée dans Supabase. Appliquez la migration.' },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
