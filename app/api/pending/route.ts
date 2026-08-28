import { NextRequest, NextResponse } from 'next/server';
import { insertRow, listRows, removeRow, updateRow } from '../../lib/convexServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');
  const status = request.nextUrl.searchParams.get('status') || 'pending';
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!['pending', 'confirmed', 'dismissed', 'all'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  try {
    const all = await listRows('pending_transactions', username);
    const transactions = all
      .filter((row) => status === 'all' || row.status === status)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 100);
    return NextResponse.json({ transactions, pendingCount: all.filter((row) => row.status === 'pending').length });
  } catch (error) {
    console.error('[pending] list failed:', error);
    return NextResponse.json({ error: 'Could not load transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const username = typeof body.username === 'string' ? body.username : '';
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action;
  if (!username || !id) return NextResponse.json({ error: 'username and id are required' }, { status: 400 });
  if (action !== 'confirm' && action !== 'dismiss' && action !== 'undo') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  try {
    const row = (await listRows('pending_transactions', username)).find((item) => item.id === id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (action === 'dismiss') {
      if (row.status === 'confirmed') return NextResponse.json({ error: 'Already confirmed. Undo it first.' }, { status: 409 });
      await updateRow('pending_transactions', id, username, { status: 'dismissed', resolved_at: new Date().toISOString() });
      return NextResponse.json({ status: 'dismissed' });
    }
    if (action === 'undo') {
      if (row.status !== 'confirmed' || !row.expense_id) return NextResponse.json({ error: 'Nothing to undo' }, { status: 409 });
      await removeRow('expenses', row.expense_id, username);
      await adjustBalance(username, row.matched_account_id, row.direction === 'debit' ? Number(row.amount) : -Number(row.amount));
      await updateRow('pending_transactions', id, username, { status: 'pending' });
      return NextResponse.json({ status: 'pending' });
    }
    if (row.status === 'confirmed') return NextResponse.json({ error: 'Already confirmed' }, { status: 409 });
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : row.suggested_category;
    if (!category) return NextResponse.json({ error: 'A category is required' }, { status: 400 });
    const accountId = body.accountId === null ? undefined : (typeof body.accountId === 'string' ? body.accountId : row.matched_account_id);
    const amount = Number(row.amount);
    const expense = await insertRow('expenses', {
      username, amount, category,
      note: row.direction === 'credit' ? `Refund: ${row.merchant || 'SMS credit'}` : row.merchant || 'SMS transaction',
      date: row.occurred_on, account_id: accountId, source: 'sms_confirmed', sms_ref: row.sms_ref,
    });
    if (!expense) throw new Error('Expense creation failed');
    await adjustBalance(username, accountId, row.direction === 'debit' ? -amount : amount);
    await updateRow('pending_transactions', id, username, { status: 'confirmed', expense_id: expense.id, resolved_at: new Date().toISOString(), matched_account_id: accountId });
    return NextResponse.json({ status: 'confirmed', expenseId: expense.id });
  } catch (error) {
    console.error('[pending] mutation failed:', error);
    return NextResponse.json({ error: 'Could not update transaction' }, { status: 500 });
  }
}

async function adjustBalance(username: string, accountId: string | undefined, delta: number) {
  if (!accountId || !delta) return;
  const account = (await listRows('accounts', username)).find((item) => item.id === accountId);
  if (!account || account.type !== 'bank') return;
  await updateRow('accounts', accountId, username, { balance: Number(account.balance || 0) + delta });
}
