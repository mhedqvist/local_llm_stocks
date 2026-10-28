import React from 'react';
import { ConnectionStatus } from '../types/websocket';

interface Props {
  status: ConnectionStatus;
}

const ConnectionStatusIndicator: React.FC<Props> = ({ status }) => {
  const statusConfig = {
    'CONNECTING': { color: 'bg-yellow-500', label: 'Connecting...' },
    'CONNECTED': { color: 'bg-green-500', label: 'Live' },
    'DISCONNECTED': { color: 'bg-red-500', label: 'Disconnected' },
    'RECONNECTING': { color: 'bg-orange-500', label: 'Reconnecting...' },
  };

  const config = statusConfig[status] || statusConfig['DISCONNECTED'];

  return (
    <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700">
      <div className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
      <span>{config.label}</span>
    </div>
  );
};

export default ConnectionStatusIndicator;
