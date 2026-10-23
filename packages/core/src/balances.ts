import { monthOf } from "./dates.js";
import { convertMinor, type RateLookup } from "./fx.js";

export type LedgerKind = "income" | "expense" | "transfer";

export type LedgerTx = {
  date: string;
  kind: LedgerKind;
  sourceAccountId: number | null;
  targetAccountId: number | null;
  amountMinor: number;
  targetAmountMinor: number | null;
  currency: string;
  targetCurrency: string | null;
};

export type FlowSummary = { inMinor: number; outMinor: number; netMinor: number; missingRates: string[] };
export type MonthlyFlow = { month: string; inMinor: number; outMinor: number };

export function accountDelta(tx: LedgerTx, accountId: number): number {
  switch (tx.kind) {
    case "income":
      return tx.targetAccountId === accountId ? tx.amountMinor : 0;
    case "expense":
      return tx.sourceAccountId === accountId ? -tx.amountMinor : 0;
    case "transfer": {
      let delta = 0;
      if (tx.sourceAccountId === accountId) delta -= tx.amountMinor;
      if (tx.targetAccountId === accountId) delta += tx.targetAmountMinor ?? tx.amountMinor;
      return delta;
    }
  }
}

export function accountBalance(openingMinor: number, txs: LedgerTx[], accountId: number): number {
  return txs.reduce((balance, tx) => balance + accountDelta(tx, accountId), openingMinor);
}

export function flowSummary(txs: LedgerTx[], month: string, display: string, lookup: RateLookup): FlowSummary {
  const missing = new Set<string>();
  let inMinor = 0;
  let outMinor = 0;
  for (const tx of txs) {
    if (tx.kind === "transfer" || monthOf(tx.date) !== month) continue;
    const converted = convertMinor(tx.amountMinor, tx.currency, display, tx.date, lookup);
    if (!converted) {
      if (!lookup(tx.currency, tx.date)) missing.add(tx.currency);
      if (!lookup(display, tx.date)) missing.add(display);
      continue;
    }
    if (tx.kind === "income") inMinor += converted.minor;
    else outMinor += converted.minor;
  }
  return { inMinor, outMinor, netMinor: inMinor - outMinor, missingRates: [...missing].sort() };
}

export function monthlyFlows(txs: LedgerTx[], months: string[], display: string, lookup: RateLookup): MonthlyFlow[] {
  return months.map((month) => {
    const { inMinor, outMinor } = flowSummary(txs, month, display, lookup);
    return { month, inMinor, outMinor };
  });
}
