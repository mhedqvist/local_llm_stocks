import React from 'react';
import { useWatchlistItem } from '../hooks/useWatchlistItem';

interface WatchlistItemProps {
  symbol: string;
  apiBaseUrl: string;
  onRemove: (symbol: string) => void;
  onClick?: () => void;
}

const WatchlistItem: React.FC<WatchlistItemProps> = ({ symbol, apiBaseUrl, onRemove, onClick }) => {
  const { data, status } = useWatchlistItem(symbol, apiBaseUrl);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number) => {
    const prefix = change >= 0 ? '+' : '';
    return `${prefix}${change.toFixed(2)}%`;
  };

  return (
    <div 
      onClick={onClick}
      className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50 cursor-pointer"
    >
      <div className="flex flex-col">
        <span className="font-bold text-slate-100">{symbol}</span>
        <span className="text-xs text-slate-500">
          {status === 'CONNECTED' ? 'Live' : 'Syncing...'}
        </span>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm text-slate-200">
            {data ? `$${formatPrice(data.price)}` : '---'}
          </span>
          <span className={`text-xs font-medium ${(data?.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data ? formatChange(data.changePercentage) : '---'}
          </span>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(symbol);
          }}
          className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-2 2-2 2-2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WatchlistItem;
