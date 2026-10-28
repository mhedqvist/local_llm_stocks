import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  PaneConfig,
  WorkspaceState,
  defaultIndicators,
  newPaneId,
  normalizeIndicators,
  normalizeWorkspace,
} from '../types/workspace';

const STORAGE_KEY = 'stocker.workspace.v1';
const LEGACY_RESOLUTION_KEY = 'resolution';
const LEGACY_INDICATORS_KEY = 'indicators';

/** Seed the workspace from single-chart-era localStorage keys (one-time migration). */
const migrateFromLegacy = (): WorkspaceState => {
  let resolution = '1d';
  let indicators = defaultIndicators();
  try {
    const legacyRes = window.localStorage.getItem(LEGACY_RESOLUTION_KEY);
    if (legacyRes) resolution = JSON.parse(legacyRes);
    const legacyInd = window.localStorage.getItem(LEGACY_INDICATORS_KEY);
    if (legacyInd) indicators = normalizeIndicators(JSON.parse(legacyInd));
  } catch (err) {
    console.warn('Legacy workspace migration failed, using defaults:', err);
  }
  const id = newPaneId();
  return {
    version: 1,
    panes: [{ id, symbol: 'AAPL', resolution, indicators }],
    activePaneId: id,
  };
};

let initialWorkspace: WorkspaceState | null = null;
const getInitialWorkspace = (): WorkspaceState => {
  if (!initialWorkspace) {
    initialWorkspace = migrateFromLegacy();
  }
  return initialWorkspace;
};

export const useWorkspace = () => {
  const [workspace, setWorkspace] = useLocalStorage<WorkspaceState>(
    STORAGE_KEY,
    getInitialWorkspace()
  );

  const addPane = useCallback(
    (symbol?: string) => {
      setWorkspace((ws) => {
        const source = ws.panes.find((p) => p.id === ws.activePaneId) ?? ws.panes[0];
        const pane: PaneConfig = {
          id: newPaneId(),
          symbol: symbol ?? source.symbol,
          // New panes default to an intraday view for correlation scanning.
          resolution: source.resolution === '1d' ? '1h' : source.resolution,
          indicators: defaultIndicators(),
        };
        return { ...ws, panes: [...ws.panes, pane], activePaneId: pane.id };
      });
    },
    [setWorkspace]
  );

  const removePane = useCallback(
    (id: string) => {
      setWorkspace((ws) => {
        const panes = ws.panes.filter((p) => p.id !== id);
        if (panes.length === 0) return ws; // keep at least one pane
        const activePaneId = ws.activePaneId === id ? panes[0].id : ws.activePaneId;
        return { ...ws, panes, activePaneId };
      });
    },
    [setWorkspace]
  );

  const updatePane = useCallback(
    (id: string, patch: Partial<Omit<PaneConfig, 'id'>>) => {
      setWorkspace((ws) => ({
        ...ws,
        panes: ws.panes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [setWorkspace]
  );

  const setActivePane = useCallback(
    (id: string) => {
      setWorkspace((ws) =>
        ws.panes.some((p) => p.id === id) ? { ...ws, activePaneId: id } : ws
      );
    },
    [setWorkspace]
  );

  const activePane = useMemo(
    () => workspace.panes.find((p) => p.id === workspace.activePaneId) ?? workspace.panes[0],
    [workspace]
  );

  return { workspace, activePane, addPane, removePane, updatePane, setActivePane };
};
