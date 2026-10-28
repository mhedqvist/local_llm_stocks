import React from 'react';

interface ChartContainerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  status: string;
  error: string | null;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ containerRef, status, error }) => {
  return (
    <div className="relative flex-grow min-h-[400px] rounded-lg overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export default ChartContainer;
