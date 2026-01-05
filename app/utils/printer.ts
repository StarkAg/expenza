// Printer expense tracking utilities
const PRINTER_STORAGE_KEY = 'expenza_printer_expenses';
const PRINTER_CARTRIDGE_KEY = 'expenza_printer_cartridges';

export interface PrinterExpense {
  id: string;
  date: string;
  pages: number;
  type: 'black_white' | 'color';
  cost: number;
  expenseId?: string; // Link to original expense if added from transactions
  created_at: string;
}

export interface CartridgeReplacement {
  id: string;
  date: string;
  type: 'black_white' | 'color';
  cost: number;
  created_at: string;
}

export function getPrinterExpenses(): PrinterExpense[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PRINTER_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addPrinterExpense(expense: Omit<PrinterExpense, 'id' | 'created_at'>): void {
  if (typeof window === 'undefined') return;
  const expenses = getPrinterExpenses();
  const newExpense: PrinterExpense = {
    ...expense,
    id: `printer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };
  expenses.push(newExpense);
  localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(expenses));
}

export function removePrinterExpense(id: string): void {
  if (typeof window === 'undefined') return;
  const expenses = getPrinterExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(filtered));
}

export function getCartridgeReplacements(): CartridgeReplacement[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PRINTER_CARTRIDGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addCartridgeReplacement(replacement: Omit<CartridgeReplacement, 'id' | 'created_at'>): void {
  if (typeof window === 'undefined') return;
  const replacements = getCartridgeReplacements();
  const newReplacement: CartridgeReplacement = {
    ...replacement,
    id: `cartridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };
  replacements.push(newReplacement);
  localStorage.setItem(PRINTER_CARTRIDGE_KEY, JSON.stringify(replacements));
}

export function removeCartridgeReplacement(id: string): void {
  if (typeof window === 'undefined') return;
  const replacements = getCartridgeReplacements();
  const filtered = replacements.filter((r) => r.id !== id);
  localStorage.setItem(PRINTER_CARTRIDGE_KEY, JSON.stringify(filtered));
}

export function calculateCostPerPage(type: 'black_white' | 'color'): number {
  // Get all cartridge replacements of this type
  const replacements = getCartridgeReplacements()
    .filter((r) => r.type === type);
  
  if (replacements.length === 0) return 0;

  // Get total cost of all cartridges
  const totalCartridgeCost = replacements.reduce((sum, r) => sum + r.cost, 0);

  // Get total pages printed of this type
  const expenses = getPrinterExpenses()
    .filter((e) => e.type === type);
  
  if (expenses.length === 0) return 0;

  const totalPages = expenses.reduce((sum, e) => sum + e.pages, 0);

  // Cost per page = total cartridge cost / total pages printed
  return totalPages > 0 ? totalCartridgeCost / totalPages : 0;
}

export function getTotalPages(type?: 'black_white' | 'color'): number {
  const expenses = getPrinterExpenses();
  const filtered = type ? expenses.filter((e) => e.type === type) : expenses;
  return filtered.reduce((sum, e) => sum + e.pages, 0);
}

export function getTotalCost(type?: 'black_white' | 'color'): number {
  const expenses = getPrinterExpenses();
  const filtered = type ? expenses.filter((e) => e.type === type) : expenses;
  return filtered.reduce((sum, e) => sum + e.cost, 0);
}

