'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import ExpenseList from '../components/ExpenseList';
import { hapticFeedback } from '../utils/haptics';

export default function TransactionsPage() {
  const router = useRouter();
  const { supabase, username, loading } = useSupabase();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // If no username after loading, redirect to auth
    if (!username) {
      router.push('/auth');
      return;
    }

    // Load expenses once username is available
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

  const handleEdit = (expense: any) => {
    hapticFeedback('light');
    // Store expense data in sessionStorage for edit page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('editExpense', JSON.stringify(expense));
      router.push(`/add?edit=true`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-2 sm:px-3 md:px-4 lg:px-4 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-4 sm:mb-6">
            Transactions
          </h1>

          <ExpenseList expenses={expenses} loading={expensesLoading} onDelete={handleDelete} onEdit={handleEdit} />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

