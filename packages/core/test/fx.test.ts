import { buildRateLookup, convertMinor, type FxRateRow } from "../src/fx.js";

const rows: FxRateRow[] = [
  { date: "2026-10-17", currency: "INR", rateE8: 8365000000 },
  { date: "2026-10-10", currency: "INR", rateE8: 8300000000 },
  { date: "2026-10-01", currency: "INR", rateE8: 8200000000 },
  { date: "2026-10-17", currency: "JPY", rateE8: 15000000000 },
  { date: "2026-10-17", currency: "KWD", rateE8: 30700000 },
  { date: "2026-10-17", currency: "ABC", rateE8: 300000000 },
];

const lookup = buildRateLookup(rows);

test("lookup returns the latest row on or before the requested date", () => {
  expect(lookup("INR", "2026-10-17")).toEqual({ rateE8: 8365000000, asOfDate: "2026-10-17" });
  expect(lookup("INR", "2026-10-12")).toEqual({ rateE8: 8300000000, asOfDate: "2026-10-10" });
  expect(lookup("INR", "2026-10-10")).toEqual({ rateE8: 8300000000, asOfDate: "2026-10-10" });
  expect(lookup("INR", "2026-11-30")).toEqual({ rateE8: 8365000000, asOfDate: "2026-10-17" });
});

test("lookup never fills forward from the future", () => {
  expect(lookup("INR", "2026-09-30")).toBeNull();
  expect(lookup("EUR", "2026-10-17")).toBeNull();
  expect(lookup("JPY", "2026-10-16")).toBeNull();
});

test("lookup treats USD as the base at one", () => {
  expect(lookup("USD", "2026-10-17")).toEqual({ rateE8: 100_000_000, asOfDate: "2026-10-17" });
  expect(lookup("USD", "1999-01-01")).toEqual({ rateE8: 100_000_000, asOfDate: "1999-01-01" });
  expect(buildRateLookup([])("USD", "2026-01-01")).toEqual({ rateE8: 100_000_000, asOfDate: "2026-01-01" });
});

test("convertMinor converts usd to inr using the rate date", () => {
  expect(convertMinor(100, "USD", "INR", "2026-10-17", lookup)).toEqual({ minor: 8365, asOfDate: "2026-10-17" });
  expect(convertMinor(100, "USD", "INR", "2026-10-12", lookup)).toEqual({ minor: 8300, asOfDate: "2026-10-10" });
});

test("convertMinor rounds half-up on the final minor unit", () => {
  expect(convertMinor(1, "INR", "USD", "2026-10-17", lookup)).toEqual({ minor: 0, asOfDate: "2026-10-17" });
  expect(convertMinor(50, "INR", "USD", "2026-10-17", lookup)).toEqual({ minor: 1, asOfDate: "2026-10-17" });
  expect(convertMinor(-50, "INR", "USD", "2026-10-17", lookup)).toEqual({ minor: -1, asOfDate: "2026-10-17" });
  expect(convertMinor(1821000, "INR", "USD", "2026-10-17", lookup)).toEqual({ minor: 21769, asOfDate: "2026-10-17" });
});

test("convertMinor respects currency exponents", () => {
  expect(convertMinor(1000, "JPY", "USD", "2026-10-17", lookup)).toEqual({ minor: 667, asOfDate: "2026-10-17" });
  expect(convertMinor(1000, "USD", "KWD", "2026-10-17", lookup)).toEqual({ minor: 3070, asOfDate: "2026-10-17" });
  expect(convertMinor(3070, "KWD", "JPY", "2026-10-17", lookup)).toEqual({ minor: 1500, asOfDate: "2026-10-17" });
});

test("convertMinor stays exact for amounts near the safe integer limit", () => {
  expect(convertMinor(9007199254740987, "ABC", "USD", "2026-10-17", lookup)).toEqual({
    minor: 3002399751580329,
    asOfDate: "2026-10-17",
  });
  expect(convertMinor(9007199254740991, "INR", "USD", "2026-10-17", lookup)).toEqual({
    minor: 107677217629898,
    asOfDate: "2026-10-17",
  });
});

test("convertMinor returns null when either rate is missing", () => {
  expect(convertMinor(100, "USD", "EUR", "2026-10-17", lookup)).toBeNull();
  expect(convertMinor(100, "EUR", "USD", "2026-10-17", lookup)).toBeNull();
  expect(convertMinor(100, "USD", "INR", "2026-09-30", lookup)).toBeNull();
  expect(convertMinor(100, "JPY", "INR", "2026-10-16", lookup)).toBeNull();
});

test("convertMinor is the identity when both currencies match", () => {
  expect(convertMinor(12345, "USD", "USD", "2026-10-17", lookup)).toEqual({ minor: 12345, asOfDate: "2026-10-17" });
  expect(convertMinor(500, "INR", "INR", "2026-09-01", lookup)).toEqual({ minor: 500, asOfDate: "2026-09-01" });
  expect(convertMinor(500, "EUR", "EUR", "2026-10-17", lookup)).toEqual({ minor: 500, asOfDate: "2026-10-17" });
});
