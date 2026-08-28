import { parseTransactionSms, inferCategory, shouldAutoAdd } from '../app/utils/smsParser.ts';

type Case = {
  name: string;
  sender: string;
  text: string;
  expect: 'reject' | { amount: number; direction: string; last4?: string | null; merchant?: string | null };
};

const cases: Case[] = [
  {
    name: 'HDFC UPI sent',
    sender: 'VM-HDFCBK',
    text: 'Sent Rs.450.00 From HDFC Bank A/C *4821 To Swiggy On 27/08/26 Ref 523456789012',
    expect: { amount: 450, direction: 'debit', last4: '4821', merchant: 'Swiggy' },
  },
  {
    name: 'HDFC card spend + balance trap',
    sender: 'VM-HDFCBK',
    text: 'Rs.1200.00 spent on HDFC Bank Card x9003 at AMAZON on 2026-08-27. Avl Lmt: Rs.48,800.00',
    expect: { amount: 1200, direction: 'debit', last4: '9003', merchant: 'Amazon' },
  },
  {
    name: 'SBI no currency symbol',
    sender: 'JD-SBIINB',
    text: 'Dear UPI user A/C X1234 debited by 300.0 on date 27Aug26 trf to ZOMATO Refno 523456789013 -SBI',
    expect: { amount: 300, direction: 'debit', last4: '1234', merchant: 'Zomato' },
  },
  {
    name: 'ICICI with Avl Bal trap',
    sender: 'AD-ICICIB',
    text: 'Dear Customer, Acct XX9123 is debited with INR 500.00 on 27-Aug-26. Info: UPI/523456789014/Uber. Avl Bal INR 12,345.67',
    expect: { amount: 500, direction: 'debit', last4: '9123', merchant: 'Uber' },
  },
  {
    name: 'Axis card spend',
    sender: 'AX-AXISBK',
    text: 'Spent Card no. XX1234 INR 250 27-08-26 12:30:45 BIGBASKET Avl Lmt INR 45,000',
    expect: { amount: 250, direction: 'debit', last4: '1234' },
  },
  {
    name: 'Credit / money in',
    sender: 'VM-HDFCBK',
    text: 'Dear Customer, your A/c XX4821 is credited with Rs.5,000.00 on 27-08-26 (IMPS Ref no 523456789015)',
    expect: { amount: 5000, direction: 'credit', last4: '4821' },
  },
  // --- real templates gathered from the IVY-wallet gist + transaction-sms-parser ---
  {
    name: 'SBI compact UPI',
    sender: 'JD-SBIINB',
    text: 'Rs150.0 debited@SBI UPI frm A/cX1234 on 27Sep26 RefNo 523456789016',
    expect: { amount: 150, direction: 'debit', last4: '1234' },
  },
  {
    name: 'SBI hyphen-debited',
    sender: 'JD-SBIINB',
    text: 'Dear SBI User, your A/c X1234-debited by Rs2500.0 on 29Sep26 transfer to RAHUL Ref No 523456789017',
    expect: { amount: 2500, direction: 'debit', last4: '1234' },
  },
  {
    name: 'SBI a/c no. long form',
    sender: 'JD-SBIINB',
    text: 'Dear Customer, Your a/c no. XXXXXXXX0000 is debited for Rs.1500.00 on 27-08-26. Avl Bal- INR 2343.23',
    expect: { amount: 1500, direction: 'debit', last4: '0000' },
  },
  {
    name: 'ICICI card, merchant at end',
    sender: 'AD-ICICIB',
    text: 'INR 899.00 spent on ICICI Bank Card XX1234 on 20-Aug-26 at BIGBAZAAR.',
    expect: { amount: 899, direction: 'debit', last4: '1234', merchant: 'Bigbazaar' },
  },
  {
    name: 'ECS with Avl Bal trap',
    sender: 'AD-ICICIB',
    text: 'INR 2000 debited from A/c no. XX3423 on 27-08-26 07:27:11 IST at ECS PAY. Avl Bal- INR 2343.23.',
    expect: { amount: 2000, direction: 'debit', last4: '3423', merchant: 'Ecs Pay' },
  },
  {
    name: 'ICICI merchant refund',
    sender: 'AD-ICICIB',
    text: 'Dear Customer, refund of INR 1299.00 from FLIPKART has been credited to your ICICI Bank Card XX1234 on 27-08-26.',
    expect: { amount: 1299, direction: 'credit', last4: '1234', merchant: 'Flipkart' },
  },
  {
    name: 'Paytm ATM withdrawal',
    sender: 'VM-PYTMBK',
    text: 'Rs.5000.00 withdrawn at AXIS ATM CONNAUGHT PLACE on 27-08-2026 using Debit Card 91XX1234',
    expect: { amount: 5000, direction: 'debit' },
  },
  {
    name: 'Paytm paid via a/c',
    sender: 'VM-PYTMBK',
    text: 'Paid Rs.320.00 via a/c 91XX1234 to Blinkit on 27-08-2026',
    expect: { amount: 320, direction: 'debit', last4: '1234', merchant: 'Blinkit' },
  },
  {
    name: 'SBI credit inbound',
    sender: 'JD-SBIINB',
    text: 'Your A/C XXXXX983974 Credited INR 25000.00 on 27/08/26 -Deposit by transfer from RAHUL',
    expect: { amount: 25000, direction: 'credit', last4: '3974' },
  },
  // --- must be rejected ---
  { name: 'ICICI statement ready', sender: 'AD-ICICIB', text: 'Dear Customer, statement for ICICI Bank Credit Card XX1234 has been sent. Total amount Rs.8,450.00.', expect: 'reject' },
  { name: 'OTP with amount', sender: 'VM-HDFCBK', text: '123456 is your OTP for txn of Rs.2,500 at AMAZON. Do not share with anyone.', expect: 'reject' },
  { name: 'UPI collect request', sender: 'VM-BHIMPS', text: 'Ravi has requested Rs.500.00 via UPI. Approve the request in your app.', expect: 'reject' },
  { name: 'Credit card bill due', sender: 'VM-HDFCBK', text: 'Your HDFC Credit Card bill of Rs.12,340.00 is due on 05-09-26. Pay by the due date to avoid charges.', expect: 'reject' },
  { name: 'Failed transaction', sender: 'AD-ICICIB', text: 'Your transaction of Rs.800.00 at SWIGGY has failed. Amount will be refunded.', expect: 'reject' },
  { name: 'Autodebit future', sender: 'VM-HDFCBK', text: 'Rs.499.00 will be debited from your A/c XX4821 on 01-09-26 towards Netflix subscription.', expect: 'reject' },
  { name: 'Promotional', sender: 'VM-HDFCBK', text: 'Congratulations! You are pre-approved for a personal loan of Rs.5,00,000. Apply now.', expect: 'reject' },
  { name: 'Balance enquiry only', sender: 'VM-HDFCBK', text: 'Your A/c XX4821 Avl Bal is Rs.45,231.00 as on 27-08-26.', expect: 'reject' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = parseTransactionSms(c.text, c.sender);
  if (c.expect === 'reject') {
    if (!r.ok) { console.log(`  PASS  ${c.name.padEnd(30)} rejected (${r.reason})`); pass++; }
    else { console.log(`X FAIL  ${c.name.padEnd(30)} SHOULD REJECT but parsed: ${JSON.stringify(r.transaction)}`); fail++; }
    continue;
  }
  if (!r.ok || !r.transaction) {
    console.log(`X FAIL  ${c.name.padEnd(30)} rejected but should parse (${r.reason})`); fail++; continue;
  }
  const t = r.transaction;
  const errs: string[] = [];
  if (t.amount !== c.expect.amount) errs.push(`amount ${t.amount} != ${c.expect.amount}`);
  if (t.direction !== c.expect.direction) errs.push(`direction ${t.direction} != ${c.expect.direction}`);
  if (c.expect.last4 !== undefined && t.accountLast4 !== c.expect.last4) errs.push(`last4 ${t.accountLast4} != ${c.expect.last4}`);
  if (c.expect.merchant !== undefined && t.merchant !== c.expect.merchant) errs.push(`merchant "${t.merchant}" != "${c.expect.merchant}"`);
  if (errs.length) { console.log(`X FAIL  ${c.name.padEnd(30)} ${errs.join('; ')}`); fail++; }
  else {
    const auto = shouldAutoAdd(t, 'fake-account-id');
    console.log(`  PASS  ${c.name.padEnd(30)} Rs${String(t.amount).padEnd(7)} ${t.direction.padEnd(6)} x${t.accountLast4 ?? '----'} "${t.merchant ?? '-'}" cat=${inferCategory(t.merchant) ?? '-'} conf=${t.confidence} ${auto ? 'AUTO' : 'inbox'} [${t.rule}] ${t.occurredOn}`);
    pass++;
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
