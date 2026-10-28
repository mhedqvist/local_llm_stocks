import React, { useState } from 'react';
import ChartContainer from './components/ChartContainer';
import TickerHeader from './components/TickerHeader';
import ControlBar from './components/ControlBar';
import Watchlist from './components/Watchlist';
import IndicatorSettings from './components/IndicatorSettings';
import { useStockChart } from './hooks/useStockChart';
import { useLocalStorage } from './hooks/useLocalStorage';

interface IndicatorConfig {
  enabled: boolean;
  params: Record<string, number>;
}

interface AppState {
  indicators: Record<string, IndicatorConfig>;
}

function App() {
  const [symbol, setSymbol] = useState('AAPL');
  const [symbols, setSymbols] = useLocalStorage<string[]>('symbols', ['AAPL', 'MSFT', 'GOOGL']);
  const [resolution, setResolution] = useLocalStorage<string>('resolution', '1d');
  const [indicators, setIndicators] = useLocalStorage<AppState['indicators']>('indicators', {
    sma: { enabled: false, params: { period: 20 } },
    ema: { enabled: false, params: { period: 20 } },
    rsi: { enabled: false, params: { period: 14 } },
    macd: { enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
    bollingerBands: { enabled: false, params: { period: 20, stdDev: 2 } },
    volume: { enabled: false, params: {} },
  });
  const API_BASE_URL = 'http://localhost:8000';

  const { containerRef, status, error, currentPrice } = useStockChart(symbol, API_BASE_URL, resolution, indicators);

  const toggleIndicator = (name: keyof AppState['indicators']) => {
    const newIndicators = {
      ...indicators,
      [name]: { ...indicators[name], enabled: !indicators[name].enabled }
    };
    setIndicators(newIndicators);
  };

  const updateIndicatorParam = (name: keyof AppState['indicators'], param: string, value: number) => {
    const newIndicators = {
      ...indicators,
      [name]: {
        ...indicators[name],
        params: { ...indicators[name].params, [param]: value }
      }
    };
    setIndicators(newIndicators);
  };

  const addToWatchlist = (newSymbol: string) => {
    if (!symbols.includes(newSymbol)) {
      setSymbols([...symbols, newSymbol]);
    }
  };

  const removeFromWatchlist = (symbolToRemove: string) => {
    setSymbols(symbols.filter((s) => s !== symbolToRemove));
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Stocker
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded border border-slate-700">
              <label htmlFor="symbol-input" className="text-xs font-medium text-slate-400 uppercase">
                Symbol
              </label>
              <input
                id="symbol-input"
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-transparent border-none text-white px-1 focus:outline-none w-20 text-sm"
              />
            </div>
          </div>

          <TickerHeader symbol={symbol} data={currentPrice} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex overflow-hidden">
        <Watchlist 
          symbols={symbols} 
          onAdd={addToWatchlist} 
          onRemove={removeFromWatchlist} 
          apiBaseUrl={API_BASE_URL}
        />
        <div className="flex-grow flex flex-col">
          <div className="flex-grow relative p-4">
            <ChartContainer containerRef={containerRef} status={status} error={error} />
          </div>
          <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-2">
            <div className="flex items-center justify-between">
              <ControlBar currentResolution={resolution} onResolutionChange={setResolution} />
              <IndicatorSettings 
                indicators={indicators} 
                onToggle={toggleIndicator} 
                onParamChange={updateIndicatorParam} 
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
