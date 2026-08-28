'use client';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

type TableName =
  | 'accounts'
  | 'expenses'
  | 'categories'
  | 'fixed_expenses'
  | 'printer_expenses'
  | 'printer_cartridges'
  | 'ingest_tokens'
  | 'pending_transactions'
  | 'skipped_messages';

type Filter = { operator: 'eq' | 'gte' | 'lte' | 'in' | 'like'; field: string; value: unknown };
type Sort = { field: string; ascending: boolean };
type Result<T = any> = { data: T; error: Error | null; count?: number | null };

function client() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
  return new ConvexHttpClient(url);
}

function dispatchDataChange(table: TableName) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('convex-data-change', { detail: { table } }));
  }
}

class ConvexTableBuilder<T = Record<string, any>[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private sort: Sort | null = null;
  private limitValue: number | null = null;
  private selectFields: string | null = null;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: unknown = null;
  private wantsSingle = false;

  constructor(private readonly table: TableName) {}

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  insert(values: unknown) {
    this.operation = 'insert';
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ operator: 'eq', field, value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ operator: 'gte', field, value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ operator: 'lte', field, value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ operator: 'in', field, value });
    return this;
  }

  like(field: string, value: string) {
    this.filters.push({ operator: 'like', field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sort = { field, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single(): ConvexTableBuilder<Record<string, any> | null> {
    this.wantsSingle = true;
    return this as unknown as ConvexTableBuilder<Record<string, any> | null>;
  }

  maybeSingle(): ConvexTableBuilder<Record<string, any> | null> {
    this.wantsSingle = true;
    return this as unknown as ConvexTableBuilder<Record<string, any> | null>;
  }

  then<TResult1 = Result<T>, TResult2 = never>(
    onfulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private username() {
    const username = this.filters.find((filter) => filter.field === 'username' && filter.operator === 'eq')?.value;
    if (typeof username !== 'string' || !username) throw new Error('A username filter is required');
    return username;
  }

  private rowsMatch(rows: Record<string, unknown>[]) {
    const filtered = rows.filter((row) => this.filters.every((filter) => {
      const value = row[filter.field];
      if (filter.operator === 'eq') return value === filter.value;
      if (filter.operator === 'in') return Array.isArray(filter.value) && filter.value.includes(value);
      if (filter.operator === 'gte') return String(value ?? '') >= String(filter.value);
      if (filter.operator === 'like') return String(value ?? '').includes(String(filter.value).replaceAll('%', ''));
      return String(value ?? '') <= String(filter.value);
    }));
    if (this.sort) {
      const { field, ascending } = this.sort;
      filtered.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (ascending ? 1 : -1));
    }
    return this.limitValue === null ? filtered : filtered.slice(0, this.limitValue);
  }

  private selectProjection(row: Record<string, unknown>) {
    if (!this.selectFields || this.selectFields === '*') return row;
    const picked: Record<string, unknown> = {};
    for (const name of this.selectFields.split(',').map((field) => field.trim())) picked[name] = row[name];
    return picked;
  }

  private async execute(): Promise<Result<T>> {
    try {
      const username = this.username();
      if (this.operation === 'select') {
        const rows = await client().query(api.data.list, { table: this.table, username }) as Record<string, unknown>[];
        const data = this.rowsMatch(rows).map((row) => this.selectProjection(row));
        return { data: (this.wantsSingle ? (data[0] ?? null) : data) as T, error: null, count: data.length };
      }

      if (this.operation === 'insert') {
        const values = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = await Promise.all(values.map((value) => client().mutation(api.data.insert, {
          table: this.table,
          values: value,
        })));
        dispatchDataChange(this.table);
        const data = inserted.map((row) => this.selectProjection(row as Record<string, unknown>));
        return { data: (this.wantsSingle ? (data[0] ?? null) : data) as T, error: null };
      }

      const id = this.filters.find((filter) => filter.field === 'id' && filter.operator === 'eq')?.value;
      if (typeof id !== 'string') throw new Error('An id filter is required for this operation');
      if (this.operation === 'update') {
        const data = await client().mutation(api.data.update, { table: this.table, id, username, values: this.payload });
        dispatchDataChange(this.table);
        return { data: (this.wantsSingle ? data : [data]) as T, error: null };
      }
      await client().mutation(api.data.remove, { table: this.table, id, username });
      dispatchDataChange(this.table);
      return { data: null as T, error: null };
    } catch (error) {
      return { data: (this.wantsSingle ? null : []) as T, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}

type ChannelHandler = () => void;

class ConvexChannel {
  private handlers: ChannelHandler[] = [];
  private listener: (() => void) | null = null;

  on(_event: string, _config: unknown, handler: ChannelHandler) {
    this.handlers.push(handler);
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    this.listener = () => this.handlers.forEach((handler) => handler());
    window.addEventListener('convex-data-change', this.listener);
    callback?.('SUBSCRIBED');
    return this;
  }

  dispose() {
    if (this.listener) window.removeEventListener('convex-data-change', this.listener);
  }
}

export type ConvexDatabase = {
  from: (table: TableName) => ConvexTableBuilder;
  channel: (_name: string) => ConvexChannel;
  removeChannel: (channel: ConvexChannel) => void;
};

export function createConvexDatabase(): ConvexDatabase {
  return {
    from: (table) => new ConvexTableBuilder(table),
    channel: () => new ConvexChannel(),
    removeChannel: (channel) => channel.dispose(),
  };
}
