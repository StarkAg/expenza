import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { findIngestToken, insertRow, listRows, updateRow } from '../../lib/convexServer';
import { parseTransactionSms, inferCategory, shouldAutoAdd, type ParsedTransaction } from '../../utils/smsParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IngestBody { token?: string; sender?: string | null; text?: string; message?: string; parsed?: Partial<ParsedTransaction> }
const hashToken = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

function validateParsed(value: Partial<ParsedTransaction>): ParsedTransaction | null {
  const amount = Number(value.amount);
  const confidence = Number(value.confidence);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
  if (value.direction !== 'debit' && value.direction !== 'credit') return null;
  if (typeof value.smsRef !== 'string' || !value.smsRef || value.smsRef.length > 200) return null;
  if (typeof value.occurredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.occurredOn)) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  return {
    amount: Math.round(amount * 100) / 100, direction: value.direction,
    merchant: typeof value.merchant === 'string' ? value.merchant.slice(0, 120) : null,
    accountLast4: typeof value.accountLast4 === 'string' ? value.accountLast4.slice(0, 8) : null,
    occurredOn: value.occurredOn, confidence,
    rule: typeof value.rule === 'string' ? value.rule.slice(0, 40) : 'device',
    smsRef: value.smsRef, bank: typeof value.bank === 'string' ? value.bank.slice(0, 40) : null,
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const contentType = request.headers.get('content-type') || '';
  let body: IngestBody = {};
  if (rawBody.trim()) {
    if (contentType.includes('application/json') || rawBody.trimStart().startsWith('{')) {
      try { body = JSON.parse(rawBody); } catch { body = { text: rawBody }; }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);
      body = { token: params.get('token') || undefined, text: params.get('text') || params.get('message') || rawBody, sender: params.get('sender') };
    } else body = { text: rawBody };
  }
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  body.text ||= body.message;
  const rawToken = (body.token || request.nextUrl.searchParams.get('token') || bearer || '').trim();
  if (!rawToken) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  body.sender ||= request.nextUrl.searchParams.get('sender');
  body.text ||= request.nextUrl.searchParams.get('text') || undefined;

  try {
    const tokenRow = await findIngestToken(hashToken(rawToken));
    if (!tokenRow || tokenRow.revoked_at) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const username = String(tokenRow.username);
    const source = tokenRow.platform === 'android' ? 'android_sms' : tokenRow.platform === 'ios' ? 'ios_shortcut' : 'manual_test';
    await updateRow('ingest_tokens', tokenRow.id, username, { last_used_at: new Date().toISOString() });

    let transaction: ParsedTransaction | null = null;
    if (body.parsed) transaction = validateParsed(body.parsed);
    else if (typeof body.text === 'string') {
      const parsed = parseTransactionSms(body.text, body.sender);
      if (!parsed.ok || !parsed.transaction) {
        await insertRow('skipped_messages', { username, raw_text: body.text.slice(0, 2000), sender: body.sender?.slice(0, 40), reason: parsed.reason, source });
        return NextResponse.json({ status: 'ignored', reason: parsed.reason });
      }
      transaction = parsed.transaction;
      await insertRow('skipped_messages', { username, raw_text: body.text.slice(0, 2000), sender: body.sender?.slice(0, 40), reason: 'parsed', source });
    }
    if (!transaction) return NextResponse.json({ error: 'Malformed transaction payload' }, { status: 400 });

    const [expenses, pending, accounts, categories] = await Promise.all([
      listRows('expenses', username), listRows('pending_transactions', username), listRows('accounts', username), listRows('categories', username),
    ]);
    if (expenses.some((row) => row.sms_ref === transaction!.smsRef) || pending.some((row) => row.sms_ref === transaction!.smsRef)) {
      return NextResponse.json({ status: 'duplicate', smsRef: transaction.smsRef });
    }
    let account: Record<string, any> | null | undefined = transaction.accountLast4
      ? accounts.filter((row) => row.last4 === transaction!.accountLast4 || String(row.name).includes(transaction!.accountLast4!))[0]
      : undefined;
    if (!account && transaction.accountLast4) {
      account = await insertRow('accounts', {
        username, name: transaction.bank ? `${transaction.bank} ····${transaction.accountLast4}` : `Account ····${transaction.accountLast4}`,
        type: 'bank', balance: 0, last4: transaction.accountLast4,
      });
    }
    const inferred = inferCategory(transaction.merchant);
    const categoryNames = categories.map((category) => String(category.name));
    const suggestedCategory = inferred && categoryNames.length > 0 && !categoryNames.includes(inferred)
      ? (categoryNames.includes('Other') ? 'Other' : categoryNames[0]) : inferred;
    const autoAdd = shouldAutoAdd(transaction, account?.id || null) && !!suggestedCategory;
    let expenseId: string | undefined;
    if (autoAdd) {
      const expense = await insertRow('expenses', {
        username, amount: transaction.amount, category: suggestedCategory, note: transaction.merchant || undefined,
        date: transaction.occurredOn, account_id: account?.id, source: 'sms_auto', sms_ref: transaction.smsRef,
      });
      expenseId = expense?.id;
      if (expenseId && account?.type === 'bank') await updateRow('accounts', account.id, username, { balance: Number(account.balance || 0) - transaction.amount });
    }
    const pendingRow = await insertRow('pending_transactions', {
      username, amount: transaction.amount, direction: transaction.direction, merchant: transaction.merchant || undefined,
      account_last4: transaction.accountLast4 || undefined, occurred_on: transaction.occurredOn,
      suggested_category: suggestedCategory || undefined, matched_account_id: account?.id, confidence: transaction.confidence,
      source, sender: body.sender?.slice(0, 40), sms_ref: transaction.smsRef, parser_rule: transaction.rule,
      status: expenseId ? 'confirmed' : 'pending', expense_id: expenseId, resolved_at: expenseId ? new Date().toISOString() : undefined,
    });
    return NextResponse.json({ status: expenseId ? 'auto_added' : 'pending_review', id: pendingRow?.id, amount: transaction.amount, direction: transaction.direction, merchant: transaction.merchant, category: suggestedCategory, confidence: transaction.confidence });
  } catch (error) {
    console.error('[ingest] failed:', error);
    return NextResponse.json({ error: 'Could not ingest transaction' }, { status: 500 });
  }
}
