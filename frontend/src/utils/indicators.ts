import { OHLCV } from '../types/chart';

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Calculates Simple Moving Average (SMA)
 * @param data Array of OHLCV data points
 * @param period The number of periods to use for the average
 * @returns Array of indicator data points
 */
export const calculateSMA = (data: OHLCV[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  return result;
};

/**
 * Generic Exponential Moving Average (EMA)
 * @param data Array of points with time and value
 * @param period The number of periods to use for the average
 * @returns Array of indicator data points
 */
export const calculateEMA_Generic = (data: IndicatorPoint[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  const k = 2 / (period + 1);
  
  // First EMA is the SMA of the first 'period' points
  let ema = data.slice(0, period).reduce((acc, val) => acc + val.value, 0) / period;
  result.push({
    time: data[period - 1].time,
    value: ema,
  });

  for (let i = period; i < data.length; i++) {
    ema = data[i].value * k + ema * (1 - k);
    result.push({
      time: data[i].time,
      value: ema,
    });
  }
  return result;
};

/**
 * Calculates Exponential Moving Average (EMA)
 * @param data Array of OHLCV data points
 * @param period The number of periods to use for the average
 * @returns Array of indicator data points
 */
export const calculateEMA = (data: OHLCV[], period: number): IndicatorPoint[] => {
  const points: IndicatorPoint[] = data.map(d => ({ time: d.time, value: d.close }));
  return calculateEMA_Generic(points, period);
};

/**
 * Calculates Relative Strength Index (RSI)
 * @param data Array of OHLCV data points
 * @param period The number of periods to use for the calculation
 * @returns Array of indicator data points
 */
export const calculateRSI = (data: OHLCV[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

  // Initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Guard: a completely flat market (0/0) is neutral, not NaN.
  const rsiFromAverages = (g: number, l: number): number =>
    g === 0 && l === 0 ? 50 : 100 - 100 / (1 + g / l);

  result.push({
    time: data[period].time,
    value: rsiFromAverages(avgGain, avgLoss),
  });

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = rsiFromAverages(avgGain, avgLoss);
    result.push({
      time: data[i].time,
      value: rsi,
    });
  }

  return result;
};

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 * @param data Array of OHLCV data points
 * @param fastPeriod Fast EMA period (default 12)
 * @param slowPeriod Slow EMA period (default 26)
 * @param signalPeriod Signal line EMA period (default 9)
 * @returns Array of MACD data points
 */
export const calculateMACD = (
  data: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] => {
  if (data.length < slowPeriod) return [];

  const pricePoints: IndicatorPoint[] = data.map(d => ({ time: d.time, value: d.close }));
  
  const fastEMA = calculateEMA_Generic(pricePoints.slice(0, data.length), fastPeriod);
  const slowEMA = calculateEMA_Generic(pricePoints.slice(0, data.length), slowPeriod);

  // Aligning EMA points to create MACD Line
  // Since calculateEMA_Generic returns points starting from period-1, we need to match them.
  const macdLinePoints: IndicatorPoint[] = [];
  
  // Create a map for quick lookup of EMA values by time
  const fastEMAMap = new Map(fastEMA.map(p => [p.time, p.value]));
  const slowEMAMap = new Map(slowEMA.map(p => [p.time, p.value]));

  for (const point of pricePoints) {
    const fastVal = fastEMAMap.get(point.time);
    const slowVal = slowEMAMap.get(point.time);

    if (fastVal !== undefined && slowVal !== undefined) {
      macdLinePoints.push({
        time: point.time,
        value: fastVal - slowVal
      });
    }
  }

  const signalLine = calculateEMA_Generic(macdLinePoints, signalPeriod);
  const signalMap = new Map(signalLine.map(p => [p.time, p.value]));

  const result: MACDPoint[] = [];
  for (const point of macdLinePoints) {
    const signalVal = signalMap.get(point.time);
    if (signalVal !== undefined) {
      result.push({
        time: point.time,
        macd: point.value,
        signal: signalVal,
        histogram: point.value - signalVal
      });
    }
  }

  return result;
};

/**
 * Calculates Bollinger Bands
 * @param data Array of OHLCV data points
 * @param period The number of periods to use for the moving average and standard deviation
 * @param stdDev The standard deviation multiplier (default 2)
 * @returns Array of Bollinger Bands data points
 */
export const calculateBollingerBands = (
  data: OHLCV[],
  period: number,
  stdDevMultiplier: number = 2
): BollingerBandsPoint[] => {
  const result: BollingerBandsPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val.close, 0);
    const mean = sum / period;

    const variance = slice.reduce((acc, val) => acc + Math.pow(val.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      middle: mean,
      upper: mean + stdDevMultiplier * stdDev,
      lower: mean - stdDevMultiplier * stdDev,
    });
  }

  return result;
};

/**
 * Formats volume data for charting
 * @param data Array of OHLCV data points
 * @returns Array of indicator data points
 */
export const calculateVolume = (data: OHLCV[]): IndicatorPoint[] => {
  return data.map(d => ({
    time: d.time,
    value: d.volume
  }));
};
