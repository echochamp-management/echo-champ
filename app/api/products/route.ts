import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const paidStatuses = ['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const availableOnly = searchParams.get('available') === 'true';
    const category = searchParams.get('category');

    const supabase = getSupabaseServer();
    let query = supabase.from('products').select('*');

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (availableOnly) {
      query = query.eq('is_available', true);
    }

    const { data, error } = await query
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: sales, error: salesError } = await supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(status)')
      .in('orders.status', paidStatuses);

    if (salesError) {
      return NextResponse.json({ error: salesError.message }, { status: 500 });
    }

    const soldByProduct = new Map<string, number>();
    (sales ?? []).forEach((sale) => {
      soldByProduct.set(sale.product_id, (soldByProduct.get(sale.product_id) || 0) + Number(sale.quantity || 0));
    });

    return NextResponse.json({
      data: (data ?? []).map((product) => ({
        ...product,
        stock_remaining: Math.max(Number(product.stock_initial || 0) - (soldByProduct.get(product.id) || 0), 0),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
