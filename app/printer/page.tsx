'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../providers';
import BottomNav from '../components/BottomNav';
import { formatCurrency } from '../utils/currency';
import { format } from 'date-fns';
import { hapticFeedback } from '../utils/haptics';
import {
  getPrinterExpenses,
  addPrinterExpense,
  removePrinterExpense,
  getCartridgeReplacements,
  addCartridgeReplacement,
  removeCartridgeReplacement,
  calculateCostPerPage,
  getTotalPages,
  getTotalCost,
  type PrinterExpense,
  type CartridgeReplacement,
} from '../utils/printer';
import { EditIcon, DeleteIcon } from '../components/Icons';

export default function PrinterPage() {
  const router = useRouter();
  const { username, loading } = useSupabase();
  const [expenses, setExpenses] = useState<PrinterExpense[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeReplacement[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCartridge, setShowAddCartridge] = useState(false);
  const [padMode, setPadMode] = useState(true);
  const [padInput, setPadInput] = useState('');
  
  // Expense form fields
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expensePages, setExpensePages] = useState('');
  const [expenseType, setExpenseType] = useState<'black_white' | 'color'>('black_white');
  const [expenseCost, setExpenseCost] = useState('');
  
  // Cartridge form fields
  const [cartridgeDate, setCartridgeDate] = useState(new Date().toISOString().split('T')[0]);
  const [cartridgeType, setCartridgeType] = useState<'black_white' | 'color'>('black_white');
  const [cartridgeCost, setCartridgeCost] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!username) {
      router.push('/auth');
      return;
    }
    loadData();
    
    // Check if we have an expense from transactions to add
    if (typeof window !== 'undefined') {
      const printerExpense = sessionStorage.getItem('printerExpense');
      if (printerExpense) {
        try {
          const expense = JSON.parse(printerExpense);
          // Pre-fill the form with expense data
          setExpenseDate(expense.date || new Date().toISOString().split('T')[0]);
          setExpenseCost(expense.amount || '');
          setPadMode(false); // Show manual form
          setShowAddExpense(true);
          sessionStorage.removeItem('printerExpense');
        } catch (error) {
          console.error('Error parsing printer expense:', error);
          sessionStorage.removeItem('printerExpense');
        }
      }
    }
  }, [username, loading, router]);

  const loadData = () => {
    setExpenses(getPrinterExpenses());
    setCartridges(getCartridgeReplacements());
  };

  const parsePadInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try to extract: pages type cost or cost pages type
    // Examples: "10 bw 500" or "500 10 bw" or "10 color 500"
    const parts = trimmed.split(/\s+/);
    
    let pages = '';
    let type: 'black_white' | 'color' = 'black_white';
    let cost = '';

    // Try to find numbers
    const numbers = parts.filter((p) => /^\d+\.?\d*$/.test(p));
    
    if (numbers.length >= 2) {
      // Assume first number is pages, second is cost
      pages = numbers[0];
      cost = numbers[1];
    } else if (numbers.length === 1) {
      // Could be pages or cost, check context
      if (parts.indexOf(numbers[0]) < parts.length / 2) {
        pages = numbers[0];
      } else {
        cost = numbers[0];
      }
    }

    // Find type keywords
    const inputLower = trimmed.toLowerCase();
    if (inputLower.includes('color') || inputLower.includes('col') || inputLower.includes('c ')) {
      type = 'color';
    } else if (inputLower.includes('bw') || inputLower.includes('black') || inputLower.includes('b ')) {
      type = 'black_white';
    }

    return { pages, type, cost };
  };

  const handlePadSubmit = () => {
    const parsed = parsePadInput(padInput);
    if (!parsed || !parsed.pages || !parsed.cost) {
      alert('Please enter pages and cost. Example: "10 bw 500" or "500 10 color"');
      return;
    }

    const pages = parseFloat(parsed.pages);
    const cost = parseFloat(parsed.cost);

    if (isNaN(pages) || isNaN(cost) || pages <= 0 || cost <= 0) {
      alert('Please enter valid numbers for pages and cost');
      return;
    }

    addPrinterExpense({
      date: expenseDate,
      pages,
      type: parsed.type,
      cost,
    });

    setPadInput('');
    loadData();
    hapticFeedback('light');
  };

  const handleManualExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pages = parseFloat(expensePages);
    const cost = parseFloat(expenseCost);

    if (isNaN(pages) || isNaN(cost) || pages <= 0 || cost <= 0) {
      alert('Please enter valid numbers');
      return;
    }

    addPrinterExpense({
      date: expenseDate,
      pages,
      type: expenseType,
      cost,
    });

    setExpensePages('');
    setExpenseCost('');
    setShowAddExpense(false);
    loadData();
    hapticFeedback('light');
  };

  const handleCartridgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(cartridgeCost);

    if (isNaN(cost) || cost <= 0) {
      alert('Please enter a valid cost');
      return;
    }

    addCartridgeReplacement({
      date: cartridgeDate,
      type: cartridgeType,
      cost,
    });

    setCartridgeCost('');
    setShowAddCartridge(false);
    loadData();
    hapticFeedback('light');
  };

  const handleDeleteExpense = (id: string) => {
    hapticFeedback('medium');
    if (confirm('Delete this printer expense?')) {
      removePrinterExpense(id);
      loadData();
    }
  };

  const handleDeleteCartridge = (id: string) => {
    hapticFeedback('medium');
    if (confirm('Delete this cartridge replacement?')) {
      removeCartridgeReplacement(id);
      loadData();
    }
  };

  const bwCostPerPage = calculateCostPerPage('black_white');
  const colorCostPerPage = calculateCostPerPage('color');
  const totalBwPages = getTotalPages('black_white');
  const totalColorPages = getTotalPages('color');
  const totalBwCost = getTotalCost('black_white');
  const totalColorCost = getTotalCost('color');

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        <div className="w-full max-w-md lg:max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-20 sm:pb-24">
          <h1 className="text-ios-large-title text-black dark:text-white mb-4 sm:mb-6">
            Printer Management
          </h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
              <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">B&W Cost/Page</p>
              <p className="text-ios-title-2 font-semibold text-black dark:text-white">
                {bwCostPerPage > 0 ? formatCurrency(bwCostPerPage) : '—'}
              </p>
              <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mt-1">
                {totalBwPages} pages
              </p>
            </div>
            <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4">
              <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">Color Cost/Page</p>
              <p className="text-ios-title-2 font-semibold text-black dark:text-white">
                {colorCostPerPage > 0 ? formatCurrency(colorCostPerPage) : '—'}
              </p>
              <p className="text-ios-caption-1 text-black/50 dark:text-white/50 mt-1">
                {totalColorPages} pages
              </p>
            </div>
          </div>

          {/* Add Expense Section */}
          <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-ios-title-3 text-black dark:text-white">Add Print Expense</h2>
              <button
                type="button"
                onClick={() => {
                  setPadMode(!padMode);
                  hapticFeedback('light');
                }}
                className="text-ios-body text-black/60 dark:text-white/60 active:opacity-70"
              >
                {padMode ? 'Manual' : 'Quick'}
              </button>
            </div>

            {padMode ? (
              <div className="space-y-3">
                <textarea
                  value={padInput}
                  onChange={(e) => setPadInput(e.target.value)}
                  placeholder="Example: 10 bw 500 or 500 10 color"
                  className="w-full min-h-[100px] px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                />
                <button
                  type="button"
                  onClick={handlePadSubmit}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80"
                >
                  Add Expense
                </button>
              </div>
            ) : (
              <form onSubmit={handleManualExpenseSubmit} className="space-y-3">
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Pages
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={expensePages}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setExpensePages(value);
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Type
                  </label>
                  <select
                    value={expenseType}
                    onChange={(e) => setExpenseType(e.target.value as 'black_white' | 'color')}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  >
                    <option value="black_white">Black & White</option>
                    <option value="color">Color</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Cost (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={expenseCost}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setExpenseCost(value);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80"
                >
                  Add Expense
                </button>
              </form>
            )}
          </div>

          {/* Cartridge Replacements */}
          <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden mb-4 sm:mb-6">
            <div className="flex justify-between items-center px-3 sm:px-4 py-2.5 sm:py-3 border-b border-black/10 dark:border-white/10">
              <h2 className="text-ios-title-3 text-black dark:text-white">Cartridge Replacements</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddCartridge(true);
                  hapticFeedback('light');
                }}
                className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-ios-caption-1 font-semibold rounded-ios active:opacity-80"
              >
                Add
              </button>
            </div>

            {showAddCartridge ? (
              <form onSubmit={handleCartridgeSubmit} className="px-3 sm:px-4 py-3 space-y-3">
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={cartridgeDate}
                    onChange={(e) => setCartridgeDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Type
                  </label>
                  <select
                    value={cartridgeType}
                    onChange={(e) => setCartridgeType(e.target.value as 'black_white' | 'color')}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  >
                    <option value="black_white">Black & White</option>
                    <option value="color">Color</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ios-body font-semibold text-black dark:text-white mb-2">
                    Cost (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={cartridgeCost}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setCartridgeCost(value);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCartridge(false);
                      setCartridgeCost('');
                    }}
                    className="flex-1 px-3 py-2 bg-white dark:bg-black text-black dark:text-white text-ios-body font-semibold rounded-ios border border-black/20 dark:border-white/20 active:opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-ios-body font-semibold rounded-ios active:opacity-80"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {cartridges.length === 0 ? (
                  <div className="px-3 sm:px-4 py-3 text-center">
                    <p className="text-ios-body text-black/60 dark:text-white/60">
                      No cartridge replacements yet
                    </p>
                  </div>
                ) : (
                  cartridges
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((cartridge) => (
                      <div
                        key={cartridge.id}
                        className="flex justify-between items-center px-3 sm:px-4 py-2.5 sm:py-3"
                      >
                        <div>
                          <p className="text-ios-body text-black dark:text-white">
                            {cartridge.type === 'black_white' ? 'B&W' : 'Color'} Cartridge
                          </p>
                          <p className="text-ios-caption-1 text-black/60 dark:text-white/60">
                            {format(new Date(cartridge.date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-ios-body font-semibold text-black dark:text-white">
                            {formatCurrency(cartridge.cost)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCartridge(cartridge.id)}
                            className="text-red-500 active:opacity-70"
                          >
                            <DeleteIcon size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Print Expenses List */}
          <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-black/10 dark:border-white/10">
              <h2 className="text-ios-title-3 text-black dark:text-white">Print Expenses</h2>
            </div>
            <div className="divide-y divide-black/10 dark:divide-white/10">
              {expenses.length === 0 ? (
                <div className="px-3 sm:px-4 py-3 text-center">
                  <p className="text-ios-body text-black/60 dark:text-white/60">
                    No print expenses yet
                  </p>
                </div>
              ) : (
                expenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((expense) => (
                    <div
                      key={expense.id}
                      className="flex justify-between items-center px-3 sm:px-4 py-2.5 sm:py-3"
                    >
                      <div>
                        <p className="text-ios-body text-black dark:text-white">
                          {expense.pages} pages ({expense.type === 'black_white' ? 'B&W' : 'Color'})
                        </p>
                        <p className="text-ios-caption-1 text-black/60 dark:text-white/60">
                          {format(new Date(expense.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-ios-body font-semibold text-black dark:text-white">
                          {formatCurrency(expense.cost)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-500 active:opacity-70"
                        >
                          <DeleteIcon size={18} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

