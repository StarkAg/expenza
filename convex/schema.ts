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
  })
    .index("by_username", ["username"])
    .index("by_username_and_date", ["username", "date"])
    .index("by_username_and_sms_ref", ["username", "sms_ref"]),
  categories: defineTable({
    username,
    name: v.string(),
    color: v.string(),
    display_order: v.number(),
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
