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
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // If no username after loading, redirect to auth
    if (!username) {
      router.push('/auth');
      return;
    }

    // Load expenses and accounts once username is available
    loadExpenses();
    loadAccounts();

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

  const loadAccounts = async () => {
    if (!username) return;

    try {
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
    }
  };

  const handleDelete = async (id: string) => {
    if (!username) return;

    // Find the expense to get account_id and amount
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete) return;

    // Optimistic update
    const previousExpenses = expenses;
    setExpenses(expenses.filter((e) => e.id !== id));

    try {
      // Reverse payment if expense had an account
      if (expenseToDelete.account_id) {
        // Fetch current account balance from database
        const { data: accountData, error: fetchError } = await supabase
          .from('accounts')
          .select('balance, type')
          .eq('id', expenseToDelete.account_id)
          .eq('username', username)
          .single();
        
        if (!fetchError && accountData && accountData.type === 'bank') {
          const expenseAmount = parseFloat(expenseToDelete.amount);
          const currentBalance = parseFloat(accountData.balance);
          const reversedBalance = currentBalance + expenseAmount; // Credit back
          
          const { error: accountError } = await supabase
            .from('accounts')
            .update({ balance: reversedBalance })
            .eq('id', expenseToDelete.account_id)
            .eq('username', username);
          if (accountError) {
            console.error('Error reversing payment:', accountError);
          } else {
            // Reload accounts to update the balance in UI
            await loadAccounts();
          }
        }
      }
      
      // Delete the expense
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

  const handleDownloadReport = () => {
    if (!username) return;
    
    hapticFeedback('light');
    const reportUrl = `/api/report?username=${encodeURIComponent(username)}`;
    window.open(reportUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 lg:px-6 pt-4 pb-32 sm:pb-36">
          {/* Download Report Button */}
          <div className="mb-4">
            <button
              onClick={handleDownloadReport}
              disabled={expensesLoading || expenses.length === 0}
              className="w-full px-4 py-3 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Expense Report</span>
            </button>
            <p className="text-ios-caption-1 text-black/60 dark:text-white/60 text-center mt-2">
              Opens in a new window. Use Print → Save as PDF to download.
            </p>
          </div>

          <ExpenseList
            expenses={expenses}
            loading={expensesLoading}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

