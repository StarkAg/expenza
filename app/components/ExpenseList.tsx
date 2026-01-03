'use client';

import { format } from 'date-fns';
import { hapticFeedback } from '../utils/haptics';
import { formatCurrency } from '../utils/currency';

interface Expense {
  id: string;
  amount: string;
  category: string;
  note: string;
  date: string;
  created_at: string;
}

interface ExpenseListProps {
  expenses: Expense[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export default function ExpenseList({ expenses, loading, onDelete }: ExpenseListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-ios-gray-200 dark:bg-ios-gray-800 rounded-ios animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ios-body text-ios-gray-600 dark:text-ios-gray-400">
          No expenses yet. Add your first expense!
        </p>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    hapticFeedback('medium');
    if (confirm('Delete this expense?')) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="bg-white dark:bg-ios-gray-800 rounded-ios p-4 shadow-ios"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-ios-headline font-semibold text-ios-gray-900 dark:text-ios-gray-50">
                  {formatCurrency(expense.amount)}
                </span>
                <span className="px-2 py-0.5 bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue text-ios-caption-1 rounded-full">
                  {expense.category}
                </span>
              </div>
              {expense.note && (
                <p className="text-ios-subhead text-ios-gray-600 dark:text-ios-gray-400">
                  {expense.note}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(expense.id)}
              className="ml-4 text-ios-red text-ios-caption-1"
            >
              Delete
            </button>
          </div>
          <p className="text-ios-caption-1 text-ios-gray-500 dark:text-ios-gray-500">
            {format(new Date(expense.date), 'MMM d, yyyy')}
          </p>
        </div>
      ))}
    </div>
  );
}

