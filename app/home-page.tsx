'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from './providers';
import BottomNav from './components/BottomNav';
import StatsCard from './components/StatsCard';
import AccountsList from './components/AccountsList';
import FixedExpensesList from './components/FixedExpensesList';
import ExpenseLineChart from './components/ExpenseLineChart';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function HomePage() {
  const router = useRouter();
  const { supabase, username, loading } = useSupabase();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [fixedExpensesLoading, setFixedExpensesLoading] = useState(true);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [categorySummary, setCategorySummary] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([]);

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

    // Subscribe to real-time changes
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

      // Calculate totals
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const daily = expensesData
        .filter((e) => {
          const expenseDate = new Date(e.date);
          return expenseDate >= todayStart && expenseDate <= todayEnd;
        })
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      const monthly = expensesData
        .filter((e) => {
          const expenseDate = new Date(e.date);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        })
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      setDailyTotal(daily);
      setMonthlyTotal(monthly);

      // Calculate category summary
      const categories: Record<string, number> = {};
      expensesData.forEach((e) => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.amount);
      });
      setCategorySummary(categories);

      // Calculate monthly chart data (last 6 months)
      const chartDataPoints: { date: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthTotal = expensesData
          .filter((e) => {
            const expenseDate = new Date(e.date);
            return expenseDate >= monthStart && expenseDate <= monthEnd;
          })
          .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        chartDataPoints.push({
          date: format(monthDate, 'MMM'),
          amount: monthTotal,
        });
      }
      setChartData(chartDataPoints);
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
        console.error('Error fetching accounts:', error);
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
        .order('day_of_month', { ascending: true });

      if (error) {
        console.error('Error fetching fixed expenses:', error);
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


  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-2 sm:px-3 md:px-4 lg:px-4 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <StatsCard label="Today" amount={dailyTotal} />
            <StatsCard label="This Month" amount={monthlyTotal} />
          </div>

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

          {Object.keys(categorySummary).length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-ios-title-3 text-black dark:text-white mb-2 sm:mb-3">
                By Category
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {Object.entries(categorySummary)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex justify-between items-center p-2 sm:p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
                    >
                      <span className="text-ios-body text-black dark:text-white truncate mr-2">
                        {category}
                      </span>
                      <span className="text-ios-body font-semibold text-black dark:text-white whitespace-nowrap">
                        ₹{amount.toFixed(2)}
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

