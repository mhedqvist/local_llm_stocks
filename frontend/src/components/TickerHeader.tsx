import React from 'react';
import { ChartData } from '../hooks/useStockChart';

interface TickerHeaderProps {
  symbol: string;
  data: ChartData | null;
}

const TickerHeader: React.FC<TickerHeaderProps> = ({ symbol, data }) => {
  const isPositive = (data?.change ?? 0) >= 0;

  return (
    <div className="flex items-center space-x-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-tighter">{symbol}</h1>
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-mono font-semibold text-white">
          ${data?.price?.toFixed(2) || '---'}
        </span>
      </div>
      <div className={`flex flex-col ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        <span className="text-sm font-medium">
          {isPositive ? '▲' : '▼'} {Math.abs(data?.changePercentage || 0).toFixed(2)}%
        </span>
        <span className="text-xs opacity-80">
          {isPositive ? '+' : ''}{data?.change?.toFixed(2) || '0.00'}
        </span>
      </div>
    </div>
  );
};

export default TickerHeader;
