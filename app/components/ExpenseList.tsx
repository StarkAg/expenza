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
  onAddToPrinter?: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, loading, onDelete, onEdit, onAddToPrinter }: ExpenseListProps) {
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

  const handleAddToPrinter = (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation();
    hapticFeedback('light');
    if (onAddToPrinter) {
      onAddToPrinter(expense);
      setExpandedId(null);
    }
  };

  // Helper function to check if a color is dark
  const isDarkColor = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const isExpanded = expandedId === expense.id;
        const categoryColor = expense.category ? getCategoryColor(expense.category) : '#000000';
        const darkColor = isDarkColor(categoryColor);
        return (
          <div
            key={expense.id}
            onClick={() => handleClick(expense.id)}
            className="border border-black/20 dark:border-white/20 rounded-ios p-4 cursor-pointer active:opacity-80 transition-opacity"
            style={{ backgroundColor: categoryColor }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-ios-headline font-semibold ${darkColor ? 'text-white' : 'text-black'}`}>
                    {formatCurrency(expense.amount)}
                  </span>
                  {expense.category && (
                    <span
                      className={`px-2 py-0.5 text-ios-caption-1 rounded-full border ${
                        darkColor ? 'border-white/30 text-white' : 'border-black/30 text-black'
                      }`}
                      style={{ backgroundColor: darkColor ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
                    >
                      {expense.category}
                    </span>
                  )}
                </div>
                {expense.note && (
                  <p className={`text-ios-subhead ${darkColor ? 'text-white/80' : 'text-black/60'}`}>
                    {expense.note}
                  </p>
                )}
              </div>
            </div>
            <p className={`text-ios-caption-1 mb-2 ${darkColor ? 'text-white/70' : 'text-black/50'}`}>
              {format(new Date(expense.date), 'MMM d, yyyy')}
            </p>
            {isExpanded && (
              <div className={`flex gap-2 flex-wrap pt-2 border-t mt-2 ${darkColor ? 'border-white/20' : 'border-black/10'}`}>
                {onEdit && (
                  <button
                    onClick={(e) => handleEdit(e, expense)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-ios active:opacity-80 transition-opacity ${
                      darkColor 
                        ? 'bg-white/20 text-white' 
                        : 'bg-black/5 text-black'
                    }`}
                  >
                    <EditIcon size={18} />
                    <span className="text-ios-body">Edit</span>
                  </button>
                )}
                {onAddToPrinter && (
                  <button
                    onClick={(e) => handleAddToPrinter(e, expense)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-ios active:opacity-80 transition-opacity ${
                      darkColor 
                        ? 'bg-white/20 text-white' 
                        : 'bg-black/5 text-black'
                    }`}
                  >
                    <span className="text-lg">🖨️</span>
                    <span className="text-ios-body">Printer</span>
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, expense.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-ios active:opacity-80 transition-opacity ${
                    darkColor 
                      ? 'bg-red-500/30 text-white' 
                      : 'bg-red-500/10 text-red-600'
                  }`}
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

