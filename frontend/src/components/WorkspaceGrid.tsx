import React from 'react';
import { WorkspaceState } from '../types/workspace';
import ChartPane from './ChartPane';

interface WorkspaceGridProps {
  workspace: WorkspaceState;
  /** Document is visible; false pauses all pane streams. */
  streaming: boolean;
  apiBaseUrl: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onUpdate: (
    id: string,
    patch: Partial<Omit<import('../types/workspace').PaneConfig, 'id'>>
  ) => void;
}

// Deterministic column count from pane count. Literal Tailwind classes so
// the JIT scanner picks them up.
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2',
  5: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  6: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
};

const columnsClass = (count: number): string =>
  count <= 4 ? GRID_COLS[count] : GRID_COLS[6];

const WorkspaceGrid: React.FC<WorkspaceGridProps> = ({
  workspace,
  streaming,
  apiBaseUrl,
  onActivate,
  onClose,
  onUpdate,
}) => {
  return (
    <div
      className={`grid ${columnsClass(workspace.panes.length)} gap-3 h-full min-h-0`}
    >
      {workspace.panes.map((pane) => (
        <ChartPane
          key={pane.id}
          pane={pane}
          isActive={pane.id === workspace.activePaneId}
          streaming={streaming}
          apiBaseUrl={apiBaseUrl}
          onActivate={onActivate}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
};

export default WorkspaceGrid;
