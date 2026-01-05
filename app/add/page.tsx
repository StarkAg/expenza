'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { hapticFeedback } from '../utils/haptics';
import { format, addDays, subDays } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CalculatorIcon } from '../components/Icons';
import { getCategoryNames } from '../utils/categories';
import { formatCurrency } from '../utils/currency';

export default function AddExpensePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { supabase, username } = useSupabase();
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [padMode, setPadMode] = useState(true); // Default to true for quick entry
  const [padInput, setPadInput] = useState('');
  const [categories, setCategories] = useState<string[]>(getCategoryNames());
  const [showManage, setShowManage] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [fixedExpensesLoading, setFixedExpensesLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editingFixedExpense, setEditingFixedExpense] = useState<any | null>(null);
  const [accountBalance, setAccountBalance] = useState('');
  const [fixedExpenseAmount, setFixedExpenseAmount] = useState('');

  useEffect(() => {
    loadCategories();
    const handleUpdate = () => loadCategories();
    window.addEventListener('categoriesUpdated', handleUpdate);
    return () => window.removeEventListener('categoriesUpdated', handleUpdate);
  }, []);

  useEffect(() => {
    if (username && showManage) {
      loadAccounts();
      loadFixedExpenses();
    }
  }, [username, showManage, supabase]);

  const loadCategories = () => {
    setCategories(getCategoryNames());
  };

  const loadAccounts = async () => {
    if (!username) return;

    try {
      setAccountsLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('username', username)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadFixedExpenses = async () => {
    if (!username) return;

    try {
      setFixedExpensesLoading(true);
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('username', username)
        .order('day_of_month', { ascending: true });

      if (error) throw error;
      setFixedExpenses(data || []);
    } catch (error) {
      console.error('Error loading fixed expenses:', error);
      setFixedExpenses([]);
    } finally {
      setFixedExpensesLoading(false);
    }
  };

  const handleAccountBalanceUpdate = async (accountId: string, newBalance: string) => {
    if (!username || !newBalance.trim()) return;

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ balance: parseFloat(newBalance) })
        .eq('id', accountId)
        .eq('username', username);
      if (error) throw error;
      loadAccounts();
      setEditingAccount(null);
      setAccountBalance('');
      hapticFeedback('light');
    } catch (error) {
      console.error('Error updating account balance:', error);
      hapticFeedback('medium');
    }
  };

  const handleFixedExpenseAmountUpdate = async (expenseId: string, newAmount: string) => {
    if (!username || !newAmount.trim()) return;

    try {
      const { error } = await supabase
        .from('fixed_expenses')
        .update({ amount: parseFloat(newAmount) })
        .eq('id', expenseId)
        .eq('username', username);
      if (error) throw error;
      loadFixedExpenses();
      setEditingFixedExpense(null);
      setFixedExpenseAmount('');
      hapticFeedback('light');
    } catch (error) {
      console.error('Error updating fixed expense:', error);
      hapticFeedback('medium');
    }
  };

  // Reset form function
  const resetForm = () => {
    setEditingExpense(null);
    setAmount('');
    setCategory('');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    setPadInput('');
    setPadMode(true); // Default to pad mode for new entries
  };

  useEffect(() => {
    // Check if we have edit data in sessionStorage (client-side only)
    if (typeof window !== 'undefined') {
      const expenseData = sessionStorage.getItem('editExpense');
      if (expenseData) {
        try {
          const expense = JSON.parse(expenseData);
          setEditingExpense(expense);
          setAmount(expense.amount);
          setCategory(expense.category);
          setNote(expense.note || '');
          setDate(expense.date);
          setPadMode(false); // Use manual form for editing
        } catch (error) {
          console.error('Error parsing expense data:', error);
          sessionStorage.removeItem('editExpense');
          resetForm();
        }
      } else {
        // No edit data - reset to default (pad mode for new entry)
        resetForm();
      }
    }
  }, [pathname]); // Re-run when pathname changes (including when Add tab is clicked again)

  const parsePadInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Extract number (can be at start or anywhere)
    const numberMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
    let extractedAmount = '';
    let remainingText = trimmed;

    if (numberMatch) {
      extractedAmount = numberMatch[1];
      // Remove the number from the text
      remainingText = trimmed.replace(numberMatch[0], '').trim();
    }

    // Find matching category (case-insensitive)
    let extractedCategory = '';
    let extractedNote = remainingText;

    for (const cat of categories) {
      const regex = new RegExp(`\\b${cat}\\b`, 'i');
      if (regex.test(remainingText)) {
        extractedCategory = cat;
        // Remove category from note
        extractedNote = remainingText.replace(regex, '').trim();
        break;
      }
    }

    // If no category found but there's text, use first word as potential category
    if (!extractedCategory && remainingText) {
      const words = remainingText.split(/\s+/);
      const firstWord = words[0];
      // Check if first word matches a category (case-insensitive)
      const matchedCategory = categories.find(
        (cat) => cat.toLowerCase() === firstWord.toLowerCase()
      );
      if (matchedCategory) {
        extractedCategory = matchedCategory;
        extractedNote = words.slice(1).join(' ').trim();
      } else {
        // If first word doesn't match, use it as note
        extractedNote = remainingText;
      }
    }

    return {
      amount: extractedAmount,
      category: extractedCategory,
      note: extractedNote,
    };
  };

  const handlePadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !padInput.trim()) return;

    const parsed = parsePadInput(padInput);
    if (!parsed || !parsed.amount || parseFloat(parsed.amount) <= 0) {
      hapticFeedback('medium');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);

    const expenseData = {
      username: username,
      amount: parseFloat(parsed.amount).toFixed(2),
      category: parsed.category.trim() || '',
      note: parsed.note.trim() || null,
      date: new Date().toISOString().split('T')[0],
    };

    try {
      if (typeof window !== 'undefined' && navigator.onLine) {
        const { error } = await supabase.from('expenses').insert(expenseData);
        if (error) throw error;
      } else if (typeof window !== 'undefined') {
        // Store offline for later sync
        const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
        pending.push(expenseData);
        localStorage.setItem('pendingExpenses', JSON.stringify(pending));
      }

      // Clear pad input and reset
      setPadInput('');
      hapticFeedback('light');
      router.push('/transactions');
    } catch (error) {
      console.error('Error adding expense:', error);
      hapticFeedback('medium');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !amount || parseFloat(amount) <= 0) return;

    hapticFeedback('medium');
    setLoading(true);

    const expenseData = {
      amount: parseFloat(amount).toFixed(2),
      category: category.trim() || '', // Allow blank/empty category
      note: note.trim() || null,
      date,
    };

    try {
      if (editingExpense) {
        // Update existing expense
        if (typeof window !== 'undefined' && navigator.onLine) {
          const { error } = await supabase
            .from('expenses')
            .update(expenseData)
            .eq('id', editingExpense.id)
            .eq('username', username);
          if (error) throw error;
        } else if (typeof window !== 'undefined') {
          // Store update for offline sync
          const pendingUpdates = JSON.parse(localStorage.getItem('pendingExpenseUpdates') || '[]');
          pendingUpdates.push({ id: editingExpense.id, ...expenseData });
          localStorage.setItem('pendingExpenseUpdates', JSON.stringify(pendingUpdates));
        }
      } else {
        // Insert new expense
        const newExpenseData = {
          username: username,
          ...expenseData,
        };

        if (typeof window !== 'undefined' && navigator.onLine) {
          const { error } = await supabase.from('expenses').insert(newExpenseData);
          if (error) throw error;
        } else if (typeof window !== 'undefined') {
          // Store offline for later sync
          const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
          pending.push(newExpenseData);
          localStorage.setItem('pendingExpenses', JSON.stringify(pending));
        }
      }

      // Clear sessionStorage if editing
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('editExpense');
      }
      
      // Reset form
      setAmount('');
      setCategory('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      setEditingExpense(null);

      hapticFeedback('light');
      router.push('/transactions');
    } catch (error) {
      console.error(`Error ${editingExpense ? 'updating' : 'adding'} expense:`, error);
      hapticFeedback('medium');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-ios-large-title text-black dark:text-white">
              {showManage ? 'Manage' : editingExpense ? 'Edit Expense' : 'Add Expense'}
          </h1>
            {!editingExpense && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManage(!showManage);
                    hapticFeedback('light');
                  }}
                  className={`p-2.5 sm:p-3 rounded-ios border transition-colors ${
                    showManage
                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                      : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20'
                  }`}
                  aria-label="Toggle manage mode"
                >
                  {showManage ? '✕' : '⚙'}
                </button>
                {!showManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setPadMode(!padMode);
                      hapticFeedback('light');
                    }}
                    className={`p-2.5 sm:p-3 rounded-ios border transition-colors ${
                      padMode
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                        : 'bg-white dark:bg-black text-black dark:text-white border-black/20 dark:border-white/20'
                    }`}
                    aria-label="Toggle pad mode"
                  >
                    <CalculatorIcon size={20} />
                  </button>
                )}
              </div>
            )}
          </div>

          {showManage && (
            <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
              {/* Accounts Section */}
              <div>
                <h2 className="text-ios-title-3 text-black dark:text-white mb-3">Accounts</h2>
                {accountsLoading ? (
                  <div className="text-center py-4">
                    <p className="text-ios-body text-black/60 dark:text-white/60">Loading...</p>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-4 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios">
                    <p className="text-ios-body text-black/60 dark:text-white/60">No accounts yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex justify-between items-center p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-lg">{account.type === 'credit_card' ? '💳' : '🏦'}</span>
                          <span className="text-ios-body text-black dark:text-white truncate">
                            {account.name}
                          </span>
                        </div>
                        {editingAccount?.id === account.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*\.?[0-9]*"
                              value={accountBalance}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  setAccountBalance(value);
                                }
                              }}
                              placeholder={account.balance.toString()}
                              className="w-24 px-2 py-1 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleAccountBalanceUpdate(account.id, accountBalance)}
                              className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black text-ios-caption-1 font-semibold rounded active:opacity-80"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(null);
                                setAccountBalance('');
                              }}
                              className="px-3 py-1 bg-white dark:bg-black text-black dark:text-white text-ios-caption-1 border border-black/20 dark:border-white/20 rounded active:opacity-80"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-ios-body font-semibold text-black dark:text-white">
                              {formatCurrency(account.balance)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(account);
                                setAccountBalance(account.balance.toString());
                                hapticFeedback('light');
                              }}
                              className="text-ios-body text-black/60 dark:text-white/60 active:opacity-70"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed Expenses Section */}
              <div>
                <h2 className="text-ios-title-3 text-black dark:text-white mb-3">Fixed Monthly Expenses</h2>
                {fixedExpensesLoading ? (
                  <div className="text-center py-4">
                    <p className="text-ios-body text-black/60 dark:text-white/60">Loading...</p>
                  </div>
                ) : fixedExpenses.length === 0 ? (
                  <div className="text-center py-4 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios">
                    <p className="text-ios-body text-black/60 dark:text-white/60">No fixed expenses yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fixedExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex justify-between items-center p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-ios-body text-black dark:text-white truncate mb-1">
                            {expense.name}
                          </div>
                          <div className="text-ios-caption-1 text-black/60 dark:text-white/60">
                            Day {expense.day_of_month} • {expense.category}
                          </div>
                        </div>
                        {editingFixedExpense?.id === expense.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*\.?[0-9]*"
                              value={fixedExpenseAmount}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  setFixedExpenseAmount(value);
                                }
                              }}
                              placeholder={expense.amount.toString()}
                              className="w-24 px-2 py-1 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleFixedExpenseAmountUpdate(expense.id, fixedExpenseAmount)}
                              className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black text-ios-caption-1 font-semibold rounded active:opacity-80"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFixedExpense(null);
                                setFixedExpenseAmount('');
                              }}
                              className="px-3 py-1 bg-white dark:bg-black text-black dark:text-white text-ios-caption-1 border border-black/20 dark:border-white/20 rounded active:opacity-80"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-ios-body font-semibold text-black dark:text-white">
                              {formatCurrency(expense.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFixedExpense(expense);
                                setFixedExpenseAmount(expense.amount.toString());
                                hapticFeedback('light');
                              }}
                              className="text-ios-body text-black/60 dark:text-white/60 active:opacity-70"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!showManage && (
            <>
            {padMode ? (
            <div className="flex flex-col h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)]">
              <form onSubmit={handlePadSubmit} className="flex flex-col flex-1">
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-4">
                  Quick Entry
                </label>
                <textarea
                  value={padInput}
                  onChange={(e) => setPadInput(e.target.value)}
                  placeholder=""
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                  className="flex-1 min-h-[400px] px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !padInput.trim()}
                  className="mt-4 w-full py-3 sm:py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Add Expense'}
                </button>
              </form>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                Amount
              </label>
              <div className="relative">
                <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-ios-title-2 text-black dark:text-white pointer-events-none">
                  ₹
                </div>
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
                  className="w-full pl-8 sm:pl-10 pr-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-title-2 text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
              />
              </div>
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
                <option value="">Select a category</option>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback('light');
                    const currentDate = new Date(date);
                    const previousDate = subDays(currentDate, 1);
                    setDate(previousDate.toISOString().split('T')[0]);
                  }}
                  disabled={loading}
                  className="p-2.5 sm:p-3 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-ios text-black dark:text-white active:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  aria-label="Previous day"
                >
                  <ChevronLeftIcon size={20} />
                </button>
                <div className="flex-1 relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white appearance-none cursor-pointer pr-10"
                disabled={loading}
              />
                  <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black/40 dark:text-white/40">
                    <CalendarIcon size={18} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback('light');
                    const currentDate = new Date(date);
                    const nextDate = addDays(currentDate, 1);
                    setDate(nextDate.toISOString().split('T')[0]);
                  }}
                  disabled={loading}
                  className="p-2.5 sm:p-3 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-ios text-black dark:text-white active:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  aria-label="Next day"
                >
                  <ChevronRightIcon size={20} />
                </button>
              </div>
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

            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full py-3 sm:py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
            >
              {loading
                ? editingExpense
                  ? 'Updating...'
                  : 'Adding...'
                : editingExpense
                  ? 'Update Expense'
                  : 'Add Expense'}
            </button>
          </form>
          )}
          </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

