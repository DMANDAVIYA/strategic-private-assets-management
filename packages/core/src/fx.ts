import { currencyExponent } from "./money.js";

export type FxRateRow = { date: string; currency: string; rateE8: number };
export type RateHit = { rateE8: number; asOfDate: string };
export type RateLookup = (currency: string, date: string) => RateHit | null;
export type ConvertedMinor = { minor: number; asOfDate: string };

const USD_RATE_E8 = 100_000_000;

export function buildRateLookup(rows: FxRateRow[]): RateLookup {
  const byCurrency = new Map<string, FxRateRow[]>();
  for (const row of rows) {
    const list = byCurrency.get(row.currency);
    if (list) list.push(row);
    else byCurrency.set(row.currency, [row]);
  }
  for (const list of byCurrency.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return (currency, date) => {
    if (currency === "USD") return { rateE8: USD_RATE_E8, asOfDate: date };
    const list = byCurrency.get(currency);
    if (!list) return null;
    let hit: FxRateRow | null = null;
    for (const row of list) {
      if (row.date > date) break;
      hit = row;
    }
    return hit ? { rateE8: hit.rateE8, asOfDate: hit.date } : null;
  };
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const quotient = (magnitude * 2n + denominator) / (denominator * 2n);
  return negative ? -quotient : quotient;
}

export function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
  date: string,
  lookup: RateLookup,
): ConvertedMinor | null {
  if (from === to) return { minor: amountMinor, asOfDate: date };
  const fromHit = lookup(from, date);
  const toHit = lookup(to, date);
  if (!fromHit || !toHit) return null;
  const numerator = BigInt(amountMinor) * BigInt(toHit.rateE8) * 10n ** BigInt(currencyExponent(to));
  const denominator = BigInt(fromHit.rateE8) * 10n ** BigInt(currencyExponent(from));
  const asOfDate = fromHit.asOfDate < toHit.asOfDate ? fromHit.asOfDate : toHit.asOfDate;
  return { minor: Number(divideHalfUp(numerator, denominator)), asOfDate };
}
