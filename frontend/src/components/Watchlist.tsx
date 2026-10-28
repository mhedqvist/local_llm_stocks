import React, { useState } from 'react';
import WatchlistItem from './WatchlistItem';

interface WatchlistProps {
  symbols: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  apiBaseUrl: string;
  onSelect?: (symbol: string) => void;
}

const Watchlist: React.FC<WatchlistProps> = ({ symbols, onAdd, onRemove, apiBaseUrl, onSelect }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = inputValue.trim().toUpperCase();
    if (symbol && !symbols.includes(symbol)) {
      onAdd(symbol);
      setInputValue('');
    }
  };

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Watchlist</h2>
        <form onSubmit={handleAdd} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Add symbol..."
            className="w-full bg-slate-800 text-slate-200 text-sm rounded-md py-1.5 pl-8 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
          />
          <svg 
            className="absolute left-2 top-2 text-slate-500" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <button
            type="submit"
            className="absolute right-1 top-1 p-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </form>
      </div>

      <div className="flex-grow overflow-y-auto">
        {(!symbols || symbols.length === 0) ? (
          <div className="p-4 text-sm text-slate-500 text-center">
            No symbols in watchlist
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {symbols.map((symbol) => (
              <WatchlistItem
                key={symbol}
                symbol={symbol}
                apiBaseUrl={apiBaseUrl}
                onRemove={onRemove}
                onClick={onSelect ? () => onSelect(symbol) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Watchlist;
