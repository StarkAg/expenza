// Currency formatting utility for INR
export const CURRENCY_SYMBOL = '₹';

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${CURRENCY_SYMBOL}${numAmount.toFixed(2)}`;
}

export function formatCurrencyWithoutSymbol(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
}

