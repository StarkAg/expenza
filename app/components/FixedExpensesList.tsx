'use client';

import { formatCurrency } from '../utils/currency';

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  is_active: boolean;
}

interface FixedExpensesListProps {
  fixedExpenses: FixedExpense[];
  loading?: boolean;
}

export default function FixedExpensesList({ fixedExpenses, loading }: FixedExpensesListProps) {
  if (loading) {
    return null;
  }

  if (fixedExpenses.length === 0) {
    return null;
  }

  const activeExpenses = fixedExpenses.filter((exp) => exp.is_active);
  const totalMonthly = activeExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex justify-between items-center mb-2 sm:mb-3">
        <h2 className="text-ios-title-3 text-black dark:text-white">Fixed Monthly Expenses</h2>
        <span className="text-ios-body font-semibold text-black dark:text-white">
          {formatCurrency(totalMonthly)}
        </span>
      </div>
      <div className="space-y-2">
        {fixedExpenses.map((expense) => (
          <div
            key={expense.id}
            className={`flex justify-between items-center p-2 sm:p-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios ${
              !expense.is_active ? 'opacity-50' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-ios-body text-black dark:text-white truncate">
                  {expense.name}
                </span>
                {!expense.is_active && (
                  <span className="text-ios-caption-1 text-black/60 dark:text-white/60">(Inactive)</span>
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
            </div>
            <span className="text-ios-body font-semibold text-black dark:text-white ml-2 whitespace-nowrap">
              {formatCurrency(expense.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

