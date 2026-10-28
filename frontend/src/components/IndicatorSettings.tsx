import React from 'react';

export interface IndicatorConfig {
  enabled: boolean;
  params: Record<string, number>;
}

interface IndicatorSettingsProps {
  indicators: Record<string, IndicatorConfig>;
  onToggle: (name: string) => void;
  onParamChange: (name: string, param: string, value: number) => void;
}

const IndicatorSettings: React.FC<IndicatorSettingsProps> = ({ indicators, onToggle, onParamChange }) => {
  if (!indicators) return null;

  return (
    <div className="flex items-center space-x-6">
      {Object.entries(indicators).map(([name, config]) => (
        <div key={name} className="flex items-center space-x-3">
          <label className="text-xs font-medium text-slate-400 uppercase cursor-pointer flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={() => onToggle(name as any)}
              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="capitalize">{name.replace(/([A-Z])/g, ' $1')}</span>
          </label>
          
          {config.enabled && Object.entries(config.params).map(([param, value]) => (
            <div key={param} className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-500 uppercase">{param}</span>
              <input
                type="number"
                value={value}
                onChange={(e) => onParamChange(name as any, param, parseFloat(e.target.value))}
                className="w-10 bg-slate-800 border border-slate-700 text-xs rounded px-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default IndicatorSettings;
