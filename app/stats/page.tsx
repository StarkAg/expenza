'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import AccountsList from '../components/AccountsList';
import FixedExpensesList from '../components/FixedExpensesList';
import ExpenseLineChart from '../components/ExpenseLineChart';
import { formatCurrency } from '../utils/currency';
import { getCategoryColor } from '../utils/categories';
import { startOfMonth, endOfMonth, format, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns';

export default function StatsPage() {
  const router = useRouter();
  const { supabase, username, loading } = useSupabase();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [fixedExpensesLoading, setFixedExpensesLoading] = useState(true);

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // If no username after loading, redirect to auth
    if (!username) {
      router.push('/auth');
      return;
    }

    // Load data once username is available
    loadExpenses();
    loadAccounts();
    loadFixedExpenses();

    // Subscribe to real-time changes for expenses
    const expensesChannel = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `username=eq.${username}`,
        },
        () => {
          loadExpenses();
        }
      )
      .subscribe();

    // Subscribe to real-time changes for accounts
    const accountsChannel = supabase
      .channel('accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `username=eq.${username}`,
        },
        () => {
          loadAccounts();
        }
      )
      .subscribe();

    // Subscribe to real-time changes for fixed expenses
    const fixedExpensesChannel = supabase
      .channel('fixed-expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fixed_expenses',
          filter: `username=eq.${username}`,
        },
        () => {
          loadFixedExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(fixedExpensesChannel);
    };
  }, [username, supabase, loading, router]);

  const loadExpenses = async () => {
    if (!username) {
      setExpensesLoading(false);
      return;
    }

    try {
      setExpensesLoading(true);
      let expensesData: any[] = [];

      if (typeof window !== 'undefined' && navigator.onLine) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('username', username)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching expenses:', error);
          // Fall back to localStorage on error
          const cached = localStorage.getItem(`expenses_${username}`);
          if (cached) {
            expensesData = JSON.parse(cached);
          }
        } else {
          expensesData = data || [];
        }
      } else if (typeof window !== 'undefined') {
        // Load from localStorage when offline
        const cached = localStorage.getItem(`expenses_${username}`);
        if (cached) {
          expensesData = JSON.parse(cached);
        }
      }

      // Merge with pending expenses
      if (typeof window !== 'undefined') {
        const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
        const pendingForUser = pending.filter((e: any) => e.username === username);
        expensesData = [...expensesData, ...pendingForUser].sort((a, b) => {
          const dateA = new Date(a.date || a.created_at).getTime();
          const dateB = new Date(b.date || b.created_at).getTime();
          return dateB - dateA;
        });

        // Cache for offline use
        if (navigator.onLine) {
          localStorage.setItem(`expenses_${username}`, JSON.stringify(expensesData));
        }
      }

      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setExpensesLoading(false);
    }
  };

  const loadAccounts = async () => {
    if (!username) {
      setAccountsLoading(false);
      return;
    }

    try {
      setAccountsLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('username', username)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading accounts:', error);
        setAccounts([]);
      } else {
        setAccounts(data || []);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadFixedExpenses = async () => {
    if (!username) {
      setFixedExpensesLoading(false);
      return;
    }

    try {
      setFixedExpensesLoading(true);
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('username', username)
        .order('day_of_month', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading fixed expenses:', error);
        setFixedExpenses([]);
      } else {
        setFixedExpenses(data || []);
      }
    } catch (error) {
      console.error('Error loading fixed expenses:', error);
      setFixedExpenses([]);
    } finally {
      setFixedExpensesLoading(false);
    }
  };

  // Calculate statistics
  const today = new Date();
  const thisMonth = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);

  const todayExpenses = expenses.filter((exp) => {
    try {
      return isSameDay(parseISO(exp.date), today);
    } catch {
      return false;
    }
  });

  const monthlyExpenses = expenses.filter((exp) => {
    try {
      const expDate = parseISO(exp.date);
      return expDate >= thisMonth && expDate <= thisMonthEnd;
    } catch {
      return false;
    }
  });

  const dailyTotal = todayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);
  const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  // Category summary
  const categorySummary: Record<string, number> = {};
  monthlyExpenses.forEach((exp) => {
    const category = exp.category || 'Other';
    categorySummary[category] = (categorySummary[category] || 0) + parseFloat(exp.amount.toString());
  });

  // Prepare chart data (monthly totals for last 6 months)
  const chartData: { date: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const monthExpenses = expenses.filter((exp) => {
      try {
        const expDate = parseISO(exp.date);
        return expDate >= monthStart && expDate <= monthEnd;
      } catch {
        return false;
      }
    });
    
    const monthTotal = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);
    chartData.push({
      date: format(month, 'MMM yyyy'),
      amount: monthTotal,
    });
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 lg:px-6 pt-4 pb-32 sm:pb-36">
          <AccountsList accounts={accounts} loading={accountsLoading} />
          <FixedExpensesList fixedExpenses={fixedExpenses} loading={fixedExpensesLoading} />
          {chartData.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-ios-title-3 text-black dark:text-white mb-2 sm:mb-3">
                Monthly Expenses
              </h2>
              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
                <ExpenseLineChart data={chartData} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
              <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">Today</p>
              <p className="text-ios-title-2 font-semibold text-black dark:text-white">
                {formatCurrency(dailyTotal)}
              </p>
            </div>
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
              <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">This Month</p>
              <p className="text-ios-title-2 font-semibold text-black dark:text-white">
                {formatCurrency(monthlyTotal)}
              </p>
            </div>
          </div>

          {Object.keys(categorySummary).length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-ios-title-3 text-black dark:text-white mb-2 sm:mb-3">
                Category Breakdown
              </h2>
              <div className="space-y-2">
                {Object.entries(categorySummary)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex justify-between items-center p-3 sm:p-4 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-black/20 dark:border-white/20 flex-shrink-0"
                          style={{ backgroundColor: getCategoryColor(category) }}
                        />
                        <span className="text-ios-body text-black dark:text-white">{category}</span>
                      </div>
                      <span className="text-ios-body font-semibold text-black dark:text-white">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
