'use client';

import { formatCurrency } from '../utils/currency';
import { AccountIcon } from './Icons';

interface Account {
  id: string;
  name: string;
  type: 'credit_card' | 'bank';
  balance: number;
}

interface AccountsListProps {
  accounts: Account[];
  loading?: boolean;
}

export default function AccountsList({ accounts, loading }: AccountsListProps) {
  if (loading) {
    return null;
  }

  if (accounts.length === 0) {
    return null;
  }

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.type === 'credit_card') {
      return sum - acc.balance; // Credit cards are debts
    }
    return sum + acc.balance;
  }, 0);

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex justify-between items-center mb-2 sm:mb-3">
        <h2 className="text-ios-title-3 text-black dark:text-white">Accounts</h2>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex justify-between items-center p-2 sm:p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios w-full max-w-md mx-auto"
          >
            <div className="flex items-center gap-2">
              <span className="account-list-icon text-black/60 dark:text-white/60">
                <AccountIcon type={account.type} size={18} />
              </span>
              <span className="text-ios-body text-black dark:text-white">{account.name}</span>
            </div>
            <span
              className={`text-ios-body font-semibold ${
                account.type === 'credit_card'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-black dark:text-white'
              }`}
            >
              {formatCurrency(account.type === 'credit_card' ? -account.balance : account.balance)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <div className="flex justify-between items-center p-2 sm:p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios w-full max-w-md">
          <span className="text-ios-body font-bold text-black dark:text-white">Total Balance</span>
          <span className="text-ios-body font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalBalance)}
          </span>
        </div>
      </div>
    </div>
  );
}
