// Feature 9, sub-task C — deterministic 20 Hz PRICE_UPDATE mock server.
//
// Listens on :8123 (override with WS_MOCK_PORT). Any WebSocket upgrade to
// /api/ws/{symbol} receives PRICE_UPDATE JSON at 20 Hz (50 ms interval)
// with monotonically increasing OHLCV:
//   close(tick) = 100 + tick * 0.01  (strictly increasing)
//   time        = START_SEC + floor(tick / 20)  (non-decreasing; the first
//                20 ticks share START_SEC — lightweight-charts merges
//                same-second updates via series.update()).
// START_SEC is injected via WS_MOCK_START_SEC (unix seconds, aligned to a
// minute boundary and equal to the last fixture candle's time, so the
// chart never receives "old data").
//
// Plain HTTP requests get a 200 JSON body (used for readiness polling).

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.WS_MOCK_PORT || 8123);
const START_SEC = Number(process.env.WS_MOCK_START_SEC || Math.floor(Date.now() / 1000 / 60) * 60);

const round2 = (n) => Math.round(n * 100) / 100;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let tick = 0;
  let lastClose = 100;

  const interval = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(interval);
      return;
    }
    tick += 1;
    const open = lastClose;
    const close = round2(100 + tick * 0.01);
    lastClose = close;
    ws.send(
      JSON.stringify({
        type: 'PRICE_UPDATE',
        data: {
          time: START_SEC + Math.floor(tick / 20),
          open,
          high: round2(Math.max(open, close) + 0.01),
          low: round2(Math.min(open, close) - 0.01),
          close,
          volume: 1_000,
        },
      })
    );
  }, 50); // 20 Hz

  ws.on('close', () => clearInterval(interval));
  ws.on('error', () => clearInterval(interval));
});

server.listen(PORT, () => {
  console.log(`ws-mock-server: listening on :${PORT} (START_SEC=${START_SEC})`);
});
