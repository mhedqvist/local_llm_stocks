import { describe, it, expect } from 'vitest';
import { OHLCV } from '../types/chart';
import {
  calculateSMA,
  calculateEMA,
  calculateEMA_Generic,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVolume,
  IndicatorPoint,
} from './indicators';

/** Builds OHLCV candles with strictly increasing unix times starting at 1. */
const mk = (closes: number[], timeOffset = 1): OHLCV[] =>
  closes.map((close, i) => ({
    time: timeOffset + i,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
  }));

describe('calculateSMA', () => {
  it('computes hand-verified values (period 3 over 5 closes)', () => {
    const data = mk([1, 2, 3, 4, 5]);
    const result = calculateSMA(data, 3);
    expect(result).toEqual([
      { time: 3, value: 2 },
      { time: 4, value: 3 },
      { time: 5, value: 4 },
    ]);
  });

  it('returns [] when series is shorter than period', () => {
    expect(calculateSMA(mk([1, 2]), 3)).toEqual([]);
  });

  it('returns exactly one point when series length equals period', () => {
    const result = calculateSMA(mk([2, 4, 6]), 3);
    expect(result).toEqual([{ time: 3, value: 4 }]);
  });

  it('is constant and equal to the price when all prices are equal', () => {
    const result = calculateSMA(mk([7, 7, 7, 7, 7]), 3);
    expect(result).toHaveLength(3);
    for (const p of result) expect(p.value).toBe(7);
  });

  it('period 1 is the identity of close prices', () => {
    const data = mk([3, 1, 4, 1, 5]);
    expect(calculateSMA(data, 1)).toEqual(
      data.map(d => ({ time: d.time, value: d.close }))
    );
  });

  it('returns [] for empty input', () => {
    expect(calculateSMA([], 3)).toEqual([]);
  });

  it('is index-based: gaps in timestamps do not change values', () => {
    // Same closes as the first test, but with gaps in time.
    const data = mk([1, 2, 3, 4, 5]).map((d, i) => ({ ...d, time: d.time + i * 10 }));
    const result = calculateSMA(data, 3);
    expect(result.map(p => p.value)).toEqual([2, 3, 4]);
  });
});

describe('calculateEMA_Generic', () => {
  it('seeds with SMA and follows the k = 2/(p+1) recurrence', () => {
    const points: IndicatorPoint[] = [1, 2, 3, 4, 5].map((v, i) => ({ time: i + 1, value: v }));
    const result = calculateEMA_Generic(points, 2);
    // k = 2/3; seed = SMA(1, 2) = 1.5
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ time: 2, value: 1.5 });
    expect(result[1].value).toBeCloseTo(2.5, 10); // 3*2/3 + 1.5/3
    expect(result[2].value).toBeCloseTo(3.5, 10); // 4*2/3 + 2.5/3
    expect(result[3].value).toBeCloseTo(4.5, 10); // 5*2/3 + 3.5/3
  });

  it('returns [] when series is shorter than period', () => {
    expect(calculateEMA_Generic([{ time: 1, value: 1 }], 3)).toEqual([]);
  });

  it('returns exactly one point (the SMA seed) when length equals period', () => {
    const points = [2, 4, 6].map((v, i) => ({ time: i + 1, value: v }));
    expect(calculateEMA_Generic(points, 3)).toEqual([{ time: 3, value: 4 }]);
  });

  it('is constant and equal to the price when all values are equal', () => {
    const points = [5, 5, 5, 5].map((v, i) => ({ time: i + 1, value: v }));
    const result = calculateEMA_Generic(points, 2);
    expect(result).toHaveLength(3); // n - period + 1
    for (const p of result) expect(p.value).toBe(5);
  });

  it('period 1 tracks the input value exactly (k = 1)', () => {
    const points = [1, 3, 2, 4].map((v, i) => ({ time: i + 1, value: v }));
    expect(calculateEMA_Generic(points, 1)).toEqual(points);
  });
});

describe('calculateEMA', () => {
  it('is equivalent to calculateEMA_Generic over mapped close prices', () => {
    const data = mk([1, 2, 3, 4, 5]);
    const points = data.map(d => ({ time: d.time, value: d.close }));
    expect(calculateEMA(data, 2)).toEqual(calculateEMA_Generic(points, 2));
  });

  it('returns [] when series is shorter than period', () => {
    expect(calculateEMA(mk([1, 2, 3]), 5)).toEqual([]);
  });
});

describe('calculateRSI', () => {
  it('computes hand-verified Wilder seed and smoothing (period 3)', () => {
    // closes [1, 2, 3, 2, 4]; changes +1, +1, -1, +2
    const data = mk([1, 2, 3, 2, 4]);
    const result = calculateRSI(data, 3);
    expect(result).toHaveLength(2);
    // seed: avgGain = 2/3, avgLoss = 1/3, RS = 2 → 100 - 100/3 (emitted at index 3 → time 4)
    expect(result[0].time).toBe(4);
    expect(result[0].value).toBeCloseTo(100 - 100 / 3, 10);
    // smoothed: avgGain = 10/9, avgLoss = 2/9, RS = 5 → 100 - 100/6 (time 5)
    expect(result[1].time).toBe(5);
    expect(result[1].value).toBeCloseTo(100 - 100 / 6, 10);
  });

  it('returns [] when series length is <= period', () => {
    expect(calculateRSI(mk([1, 2, 3]), 3)).toEqual([]);
    expect(calculateRSI(mk([1, 2]), 3)).toEqual([]);
  });

  it('is 100 for an all-gains series (avgLoss = 0)', () => {
    const result = calculateRSI(mk([1, 2, 3, 4]), 3);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(100);
  });

  it('is 0 for an all-losses series (avgGain = 0)', () => {
    const result = calculateRSI(mk([4, 3, 2, 1]), 3);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(0);
  });

  it('is 50 (neutral) for a flat series — 0/0 guard', () => {
    const result = calculateRSI(mk([7, 7, 7, 7]), 3);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(50);
  });

  it('stays within [0, 100] for a mixed series', () => {
    const closes = [10, 11, 10.5, 12, 11, 13, 12.5, 14, 13, 15];
    const result = calculateRSI(mk(closes), 4);
    expect(result.length).toBe(closes.length - 4);
    for (const p of result) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});

describe('calculateMACD', () => {
  it('computes hand-verified values (fast 2, slow 3, signal 2) on linear data', () => {
    const data = mk([1, 2, 3, 4, 5, 6]);
    const result = calculateMACD(data, 2, 3, 2);
    // fast EMA(2): t2 1.5, t3 2.5, t4 3.5, t5 4.5, t6 5.5
    // slow EMA(3): t3 2,   t4 3,   t5 4,   t6 5
    // macd line: constant 0.5 from t3; signal (EMA2 of 0.5s) = 0.5 from t4
    expect(result).toEqual([
      { time: 4, macd: 0.5, signal: 0.5, histogram: 0 },
      { time: 5, macd: 0.5, signal: 0.5, histogram: 0 },
      { time: 6, macd: 0.5, signal: 0.5, histogram: 0 },
    ]);
  });

  it('computes hand-verified values on non-linear data (fast 2, slow 3, signal 2)', () => {
    const data = mk([1, 3, 2, 6, 5, 8]);
    const result = calculateMACD(data, 2, 3, 2);
    // macd line: t3 0, t4 2/3, t5 7/18, t6 77/108
    // signal:    t4 1/3, t5 10/27, t6 97/162
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(4);
    expect(result[0].macd).toBeCloseTo(2 / 3, 10);
    expect(result[0].signal).toBeCloseTo(1 / 3, 10);
    expect(result[0].histogram).toBeCloseTo(1 / 3, 10);
    expect(result[1].macd).toBeCloseTo(7 / 18, 10);
    expect(result[1].signal).toBeCloseTo(10 / 27, 10);
    expect(result[1].histogram).toBeCloseTo(1 / 54, 10);
    expect(result[2].macd).toBeCloseTo(77 / 108, 10);
    expect(result[2].signal).toBeCloseTo(97 / 162, 10);
    expect(result[2].histogram).toBeCloseTo(37 / 324, 10); // 77/108 - 97/162
  });

  it('histogram equals macd - signal at every point', () => {
    const data = mk([10, 12, 9, 14, 11, 15, 13, 17, 12, 16, 18, 15, 19, 14]);
    const result = calculateMACD(data, 5, 8, 4);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(p.histogram).toBeCloseTo(p.macd - p.signal, 12);
    }
  });

  it('returns [] when series is shorter than slow period', () => {
    expect(calculateMACD(mk([1, 2, 3]), 12, 26, 9)).toEqual([]);
    expect(calculateMACD(mk([1, 2, 3]), 2, 3, 2)).toEqual([]);
  });

  it('len == slow period yields a single point once the signal line can seed', () => {
    const result = calculateMACD(mk([1, 2, 3, 4]), 2, 3, 2);
    // macd line: 0.5 @ t3, 0.5 @ t4 → signal seeds 0.5 @ t4
    expect(result).toEqual([{ time: 4, macd: 0.5, signal: 0.5, histogram: 0 }]);
  });

  it('starts at index slow + signal - 2 (result length = n - slow - signal + 2)', () => {
    const n = 10;
    const data = mk(Array.from({ length: n }, (_, i) => 10 + (i % 3)));
    const result = calculateMACD(data, 2, 3, 2);
    expect(result).toHaveLength(n - 3 - 2 + 2);
    expect(result[0].time).toBe(data[3].time);
  });

  it('is all zeros when all prices are equal', () => {
    const data = mk([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const result = calculateMACD(data, 2, 3, 2);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(p.macd).toBe(0);
      expect(p.signal).toBe(0);
      expect(p.histogram).toBe(0);
    }
  });
});

describe('calculateBollingerBands', () => {
  it('computes hand-verified values (period 3, multiplier 2, population std-dev)', () => {
    const data = mk([1, 2, 3]);
    const result = calculateBollingerBands(data, 3, 2);
    // mean 2, variance 2/3, std 0.8164965809278259
    const std = Math.sqrt(2 / 3);
    expect(result).toEqual([
      {
        time: 3,
        middle: 2,
        upper: 2 + 2 * std,
        lower: 2 - 2 * std,
      },
    ]);
    expect(result[0].upper).toBeCloseTo(3.6329931618556517, 12);
    expect(result[0].lower).toBeCloseTo(0.3670068381443483, 12);
  });

  it('slides the window (period 3 over 4 closes)', () => {
    const data = mk([1, 2, 3, 4]);
    const result = calculateBollingerBands(data, 3, 2);
    expect(result).toHaveLength(2);
    const std = Math.sqrt(2 / 3);
    expect(result[0].middle).toBe(2);
    expect(result[1].middle).toBe(3);
    expect(result[1].upper).toBeCloseTo(3 + 2 * std, 12);
    expect(result[1].lower).toBeCloseTo(3 - 2 * std, 12);
  });

  it('returns [] when series is shorter than period', () => {
    expect(calculateBollingerBands(mk([1, 2]), 3)).toEqual([]);
  });

  it('collapses to a single line when all prices are equal', () => {
    const data = mk([9, 9, 9, 9]);
    const result = calculateBollingerBands(data, 3, 2);
    expect(result).toHaveLength(2);
    for (const p of result) {
      expect(p.upper).toBe(p.middle);
      expect(p.middle).toBe(p.lower);
      expect(p.middle).toBe(9);
    }
  });

  it('custom multiplier scales bands symmetrically around middle', () => {
    const data = mk([1, 2, 3]);
    const std = Math.sqrt(2 / 3);
    const wide = calculateBollingerBands(data, 3, 1);
    expect(wide[0].upper).toBeCloseTo(2 + std, 12);
    expect(wide[0].lower).toBeCloseTo(2 - std, 12);
    expect(wide[0].upper - wide[0].middle).toBeCloseTo(wide[0].middle - wide[0].lower, 12);
  });
});

describe('calculateVolume', () => {
  it('maps time and volume identically for every point', () => {
    const data = [
      { time: 10, open: 1, high: 1, low: 1, close: 1, volume: 111 },
      { time: 20, open: 1, high: 1, low: 1, close: 1, volume: 222 },
      { time: 30, open: 1, high: 1, low: 1, close: 1, volume: 333 },
    ];
    expect(calculateVolume(data)).toEqual([
      { time: 10, value: 111 },
      { time: 20, value: 222 },
      { time: 30, value: 333 },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(calculateVolume([])).toEqual([]);
  });
});
