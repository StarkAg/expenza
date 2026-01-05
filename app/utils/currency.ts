// Currency formatting utility for INR
export const CURRENCY_SYMBOL = '₹';

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const isNegative = numAmount < 0;
  const absAmount = Math.abs(numAmount);
  return `${CURRENCY_SYMBOL}${isNegative ? '-' : ''}${absAmount.toFixed(2)}`;
}

export function formatCurrencyWithoutSymbol(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(2);
}


