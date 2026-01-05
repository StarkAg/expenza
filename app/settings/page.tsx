'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { hapticFeedback } from '../utils/haptics';
import { EditIcon, DeleteIcon, GripVerticalIcon, AddIcon } from '../components/Icons';
import { formatCurrency } from '../utils/currency';
import {
  getCategories,
  type Category,
  updateCategoryName,
  updateCategoryColor,
  removeCategory,
  reorderCategories,
  resetCategories,
  PRESET_COLORS,
} from '../utils/categories';
import ColorPicker from '../components/ColorPicker';

export default function SettingsPage() {
  const router = useRouter();
  const { supabase, username, themeMode, setThemeMode } = useSupabase() as any;
  const [categories, setCategoriesState] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingColorId, setEditingColorId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'credit_card'>('bank');
  const [accountBalance, setAccountBalance] = useState('');

  useEffect(() => {
    loadCategories();
    loadAccounts();

    // Listen for category updates from other components
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

  const loadCategories = async () => {
    const categories = await getCategories();
    setCategoriesState(categories);
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

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleSignOut = async () => {
    hapticFeedback('medium');
    localStorage.removeItem('username');
    router.push('/auth');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      return;
    }

    hapticFeedback('heavy');
    // Delete all expenses first
    if (username) {
      await supabase.from('expenses').delete().eq('username', username);
      localStorage.removeItem('username');
      localStorage.removeItem(`expenses_${username}`);
      router.push('/auth');
    }
  };

  const handleStartEdit = (index: number) => {
    hapticFeedback('light');
    setEditingId(index);
    setEditValue(categories[index].name);
    setEditingColorId(null); // Close color picker if open
  };

  const handleSaveEdit = (index: number) => {
    hapticFeedback('light');
    const newName = editValue.trim();
    if (newName && newName !== categories[index].name) {
      updateCategoryName(categories[index].name, newName);
      loadCategories();
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleColorChange = async (index: number, color: string) => {
    hapticFeedback('light');
    await updateCategoryColor(categories[index].name, color);
    await loadCategories();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = async (index: number) => {
    hapticFeedback('medium');
    if (confirm(`Delete category "${categories[index].name}"?`)) {
      await removeCategory(categories[index].name);
      await loadCategories();
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    hapticFeedback('light');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderCategories(draggedIndex, index);
      loadCategories();
      hapticFeedback('medium');
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    hapticFeedback('medium');
    if (confirm('Reset categories to defaults? This will remove all custom categories.')) {
      resetCategories();
      loadCategories();
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !accountName.trim()) return;

    hapticFeedback('medium');
    const accountData = {
      username: username,
      name: accountName.trim(),
      type: accountType,
      balance: accountBalance ? parseFloat(accountBalance) : 0,
    };

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update(accountData)
          .eq('id', editingAccount.id)
          .eq('username', username);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounts').insert(accountData);
        if (error) throw error;
      }

      setAccountName('');
      setAccountBalance('');
      setAccountType('bank');
      setEditingAccount(null);
      setShowAccountForm(false);
      loadAccounts();
      hapticFeedback('light');
    } catch (error) {
      console.error('Error saving account:', error);
      hapticFeedback('medium');
    }
  };

  const handleAccountEdit = (account: any) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountType(account.type);
    setAccountBalance(account.balance.toString());
    setShowAccountForm(true);
    hapticFeedback('light');
  };

  const handleAccountDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return;

    hapticFeedback('medium');
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id).eq('username', username);
      if (error) throw error;
      loadAccounts();
      hapticFeedback('light');
    } catch (error) {
      console.error('Error deleting account:', error);
      hapticFeedback('medium');
    }
  };

  const handleAccountCancel = () => {
    setAccountName('');
    setAccountBalance('');
    setAccountType('bank');
    setEditingAccount(null);
    setShowAccountForm(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-4 sm:mb-6">
            Settings
          </h1>

          <div className="space-y-3 sm:space-y-4">
            {username && (
              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
                <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">
                  Signed in as
                </p>
                <p className="text-ios-body text-black dark:text-white">
                  @{username}
                </p>
              </div>
            )}

                {/* Appearance / Theme Mode */}
                <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-ios-title-3 text-black dark:text-white">Appearance</h2>
                      <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mt-0.5">
                        Choose light, dark, or follow system
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex rounded-full bg-black/5 dark:bg-white/5 p-0.5">
                    {[
                      { value: 'light', label: 'Light' },
                      { value: 'system', label: 'Auto' },
                      { value: 'dark', label: 'Dark' },
                    ].map((option) => {
                      const isActive = themeMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            hapticFeedback('light');
                            setThemeMode(option.value as any);
                          }}
                          className={`px-3 sm:px-4 py-1.5 text-ios-body rounded-full transition-colors ${
                            isActive
                              ? 'bg-black dark:bg-white text-white dark:text-black'
                              : 'text-black/60 dark:text-white/60'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

            {/* Categories Section */}
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-black/10 dark:border-white/10">
                <h2 className="text-ios-title-3 text-black dark:text-white">Categories</h2>
                <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mt-1">
                  Edit, reorder, or remove categories
                </p>
              </div>
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {categories.map((category, index) => (
                  <div key={`${category.name}-${index}`}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-move transition-colors ${
                        dragOverIndex === index
                          ? 'bg-black/5 dark:bg-white/5'
                          : 'bg-transparent'
                      } ${draggedIndex === index ? 'opacity-50' : ''}`}
                    >
                      <div className="text-black/40 dark:text-white/40 flex-shrink-0">
                        <GripVerticalIcon size={18} />
                      </div>
                      {editingId === index ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit(index)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(index);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="flex-1 text-ios-body text-black dark:text-white">
                            {category.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                hapticFeedback('light');
                                setEditingColorId(editingColorId === index ? null : index);
                                setEditingId(null);
                              }}
                              className="p-1.5 text-black dark:text-white active:opacity-70"
                              aria-label="Edit color"
                              title="Edit color"
                            >
                              <div
                                className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20"
                                style={{ backgroundColor: category.color }}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index)}
                              className="p-1.5 text-black dark:text-white active:opacity-70"
                              aria-label="Edit category"
                            >
                              <EditIcon size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(index)}
                              className="p-1.5 text-red-500 active:opacity-70"
                              aria-label="Delete category"
                            >
                              <DeleteIcon size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {editingColorId === index && (
                      <div className="px-3 sm:px-4 pb-3 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10">
                        <ColorPicker
                          value={category.color}
                          onChange={(color) => handleColorChange(index, color)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full px-3 py-2 text-ios-body text-red-500 text-center active:opacity-70"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>

            {/* Accounts Section */}
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-ios-title-3 text-black dark:text-white">Accounts</h2>
                  <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mt-1">
                    Banks and credit cards
                  </p>
                </div>
                {!showAccountForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountForm(true);
                      hapticFeedback('light');
                    }}
                    className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-ios active:opacity-80"
                    aria-label="Add account"
                  >
                    <AddIcon size={18} />
                  </button>
                )}
              </div>

              {showAccountForm ? (
                <form onSubmit={handleAccountSubmit} className="px-3 sm:px-4 py-3 space-y-3">
                  <div>
                    <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Bank or card name"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                      Type
                    </label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as 'bank' | 'credit_card')}
                      className="w-full px-3 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    >
                      <option value="bank">Bank</option>
                      <option value="credit_card">Credit Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                      Balance (optional)
                    </label>
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
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAccountCancel}
                      className="flex-1 px-3 py-2 bg-white dark:bg-black text-black dark:text-white text-ios-body font-semibold rounded-ios border border-black/20 dark:border-white/20 active:opacity-80"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!accountName.trim()}
                      className="flex-1 px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80 disabled:opacity-50"
                    >
                      {editingAccount ? 'Update' : 'Add'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {accountsLoading ? (
                    <div className="px-3 sm:px-4 py-3 text-center">
                      <p className="text-ios-body text-black/60 dark:text-white/60">Loading...</p>
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="px-3 sm:px-4 py-3 text-center">
                      <p className="text-ios-body text-black/60 dark:text-white/60">No accounts yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-black/10 dark:divide-white/10">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-ios-body">
                                {account.type === 'credit_card' ? '💳' : '🏦'}
                              </span>
                              <span className="text-ios-body text-black dark:text-white">{account.name}</span>
                            </div>
                            <span className="text-ios-caption-1 text-black/60 dark:text-white/60">
                              {formatCurrency(account.balance)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAccountEdit(account)}
                              className="p-1.5 text-black dark:text-white active:opacity-70"
                              aria-label="Edit account"
                            >
                              <EditIcon size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAccountDelete(account.id)}
                              className="p-1.5 text-red-500 active:opacity-70"
                              aria-label="Delete account"
                            >
                              <DeleteIcon size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <button
                onClick={handleSignOut}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-ios-body text-black dark:text-white active:bg-black/5 dark:active:bg-white/5"
              >
                Sign Out
              </button>
            </div>

            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
              <button
                onClick={handleDeleteAccount}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-ios-body text-black dark:text-white active:bg-black/5 dark:active:bg-white/5"
              >
                Delete Account
              </button>
            </div>

            <div className="pt-4">
              <SecretPrinterOption />
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function SecretPrinterOption() {
  const router = useRouter();
  const [tapCount, setTapCount] = useState(0);
  const [tapTimeout, setTapTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleTap = () => {
    hapticFeedback('light');
    const newCount = tapCount + 1;
    setTapCount(newCount);

    // Reset counter after 2 seconds
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }

    const timeout = setTimeout(() => {
      setTapCount(0);
    }, 2000);

    setTapTimeout(timeout);

    // If tapped 5 times, navigate to printer page
    if (newCount >= 5) {
      clearTimeout(timeout);
      setTapCount(0);
      router.push('/printer');
    }
  };

  useEffect(() => {
    return () => {
      if (tapTimeout) {
        clearTimeout(tapTimeout);
      }
    };
  }, [tapTimeout]);

  return (
    <div
      onClick={handleTap}
      className="cursor-pointer active:opacity-70 transition-opacity"
      aria-hidden="true"
    >
      <p className="text-ios-caption-1 text-black/50 dark:text-white/50 text-center">
        Expenza v1.0.0
      </p>
    </div>
  );
}
