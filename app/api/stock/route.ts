import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

interface ProductStockRow {
  id: string;
  name: string;
  stock_initial: number | null;
}

interface SaleRow {
  product_id: string;
  quantity: number | null;
}

const paidStatuses = ['payee_validee', 'validee', 'payée', 'paye', 'completed', 'paid', 'encaissée', 'encaissee'];

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock_initial')
      .order('name', { ascending: true });

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    const { data: sales, error: salesError } = await supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(status)')
      .in('orders.status', paidStatuses);

    const productRows = (products ?? []) as ProductStockRow[];
    const saleRows = (sales ?? []) as SaleRow[];
    const stockData = productRows.map((product: ProductStockRow) => {
      const sold = saleRows
        .filter((sale: SaleRow) => sale.product_id === product.id)
        .reduce((sum: number, sale: SaleRow) => sum + Number(sale.quantity || 0), 0);
      return {
        id: product.id,
        name: product.name,
        stock_initial: Number(product.stock_initial || 0),
        sold,
        remaining: Number(product.stock_initial || 0) - sold,
      };
    });

    if (salesError) {
      console.warn('Sales fetch warning:', salesError.message);
    }

    return NextResponse.json({ data: stockData });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
