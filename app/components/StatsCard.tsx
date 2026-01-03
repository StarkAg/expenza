'use client';

import { formatCurrency } from '../utils/currency';

interface StatsCardProps {
  label: string;
  amount: number;
}

export default function StatsCard({ label, amount }: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-ios-gray-800 rounded-ios-lg p-4 shadow-ios">
      <p className="text-ios-caption-1 text-ios-gray-600 dark:text-ios-gray-400 mb-1">
        {label}
      </p>
      <p className="text-ios-title-1 text-ios-gray-900 dark:text-ios-gray-50">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

