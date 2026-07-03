import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cookie-backed client (via @supabase/ssr) so the session survives page
// navigation and is visible to the middleware that gates every route
// behind login. All existing pages already `import { supabase } from
// '@/lib/supabase'` — this swap is invisible to them.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch EVERY row matching a query, regardless of table size.
 *
 * Supabase/PostgREST caps any single request at a project-level max-rows
 * setting (1000 by default) — a client-side `.limit(N)` above that cap is
 * silently ignored and you still only get the first ~1000 rows back. The
 * only reliable way to get everything is to page through with `.range()`
 * until a page comes back shorter than the page size.
 *
 * CRITICAL: `.range()` pagination is only safe with a deterministic
 * `.order()`. Without one, Postgres does not guarantee the same row order
 * across two separate requests — so the SAME row can land in two
 * different pages (double-counted) while another row is skipped entirely.
 * This was a real, confirmed bug: an item with exactly one row in the
 * database was being fetched twice across a page boundary and its
 * quantity summed twice client-side. Every call orders by `orderBy`
 * (defaults to `id`, present on every table this is used against) so each
 * page is a strictly non-overlapping window — no duplicates, no gaps,
 * every time, regardless of how large the table grows.
 */
export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  build: (q: any) => any = (q) => q,
  orderBy: string = 'id'
): Promise<T[]> {
  const PAGE = 1000
  let from = 0
  let all: T[] = []
  while (true) {
    const { data, error } = await build(supabase.from(table).select(columns))
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data as T[])
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export type Sale = {
  id: number
  date: string
  voucher_no: string
  customer_name: string
  mobile_no: string
  category: string
  sub_category: string
  brand: string
  item_code: string
  product_name: string
  batch_no: string
  purchase_price: number
  landing_cost: number
  mrp: number
  selling_price: number
  qty: number
  net_amount: number
  profit: number
  sales_man: string
  total_bill_amount: number
  receipt_data: string
  discount: number
  other_discount: number
  tax_amount: number
  cgst: number
  sgst: number
}

export type Product = {
  id: number
  item_code: string
  product_name: string
  category: string
  brand: string
  mrp: number
  purchase_price: number
  online_price: number
  qty: number
  image_url: string
  product_type: string
  hsn_code: string
  sales_tax_rate: number
  created_on: string
}

export type Expense = {
  id: number
  date: string
  vendor_name: string
  expense_no: string
  description: string
  gross_total: number
  payment_method: string
  cgst: number
  sgst: number
  total_tax: number
  total_basic: number
}
