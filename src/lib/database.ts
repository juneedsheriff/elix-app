import { supabase } from './supabase';

/** Example: load rows from a Supabase table (enable RLS policies in the dashboard first). */
export async function fetchTable<T extends Record<string, unknown>>(
  table: string,
  options?: { columns?: string; limit?: number }
) {
  let query = supabase.from(table).select(options?.columns ?? '*');
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  return query.returns<T[]>();
}
