import React, { useEffect, useState } from 'react';
import WorkspaceGrid from './components/WorkspaceGrid';
import Watchlist from './components/Watchlist';
import { useWorkspace } from './hooks/useWorkspace';
import { useLocalStorage } from './hooks/useLocalStorage';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const { workspace, activePane, addPane, removePane, updatePane, setActivePane } = useWorkspace();
  const [symbols, setSymbols] = useLocalStorage<string[]>('symbols', ['AAPL', 'MSFT', 'GOOGL']);
  // Pause all pane streams while the tab is hidden; the per-pane hook
  // reconnects and gap-fills when we come back.
  const [docVisible, setDocVisible] = useState(!document.hidden);

  useEffect(() => {
    const onVisibilityChange = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const addToWatchlist = (newSymbol: string) => {
    if (!symbols.includes(newSymbol)) {
      setSymbols([...symbols, newSymbol]);
    }
  };

  const removeFromWatchlist = (symbolToRemove: string) => {
    setSymbols(symbols.filter((s) => s !== symbolToRemove));
  };

  // Clicking a watchlist symbol loads it into the active pane.
  const selectFromWatchlist = (symbol: string) => {
    updatePane(activePane.id, { symbol });
    setActivePane(activePane.id);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Stocker
            </h1>
            <span className="text-xs text-slate-500">
              {workspace.panes.length} {workspace.panes.length === 1 ? 'pane' : 'panes'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">
              Active: <span className="text-slate-300 font-medium">{activePane.symbol}</span>
            </span>
            <button
              onClick={() => addPane()}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              + Add pane
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex overflow-hidden">
        <Watchlist
          symbols={symbols}
          onAdd={addToWatchlist}
          onRemove={removeFromWatchlist}
          apiBaseUrl={API_BASE_URL}
          onSelect={selectFromWatchlist}
        />
        <div className="flex-grow overflow-y-auto p-4 min-h-0">
          <WorkspaceGrid
            workspace={workspace}
            streaming={docVisible}
            apiBaseUrl={API_BASE_URL}
            onActivate={setActivePane}
            onClose={removePane}
            onUpdate={updatePane}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
