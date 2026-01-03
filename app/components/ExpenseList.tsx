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
            className="h-20 bg-black/5 dark:bg-white/5 rounded-ios animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ios-body text-black/60 dark:text-white/60">
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
          className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios p-4"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-ios-headline font-semibold text-black dark:text-white">
                  {formatCurrency(expense.amount)}
                </span>
                <span className="px-2 py-0.5 bg-black/10 dark:bg-white/20 text-black dark:text-white text-ios-caption-1 rounded-full border border-black/20 dark:border-white/20">
                  {expense.category}
                </span>
              </div>
              {expense.note && (
                <p className="text-ios-subhead text-black/60 dark:text-white/60">
                  {expense.note}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(expense.id)}
              className="ml-4 text-black dark:text-white text-ios-caption-1 underline"
            >
              Delete
            </button>
          </div>
          <p className="text-ios-caption-1 text-black/50 dark:text-white/50">
            {format(new Date(expense.date), 'MMM d, yyyy')}
          </p>
        </div>
      ))}
    </div>
  );
}

