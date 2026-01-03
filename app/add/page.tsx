'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { hapticFeedback } from '../utils/haptics';

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

export default function AddExpensePage() {
  const router = useRouter();
  const { supabase, username } = useSupabase();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !amount || parseFloat(amount) <= 0) return;

    hapticFeedback('medium');
    setLoading(true);

    const expenseData = {
      username: username,
      amount: parseFloat(amount).toFixed(2),
      category,
      note: note.trim() || null,
      date,
    };

    try {
      // Check if online
      if (typeof window !== 'undefined' && navigator.onLine) {
        const { error } = await supabase.from('expenses').insert(expenseData);
        if (error) throw error;
      } else if (typeof window !== 'undefined') {
        // Store offline for later sync
        const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
        pending.push(expenseData);
        localStorage.setItem('pendingExpenses', JSON.stringify(pending));
      }

      // Reset form
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);

      hapticFeedback('light');
      router.push('/');
    } catch (error) {
      console.error('Error adding expense:', error);
      // Fallback to offline storage
      if (typeof window !== 'undefined') {
        const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
        pending.push(expenseData);
        localStorage.setItem('pendingExpenses', JSON.stringify(pending));
      }
      
      // Reset form anyway
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      hapticFeedback('light');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-6">
            Add Expense
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 bg-white dark:bg-black text-ios-title-2 text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

