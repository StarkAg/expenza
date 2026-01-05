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
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    loadCategories();
    const handleUpdate = () => loadCategories();
    window.addEventListener('categoriesUpdated', handleUpdate);
    return () => window.removeEventListener('categoriesUpdated', handleUpdate);
  }, [username, supabase]);

  // Load accounts always (not just in manage mode)
  useEffect(() => {
    if (username) {
      loadAccounts();
    }
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
    if (username && showManage) {
      loadFixedExpenses();
    }
  }, [username, showManage, supabase]);

  // Set first bank account as default when accounts are loaded
  useEffect(() => {
    const bankAccounts = accounts.filter((acc) => acc.type === 'bank');
    if (bankAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(bankAccounts[0].id);
    }
  }, [accounts, selectedAccountId]);

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

    // Extract all numbers from the input
    const numberMatches = trimmed.match(/(\d+(?:\.\d+)?)/g);
    if (!numberMatches || numberMatches.length === 0) return null;

    // Find matching category (case-insensitive)
    let extractedCategory = '';
    let remainingText = trimmed;

    // Remove all numbers from text to find category
    for (const num of numberMatches) {
      remainingText = remainingText.replace(num, '').trim();
    }

    // Find matching category (case-insensitive)
    for (const cat of categories) {
      const regex = new RegExp(`\\b${cat}\\b`, 'i');
      if (regex.test(remainingText)) {
        extractedCategory = cat;
        remainingText = remainingText.replace(regex, '').trim();
        break;
      }
    }

    // Check if "Auto" is mentioned and map to Transport
    if (!extractedCategory && /auto/i.test(remainingText)) {
      if (categories.includes('Transport')) {
        extractedCategory = 'Transport';
        remainingText = remainingText.replace(/auto/gi, '').trim();
      } else if (categories.find(cat => cat.toLowerCase() === 'auto')) {
        extractedCategory = categories.find(cat => cat.toLowerCase() === 'auto') || '';
        remainingText = remainingText.replace(/auto/gi, '').trim();
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
        remainingText = words.slice(1).join(' ').trim();
      }
    }

    // Create an expense entry for each number found
    const expenses = numberMatches.map((amountStr) => ({
      amount: amountStr,
      category: extractedCategory,
      note: remainingText.trim() || null,
    }));

    return expenses;
  };

  const handlePadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !padInput.trim()) return;

    const parsedExpenses = parsePadInput(padInput);
    if (!parsedExpenses || parsedExpenses.length === 0) {
      hapticFeedback('medium');
      return;
    }

    // Validate all amounts
    const validExpenses = parsedExpenses.filter(
      (exp) => exp.amount && parseFloat(exp.amount) > 0
    );

    if (validExpenses.length === 0) {
      hapticFeedback('medium');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);

    const expenseDate = new Date().toISOString().split('T')[0];
    const expensesToInsert = validExpenses.map((exp) => ({
      username: username,
      amount: parseFloat(exp.amount).toFixed(2),
      category: exp.category.trim() || '',
      note: exp.note || null,
      date: expenseDate,
    }));

    try {
      if (typeof window !== 'undefined' && navigator.onLine) {
        const { error } = await supabase.from('expenses').insert(expensesToInsert);
        if (error) throw error;

        // Debit from selected bank account if one is selected
        if (selectedAccountId) {
          const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
          if (selectedAccount && selectedAccount.type === 'bank') {
            const totalAmount = validExpenses.reduce(
              (sum, exp) => sum + parseFloat(exp.amount),
              0
            );
            const newBalance = parseFloat(selectedAccount.balance) - totalAmount;
            const { error: accountError } = await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', selectedAccountId)
              .eq('username', username);
            if (accountError) {
              console.error('Error updating account balance:', accountError);
            } else {
              // Reload accounts to update the balance in UI
              await loadAccounts();
            }
          }
        }
      } else if (typeof window !== 'undefined') {
        // Store offline for later sync
        const pending = JSON.parse(localStorage.getItem('pendingExpenses') || '[]');
        pending.push(...expensesToInsert);
        localStorage.setItem('pendingExpenses', JSON.stringify(pending));
      }

      // Clear pad input and reset
      setPadInput('');
      hapticFeedback('light');
      router.push('/transactions');
    } catch (error) {
      console.error('Error adding expenses:', error);
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

        // Debit from selected bank account if one is selected
        if (selectedAccountId) {
          const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
          if (selectedAccount && selectedAccount.type === 'bank') {
            const expenseAmount = parseFloat(amount);
            const newBalance = parseFloat(selectedAccount.balance) - expenseAmount;
            const { error: accountError } = await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', selectedAccountId)
              .eq('username', username);
            if (accountError) {
              console.error('Error updating account balance:', accountError);
            } else {
              // Reload accounts to update the balance in UI
              await loadAccounts();
            }
          }
        }
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

  // Prevent body scroll when on this page
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black overflow-hidden">
      <main className="flex-1 overflow-hidden pb-safe-bottom flex flex-col min-h-0">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 lg:px-6 pt-4 pb-4 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2 sm:mb-3 flex-shrink-0">
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
            {!showManage && !editingExpense && (
              <div className="flex gap-2">
                {padMode ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePadSubmit(e as any);
                    }}
                    disabled={loading || !padInput.trim()}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios-lg active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : 'Add'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios-lg active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? 'Adding...'
                      : editingExpense
                        ? 'Update'
                        : 'Add'}
                  </button>
                )}
              </div>
            )}
          </div>

          {showManage && (
            <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6 flex-1 min-h-0 overflow-y-auto">
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
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {padMode ? (
            <div className="flex flex-col flex-1 min-h-0">
              <form onSubmit={handlePadSubmit} className="flex flex-col flex-1 min-h-0">
                <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-2">
                  Quick Entry
                </label>
                {(() => {
                  const bankAccounts = accounts.filter((acc) => acc.type === 'bank');
                  if (bankAccounts.length > 0) {
                    return (
                      <div className="mb-2">
                        <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                          Bank Account (optional)
                        </label>
                        <select
                          value={selectedAccountId}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                          disabled={loading}
                        >
                          <option value="">None</option>
                          {bankAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({formatCurrency(account.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}
                <textarea
                  value={padInput}
                  onChange={(e) => setPadInput(e.target.value)}
                  placeholder=""
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                  className="w-full h-32 px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  autoFocus
                />
              </form>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-2 max-h-full overflow-hidden">
            <div>
              <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Amount
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ios-body text-black dark:text-white pointer-events-none">
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
                  className="w-full pl-7 pr-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                disabled={loading}
              />
              </div>
            </div>

            <div>
              <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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

            {(() => {
              const bankAccounts = accounts.filter((acc) => acc.type === 'bank');
              if (bankAccounts.length > 0) {
                return (
                  <div>
                    <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                      Bank Account (optional)
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      disabled={loading}
                    >
                      <option value="">None</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}

            <div>
              <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Date
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback('light');
                    const currentDate = new Date(date);
                    const previousDate = subDays(currentDate, 1);
                    setDate(previousDate.toISOString().split('T')[0]);
                  }}
                  disabled={loading}
                  className="p-2 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-ios text-black dark:text-white active:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  aria-label="Previous day"
                >
                  <ChevronLeftIcon size={18} />
                </button>
                <div className="flex-1 relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white appearance-none cursor-pointer pr-8"
                disabled={loading}
              />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-black/40 dark:text-white/40">
                    <CalendarIcon size={16} />
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
                  className="p-2 bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-ios text-black dark:text-white active:opacity-80 transition-opacity disabled:opacity-50 flex-shrink-0"
                  aria-label="Next day"
                >
                  <ChevronRightIcon size={18} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-ios-caption-1 font-semibold text-black dark:text-white mb-1">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full px-2.5 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                disabled={loading}
              />
            </div>
          </form>
          )}
          </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

