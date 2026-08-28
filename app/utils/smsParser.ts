// Bank SMS parser for the auto expense tracker.
//
// Runs in two places, so it must stay dependency-free and side-effect-free:
//   1. On the Android device (inside the Capacitor webview) -- so that raw
//      message bodies never leave the phone, per Play's Spyware Policy.
//   2. On the server in /api/ingest -- for the iOS Shortcut path, which posts
//      raw text because it runs as the user's own automation.
//
// Everything here is tuned for Indian bank / UPI SMS formats.

export type Direction = 'debit' | 'credit';

export interface ParsedTransaction {
  amount: number;
  direction: Direction;
  merchant: string | null;
  accountLast4: string | null;
  occurredOn: string; // YYYY-MM-DD
  confidence: number; // 0..1
  rule: string; // which merchant rule matched, for debugging misparses
  smsRef: string; // stable fingerprint for de-duplication
  bank: string | null; // used to name an auto-created account
}

export interface ParseResult {
  ok: boolean;
  transaction?: ParsedTransaction;
  reason?: string; // why it was rejected, surfaced in logs only
}

// ============================================
// Rejection rules
// ============================================
// These run before anything else. A false positive here just means a message is
// ignored; a false negative can corrupt an account balance. Bias to rejecting.
const REJECT_RULES: Array<{ name: string; re: RegExp }> = [
  // One-time passwords -- these contain an amount often enough to be dangerous.
  { name: 'otp', re: /\b(otp|one[\s-]?time\s*password|verification\s*code)\b/i },
  { name: 'do-not-share', re: /\bdo\s*not\s*share\b/i },

  // UPI collect requests: someone is ASKING for money. No debit has occurred.
  { name: 'collect-request', re: /\b(has\s+requested|is\s+requesting|collect\s+request|payment\s+request)\b/i },

  // Future tense / reminders -- the money has not moved yet.
  { name: 'future-debit', re: /\bwill\s+be\s+(debited|deducted|charged|auto[\s-]?debited)\b/i },
  { name: 'due-reminder', re: /\b(due\s+on|due\s+date|payment\s+due|last\s+date|pay\s+by|kindly\s+pay|please\s+pay)\b/i },
  { name: 'statement', re: /\b(statement\s+(for|is|has)\b|statement\s+(is\s+)?(generated|ready)|min(imum)?\s+amt\s+due|total\s+amt\s+due)\b/i },

  // Nothing actually happened.
  { name: 'failed', re: /\b(failed|declined|unsuccessful|could\s+not\s+be\s+processed|has\s+been\s+rejected)\b/i },

  // Marketing.
  { name: 'promo', re: /\b(offer|discount|sale|win\s+|congratulations|apply\s+now|pre[\s-]?approved|eligible\s+for)\b/i },
];

// ============================================
// Amount extraction
// ============================================
// Balance / limit clauses are masked out FIRST, otherwise "Avl Bal Rs 45,231.00"
// gets picked up as the transaction amount -- the single most damaging misparse.
const BALANCE_CLAUSE =
  /(?:avl(?:\.|able)?\s*(?:bal|balance|limit|lmt)|bal(?:ance)?|available\s*(?:balance|limit)|total\s*limit|outstanding|cash\s*limit)\s*(?:is|:|-)?\s*(?:rs|inr|₹)\.?\s*[\d,]+(?:\.\d{1,2})?/gi;

// Tried in order. SBI in particular writes "debited by 300.0" with no currency
// marker at all, so a symbol-only pattern would miss a very common format.
const AMOUNT_PATTERNS: RegExp[] = [
  /(?:rs|inr|₹)\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited|debit|credit)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)/i,
  /\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr)\b/i,
];

// ============================================
// Direction
// ============================================
// "Sent"/"Paid" appear bare at the start of HDFC UPI alerts ("Sent Rs.450.00
// From HDFC Bank A/C *4821 To Swiggy"), so they cannot require a following "to".
const DEBIT_STRONG =
  /\b(debited|spent|paid|withdrawn|withdrawal|purchase\s+of|sent|transferred|txn\s+of)\b/i;
const CREDIT_STRONG =
  /\b(credited|received|refund(?:ed)?|deposited|cashback\s+of)\b/i;

// ============================================
// Account number
// ============================================
// Matches the many ways banks mask an account number:
//   "A/c XX4821"  "Acct no. ****9003"  "Card ending 1234"  "A/cX1234"
//   "a/c 91XX1234"  "a/c no. XXXXXXXX0000"  "A/C XXXXX983974"
// No trailing \b after the keyword -- SBI writes "A/cX1234" with no separator,
// and "c" followed by "X" is not a word boundary.
const ACCOUNT_LAST4 =
  /\b(?:a\/c|acct|account|card|vpa|ac)\.?\s*(?:no\.?|number)?\s*[:#-]?\s*(?:\d*(?:x+|\*+)|ending(?:\s+with)?)?\s*(\d{3,6})\b/i;

// ============================================
// Merchant rules, in priority order
// ============================================
const MERCHANT_RULES: Array<{ name: string; re: RegExp }> = [
  // "to VPA swiggy@ybl" / "to swiggy.stores@icici"
  { name: 'vpa', re: /\bto\s+(?:vpa\s+)?([a-z0-9._-]{2,40})@[a-z]{2,15}\b/i },
  // ICICI: "...debited with Rs 450. SWIGGY credited."
  { name: 'semicolon-credited', re: /[;.]\s*([A-Za-z][A-Za-z0-9 &.'-]{1,39}?)\s+credited\b/i },
  // ICICI refund: "refund of INR 499 from FLIPKART has been credited"
  { name: 'from-credited', re: /\bfrom\s+([A-Za-z][A-Za-z0-9 &.'-]{1,39}?)\s+has\s+been\s+credited\b/i },
  // "at AMAZON on 12-08-26"
  { name: 'at-on', re: /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'*-]{1,39}?)\s+on\b/i },
  // Trailing merchant with no closing "on": "...on 20-Oct-22 at BIGBAZAAR."
  // ICICI card alerts and "at ECS PAY." end this way.
  { name: 'at-eos', re: /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'*-]{1,39}?)\s*(?:\.|$)/i },
  // "to ZOMATO on 12-08-26"
  { name: 'to-on', re: /\bto\s+([A-Za-z0-9][A-Za-z0-9 &.'-]{1,39}?)\s+on\b/i },
  // HDFC: "trf to SWIGGY ref no 1234"
  { name: 'trf-to', re: /\btrf\s+to\s+([A-Za-z0-9][A-Za-z0-9 &.'-]{1,39}?)(?:\s+ref|\s*\.|$)/i },
  // "UPI/P2M/123456/SWIGGY"
  { name: 'upi-path', re: /\bupi\/[^/]*\/[^/]*\/([A-Za-z][A-Za-z0-9 &.'-]{1,39})/i },
  // SBI: "Info: UPI/SWIGGY."
  { name: 'info', re: /\binfo[:\s-]+(?:upi\/)?([A-Za-z][A-Za-z0-9 &.'-]{1,39})/i },
  // Generic trailing "to SOMEONE."
  { name: 'to-eos', re: /\bto\s+([A-Za-z][A-Za-z0-9 &.'-]{1,39}?)\s*(?:\.|$)/i },
];

// Tokens that mean we grabbed boilerplate rather than a merchant name.
const MERCHANT_JUNK =
  /^(a\/c|ac|account|card|your|the|you|us|bank|upi|imps|neft|rtgs|atm|ref|no|info|vpa|txn|transaction|payment|self|beneficiary|date|avl|bal|balance)$/i;

// UPI payment-service-provider handles. These trail the merchant name in UPI
// reference paths and must never be mistaken for the merchant itself.
const PSP_HANDLE =
  /^(ybl|okhdfcbank|okicici|oksbi|okaxis|paytm|ptys|apl|axl|ibl|upi|sbi|hdfc|icici|axis|kotak|yesb|idfc|fbl|jupiteraxis|abfspay|naviaxis|slc|dr|cr|p2m|p2a|npci)$/i;

const KNOWN_SENDER =
  /(HDFCBK|SBIINB|SBIPSG|CBSSBI|ATMSBI|ICICIB|IPBMSG|AXISBK|AXISBN|KOTAKB|PNBSMS|BOIIND|CANBNK|IDFCFB|YESBNK|INDUSB|UNIONB|FEDBNK|RBLBNK|AUBANK|BANDHN|DBSBNK|SCBANK|CITIBK|HSBCIN|PYTMBK|AIRBNK|JUSPAY|BHIMPS)/i;

// ============================================
// Bank identification
// ============================================
// Read from the message body first. Public users should not have to wire a
// "sender" variable into their Shortcut just to get an accurate reading, and
// virtually every bank SMS names the bank in the text ("From HDFC Bank A/C").
const BANK_NAMES: Array<{ name: string; re: RegExp }> = [
  { name: 'HDFC', re: /\bhdfc\b/i },
  { name: 'SBI', re: /\b(sbi|state bank)\b/i },
  { name: 'ICICI', re: /\bicici\b/i },
  { name: 'Axis', re: /\baxis\b/i },
  { name: 'Kotak', re: /\bkotak\b/i },
  { name: 'PNB', re: /\b(pnb|punjab national)\b/i },
  { name: 'Bank of Baroda', re: /\b(bob|bank of baroda)\b/i },
  { name: 'Canara', re: /\bcanara\b/i },
  { name: 'IDFC', re: /\bidfc\b/i },
  { name: 'Yes Bank', re: /\byes\s*bank\b/i },
  { name: 'IndusInd', re: /\bindusind\b/i },
  { name: 'Union Bank', re: /\bunion\s*bank\b/i },
  { name: 'Federal Bank', re: /\bfederal\s*bank\b/i },
  { name: 'RBL', re: /\brbl\b/i },
  { name: 'IDBI', re: /\bidbi\b/i },
  { name: 'Indian Bank', re: /\bindian\s*bank\b/i },
  { name: 'Bank of India', re: /\b(boi|bank of india)\b/i },
  { name: 'Paytm', re: /\bpaytm\b/i },
  { name: 'Airtel Payments', re: /\bairtel\s*payments\b/i },
];

/** Best-effort bank name, from the message text or the sender header. */
export function detectBank(text: string, sender?: string | null): string | null {
  for (const b of BANK_NAMES) {
    if (b.re.test(text)) return b.name;
  }
  if (sender) {
    for (const b of BANK_NAMES) {
      if (b.re.test(sender)) return b.name;
    }
  }
  return null;
}

// ============================================
// Category inference
// ============================================
const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: 'Food', words: ['swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'dominos', 'pizza', 'mcdonald', 'kfc', 'starbucks', 'cafe', 'restaurant', 'bakery', 'biryani', 'eatclub', 'bigbasket', 'dunzo', 'licious', 'freshtohome'] },
  { category: 'Transport', words: ['uber', 'ola', 'rapido', 'irctc', 'redbus', 'indigo', 'spicejet', 'airindia', 'vistara', 'metro', 'fastag', 'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'shell', 'parking', 'blusmart', 'namma'] },
  { category: 'Shopping', words: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'snapdeal', 'decathlon', 'ikea', 'lifestyle', 'shoppers', 'reliance', 'dmart', 'croma', 'vijaysales'] },
  { category: 'Bills', words: ['electricity', 'recharge', 'airtel', 'jio', 'vodafone', 'vi ', 'bsnl', 'broadband', 'gas', 'water', 'insurance', 'lic ', 'premium', 'rent', 'maintenance', 'tax', 'billdesk', 'bbps', 'act fibernet', 'tata power', 'adani'] },
  { category: 'Entertainment', words: ['netflix', 'prime video', 'hotstar', 'spotify', 'youtube', 'bookmyshow', 'pvr', 'inox', 'cinepolis', 'gaana', 'jiosaavn', 'steam', 'playstation', 'xbox'] },
  { category: 'Health', words: ['pharmacy', 'apollo', 'medplus', 'pharmeasy', 'netmeds', 'tata 1mg', '1mg', 'hospital', 'clinic', 'diagnostic', 'lab', 'practo', 'cult', 'gym', 'fitness'] },
];

export function inferCategory(merchant: string | null): string | null {
  if (!merchant) return null;
  const m = merchant.toLowerCase();
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => m.includes(w))) return category;
  }
  return null;
}

// ============================================
// Helpers
// ============================================

// FNV-1a. Not cryptographic -- this only needs to be stable and collision-light
// across the device and the server, and it must not pull in a dependency.
function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function toISODate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayISO(): string {
  const n = new Date();
  return toISODate(n.getFullYear(), n.getMonth() + 1, n.getDate())!;
}

// Extracts a transaction date. Indian bank SMS are day-first, always.
function extractDate(text: string): string | null {
  // 2026-08-27 (year-first) -- must be tried before the day-first pattern.
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const d = toISODate(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10));
    if (d) return d;
  }
  // 12-08-26 / 12/08/2026
  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numeric) {
    const d = parseInt(numeric[1], 10);
    const m = parseInt(numeric[2], 10);
    let y = parseInt(numeric[3], 10);
    if (y < 100) y += 2000;
    const iso = toISODate(y, m, d);
    if (iso) return iso;
  }
  // 12-Aug-26 / 12 Aug 2026 / 12Aug26
  const named = text.match(/\b(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{2,4})\b/);
  if (named) {
    const d = parseInt(named[1], 10);
    const m = MONTHS[named[2].toLowerCase()];
    let y = parseInt(named[3], 10);
    if (y < 100) y += 2000;
    if (m) {
      const iso = toISODate(y, m, d);
      if (iso) return iso;
    }
  }
  return null;
}

function cleanMerchant(raw: string): string | null {
  let m = raw.replace(/\s+/g, ' ').trim();

  // End-anchored rules over-capture trailing boilerplate: "transfer to RAHUL
  // Ref No 523456789017" yields the merchant plus the reference. Cut at the
  // first trailing marker.
  m = m.split(/\s+(?:ref(?:no|erence)?\b|refno\b|on\s+\d|upi\b|txn\b|via\b|using\b|not\s+you\b|avl\b|bal\b|-\s*\w+bank\b)/i)[0];
  // Drop a dangling reference number.
  m = m.replace(/\s+\d{6,}\s*$/, '');

  m = m.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').trim();
  if (m.length < 2 || m.length > 40) return null;
  if (MERCHANT_JUNK.test(m)) return null;
  if (/^\d+$/.test(m)) return null; // pure number -- a ref, not a name
  if (extractDate(m)) return null; // we grabbed a date
  // Title-case ALL-CAPS names; leave mixed case (e.g. "iPhone") alone.
  if (m === m.toUpperCase()) {
    m = m
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return m;
}

// ============================================
// Main entry point
// ============================================
export function parseTransactionSms(text: string, sender?: string | null): ParseResult {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 15) {
    return { ok: false, reason: 'too-short' };
  }

  for (const rule of REJECT_RULES) {
    if (rule.re.test(normalized)) {
      return { ok: false, reason: `rejected:${rule.name}` };
    }
  }

  // Mask balance clauses before reading the amount.
  const masked = normalized.replace(BALANCE_CLAUSE, ' [BAL] ');

  let amountMatch: RegExpMatchArray | null = null;
  for (const p of AMOUNT_PATTERNS) {
    amountMatch = masked.match(p);
    if (amountMatch) break;
  }
  if (!amountMatch) {
    return { ok: false, reason: 'no-amount' };
  }
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'bad-amount' };
  }

  const hasDebit = DEBIT_STRONG.test(masked);
  const hasCredit = CREDIT_STRONG.test(masked);
  if (!hasDebit && !hasCredit) {
    return { ok: false, reason: 'no-direction' };
  }
  // "debited from A/c X and credited to beneficiary" -- from the account
  // holder's perspective this is a debit, so debit wins when both appear.
  const direction: Direction = hasDebit ? 'debit' : 'credit';
  const unambiguous = hasDebit !== hasCredit;

  const accountMatch = masked.match(ACCOUNT_LAST4);
  const accountLast4 = accountMatch ? accountMatch[1].slice(-4) : null;

  let merchant: string | null = null;
  let rule = 'none';

  // UPI reference paths vary in segment count -- "UPI/523456789014/Uber",
  // "UPI/P2M/523456789014/Swiggy", "UPI/DR/523456789014/ZOMATO/ybl". The
  // merchant is the last segment that reads as a name, so walk the path rather
  // than trying to pin down the shape with one regex.
  // The merchant is the first name-like segment AFTER the numeric reference:
  //   UPI/523456789014/Uber                        -> Uber
  //   UPI/P2M/523456789012/Swiggy                  -> Swiggy
  //   UPI/DR/312345678901/SWIGGY/YBL/swiggy.stores -> Swiggy  (not the handle)
  const upiPath = masked.match(/\bupi\/([^\s,]+)/i);
  if (upiPath) {
    const segments = upiPath[1].split('/').filter(Boolean);
    const refIndex = segments.findIndex((s) => /^\d{6,}$/.test(s));
    const start = refIndex >= 0 ? refIndex + 1 : 0;
    for (let i = start; i < segments.length; i++) {
      if (PSP_HANDLE.test(segments[i])) continue;
      const cleaned = cleanMerchant(segments[i]);
      if (cleaned && /[A-Za-z]{2}/.test(cleaned)) {
        merchant = cleaned;
        rule = 'upi-path';
        break;
      }
    }
  }

  if (!merchant) for (const r of MERCHANT_RULES) {
    const m = masked.match(r.re);
    if (m && m[1]) {
      const cleaned = cleanMerchant(m[1]);
      if (cleaned) {
        merchant = cleaned;
        rule = r.name;
        break;
      }
    }
  }

  const bank = detectBank(normalized, sender);

  const parsedDate = extractDate(masked);

  // A date in the future or more than 30 days old means we probably grabbed a
  // due date or a card expiry rather than the transaction date. Fall back to
  // today rather than filing the expense under a date the user never spent on.
  let dateSuspect = false;
  if (parsedDate) {
    const diffDays = (Date.parse(parsedDate) - Date.parse(todayISO())) / 86400000;
    if (diffDays > 1 || diffDays < -30) dateSuspect = true;
  }
  const occurredOn = parsedDate && !dateSuspect ? parsedDate : todayISO();

  // ---- Confidence ----
  let confidence = 0.35;
  if (unambiguous) confidence += 0.15;
  if (accountLast4) confidence += 0.15;
  if (merchant) confidence += 0.12;
  // Credit the bank signal whether it came from the sender header or the body,
  // so a Shortcut that omits the sender variable is not penalised.
  if (bank || (sender && KNOWN_SENDER.test(sender))) confidence += 0.12;
  if (parsedDate && !dateSuspect) confidence += 0.06;
  if (!parsedDate) confidence -= 0.08;
  if (dateSuspect) confidence -= 0.15;
  if (/https?:\/\//i.test(normalized)) confidence -= 0.15;
  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));

  // ---- De-duplication key ----
  // A bank reference number is the most reliable identity for a transaction, so
  // prefer it. Otherwise fall back to a hash of the message itself.
  const refMatch = normalized.match(
    /\b(?:ref(?:erence)?\s*(?:no\.?|number|#)?|txn\s*(?:id|no\.?)?|utr|rrn)\s*[:.#-]?\s*([A-Za-z0-9]{6,25})\b/i
  );
  const smsRef = refMatch
    ? `ref:${refMatch[1].toLowerCase()}`
    : `h:${fingerprint(normalized.toLowerCase())}:${amount.toFixed(2)}:${occurredOn}`;

  return {
    ok: true,
    transaction: {
      amount,
      direction,
      merchant,
      accountLast4,
      occurredOn,
      confidence,
      rule,
      smsRef,
      bank,
    },
  };
}

// ============================================
// Hybrid routing
// ============================================
export const AUTO_ADD_THRESHOLD = 0.85;

/**
 * Decides whether a parsed transaction posts straight to expenses or waits in
 * the inbox.
 *
 * Credits NEVER auto-add, at any confidence. A credit could be a salary, a
 * transfer from savings, or a genuine refund, and Expenza models a refund as an
 * expense row that credits the account -- guessing wrong there silently inflates
 * both the balance and the spend total. Those always get a human look.
 */
export function shouldAutoAdd(
  tx: ParsedTransaction,
  matchedAccountId: string | null
): boolean {
  if (tx.direction === 'credit') return false;
  if (!matchedAccountId) return false; // no account = balance can't be updated
  return tx.confidence >= AUTO_ADD_THRESHOLD;
}
