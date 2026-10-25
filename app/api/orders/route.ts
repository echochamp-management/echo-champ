import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const localDayBounds = (date: string, timezoneOffset: number) => {
  const sign = timezoneOffset <= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(timezoneOffset);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;
  return {
    start: new Date(`${date}T00:00:00${offset}`).toISOString(),
    end: new Date(`${date}T23:59:59.999${offset}`).toISOString(),
  };
};

interface OrderSummaryRecord {
  status?: string | null;
  total_amount?: number | string | null;
}

interface OrderItemInput {
  id: string;
  quantity?: number | string | null;
  price?: number | string | null;
}

interface CreateOrderBody {
  customer_name?: string;
  customer_firstname?: string;
  total_amount?: number | string | null;
  status?: string;
  order_type?: string;
  payment_method?: 'cash' | 'carte' | 'virement_bancaire' | 'credit';
  source?: 'catalogue' | 'interne';
  items?: OrderItemInput[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const mine = searchParams.get('mine') === 'true';
    const summary = searchParams.get('summary') === 'true';
    const report = searchParams.get('report') === 'true';
    const requestedDate = searchParams.get('date');
    const timezoneOffset = Number(searchParams.get('timezone_offset'));
    const period = searchParams.get('period');

    const todayOnly = (report || summary) && period !== 'all';

    const supabase = getSupabaseServer(request);
    let query = supabase
      .from('orders')
      .select(
        `
          id,
          customer_name,
          customer_firstname,
          total_amount,
          status,
          order_type,
          source,
          customer_message,
          estimated_ready_minutes,
          confirmed_at,
          created_at,
          order_items (
            id,
            quantity,
            unit_price,
            products ( name )
          )
        `
      );

    if (status) {
      query = query.eq('status', status);
    }

    if (source === 'catalogue' || source === 'interne') {
      query = query.eq('source', source);
    }

    if (mine) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
      }
      query = query.eq('user_id', user.id);
    }

    if (todayOnly) {
      const now = new Date();
      const date = requestedDate || now.toISOString().slice(0, 10);
      const bounds = Number.isFinite(timezoneOffset) ? localDayBounds(date, timezoneOffset) : localDayBounds(date, 0);
      const start = bounds.start;
      const end = bounds.end;
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (summary) {
      const orders = data ?? [];
      const paid = orders.filter((order: OrderSummaryRecord) =>
        ['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee'].includes(
          String(order.status || '').toLowerCase()
        )
      );
      const totalRevenue = paid.reduce(
        (sum: number, order: OrderSummaryRecord) => sum + Number(order.total_amount || 0),
        0
      );
      const totalOrders = paid.length;
      const averageBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      return NextResponse.json({
        totalRevenue,
        totalOrders,
        averageBasket,
        orders,
      });
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
    const body = (await request.json()) as CreateOrderBody;
    const supabase = getSupabaseServer(request);

    const { customer_name, customer_firstname, total_amount, status, order_type, payment_method, source, items = [] } = body;
    const allowedPaymentMethods = ['cash', 'carte', 'virement_bancaire', 'credit'] as const;
    const finalPaymentMethod = payment_method || 'cash';

    if (!allowedPaymentMethods.includes(finalPaymentMethod as (typeof allowedPaymentMethods)[number])) {
      return NextResponse.json({ error: 'Mode de paiement invalide.' }, { status: 400 });
    }

    if (source === 'catalogue' && finalPaymentMethod === 'credit') {
      return NextResponse.json({ error: 'Le crédit est réservé aux commandes de la caisse.' }, { status: 400 });
    }

    if (!customer_name || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing customer name or order items' }, { status: 400 });
    }

    if (source === 'catalogue') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({ error: 'Connexion requise pour commander depuis le catalogue.' }, { status: 401 });
      }
      if (user.user_metadata?.profile_configured !== true) {
        return NextResponse.json({ error: 'Configurez votre compte avant de passer une commande.' }, { status: 403 });
      }
    }

    const { data: { user: authenticatedUser } } = await supabase.auth.getUser();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: String(customer_name).trim(),
          user_id: source === 'catalogue' ? authenticatedUser?.id : null,
          customer_firstname: customer_firstname ? String(customer_firstname).trim() : null,
          total_amount: Number(total_amount || 0),
          status: status || 'en_attente_paiement',
          order_type: order_type || 'sur_place',
          payment_method: finalPaymentMethod,
          source: source || 'interne',
        },
      ])
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Unable to create order' }, { status: 500 });
    }

    const payload = items.map((item: OrderItemInput) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.price || 0),
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(payload);

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (finalPaymentMethod === 'credit') {
      const debtPayload = {
        order_id: order.id,
        customer_name: String(customer_name).trim(),
        customer_firstname: customer_firstname ? String(customer_firstname).trim() : null,
        amount: Number(total_amount || 0),
        remaining_amount: Number(total_amount || 0),
        status: 'ouvert',
        payment_method: 'credit',
      };

      const { error: debtError } = await supabase.from('customer_debts').insert([debtPayload]);
      if (debtError) {
        await supabase.from('order_items').delete().eq('order_id', order.id);
        await supabase.from('orders').delete().eq('id', order.id);
        return NextResponse.json({ error: debtError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ data: order, message: 'Order created successfully' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
