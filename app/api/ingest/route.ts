import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { findIngestToken, insertRow, listRows, updateRow } from '../../lib/convexServer';
import { parseTransactionSms, inferCategory, shouldAutoAdd, type ParsedTransaction } from '../../utils/smsParser';
import { merchantKey } from '../../lib/merchants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hashToken = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

// Senders here are an iOS Shortcut, an Android app, or a hand-rolled webhook.
// None of them agree on a field name or a Content-Type, and Shortcuts in
// particular will happily send a Text body under an application/json header.
// So: accept anything, look for the message under any plausible key, and never
// let a surprising body shape reach a throw.
const TEXT_KEYS = ['text', 'message', 'msg', 'sms', 'smstext', 'messagebody', 'body', 'content', 'shortcutinput', 'input', 'value'];
const SENDER_KEYS = ['sender', 'from', 'address', 'originator', 'senderid'];
const TOKEN_KEYS = ['token', 'key', 'apikey', 'accesstoken'];

const normaliseKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, '');

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/** First key in `keys` present on `source` whose value is string-like. */
function pick(source: Record<string, unknown>, keys: string[]): string | undefined {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(source)) lookup.set(normaliseKey(key), value);
  for (const key of keys) {
    const found = asString(lookup.get(normaliseKey(key)));
    if (found !== undefined) return found;
  }
  return undefined;
}

const RECOGNISED = new Set([...TEXT_KEYS, ...SENDER_KEYS, ...TOKEN_KEYS, 'parsed'].map(normaliseKey));

/**
 * Turn a raw request body into a field map plus, when the body clearly is not
 * structured, the message text it should be read as. Never throws.
 */
function readBody(rawBody: string, contentType: string): { fields: Record<string, unknown>; plain?: string } {
  const trimmed = rawBody.trim();
  if (!trimmed) return { fields: {} };

  if (contentType.includes('json') || /^[[{"]/.test(trimmed) || trimmed === 'null') {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { fields: parsed as Record<string, unknown> };
      }
      // Valid JSON, but a bare string / number / array / null. The only
      // sensible reading is that the whole thing is the message.
      return { fields: {}, plain: typeof parsed === 'string' ? parsed : rawBody };
    } catch {
      // Declared JSON but is not JSON -- the usual Shortcuts misconfiguration.
      return { fields: {}, plain: rawBody };
    }
  }

  if (contentType.includes('x-www-form-urlencoded')) {
    try {
      const fields: Record<string, unknown> = {};
      new URLSearchParams(rawBody).forEach((value, key) => {
        fields[key] = value;
      });
      // Only fall back to the raw body if nothing in it was a field we know;
      // otherwise "token=abc" would be mistaken for a bank message.
      const known = Object.keys(fields).some((key) => RECOGNISED.has(normaliseKey(key)));
      return { fields, plain: known ? undefined : rawBody };
    } catch {
      return { fields: {}, plain: rawBody };
    }
  }

  return { fields: {}, plain: rawBody };
}

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

/**
 * Health check. Opening the Shortcut URL in a browser is the obvious way to
 * test it, and a bare POST-only route answers that with 405 Method Not
 * Allowed -- indistinguishable from a broken endpoint. This confirms the URL
 * and the token without writing anything.
 */
export async function GET(request: NextRequest) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const rawToken = (
    request.nextUrl.searchParams.get('token') ||
    bearer ||
    request.headers.get('x-expenza-token') ||
    ''
  ).trim();

  if (!rawToken) {
    return NextResponse.json(
      { status: 'error', connection: 'missing-token', message: 'No token in this URL. Copy the Shortcut URL again from Settings -> Auto-Tracking.' },
      { status: 401 }
    );
  }

  try {
    const tokenRow = await findIngestToken(hashToken(rawToken));
    if (!tokenRow || tokenRow.revoked_at) {
      return NextResponse.json(
        { status: 'error', connection: 'invalid-token', message: 'This link is not valid any more. Create a new one from Settings -> Auto-Tracking.' },
        { status: 401 }
      );
    }
    return NextResponse.json({
      status: 'ok',
      connection: 'ok',
      message: 'This Auto-Tracking link is working. Bank messages sent here by your Shortcut will appear in your Expenza inbox.',
    });
  } catch (error) {
    console.error('[ingest] health check failed:', error);
    return NextResponse.json(
      { status: 'error', connection: 'unavailable', message: 'Could not reach the database. Try again shortly.' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    rawBody = ''; // Unreadable stream; the query string may still carry enough.
  }

  const contentType = request.headers.get('content-type') || '';
  const query = request.nextUrl.searchParams;
  const { fields, plain } = readBody(rawBody, contentType);

  // `??`, never `||`: an empty string is a real answer -- it means the field
  // was sent but was blank -- and collapsing it to undefined is what made a
  // manually-run Shortcut fall through to "Malformed transaction payload".
  const messageText = pick(fields, TEXT_KEYS) ?? plain ?? query.get('text') ?? query.get('message') ?? undefined;
  const senderRaw = pick(fields, SENDER_KEYS) ?? query.get('sender') ?? undefined;
  const sender = senderRaw ? senderRaw.slice(0, 40) : undefined;

  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const rawToken = (
    pick(fields, TOKEN_KEYS) ||
    query.get('token') ||
    bearer ||
    request.headers.get('x-expenza-token') ||
    ''
  ).trim();
  if (!rawToken) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

  const parsedInput = fields.parsed && typeof fields.parsed === 'object' && !Array.isArray(fields.parsed)
    ? (fields.parsed as Partial<ParsedTransaction>)
    : undefined;

  try {
    const tokenRow = await findIngestToken(hashToken(rawToken));
    if (!tokenRow || tokenRow.revoked_at) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const username = String(tokenRow.username);
    const source = tokenRow.platform === 'android' ? 'android_sms' : tokenRow.platform === 'ios' ? 'ios_shortcut' : 'manual_test';
    await updateRow('ingest_tokens', tokenRow.id, username, { last_used_at: new Date().toISOString() });

    let transaction: ParsedTransaction | null = null;

    if (parsedInput) {
      transaction = validateParsed(parsedInput);
      if (!transaction) {
        return NextResponse.json(
          { status: 'error', reason: 'invalid-parsed', error: 'The parsed transaction was missing a valid amount, direction, date, or reference.' },
          { status: 400 }
        );
      }
    } else if (typeof messageText === 'string' && messageText.trim()) {
      const parsed = parseTransactionSms(messageText, sender);
      if (!parsed.ok || !parsed.transaction) {
        await insertRow('skipped_messages', { username, raw_text: messageText.slice(0, 2000), sender, reason: parsed.reason, source });
        return NextResponse.json({ status: 'ignored', reason: parsed.reason });
      }
      transaction = parsed.transaction;
      await insertRow('skipped_messages', { username, raw_text: messageText.slice(0, 2000), sender, reason: 'parsed', source });
    } else {
      // No message text at all. This is exactly what tapping Play on the iOS
      // Shortcut looks like -- the Message variable is only filled in when the
      // automation fires for a real SMS -- so report it as a working
      // connection rather than as a malformed request.
      return NextResponse.json({
        status: 'ignored',
        reason: 'no-message',
        connection: 'ok',
        message:
          'Connection works. No message text was received, which is expected when you run the Shortcut by hand. A real bank message will include it.',
      });
    }

    const [expenses, pending, accounts, categories, remembered] = await Promise.all([
      listRows('expenses', username), listRows('pending_transactions', username), listRows('accounts', username),
      listRows('categories', username), listRows('merchant_categories', username),
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
    // Income and spending have separate category lists. A credit must never be
    // offered a spending category, or it lands in the wrong list on confirm.
    const isCredit = transaction.direction === 'credit';
    const wantedKind = isCredit ? 'income' : 'expense';
    const kindNames = categories
      .filter((category) => (category.kind === 'income' ? 'income' : 'expense') === wantedKind)
      .map((category) => String(category.name));

    // A category the user already chose for this payee beats the built-in
    // guess -- that choice is the whole point of remembering it.
    const key = merchantKey(transaction.merchant);
    const savedRow = key
      ? remembered.find(
          (row) => row.merchant_key === key &&
            (row.direction === 'credit' ? 'credit' : 'debit') === (isCredit ? 'credit' : 'debit')
        )
      : undefined;
    const saved = savedRow && kindNames.includes(String(savedRow.category))
      ? String(savedRow.category)
      : undefined;

    const inferred = saved ?? (isCredit ? undefined : inferCategory(transaction.merchant));
    const fallback = isCredit
      ? (kindNames.includes('Other income') ? 'Other income' : kindNames[0])
      : (kindNames.includes('Other') ? 'Other' : kindNames[0]);
    const suggestedCategory = inferred && (kindNames.length === 0 || kindNames.includes(inferred))
      ? inferred
      : fallback;
    const autoAdd = shouldAutoAdd(transaction, account?.id || null) && !!suggestedCategory;
    let expenseId: string | undefined;
    if (autoAdd) {
      const expense = await insertRow('expenses', {
        username, amount: transaction.amount, category: suggestedCategory, note: transaction.merchant || undefined,
        direction: transaction.direction,
        date: transaction.occurredOn, account_id: account?.id, source: 'sms_auto', sms_ref: transaction.smsRef,
      });
      expenseId = expense?.id;
      if (expenseId && account?.type === 'bank') await updateRow('accounts', account.id, username, { balance: Number(account.balance || 0) - transaction.amount });
    }
    const pendingRow = await insertRow('pending_transactions', {
      username, amount: transaction.amount, direction: transaction.direction, merchant: transaction.merchant || undefined,
      account_last4: transaction.accountLast4 || undefined, occurred_on: transaction.occurredOn,
      suggested_category: suggestedCategory || undefined, matched_account_id: account?.id, confidence: transaction.confidence,
      source, sender, sms_ref: transaction.smsRef, parser_rule: transaction.rule,
      status: expenseId ? 'confirmed' : 'pending', expense_id: expenseId, resolved_at: expenseId ? new Date().toISOString() : undefined,
    });
    return NextResponse.json({ status: expenseId ? 'auto_added' : 'pending_review', id: pendingRow?.id, amount: transaction.amount, direction: transaction.direction, merchant: transaction.merchant, category: suggestedCategory, confidence: transaction.confidence });
  } catch (error) {
    console.error('[ingest] failed:', error);
    return NextResponse.json({ error: 'Could not ingest transaction' }, { status: 500 });
  }
}
