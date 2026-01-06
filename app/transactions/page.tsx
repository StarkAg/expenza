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

    // Check if it's a refund (note starts with "Refund:")
    const isRefund = expenseToDelete.note && expenseToDelete.note.toString().startsWith('Refund:');

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
          
          // If it was a refund (credited), we need to debit (subtract) to reverse
          // If it was an expense (debited), we need to credit (add) to reverse
          const reversedBalance = isRefund 
            ? currentBalance - expenseAmount  // Debit to reverse refund
            : currentBalance + expenseAmount; // Credit to reverse expense
          
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

  const handleDownloadReport = async () => {
    if (!username) return;
    
    hapticFeedback('light');
    
    try {
      // Fetch the HTML report
      const response = await fetch(`/api/report?username=${encodeURIComponent(username)}`);
      const html = await response.text();
      
      // Create a hidden iframe to render the HTML
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      
      document.body.appendChild(iframe);
      
      // Write HTML to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }
      
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      // Wait for iframe to fully load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        setTimeout(resolve, 1000); // Fallback timeout
      });
      
      // Wait for styles and images to load
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Get the body element from iframe
      const iframeBody = iframeDoc.body;
      if (!iframeBody) {
        throw new Error('Could not access iframe body');
      }
      
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default;
      
      // Convert HTML to canvas using html2canvas
      const canvas = await html2canvas(iframeBody, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        windowWidth: 794,
        windowHeight: 1123,
      });
      
      // Create PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '-');
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `Expenses_${dateStr}_${timeStr}@CashBook.pdf`;
      
      // Download the PDF
      pdf.save(filename);
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
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
              Downloads PDF report directly to your device.
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

