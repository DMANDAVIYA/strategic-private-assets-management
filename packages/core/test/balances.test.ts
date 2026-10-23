import { accountBalance, accountDelta, flowSummary, monthlyFlows, type LedgerTx } from "../src/balances.js";
import { buildRateLookup } from "../src/fx.js";

const CHECKING = 1;
const SAVINGS = 2;
const OTHER = 3;

function tx(overrides: Partial<LedgerTx>): LedgerTx {
  return {
    date: "2026-10-05",
    kind: "expense",
    sourceAccountId: CHECKING,
    targetAccountId: null,
    amountMinor: 0,
    targetAmountMinor: null,
    currency: "USD",
    targetCurrency: null,
    ...overrides,
  };
}

const income = tx({ kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 5000 });
const expense = tx({ kind: "expense", amountMinor: 1200 });
const transferOut = tx({ kind: "transfer", targetAccountId: SAVINGS, amountMinor: 3000 });
const crossTransfer = tx({
  kind: "transfer",
  targetAccountId: SAVINGS,
  amountMinor: 3000,
  targetAmountMinor: 2520,
  targetCurrency: "EUR",
});

test("accountDelta signs income, expense and transfer legs", () => {
  expect(accountDelta(income, CHECKING)).toBe(5000);
  expect(accountDelta(expense, CHECKING)).toBe(-1200);
  expect(accountDelta(transferOut, CHECKING)).toBe(-3000);
  expect(accountDelta(transferOut, SAVINGS)).toBe(3000);
  expect(accountDelta(crossTransfer, CHECKING)).toBe(-3000);
  expect(accountDelta(crossTransfer, SAVINGS)).toBe(2520);
});

test("accountDelta is zero for unrelated accounts", () => {
  expect(accountDelta(income, OTHER)).toBe(0);
  expect(accountDelta(expense, OTHER)).toBe(0);
  expect(accountDelta(transferOut, OTHER)).toBe(0);
  expect(accountDelta(income, SAVINGS)).toBe(0);
  expect(accountDelta(expense, SAVINGS)).toBe(0);
});

test("accountBalance applies every transaction to the opening balance", () => {
  expect(accountBalance(10000, [income, expense, transferOut], CHECKING)).toBe(10800);
  expect(accountBalance(0, [income, expense, crossTransfer], SAVINGS)).toBe(2520);
  expect(accountBalance(-500, [], OTHER)).toBe(-500);
});

const lookup = buildRateLookup([{ date: "2026-10-01", currency: "INR", rateE8: 8365000000 }]);

const monthTxs: LedgerTx[] = [
  tx({ date: "2026-10-03", kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 210000 }),
  tx({ date: "2026-10-12", kind: "expense", amountMinor: 1821000, currency: "INR" }),
  tx({ date: "2026-10-20", kind: "transfer", targetAccountId: SAVINGS, amountMinor: 50000 }),
  tx({ date: "2026-09-30", kind: "expense", amountMinor: 9900 }),
  tx({ date: "2026-11-01", kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 7700 }),
];

test("flowSummary converts the month's income and expenses and ignores transfers", () => {
  expect(flowSummary(monthTxs, "2026-10", "USD", lookup)).toEqual({
    inMinor: 210000,
    outMinor: 21769,
    netMinor: 188231,
    missingRates: [],
  });
});

test("flowSummary reports in the display currency", () => {
  expect(flowSummary(monthTxs, "2026-10", "INR", lookup)).toEqual({
    inMinor: 17566500,
    outMinor: 1821000,
    netMinor: 15745500,
    missingRates: [],
  });
});

test("flowSummary excludes rows without a rate and lists their currencies", () => {
  const withEur = [...monthTxs, tx({ date: "2026-10-15", kind: "expense", amountMinor: 4000, currency: "EUR" })];
  expect(flowSummary(withEur, "2026-10", "USD", lookup)).toEqual({
    inMinor: 210000,
    outMinor: 21769,
    netMinor: 188231,
    missingRates: ["EUR"],
  });
});

test("flowSummary deduplicates and sorts missing currencies", () => {
  const txs = [
    tx({ date: "2026-10-15", kind: "expense", amountMinor: 4000, currency: "GBP" }),
    tx({ date: "2026-10-16", kind: "expense", amountMinor: 4000, currency: "EUR" }),
    tx({ date: "2026-10-17", kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 10, currency: "EUR" }),
    tx({ date: "2026-10-18", kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 100 }),
  ];
  expect(flowSummary(txs, "2026-10", "USD", lookup)).toEqual({
    inMinor: 100,
    outMinor: 0,
    netMinor: 100,
    missingRates: ["EUR", "GBP"],
  });
});

test("flowSummary names the display currency when it has no rate", () => {
  const txs = [tx({ date: "2026-10-18", kind: "income", sourceAccountId: null, targetAccountId: CHECKING, amountMinor: 100 })];
  expect(flowSummary(txs, "2026-10", "EUR", lookup)).toEqual({
    inMinor: 0,
    outMinor: 0,
    netMinor: 0,
    missingRates: ["EUR"],
  });
});

test("flowSummary of an empty month is all zeros", () => {
  expect(flowSummary(monthTxs, "2026-08", "USD", lookup)).toEqual({
    inMinor: 0,
    outMinor: 0,
    netMinor: 0,
    missingRates: [],
  });
});

test("monthlyFlows returns one entry per month in the given order", () => {
  expect(monthlyFlows(monthTxs, ["2026-09", "2026-10", "2026-11"], "USD", lookup)).toEqual([
    { month: "2026-09", inMinor: 0, outMinor: 9900 },
    { month: "2026-10", inMinor: 210000, outMinor: 21769 },
    { month: "2026-11", inMinor: 7700, outMinor: 0 },
  ]);
  expect(monthlyFlows(monthTxs, [], "USD", lookup)).toEqual([]);
});
