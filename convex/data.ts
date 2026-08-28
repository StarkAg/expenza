import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const table = v.union(
  v.literal("accounts"),
  v.literal("expenses"),
  v.literal("categories"),
  v.literal("fixed_expenses"),
  v.literal("printer_expenses"),
  v.literal("printer_cartridges"),
  v.literal("ingest_tokens"),
  v.literal("pending_transactions"),
  v.literal("skipped_messages"),
);

type TableName = typeof table.type;

function toLegacy<T extends { _id: string; _creationTime: number }>(document: T) {
  const { _id, _creationTime, ...fields } = document;
  return {
    ...fields,
    id: _id,
    created_at: new Date(_creationTime).toISOString(),
    updated_at: new Date(_creationTime).toISOString(),
  };
}

function normalizeValues(tableName: TableName, input: Record<string, unknown>) {
  const values = Object.fromEntries(
    Object.entries(input).filter(([key, value]) =>
      value !== null && value !== undefined && !["id", "created_at", "updated_at"].includes(key),
    ),
  ) as Record<string, unknown>;
  if (["expenses", "fixed_expenses"].includes(tableName) && values.amount !== undefined) values.amount = Number(values.amount);
  if (tableName === "accounts" && values.balance !== undefined) values.balance = Number(values.balance);
  if (tableName === "printer_expenses") {
    if (values.pages !== undefined) values.pages = Number(values.pages);
    if (values.cost !== undefined) values.cost = Number(values.cost);
  }
  if (tableName === "printer_cartridges" && values.cost !== undefined) values.cost = Number(values.cost);
  if (tableName === "categories" && values.display_order !== undefined) values.display_order = Number(values.display_order);
  if (tableName === "fixed_expenses" && values.day_of_month !== undefined) values.day_of_month = Number(values.day_of_month);
  return values;
}

async function listForUser(ctx: Parameters<typeof query>[0] extends never ? never : any, tableName: TableName, username: string) {
  return await ctx.db.query(tableName).withIndex("by_username", (index: any) => index.eq("username", username)).collect();
}

export const list = query({
  args: { table, username: v.string() },
  handler: async (ctx, args) => (await listForUser(ctx, args.table, args.username)).map(toLegacy),
});

export const findIngestToken = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("ingest_tokens")
      .withIndex("by_token_hash", (index) => index.eq("token_hash", args.tokenHash))
      .unique();
    return document ? toLegacy(document) : null;
  },
});

export const insert = mutation({
  args: { table, values: v.any() },
  handler: async (ctx, args) => {
    const values = normalizeValues(args.table, args.values as Record<string, unknown>);
    if (!values.username || typeof values.username !== "string") throw new Error("username is required");
    const id = await ctx.db.insert(args.table, values as never);
    const document = await ctx.db.get(args.table, id);
    return document ? toLegacy(document as never) : null;
  },
});

export const update = mutation({
  args: { table, id: v.string(), username: v.string(), values: v.any() },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.table, args.id as never);
    if (!document || document.username !== args.username) throw new Error("Record not found");
    const { username: _username, ...values } = normalizeValues(args.table, args.values as Record<string, unknown>);
    await ctx.db.patch(args.table, args.id as never, values as never);
    const updated = await ctx.db.get(args.table, args.id as never);
    return updated ? toLegacy(updated as never) : null;
  },
});

export const remove = mutation({
  args: { table, id: v.string(), username: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.table, args.id as never);
    if (!document || document.username !== args.username) throw new Error("Record not found");
    await ctx.db.delete(args.table, args.id as never);
    return null;
  },
});
