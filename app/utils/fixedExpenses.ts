// Utility functions for processing fixed monthly expenses

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

function getSupabaseClient() {
  if (typeof window === 'undefined') return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

export interface FixedExpense {
  id: string;
  username: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  account_id: string | null;
  is_active: boolean;
  note: string | null;
}

/**
 * Process fixed expenses for today - creates expense entries and deducts from bank accounts
 */
export async function processFixedExpensesForToday(): Promise<void> {
  const username = getUsername();
  if (!username) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const today = new Date();
  const dayOfMonth = today.getDate();

  try {
    // Get all active fixed expenses for today
    const { data: fixedExpenses, error: fetchError } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .eq('day_of_month', dayOfMonth);

    if (fetchError) {
      console.error('Error fetching fixed expenses:', fetchError);
      return;
    }

    if (!fixedExpenses || fixedExpenses.length === 0) {
      return; // No fixed expenses for today
    }

    const todayDateStr = today.toISOString().split('T')[0];

    // Check which expenses have already been processed today
    const { data: todayExpenses, error: expensesError } = await supabase
      .from('expenses')
      .select('note')
      .eq('username', username)
      .eq('date', todayDateStr)
      .like('note', '%[Fixed Expense:%');

    if (expensesError) {
      console.error('Error checking existing expenses:', expensesError);
      return;
    }

    const processedIds = new Set<string>();
    if (todayExpenses) {
      todayExpenses.forEach((exp) => {
        // Extract fixed expense ID from note format: "[Fixed Expense: {id}]"
        const match = exp.note?.match(/\[Fixed Expense: ([^\]]+)\]/);
        if (match) {
          processedIds.add(match[1]);
        }
      });
    }

    // Process each fixed expense that hasn't been processed today
    for (const fixedExpense of fixedExpenses) {
      if (processedIds.has(fixedExpense.id)) {
        continue; // Already processed today
      }

      // Create expense entry
      const expenseNote = fixedExpense.note
        ? `${fixedExpense.note} [Fixed Expense: ${fixedExpense.id}]`
        : `[Fixed Expense: ${fixedExpense.id}]`;

      const { data: newExpense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          username: username,
          amount: fixedExpense.amount,
          category: fixedExpense.category,
          note: expenseNote,
          date: todayDateStr,
        })
        .select()
        .single();

      if (expenseError) {
        console.error(`Error creating expense for ${fixedExpense.name}:`, expenseError);
        continue;
      }

      // Deduct from bank account if specified
      if (fixedExpense.account_id) {
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('balance, type')
          .eq('id', fixedExpense.account_id)
          .eq('username', username)
          .single();

        if (accountError) {
          console.error(`Error fetching account for ${fixedExpense.name}:`, accountError);
          continue;
        }

        if (account && account.type === 'bank') {
          const newBalance = parseFloat(account.balance.toString()) - parseFloat(fixedExpense.amount.toString());
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', fixedExpense.account_id)
            .eq('username', username);

          if (updateError) {
            console.error(`Error updating account balance for ${fixedExpense.name}:`, updateError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing fixed expenses:', error);
  }
}

/**
 * Check and process fixed expenses when app loads
 * Uses localStorage to track last check date to avoid multiple runs per day
 */
export function checkAndProcessFixedExpenses(): void {
  if (typeof window === 'undefined') return;

  const lastCheckKey = 'lastFixedExpenseCheck';
  const today = new Date().toISOString().split('T')[0];
  const lastCheck = localStorage.getItem(lastCheckKey);

  // Only process once per day
  if (lastCheck === today) {
    return;
  }

  // Process fixed expenses
  processFixedExpensesForToday().then(() => {
    // Update last check date
    localStorage.setItem(lastCheckKey, today);
  });
}

