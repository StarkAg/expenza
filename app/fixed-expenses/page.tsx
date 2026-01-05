'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import FixedExpensesList from '../components/FixedExpensesList';
import { hapticFeedback } from '../utils/haptics';
import { formatCurrency } from '../utils/currency';
import { getCategoryNames } from '../utils/categories';

export default function FixedExpensesPage() {
  const router = useRouter();
  const { supabase, username, loading: authLoading } = useSupabase();
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [categories, setCategories] = useState<string[]>(getCategoryNames());
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [accountId, setAccountId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadCategories();
    const handleUpdate = () => loadCategories();
    window.addEventListener('categoriesUpdated', handleUpdate);
    return () => window.removeEventListener('categoriesUpdated', handleUpdate);
  }, [username, supabase]);

  // Subscribe to real-time category changes
  useEffect(() => {
    if (!username || !supabase) return;

    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `username=eq.${username}`,
        },
        () => {
          loadCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!username) {
      router.push('/auth');
      return;
    }
    loadFixedExpenses();
    loadAccounts();
  }, [username, authLoading, router]);

  const loadCategories = () => {
    const cats = getCategoryNames();
    setCategories(cats);
    if (cats.length > 0 && !cats.includes(category)) {
      setCategory(cats[0]);
    }
  };

  const loadFixedExpenses = async () => {
    if (!username) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('username', username)
        .order('day_of_month', { ascending: true });

      if (error) throw error;
      setFixedExpenses(data || []);
    } catch (error) {
      console.error('Error loading fixed expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    if (!username) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('username', username)
        .order('name', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name.trim() || !amount || parseFloat(amount) <= 0) return;

    hapticFeedback('medium');
    setLoading(true);

    const expenseData = {
      username: username,
      name: name.trim(),
      amount: parseFloat(amount),
      category,
      day_of_month: parseInt(dayOfMonth),
      account_id: accountId || null,
      is_active: isActive,
      note: note.trim() || null,
    };

    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('fixed_expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)
          .eq('username', username);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixed_expenses').insert(expenseData);
        if (error) throw error;
      }

      setName('');
      setAmount('');
      setCategory(categories[0]);
      setDayOfMonth('1');
      setAccountId('');
      setIsActive(true);
      setNote('');
      setEditingExpense(null);
      setShowForm(false);
      loadFixedExpenses();
      hapticFeedback('light');
    } catch (error) {
      console.error('Error saving fixed expense:', error);
      hapticFeedback('medium');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setName(expense.name);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDayOfMonth(expense.day_of_month.toString());
    setAccountId(expense.account_id || '');
    setIsActive(expense.is_active);
    setNote(expense.note || '');
    setShowForm(true);
    hapticFeedback('light');
  };

  const handleDelete = async (id: string) => {
    if (!username) return;
    if (!confirm('Are you sure you want to delete this fixed expense?')) return;

    hapticFeedback('medium');
    try {
      const { error } = await supabase
        .from('fixed_expenses')
        .delete()
        .eq('id', id)
        .eq('username', username);
      if (error) throw error;
      loadFixedExpenses();
      hapticFeedback('light');
    } catch (error) {
      console.error('Error deleting fixed expense:', error);
      hapticFeedback('medium');
    }
  };

  const handleCancel = () => {
    setName('');
    setAmount('');
    setCategory(categories[0]);
    setDayOfMonth('1');
    setAccountId('');
    setIsActive(true);
    setNote('');
    setEditingExpense(null);
    setShowForm(false);
  };

  const activeExpenses = fixedExpenses.filter((exp) => exp.is_active);
  const totalMonthly = activeExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-2 sm:px-3 md:px-4 lg:px-4 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-ios-large-title text-black dark:text-white">Fixed Expenses</h1>
            {!showForm && (
              <button
                onClick={() => {
                  setShowForm(true);
                  hapticFeedback('light');
                }}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80"
              >
                + Add
              </button>
            )}
          </div>

          {!showForm && (
            <>
              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">
                  Total Monthly
                </p>
                <p className="text-ios-title-1 text-black dark:text-white">{formatCurrency(totalMonthly)}</p>
              </div>

              <FixedExpensesList fixedExpenses={fixedExpenses} loading={loading} />

              {fixedExpenses.length > 0 && (
                <div className="space-y-2 mt-4">
                  {fixedExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className={`flex justify-between items-center p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios ${
                        !expense.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-ios-body text-black dark:text-white truncate">
                            {expense.name}
                          </span>
                          {!expense.is_active && (
                            <span className="text-ios-caption-1 text-black/60 dark:text-white/60">
                              (Inactive)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-ios-caption-1 text-black/60 dark:text-white/60">
                            Day {expense.day_of_month}
                          </span>
                          <span className="text-ios-caption-1 text-black/40 dark:text-white/40">•</span>
                          <span className="text-ios-caption-1 text-black/60 dark:text-white/60">
                            {expense.category}
                          </span>
                        </div>
                        <span className="text-ios-body font-semibold text-black dark:text-white">
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="px-3 py-1.5 text-ios-caption-1 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-ios active:opacity-80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="px-3 py-1.5 text-ios-caption-1 text-red-600 dark:text-red-400 border border-red-600/20 dark:border-red-400/20 rounded-ios active:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <h2 className="text-ios-title-2 text-black dark:text-white mb-4">
                {editingExpense ? 'Edit Fixed Expense' : 'Add Fixed Expense'}
              </h2>

              <div>
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rent, Internet Bill"
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                  Amount
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and one decimal point
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAmount(value);
                    }
                  }}
                  placeholder="0.00"
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                  Day of Month (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  disabled={loading}
                />
              </div>

              {accounts.length > 0 && (
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Account (Optional)
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    disabled={loading}
                  >
                    <option value="">None</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-black/20 dark:border-white/20"
                  disabled={loading}
                />
                <label htmlFor="isActive" className="text-ios-body text-black dark:text-white">
                  Active
                </label>
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 sm:py-4 bg-white dark:bg-black text-black dark:text-white text-ios-headline font-semibold rounded-ios-lg border border-black/20 dark:border-white/20 disabled:opacity-50 active:opacity-80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 sm:py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
                >
                  {loading ? 'Saving...' : editingExpense ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

