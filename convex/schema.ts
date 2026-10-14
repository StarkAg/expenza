import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const username = v.string();

export default defineSchema({
  accounts: defineTable({
    username,
    name: v.string(),
    type: v.union(v.literal("bank"), v.literal("credit_card")),
    balance: v.number(),
    last4: v.optional(v.string()),
  }).index("by_username", ["username"]),
  expenses: defineTable({
    username,
    amount: v.number(),
    category: v.string(),
    note: v.optional(v.string()),
    date: v.string(),
    account_id: v.optional(v.id("accounts")),
    source: v.optional(v.string()),
    sms_ref: v.optional(v.string()),
    // Absent means debit. Every row written before income tracking existed is
    // a debit, so leaving this optional keeps them valid and correctly summed.
    direction: v.optional(v.union(v.literal("debit"), v.literal("credit"))),
  })
    .index("by_username", ["username"])
    .index("by_username_and_date", ["username", "date"])
    .index("by_username_and_sms_ref", ["username", "sms_ref"]),
  categories: defineTable({
    username,
    name: v.string(),
    color: v.string(),
    display_order: v.number(),
    // Absent means "expense" -- keeps every pre-existing category valid.
    kind: v.optional(v.union(v.literal("expense"), v.literal("income"))),
  }).index("by_username", ["username"]),

  // Remembers the category chosen for a payee so the next message from the
  // same one is categorised without asking again.
  merchant_categories: defineTable({
    username,
    merchant_key: v.string(), // normalised: lowercased, punctuation stripped
    merchant_label: v.optional(v.string()), // what it looked like when saved
    category: v.string(),
    direction: v.optional(v.union(v.literal("debit"), v.literal("credit"))),
  })
    .index("by_username", ["username"])
    .index("by_username_and_merchant_key", ["username", "merchant_key"]),

  // Money the user has borrowed. Interest is never stored: it is simple
  // interest derived from principal, daily rate, and elapsed days at read
  // time, so editing the rate or the start date corrects history immediately
  // and there is no scheduled job to double-post or miss a day.
  loans: defineTable({
    username,
    name: v.string(),
    principal: v.number(),
    daily_rate_percent: v.number(), // percent of principal per day
    started_on: v.string(), // YYYY-MM-DD
    closed_on: v.optional(v.string()), // accrual stops on this date
    note: v.optional(v.string()),
  }).index("by_username", ["username"]),
  fixed_expenses: defineTable({
    username,
    name: v.string(),
    amount: v.number(),
    category: v.string(),
    day_of_month: v.number(),
    account_id: v.optional(v.id("accounts")),
    is_active: v.boolean(),
    note: v.optional(v.string()),
  }).index("by_username", ["username"]),
  printer_expenses: defineTable({
    username,
    date: v.string(),
    pages: v.number(),
    type: v.union(v.literal("black_white"), v.literal("color")),
    cost: v.number(),
    expense_id: v.optional(v.id("expenses")),
  }).index("by_username", ["username"]),
  printer_cartridges: defineTable({
    username,
    date: v.string(),
    type: v.union(v.literal("black_white"), v.literal("color")),
    cost: v.number(),
  }).index("by_username", ["username"]),
  ingest_tokens: defineTable({
    username,
    label: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("other")),
    token_hash: v.string(),
    token_hint: v.string(),
    // A single account-level connection is intentionally reusable across
    // iPhone Shortcuts, a Mac, and any future sender integration.
    connection_scope: v.optional(v.literal("account")),
    connection_token: v.optional(v.string()),
    last_used_at: v.optional(v.string()),
    revoked_at: v.optional(v.string()),
  })
    .index("by_username", ["username"])
    .index("by_token_hash", ["token_hash"]),
  pending_transactions: defineTable({
    username,
    amount: v.number(),
    direction: v.union(v.literal("debit"), v.literal("credit")),
    merchant: v.optional(v.string()),
    account_last4: v.optional(v.string()),
    occurred_on: v.string(),
    suggested_category: v.optional(v.string()),
    matched_account_id: v.optional(v.id("accounts")),
    confidence: v.number(),
    source: v.string(),
    sender: v.optional(v.string()),
    sms_ref: v.string(),
    raw_text: v.optional(v.string()),
    parser_rule: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("dismissed")),
    expense_id: v.optional(v.id("expenses")),
    resolved_at: v.optional(v.string()),
  })
    .index("by_username", ["username"])
    .index("by_username_and_status", ["username", "status"])
    .index("by_username_and_sms_ref", ["username", "sms_ref"]),
  skipped_messages: defineTable({
    username,
    sender: v.optional(v.string()),
    sms_ref: v.optional(v.string()),
    raw_text: v.optional(v.string()),
    reason: v.string(),
    source: v.optional(v.string()),
  }).index("by_username", ["username"]),
});
