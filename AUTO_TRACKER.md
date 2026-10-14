# Auto Expense Tracker (SMS)

Turns bank SMS into Expenza expenses. High-confidence transactions post
automatically; anything uncertain waits in an inbox for one tap.

```
iPhone Shortcut ──raw SMS text──┐
                                ├─→ POST /api/ingest ─→ parse ─→ ┬─ auto-add → expenses
Android app ──parsed fields─────┘                                └─ inbox → you confirm
```

---

## 1. Setup

### 1.1 Database

Run [`supabase/sms_auto_tracker.sql`](supabase/sms_auto_tracker.sql) in the SQL
Editor of the **existing** Expenza project. It adds:

| Object | Purpose |
|---|---|
| `expenses.source` | `manual` / `sms_auto` / `sms_confirmed` |
| `expenses.sms_ref` | Dedupe key, unique per user |
| `accounts.last4` | Last 4 digits, used to match an SMS to an account |
| `ingest_tokens` | One per paired device; only a SHA-256 hash is stored |
| `pending_transactions` | The review inbox + audit trail |

Both new tables have **RLS enabled with no policies**, so the public anon key
cannot read them. Only the server routes, holding the service-role key, can.

### 1.2 Environment variable

`/api/ingest`, `/api/pending` and `/api/tokens` need the service-role key:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Supabase → Settings → API → service_role
```

Add it to `.env.local` **and** to Vercel → Project → Settings → Environment
Variables. A shell variable in `~/.zshrc` covers local `next dev` only —
serverless functions never see it.

Never prefix it `NEXT_PUBLIC_`; that ships it to the browser.

### 1.3 Accounts (nothing to do)

Accounts are created automatically. The first time a transaction arrives for an
account we have not seen, Expenza creates one from the digits in the message and
names it after the bank it detected -- `HDFC ····5555`. Auto-add works from the
very first SMS; no setup, no pre-registering account numbers.

Auto-created accounts open at a zero balance, so they read negative until you
enter the real opening balance on the Accounts screen. That is cosmetic -- the
spend totals and categories are correct either way.

### 1.4 Pair a device

Settings → Auto-Tracking → add a device. The token appears **once**. Only its
hash is stored, so a lost token must be revoked and replaced.

---

## 2. iPhone (Shortcuts)

iOS gives no app any way to read SMS — no API exists, for any framework. The
Shortcuts app is the only route, and it belongs to you rather than to Expenza.

**Shortcuts → Automation → New → Message**

1. Trigger: **When I get a message** — leave **both** the sender and
   `Message contains` boxes empty. Forward everything and let the server decide;
   filtering on the phone only risks dropping a bank format you didn't expect.
2. Turn **Run Immediately** on and **Notify When Run** off.
3. Action: **Get Contents of URL**

   **Simplest form** — token on the query string, the SMS as a plain-text body.
   Four settings, no JSON rows to assemble:

   - URL: `https://<your-app>/api/ingest?token=exp_YOUR_TOKEN`
   - Method: `POST`
   - Request Body: **Text**
   - Body content: the **Message** variable

   That is the whole setup. The `sender` variable is **not** needed -- the bank
   is identified from the message text itself.

   **More secure form** — keeps the token out of the URL, which matters once
   this is deployed publicly, since query strings show up in server and proxy
   logs. Either send it as a header:

   - Headers: `Authorization` = `Bearer exp_YOUR_TOKEN`

   or as JSON:

   - Request Body: `JSON`
     | Key | Type | Value |
     |---|---|---|
     | `token` | Text | your device token |
     | `text` | Text | the *Message* variable |

   `sender` is optional and adds nothing -- the bank is read from the message.

   The endpoint accepts all three and looks for the token in the body, then
   `?token=`, then the `Authorization` header.

The endpoint returns `200 {"status":"ignored"}` for non-transactional messages,
so the automation stays silent on ordinary texts.

## 3. Android

A PWA cannot read SMS. This needs a native shell — recommended stack is
**Capacitor wrapping this same Next.js app**, so the UI stays one codebase:

```
npm install @capacitor/core @capacitor/cli
npx cap init Expenza com.expenza.app
npx cap add android
```

Point `capacitor.config.ts` at the deployed URL (`server.url`) rather than
static-exporting — `/api/*` are server routes and static export would break them.

The Kotlin plugin is a `BroadcastReceiver` on `SMS_RECEIVED` that hands the body
to the webview, where `app/utils/smsParser.ts` runs and posts **parsed fields
only**:

```json
{ "token": "...", "sender": "AD-HDFCBK",
  "parsed": { "amount": 450, "direction": "debit", "merchant": "Swiggy",
              "accountLast4": "4821", "occurredOn": "2026-08-27",
              "confidence": 0.95, "rule": "to-on", "smsRef": "ref:52345..." } }
```

### Why on-device parsing is not optional

Google Play permits this use case — `READ_SMS`/`RECEIVE_SMS` are grantable to a
non-default handler under the listed exception **"SMS-based money management —
apps that track and manage budget"**, via the Permissions Declaration Form. But
the Spyware Policy attaches a hard limit:

> personal loans or budgeting apps may not exfiltrate or share non-financial or
> personal SMS history of a user

Posting raw message bodies to a server is exactly that. So `raw_text` stays NULL
for `source='android_sms'`, and the endpoint accepts pre-parsed fields. The iOS
path may send raw text because it runs as the user's own Shortcut automation.

Approval also requires: SMS parsing as *core* functionality, prominent in-app
disclosure before the permission prompt, a matching privacy policy and Data
Safety declaration, and the app remaining fully usable if permission is denied.

**Alternative avoiding the review entirely:** a Notification Listener
(`BIND_NOTIFICATION_LISTENER_SERVICE`) is not in the SMS permission group and
also catches GPay/PhonePe/Paytm notifications — often better UPI coverage. Or
sideload the APK for personal use.

---

## 4. How routing decides

`shouldAutoAdd()` in [`app/utils/smsParser.ts`](app/utils/smsParser.ts):

| Condition | Result |
|---|---|
| confidence ≥ 0.85 **and** category inferred | auto-added, tagged `sms_auto` (the account is created automatically if unknown) |
| anything else | inbox |
| **any credit, at any confidence** | inbox, always |

Credits never auto-add. A credit may be salary, a transfer between your own
accounts, or a real refund — and Expenza stores a refund as an expense row that
*credits* the account, so guessing wrong inflates both the balance and the spend
total. Those always get a human look.

Account matching requires exactly one candidate. Two accounts ending `1234` means
we genuinely don't know which, so it goes to the inbox. Zero candidates means a
new account is created from the message rather than bothering the user.

Everything auto-added stays reversible: the **Added automatically** tab has an
Undo that deletes the expense and restores the balance.

### Safety rails in the parser

Rejected outright: OTPs, UPI collect requests, due-date reminders, statement
alerts, failed/declined transactions, future auto-debit notices, promotional
messages. Balance clauses (`Avl Bal Rs 45,231.00`) are masked *before* the amount
is read — otherwise the balance gets logged as the spend, the most damaging
misparse.

De-duplication uses the bank's reference number when present, else a hash of the
message. The same SMS delivered twice cannot create two expenses.

---

## 5. Tests

```bash
node --experimental-strip-types scripts/test-sms-parser.ts
```

23 cases covering HDFC, SBI, ICICI, Axis, Paytm formats — including balance
traps and every message type that must be rejected. Add your own real messages
(mask the digits) when you hit a misparse; that is the fastest way to improve
accuracy.

---

## 6. Known limitations

- **Small UPI transactions may never generate an SMS.** HDFC stopped alerts for
  UPI spends under ₹100 and credits under ₹500, and other banks have asked RBI
  to do the same for low-value transactions. Notification-listener capture is
  more reliable than SMS for exactly this reason.
- **Auth is username-only.** `/api/pending` and `/api/tokens` trust a
  `username` query parameter, matching the rest of the app. That is not real
  authorization. `/api/ingest` is stronger — it derives the username from the
  token and ignores the body.
- **The older tables have RLS disabled** (`COMPLETE_SCHEMA.sql` enables then
  immediately disables it), so the public anon key can already read and write
  every user's expenses. Worth fixing independently of this feature.
- **No rate limiting** on `/api/ingest`. A leaked token can be spammed until
  revoked.
