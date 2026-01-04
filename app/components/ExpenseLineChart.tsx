'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils/currency';

interface ChartDataPoint {
  date: string;
  amount: number;
}

interface ExpenseLineChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
}

export default function ExpenseLineChart({ data, loading }: ExpenseLineChartProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches || document.documentElement.classList.contains('dark'));

    const handleChange = () => {
      setIsDark(mediaQuery.matches || document.documentElement.classList.contains('dark'));
    };
    mediaQuery.addEventListener('change', handleChange);

    // Also check for class changes
    const observer = new MutationObserver(handleChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-ios-body text-black/60 dark:text-white/60">Loading chart...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-ios-body text-black/60 dark:text-white/60">No data to display</p>
      </div>
    );
  }

  // Custom tooltip formatter
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-ios p-2 shadow-lg">
          <p className="text-ios-caption-1 text-black/60 dark:text-white/60 mb-1">
            {payload[0].payload.date}
          </p>
          <p className="text-ios-body font-semibold text-black dark:text-white">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
          <XAxis
            dataKey="date"
            stroke={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
            style={{ fontSize: '12px' }}
            tick={{ fill: isDark ? '#ffffff' : '#000000' }}
          />
          <YAxis
            stroke={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
            style={{ fontSize: '12px' }}
            tick={{ fill: isDark ? '#ffffff' : '#000000' }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={customTooltip} />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={isDark ? '#ffffff' : '#000000'}
            strokeWidth={2}
            dot={{ fill: isDark ? '#ffffff' : '#000000', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

