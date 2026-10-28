import { Range, Time } from 'lightweight-charts';

/** Visible time window shared across panes (lightweight-charts `Range<Time>`). */
type TimeRange = Range<Time>;

/**
 * Framework-free singleton that synchronizes crosshair positions and
 * time-scale windows across all chart panes. Handlers live outside the
 * React render tree so high-frequency mouse/scroll events never trigger
 * React re-renders.
 *
 * Every broadcast carries the source pane id; panes must ignore events
 * where `sourceId === ownId` to prevent echo loops.
 */

export interface CrosshairEvent {
  /** Time under the cursor, or null when the mouse left the pane. */
  time: Time | null;
  /** Price value on the source pane's main scale (informational). */
  price: number | null;
}

type CrosshairHandler = (event: CrosshairEvent, sourceId: string) => void;
type TimeRangeHandler = (range: TimeRange, sourceId: string) => void;

class WorkspaceSync {
  private crosshairHandlers = new Map<string, CrosshairHandler>();
  private timeRangeHandlers = new Map<string, TimeRangeHandler>();

  subscribeCrosshair(id: string, handler: CrosshairHandler): () => void {
    this.crosshairHandlers.set(id, handler);
    return () => this.crosshairHandlers.delete(id);
  }

  subscribeTimeRange(id: string, handler: TimeRangeHandler): () => void {
    this.timeRangeHandlers.set(id, handler);
    return () => this.timeRangeHandlers.delete(id);
  }

  /** Remove all subscriptions for a pane (called on pane teardown). */
  forget(id: string): void {
    this.crosshairHandlers.delete(id);
    this.timeRangeHandlers.delete(id);
  }

  broadcastCrosshair(event: CrosshairEvent, sourceId: string): void {
    for (const [id, handler] of this.crosshairHandlers) {
      if (id !== sourceId) handler(event, sourceId);
    }
  }

  broadcastTimeRange(range: TimeRange, sourceId: string): void {
    for (const [id, handler] of this.timeRangeHandlers) {
      if (id !== sourceId) handler(range, sourceId);
    }
  }
}

export const workspaceSync = new WorkspaceSync();
