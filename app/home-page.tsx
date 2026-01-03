'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from './providers';
import BottomNav from './components/BottomNav';
import ExpenseList from './components/ExpenseList';
import StatsCard from './components/StatsCard';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export default function HomePage() {
  const router = useRouter();
  const { supabase, username, loading } = useSupabase();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [categorySummary, setCategorySummary] = useState<Record<string, number>>({});

  useEffect(() => {
    if (loading) return;
    
    if (!username) {
      router.push('/auth');
      return;
    }

    loadExpenses();

    // Subscribe to real-time changes
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username, supabase, loading, router]);

  const loadExpenses = async () => {
    if (!username) return;

    try {
      let expensesData: any[] = [];

      if (typeof window !== 'undefined' && navigator.onLine) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('username', username)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        expensesData = data || [];
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
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!username) return;

    // Optimistic update
    const previousExpenses = expenses;
    setExpenses(expenses.filter((e) => e.id !== id));

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('username', username);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting expense:', error);
      setExpenses(previousExpenses);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-ios-gray-50 dark:bg-ios-gray-900">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          <h1 className="text-ios-large-title text-ios-gray-900 dark:text-ios-gray-50 mb-6">
            Expenses
          </h1>

          <div className="space-y-4 mb-6">
            <StatsCard label="Today" amount={dailyTotal} />
            <StatsCard label="This Month" amount={monthlyTotal} />
          </div>

          {Object.keys(categorySummary).length > 0 && (
            <div className="mb-6">
              <h2 className="text-ios-title-3 text-ios-gray-900 dark:text-ios-gray-50 mb-3">
                By Category
              </h2>
              <div className="space-y-2">
                {Object.entries(categorySummary)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex justify-between items-center p-3 bg-white dark:bg-ios-gray-800 rounded-ios"
                    >
                      <span className="text-ios-body text-ios-gray-900 dark:text-ios-gray-50">
                        {category}
                      </span>
                      <span className="text-ios-body font-semibold text-ios-gray-900 dark:text-ios-gray-50">
                        ₹{amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-ios-title-3 text-ios-gray-900 dark:text-ios-gray-50 mb-3">
              Recent
            </h2>
            <ExpenseList expenses={expenses} loading={expensesLoading} onDelete={handleDelete} />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

