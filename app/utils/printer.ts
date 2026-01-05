// Printer expense tracking utilities with Supabase sync support
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PrinterExpense {
  id: string;
  date: string;
  pages: number;
  type: 'black_white' | 'color';
  cost: number;
  expenseId?: string; // Link to original expense if added from transactions
  created_at: string;
}

export interface CartridgeReplacement {
  id: string;
  date: string;
  type: 'black_white' | 'color';
  cost: number;
  created_at: string;
}

// Get Supabase client
function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Get username from localStorage
function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

// Sync printer expenses to Supabase
async function syncPrinterExpensesToSupabase(expenses: PrinterExpense[], username: string) {
  const supabase = getSupabaseClient();
  if (!supabase || !navigator.onLine) return;

  try {
    // Delete existing expenses for this user
    await supabase.from('printer_expenses').delete().eq('username', username);

    // Insert new expenses
    const expensesToInsert = expenses.map((exp) => ({
      username,
      date: exp.date,
      pages: exp.pages,
      type: exp.type,
      cost: exp.cost,
      expense_id: exp.expenseId || null,
    }));

    if (expensesToInsert.length > 0) {
      await supabase.from('printer_expenses').insert(expensesToInsert);
    }
  } catch (error) {
    console.error('Error syncing printer expenses to Supabase:', error);
  }
}

// Sync cartridges to Supabase
async function syncCartridgesToSupabase(cartridges: CartridgeReplacement[], username: string) {
  const supabase = getSupabaseClient();
  if (!supabase || !navigator.onLine) return;

  try {
    // Delete existing cartridges for this user
    await supabase.from('printer_cartridges').delete().eq('username', username);

    // Insert new cartridges
    const cartridgesToInsert = cartridges.map((cart) => ({
      username,
      date: cart.date,
      type: cart.type,
      cost: cart.cost,
    }));

    if (cartridgesToInsert.length > 0) {
      await supabase.from('printer_cartridges').insert(cartridgesToInsert);
    }
  } catch (error) {
    console.error('Error syncing cartridges to Supabase:', error);
  }
}

// Get printer expenses from Supabase (with localStorage fallback)
export async function getPrinterExpenses(): Promise<PrinterExpense[]> {
  const username = getUsername();
  if (!username) return [];

  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('printer_expenses')
        .select('*')
        .eq('username', username)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Sync to localStorage for offline access
        const expenses = data.map((exp) => ({
          id: exp.id,
          date: exp.date,
          pages: exp.pages,
          type: exp.type,
          cost: parseFloat(exp.cost.toString()),
          expenseId: exp.expense_id || undefined,
          created_at: exp.created_at,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(`printer_expenses_${username}`, JSON.stringify(expenses));
        }
        return expenses;
      }
    } catch (error) {
      console.error('Error fetching printer expenses from Supabase:', error);
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`printer_expenses_${username}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing stored printer expenses:', error);
      }
    }
  }

  return [];
}

// Get cartridges from Supabase (with localStorage fallback)
export async function getCartridgeReplacements(): Promise<CartridgeReplacement[]> {
  const username = getUsername();
  if (!username) return [];

  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('printer_cartridges')
        .select('*')
        .eq('username', username)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Sync to localStorage for offline access
        const cartridges = data.map((cart) => ({
          id: cart.id,
          date: cart.date,
          type: cart.type,
          cost: parseFloat(cart.cost.toString()),
          created_at: cart.created_at,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(`printer_cartridges_${username}`, JSON.stringify(cartridges));
        }
        return cartridges;
      }
    } catch (error) {
      console.error('Error fetching cartridges from Supabase:', error);
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`printer_cartridges_${username}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing stored cartridges:', error);
      }
    }
  }

  return [];
}

export async function addPrinterExpense(expense: Omit<PrinterExpense, 'id' | 'created_at'>): Promise<void> {
  const username = getUsername();
  if (!username) return;

  const supabase = getSupabaseClient();
  const newExpense: PrinterExpense = {
    ...expense,
    id: `printer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  // Save to localStorage immediately for instant UI update
  if (typeof window !== 'undefined') {
    const expenses = await getPrinterExpenses();
    expenses.push(newExpense);
    localStorage.setItem(`printer_expenses_${username}`, JSON.stringify(expenses));
  }

  // Sync to Supabase
  if (supabase && navigator.onLine) {
    try {
      const { error } = await supabase.from('printer_expenses').insert({
        username,
        date: expense.date,
        pages: expense.pages,
        type: expense.type,
        cost: expense.cost,
        expense_id: expense.expenseId || null,
      });

      if (error) throw error;

      // Reload from Supabase to get the real ID
      const updated = await getPrinterExpenses();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`printer_expenses_${username}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error adding printer expense to Supabase:', error);
    }
  }
}

export async function removePrinterExpense(id: string): Promise<void> {
  const username = getUsername();
  if (!username) return;

  // Remove from localStorage immediately
  if (typeof window !== 'undefined') {
    const expenses = await getPrinterExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    localStorage.setItem(`printer_expenses_${username}`, JSON.stringify(filtered));
  }

  // Remove from Supabase
  const supabase = getSupabaseClient();
  if (supabase && navigator.onLine) {
    try {
      await supabase.from('printer_expenses').delete().eq('id', id).eq('username', username);
    } catch (error) {
      console.error('Error removing printer expense from Supabase:', error);
    }
  }
}

export async function addCartridgeReplacement(
  replacement: Omit<CartridgeReplacement, 'id' | 'created_at'>
): Promise<void> {
  const username = getUsername();
  if (!username) return;

  const supabase = getSupabaseClient();
  const newReplacement: CartridgeReplacement = {
    ...replacement,
    id: `cartridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  // Save to localStorage immediately for instant UI update
  if (typeof window !== 'undefined') {
    const cartridges = await getCartridgeReplacements();
    cartridges.push(newReplacement);
    localStorage.setItem(`printer_cartridges_${username}`, JSON.stringify(cartridges));
  }

  // Sync to Supabase
  if (supabase && navigator.onLine) {
    try {
      const { error } = await supabase.from('printer_cartridges').insert({
        username,
        date: replacement.date,
        type: replacement.type,
        cost: replacement.cost,
      });

      if (error) throw error;

      // Reload from Supabase to get the real ID
      const updated = await getCartridgeReplacements();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`printer_cartridges_${username}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error adding cartridge to Supabase:', error);
    }
  }
}

export async function removeCartridgeReplacement(id: string): Promise<void> {
  const username = getUsername();
  if (!username) return;

  // Remove from localStorage immediately
  if (typeof window !== 'undefined') {
    const cartridges = await getCartridgeReplacements();
    const filtered = cartridges.filter((r) => r.id !== id);
    localStorage.setItem(`printer_cartridges_${username}`, JSON.stringify(filtered));
  }

  // Remove from Supabase
  const supabase = getSupabaseClient();
  if (supabase && navigator.onLine) {
    try {
      await supabase.from('printer_cartridges').delete().eq('id', id).eq('username', username);
    } catch (error) {
      console.error('Error removing cartridge from Supabase:', error);
    }
  }
}

export async function calculateCostPerPage(type: 'black_white' | 'color'): Promise<number> {
  // Get all cartridge replacements of this type
  const replacements = await getCartridgeReplacements();
  const filteredReplacements = replacements.filter((r) => r.type === type);

  if (filteredReplacements.length === 0) return 0;

  // Get total cost of all cartridges
  const totalCartridgeCost = filteredReplacements.reduce((sum, r) => sum + r.cost, 0);

  // Get total pages printed of this type
  const expenses = await getPrinterExpenses();
  const filteredExpenses = expenses.filter((e) => e.type === type);

  if (filteredExpenses.length === 0) return 0;

  const totalPages = filteredExpenses.reduce((sum, e) => sum + e.pages, 0);

  // Cost per page = total cartridge cost / total pages printed
  return totalPages > 0 ? totalCartridgeCost / totalPages : 0;
}

export async function getTotalPages(type?: 'black_white' | 'color'): Promise<number> {
  const expenses = await getPrinterExpenses();
  const filtered = type ? expenses.filter((e) => e.type === type) : expenses;
  return filtered.reduce((sum, e) => sum + e.pages, 0);
}

export async function getTotalCost(type?: 'black_white' | 'color'): Promise<number> {
  const expenses = await getPrinterExpenses();
  const filtered = type ? expenses.filter((e) => e.type === type) : expenses;
  return filtered.reduce((sum, e) => sum + e.cost, 0);
}
