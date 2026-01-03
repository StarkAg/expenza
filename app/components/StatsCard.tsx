'use client';

import { formatCurrency } from '../utils/currency';

interface StatsCardProps {
  label: string;
  amount: number;
}

export default function StatsCard({ label, amount }: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-ios-lg p-4">
      <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">
        {label}
      </p>
      <p className="text-ios-title-1 text-black dark:text-white">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

