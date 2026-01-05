'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { hapticFeedback } from '../utils/haptics';
import { formatCurrency } from '../utils/currency';
import { getCategoryColor } from '../utils/categories';
import { EditIcon, DeleteIcon } from './Icons';

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
  onEdit?: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, loading, onDelete, onEdit }: ExpenseListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleClick = (id: string) => {
    hapticFeedback('light');
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    hapticFeedback('medium');
    if (confirm('Delete this expense?')) {
      onDelete(id);
      setExpandedId(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation();
    hapticFeedback('light');
    if (onEdit) {
      onEdit(expense);
      setExpandedId(null);
    }
  };

  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const isExpanded = expandedId === expense.id;
        return (
          <div
            key={expense.id}
            onClick={() => handleClick(expense.id)}
            className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios p-4 cursor-pointer active:opacity-80 transition-opacity"
          >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-ios-headline font-semibold text-black dark:text-white">
                        {formatCurrency(expense.amount)}
                      </span>
                      {expense.category && (
                        <span
                          className="px-2 py-0.5 text-white text-ios-caption-1 rounded-full border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: getCategoryColor(expense.category) }}
                        >
                          {expense.category}
                        </span>
                      )}
                    </div>
                {expense.note && (
                  <p className="text-ios-subhead text-black/60 dark:text-white/60">
                    {expense.note}
                  </p>
                )}
              </div>
            </div>
            <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mb-2">
              {format(new Date(expense.date), 'MMM d, yyyy')}
            </p>
            {isExpanded && (
              <div className="flex gap-3 pt-2 border-t border-black/10 dark:border-white/10 mt-2">
                {onEdit && (
                  <button
                    onClick={(e) => handleEdit(e, expense)}
                    className="flex items-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/10 text-black dark:text-white rounded-ios active:opacity-80 transition-opacity"
                  >
                    <EditIcon size={18} />
                    <span className="text-ios-body">Edit</span>
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, expense.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-ios active:opacity-80 transition-opacity"
                >
                  <DeleteIcon size={18} />
                  <span className="text-ios-body">Delete</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

