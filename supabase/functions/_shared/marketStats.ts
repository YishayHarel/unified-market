/**
 * Historical base rates for pre-open conditions.
 *
 * The point of this module is that no percentage shown to a reader is ever
 * produced by a language model. A model asked "what are the odds this opens
 * green" will answer with a confident number drawn from nothing. Everything
 * here is counted from actual daily bars, so a stated probability means
 * "this is how often it went that way", which is a claim that can be checked.
 *
 * Data comes from Yahoo's chart endpoint: free, no key, daily OHLC.
 *
 * A note on what is and is not measurable here. Daily bars give previous close
 * and next open, so the full overnight gap — which already contains the
 * after-hours move — is measurable, and so is everything that happens after the
 * open. What is NOT measurable from this source is the path from an after-hours
 * quote at 8pm to the actual open, because that needs historical pre-market
 * ticks. So we answer "it is indicated to open +3%, here is what usually
 * happens next" rather than "an after-hours +3% usually becomes X at the open".
 */

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface GapEvent {
  date: string;
  /** Open versus previous close. */
  gapPct: number;
  /** Close versus open — whether the move continued after the bell. */
  followThroughPct: number;
  /** Gave back more than half the gap at some point during the day. */
  fadedHalf: boolean;
  /** Traded all the way back to the previous close. */
  filledGap: boolean;
  /** Closed on the same side of the open as the gap direction. */
  heldDirection: boolean;
}

export interface GapStats {
  sampleSize: number;
  /** Percentage that closed beyond the open, in the gap's direction. */
  heldDirectionPct: number;
  /** Percentage that gave back more than half the gap intraday. */
  fadedHalfPct: number;
  /** Percentage that fully retraced to the previous close. */
  filledGapPct: number;
  /** Median close-versus-open move, in percent. */
  medianFollowThroughPct: number;
  /** Window the sample was drawn from. */
  fromDate: string;
  toDate: string;
}

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_TIMEOUT_MS = 8000;

/**
 * Below this the percentages are noise dressed up as analysis — a single stock
 * may only gap hard a handful of times a year. Callers must present anything
 * under this as "insufficient history" rather than rounding it into a claim.
 */
export const MIN_SAMPLE_SIZE = 12;

export async function fetchDailyBars(
  symbol: string,
  range: "1y" | "2y" | "5y" | "10y" = "5y",
): Promise<DailyBar[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; UnifiedMarket/1.0)" },
      },
    );
    if (!res.ok) return [];

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps.length || !quote) return [];

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      // Yahoo pads holidays and halts with nulls.
      if ([open, high, low, close].some((v) => v == null)) continue;
      bars.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume: quote.volume?.[i] ?? null,
      });
    }
    return bars;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Turns a bar series into one record per overnight gap. */
export function computeGapEvents(bars: DailyBar[]): GapEvent[] {
  const events: GapEvent[] = [];

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const day = bars[i];
    if (prev.close <= 0 || day.open <= 0) continue;

    const gapPct = (day.open / prev.close - 1) * 100;
    const followThroughPct = (day.close / day.open - 1) * 100;
    const up = gapPct > 0;

    // Half-way back toward the previous close, measured against the intraday
    // extreme rather than the close: a gap that collapsed at 10am and recovered
    // by 4pm still faded, and that is what a reader watching the open cares
    // about.
    const halfwayBack = day.open - (day.open - prev.close) / 2;
    const fadedHalf = up ? day.low <= halfwayBack : day.high >= halfwayBack;
    const filledGap = up ? day.low <= prev.close : day.high >= prev.close;

    events.push({
      date: day.date,
      gapPct,
      followThroughPct,
      fadedHalf,
      filledGap,
      heldDirection: up ? followThroughPct > 0 : followThroughPct < 0,
    });
  }

  return events;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Base rates for gaps comparable to today's.
 *
 * Comparable means same direction and similar magnitude: a +0.4% gap says
 * nothing about a +6% one. The band widens if the strict match is too thin,
 * because a wider band with a real sample beats a precise one with n=3.
 */
export function summarizeGapStats(events: GapEvent[], todayGapPct: number): GapStats | null {
  if (events.length === 0) return null;

  const up = todayGapPct > 0;
  const magnitude = Math.abs(todayGapPct);

  const inBand = (tolerance: number) =>
    events.filter((e) => {
      if (up ? e.gapPct <= 0 : e.gapPct >= 0) return false;
      const diff = Math.abs(Math.abs(e.gapPct) - magnitude);
      return diff <= tolerance;
    });

  let sample = inBand(Math.max(0.25, magnitude * 0.5));
  if (sample.length < MIN_SAMPLE_SIZE) sample = inBand(Math.max(0.75, magnitude));
  if (sample.length < MIN_SAMPLE_SIZE) {
    // Last resort: every gap of at least this size in the same direction.
    sample = events.filter((e) =>
      up ? e.gapPct >= magnitude * 0.5 : e.gapPct <= -magnitude * 0.5
    );
  }
  if (sample.length === 0) return null;

  const pct = (n: number) => (n / sample.length) * 100;
  const dates = sample.map((e) => e.date).sort();

  return {
    sampleSize: sample.length,
    heldDirectionPct: pct(sample.filter((e) => e.heldDirection).length),
    fadedHalfPct: pct(sample.filter((e) => e.fadedHalf).length),
    filledGapPct: pct(sample.filter((e) => e.filledGap).length),
    medianFollowThroughPct: median(sample.map((e) => e.followThroughPct)),
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
  };
}

/** Convenience: bars, gaps, and base rates for one symbol in a single call. */
export async function gapStatsForSymbol(
  symbol: string,
  todayGapPct: number,
  range: "1y" | "2y" | "5y" | "10y" = "5y",
): Promise<GapStats | null> {
  const bars = await fetchDailyBars(symbol, range);
  if (bars.length < 60) return null;
  return summarizeGapStats(computeGapEvents(bars), todayGapPct);
}

/**
 * Renders stats as a sentence the model may quote verbatim.
 *
 * Handing over prose rather than an object matters: a model given raw numbers
 * tends to re-round or re-frame them, and these are exactly the figures that
 * must survive unchanged.
 */
export function describeGapStats(
  label: string,
  gapPct: number,
  stats: GapStats | null,
): string {
  if (!stats || stats.sampleSize < MIN_SAMPLE_SIZE) {
    return `${label}: indicated ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(2)}% — too few comparable days on record to quote a base rate.`;
  }

  const direction = gapPct > 0 ? "up" : "down";
  const sentences = [
    `${label}: indicated ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(2)}%.`,
    `Across ${stats.sampleSize} comparable ${direction} gaps since ${stats.fromDate}:`,
    `${stats.heldDirectionPct.toFixed(0)}% continued past the open,`,
    `${stats.fadedHalfPct.toFixed(0)}% gave back at least half the gap intraday,`,
    `${stats.filledGapPct.toFixed(0)}% fully retraced to the prior close.`,
    `Median move from open to close was ${stats.medianFollowThroughPct >= 0 ? "+" : ""}${stats.medianFollowThroughPct.toFixed(2)}%.`,
  ];

  // Half of a small gap is inside ordinary intraday noise, so a high fade rate
  // there says nothing about direction. Flag it rather than let the number be
  // quoted as if it were a signal.
  if (Math.abs(gapPct) < 0.5) {
    sentences.push(
      `Treat the fade and retrace figures as noise at this gap size — half of ${Math.abs(gapPct).toFixed(2)}% is within a normal day's range.`,
    );
  }

  return sentences.join(" ");
}
