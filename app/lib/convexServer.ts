import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

export type ConvexTable =
  | 'accounts' | 'expenses' | 'categories' | 'fixed_expenses'
  | 'printer_expenses' | 'printer_cartridges' | 'ingest_tokens'
  | 'pending_transactions' | 'skipped_messages';

function convex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('Convex is not configured');
  return new ConvexHttpClient(url);
}

function withoutUndefined(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

export async function listRows(table: ConvexTable, username: string) {
  return await convex().query(api.data.list, { table, username }) as Array<Record<string, any>>;
}

export async function findIngestToken(tokenHash: string) {
  return await convex().query(api.data.findIngestToken, { tokenHash }) as Record<string, any> | null;
}

export async function insertRow(table: ConvexTable, values: Record<string, unknown>) {
  return await convex().mutation(api.data.insert, { table, values: withoutUndefined(values) }) as Record<string, any> | null;
}

export async function updateRow(table: ConvexTable, id: string, username: string, values: Record<string, unknown>) {
  return await convex().mutation(api.data.update, { table, id, username, values: withoutUndefined(values) }) as Record<string, any> | null;
}

export async function removeRow(table: ConvexTable, id: string, username: string) {
  await convex().mutation(api.data.remove, { table, id, username });
}
