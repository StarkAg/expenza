'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import AccountsList from '../components/AccountsList';
import { hapticFeedback } from '../utils/haptics';
import { formatCurrency } from '../utils/currency';

export default function AccountsPage() {
  const router = useRouter();
  const { supabase, username, loading: authLoading } = useSupabase();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'credit_card' | 'bank'>('bank');
  const [balance, setBalance] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!username) {
      router.push('/auth');
      return;
    }
    loadAccounts();
  }, [username, authLoading, router]);

  const loadAccounts = async () => {
    if (!username) return;

    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name.trim() || balance === '') return;

    hapticFeedback('medium');
    setLoading(true);

    const accountData = {
      username: username,
      name: name.trim(),
      type,
      balance: parseFloat(balance),
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

      setName('');
      setBalance('');
      setType('bank');
      setEditingAccount(null);
      setShowForm(false);
      loadAccounts();
      hapticFeedback('light');
    } catch (error) {
      console.error('Error saving account:', error);
      hapticFeedback('medium');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setName(account.name);
    setType(account.type);
    setBalance(account.balance.toString());
    setShowForm(true);
    hapticFeedback('light');
  };

  const handleDelete = async (id: string) => {
    if (!username) return;
    if (!confirm('Are you sure you want to delete this account?')) return;

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

  const handleCancel = () => {
    setName('');
    setBalance('');
    setType('bank');
    setEditingAccount(null);
    setShowForm(false);
  };

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.type === 'credit_card') {
      return sum - parseFloat(acc.balance);
    }
    return sum + parseFloat(acc.balance);
  }, 0);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 lg:px-6 pt-4 pb-32 sm:pb-36">

          {!showForm && (
            <>
              <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">Total Balance</p>
                <p className="text-ios-title-1 text-black dark:text-white">{formatCurrency(totalBalance)}</p>
              </div>

              <AccountsList accounts={accounts} loading={loading} />

              {accounts.length > 0 && (
                <div className="space-y-2 mt-4">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex justify-between items-center p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-ios-body text-black/60 dark:text-white/60">
                            {account.type === 'credit_card' ? '💳' : '🏦'}
                          </span>
                          <span className="text-ios-body text-black dark:text-white">{account.name}</span>
                        </div>
                        <span
                          className={`text-ios-caption-1 ${
                            account.type === 'credit_card'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-black/60 dark:text-white/60'
                          }`}
                        >
                          {account.type === 'credit_card' ? '-' : ''}
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(account)}
                          className="px-3 py-1.5 text-ios-caption-1 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-ios active:opacity-80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
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
                {editingAccount ? 'Edit Account' : 'Add Account'}
              </h2>

              <div>
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bank 1, Credit Card"
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'credit_card' | 'bank')}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  disabled={loading}
                >
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                  Balance
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={balance}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and one decimal point
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setBalance(value);
                    }
                  }}
                  placeholder="0.00"
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                  disabled={loading || !name.trim() || balance === ''}
                  className="flex-1 py-3 sm:py-4 bg-black dark:bg-white text-white dark:text-black text-ios-headline font-semibold rounded-ios-lg disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
                >
                  {loading ? 'Saving...' : editingAccount ? 'Update' : 'Add'}
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

