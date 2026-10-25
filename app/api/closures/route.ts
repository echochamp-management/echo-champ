import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const localDayBounds = (date: string, timezoneOffset: number) => {
  const sign = timezoneOffset <= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(timezoneOffset);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;
  const start = new Date(`${date}T00:00:00${offset}`);
  const end = new Date(`${date}T23:59:59.999${offset}`);
  return { start: start.toISOString(), end: end.toISOString() };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get('report') === 'true';
    const requestedDate = searchParams.get('date');
    const timezoneOffset = Number(searchParams.get('timezone_offset'));
    const supabase = getSupabaseServer(request);

    let query = supabase.from('daily_closures').select('*');

    if (report) {
      const now = new Date();
      const deviceDate = requestedDate || now.toISOString().slice(0, 10);
      const bounds = Number.isFinite(timezoneOffset) ? localDayBounds(deviceDate, timezoneOffset) : localDayBounds(deviceDate, 0);
      const start = bounds.start;
      const end = bounds.end;
      query = query.gte('closed_at', start).lte('closed_at', end);
    }

    const { data, error } = await query.order('closed_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseServer(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.user_metadata?.account_role === 'presidence' || user?.email?.toLowerCase() === 'presidence@gmail.com') {
      return NextResponse.json({ error: 'La création des clôtures est réservée à la caisse.' }, { status: 403 });
    }

    const now = new Date();
    const closureDate = typeof body.closure_date === 'string' ? body.closure_date : now.toISOString().slice(0, 10);
    const requestedOffset = Number(body.timezone_offset);
    const bounds = Number.isFinite(requestedOffset) ? localDayBounds(closureDate, requestedOffset) : localDayBounds(closureDate, 0);
    const expensesStart = bounds.start;
    const expensesEnd = bounds.end;
    const { timezone_offset: _timezoneOffset, ...closureBody } = body;
    const { data: expensesData, error: expensesError } = await supabase
      .from('cash_expenses')
      .select('amount')
      .gte('occurred_at', expensesStart)
      .lte('occurred_at', expensesEnd);

    if (expensesError) {
      return NextResponse.json({ error: expensesError.message }, { status: 500 });
    }

    const totalExpenses = (expensesData ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const netCash = Number(body.total_sales || 0) - totalExpenses;

    const { count, error: countError } = await supabase
      .from('daily_closures')
      .select('id', { count: 'exact', head: true })
      .eq('closure_date', closureDate);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= 4) {
      return NextResponse.json(
        { error: 'La limite de 4 rapports pour cette journée est atteinte.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('daily_closures')
      .insert([
        {
          ...closureBody,
          closure_date: closureDate,
          total_expenses: Number(body.total_expenses ?? totalExpenses),
          net_cash: Number(body.net_cash ?? netCash),
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
