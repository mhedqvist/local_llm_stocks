import React from 'react';

interface ControlBarProps {
  currentResolution: string;
  onResolutionChange: (resolution: string) => void;
}

const ControlBar: React.FC<ControlBarProps> = ({ currentResolution, onResolutionChange }) => {
  const resolutions = ['1m', '5m', '1h', '1d'];

  return (
    <div className="flex items-center space-x-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
      {resolutions.map((res) => (
        <button
          key={res}
          onClick={() => onResolutionChange(res)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            currentResolution === res
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {res}
        </button>
      ))}
    </div>
  );
};

export default ControlBar;
