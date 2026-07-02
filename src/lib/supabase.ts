import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch EVERY row matching a query, regardless of table size.
 *
 * Supabase/PostgREST caps any single request at a project-level max-rows
 * setting (1000 by default) — a client-side `.limit(N)` above that cap is
 * silently ignored and you still only get the first ~1000 rows back. The
 * only reliable way to get everything is to page through with `.range()`
 * until a page comes back shorter than the page size.
 *
 * This means this function is safe to use forever, even as tables grow
 * well past 1000, 10,000, or 100,000 rows — no hardcoded cap to outgrow.
 */
export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  build: (q: any) => any = (q) => q
): Promise<T[]> {
  const PAGE = 1000
  let from = 0
  let all: T[] = []
  while (true) {
    const { data, error } = await build(supabase.from(table).select(columns)).range(from, from + PAGE - 1)
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
