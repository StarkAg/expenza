import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const sourceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!sourceUrl || !sourceKey || !convexUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_CONVEX_URL are required.');
}

const convex = new ConvexHttpClient(convexUrl);
const tables = [
  'accounts', 'expenses', 'categories', 'fixed_expenses', 'printer_expenses',
  'printer_cartridges', 'ingest_tokens', 'pending_transactions', 'skipped_messages',
];

async function readSource(table) {
  const response = await fetch(`${sourceUrl}/rest/v1/${table}?select=*`, {
    headers: { apikey: sourceKey, Authorization: `Bearer ${sourceKey}` },
  });
  if (!response.ok) throw new Error(`Could not read ${table}: ${response.status}`);
  return await response.json();
}

function fields(row, keys) {
  const result = {};
  for (const key of keys) if (row[key] !== null && row[key] !== undefined) result[key] = row[key];
  return result;
}

async function insert(table, values) {
  return await convex.mutation(api.data.insert, { table, values });
}

const source = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await readSource(table)])));
const accounts = new Map();
const expenses = new Map();

for (const row of source.accounts) {
  const created = await insert('accounts', fields(row, ['username', 'name', 'type', 'balance', 'last4']));
  accounts.set(row.id, created.id);
}
for (const row of source.categories) {
  await insert('categories', fields(row, ['username', 'name', 'color', 'display_order']));
}
for (const row of source.expenses) {
  const created = await insert('expenses', {
    ...fields(row, ['username', 'amount', 'category', 'note', 'date', 'source', 'sms_ref']),
    ...(row.account_id && accounts.get(row.account_id) ? { account_id: accounts.get(row.account_id) } : {}),
  });
  expenses.set(row.id, created.id);
}
for (const row of source.fixed_expenses) {
  await insert('fixed_expenses', {
    ...fields(row, ['username', 'name', 'amount', 'category', 'day_of_month', 'is_active', 'note']),
    ...(row.account_id && accounts.get(row.account_id) ? { account_id: accounts.get(row.account_id) } : {}),
  });
}
for (const row of source.printer_expenses) {
  await insert('printer_expenses', {
    ...fields(row, ['username', 'date', 'pages', 'type', 'cost']),
    ...(row.expense_id && expenses.get(row.expense_id) ? { expense_id: expenses.get(row.expense_id) } : {}),
  });
}
for (const row of source.printer_cartridges) {
  await insert('printer_cartridges', fields(row, ['username', 'date', 'type', 'cost']));
}
for (const row of source.ingest_tokens) {
  await insert('ingest_tokens', fields(row, ['username', 'label', 'platform', 'token_hash', 'token_hint', 'last_used_at', 'revoked_at']));
}
for (const row of source.pending_transactions) {
  await insert('pending_transactions', {
    ...fields(row, ['username', 'amount', 'direction', 'merchant', 'account_last4', 'occurred_on', 'suggested_category', 'confidence', 'source', 'sender', 'sms_ref', 'raw_text', 'parser_rule', 'status', 'resolved_at']),
    ...(row.matched_account_id && accounts.get(row.matched_account_id) ? { matched_account_id: accounts.get(row.matched_account_id) } : {}),
    ...(row.expense_id && expenses.get(row.expense_id) ? { expense_id: expenses.get(row.expense_id) } : {}),
  });
}
for (const row of source.skipped_messages) {
  await insert('skipped_messages', fields(row, ['username', 'sender', 'sms_ref', 'raw_text', 'reason', 'source']));
}

console.log(JSON.stringify(Object.fromEntries(tables.map((table) => [table, source[table].length]))));
