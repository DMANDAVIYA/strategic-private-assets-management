import { currencyExponent, formatMinor, parseAmount } from "../src/money.js";

test("currencyExponent knows zero, two and three decimal currencies", () => {
  expect(currencyExponent("JPY")).toBe(0);
  expect(currencyExponent("KRW")).toBe(0);
  expect(currencyExponent("KWD")).toBe(3);
  expect(currencyExponent("BHD")).toBe(3);
  expect(currencyExponent("USD")).toBe(2);
  expect(currencyExponent("INR")).toBe(2);
  expect(currencyExponent("HUF")).toBe(2);
  expect(currencyExponent("XYZ")).toBe(2);
});

test("parseAmount accepts grouped decimals and returns minor units", () => {
  expect(parseAmount("1,234.56", "USD")).toBe(123456);
  expect(parseAmount("$12", "USD")).toBe(1200);
  expect(parseAmount("12.3", "USD")).toBe(1230);
  expect(parseAmount(" 12 ", "USD")).toBe(1200);
  expect(parseAmount("$ 12", "USD")).toBe(1200);
  expect(parseAmount("₹1,23,456.78", "INR")).toBe(12345678);
  expect(parseAmount("€0.05", "EUR")).toBe(5);
  expect(parseAmount("1234", "JPY")).toBe(1234);
  expect(parseAmount("¥1,234", "JPY")).toBe(1234);
  expect(parseAmount("1.234", "KWD")).toBe(1234);
  expect(parseAmount("1.2", "KWD")).toBe(1200);
});

test("parseAmount rejects malformed input", () => {
  expect(parseAmount("12.345", "USD")).toBeNull();
  expect(parseAmount("12.5", "JPY")).toBeNull();
  expect(parseAmount("1.2345", "KWD")).toBeNull();
  expect(parseAmount("-5", "USD")).toBeNull();
  expect(parseAmount("", "USD")).toBeNull();
  expect(parseAmount("   ", "USD")).toBeNull();
  expect(parseAmount("$", "USD")).toBeNull();
  expect(parseAmount("$$12", "USD")).toBeNull();
  expect(parseAmount("12.", "USD")).toBeNull();
  expect(parseAmount(".5", "USD")).toBeNull();
  expect(parseAmount("1.2.3", "USD")).toBeNull();
  expect(parseAmount("12abc", "USD")).toBeNull();
  expect(parseAmount("1e3", "USD")).toBeNull();
  expect(parseAmount("99999999999999999999", "USD")).toBeNull();
});

test("formatMinor uses en-US grouping with the currency symbol", () => {
  expect(formatMinor(123456, "USD")).toBe("$1,234.56");
  expect(formatMinor(0, "USD")).toBe("$0.00");
  expect(formatMinor(-4218000, "USD")).toBe("-$42,180.00");
  expect(formatMinor(1234, "JPY")).toBe("¥1,234");
  expect(formatMinor(3070, "KWD")).toBe("KWD 3.070");
});

test("formatMinor supports indian grouping", () => {
  expect(formatMinor(123456789, "INR", { grouping: "indian" })).toBe("₹12,34,567.89");
  expect(formatMinor(123456789, "INR", { grouping: "standard" })).toBe("₹1,234,567.89");
});

test("formatMinor signs positive and negative amounts but never zero", () => {
  expect(formatMinor(-4218000, "USD", { signed: true })).toBe("−$42,180.00");
  expect(formatMinor(123456, "USD", { signed: true })).toBe("+$1,234.56");
  expect(formatMinor(0, "USD", { signed: true })).toBe("$0.00");
  expect(formatMinor(-123456789, "INR", { grouping: "indian", signed: true })).toBe("−₹12,34,567.89");
});
