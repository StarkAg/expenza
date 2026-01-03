'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';

export default function StatsPage() {
  const { supabase, username } = useSupabase();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    if (!username) return;

    loadExpenses();
  }, [username, selectedMonth, supabase]);

  const loadExpenses = async () => {
    if (!username) return;

    try {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('username', username)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthlyTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount);
  });

  const previousMonth = subMonths(selectedMonth, 1);
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });

  return (
    <div className="flex flex-col h-screen bg-ios-gray-50 dark:bg-ios-gray-900">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          <h1 className="text-ios-large-title text-ios-gray-900 dark:text-ios-gray-50 mb-6">
            Statistics
          </h1>

          <div className="mb-6">
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
              className="px-4 py-2 bg-white dark:bg-ios-gray-800 text-ios-body text-ios-gray-900 dark:text-ios-gray-50 rounded-ios border border-ios-gray-200 dark:border-ios-gray-700"
            />
          </div>

          <div className="bg-white dark:bg-ios-gray-800 rounded-ios-lg p-4 shadow-ios mb-6">
            <p className="text-ios-caption-1 text-ios-gray-600 dark:text-ios-gray-400 mb-1">
              Total for {format(selectedMonth, 'MMMM yyyy')}
            </p>
            <p className="text-ios-title-1 text-ios-gray-900 dark:text-ios-gray-50">
              ₹{monthlyTotal.toFixed(2)}
            </p>
          </div>

          {Object.keys(categoryTotals).length > 0 && (
            <div className="mb-6">
              <h2 className="text-ios-title-3 text-ios-gray-900 dark:text-ios-gray-50 mb-3">
                By Category
              </h2>
              <div className="space-y-2">
                {Object.entries(categoryTotals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => {
                    const percentage = (amount / monthlyTotal) * 100;
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-ios-body text-ios-gray-900 dark:text-ios-gray-50">
                            {category}
                          </span>
                          <span className="text-ios-body font-semibold text-ios-gray-900 dark:text-ios-gray-50">
                            ₹{amount.toFixed(2)} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-ios-gray-200 dark:bg-ios-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ios-blue rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <p className="text-ios-body text-ios-gray-600 dark:text-ios-gray-400">
                Loading...
              </p>
            </div>
          )}

          {!loading && expenses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-ios-body text-ios-gray-600 dark:text-ios-gray-400">
                No expenses for this month.
              </p>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

