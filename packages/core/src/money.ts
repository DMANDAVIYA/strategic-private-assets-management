const ZERO_EXPONENT = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);
const THREE_EXPONENT = new Set(["BHD", "KWD", "OMR", "JOD", "TND", "IQD", "LYD"]);
const LEADING_SYMBOLS = new Set(["$", "₹", "€", "£", "¥"]);
const MINUS_SIGN = "−";

export type FormatMinorOptions = { grouping?: "standard" | "indian"; signed?: boolean };

export function currencyExponent(code: string): number {
  if (ZERO_EXPONENT.has(code)) return 0;
  if (THREE_EXPONENT.has(code)) return 3;
  return 2;
}

export function parseAmount(text: string, code: string): number | null {
  const exponent = currencyExponent(code);
  let body = text.trim();
  if (body.length > 0 && LEADING_SYMBOLS.has(body[0] as string)) body = body.slice(1);
  body = body.replaceAll(",", "").trim();
  const pattern = exponent === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(body)) return null;
  const [whole, fraction = ""] = body.split(".");
  const minor = Number(`${whole}${fraction.padEnd(exponent, "0")}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMinor(minor: number, code: string, opts: FormatMinorOptions = {}): string {
  const locale = opts.grouping === "indian" ? "en-IN" : "en-US";
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: code });
  const major = minor / 10 ** currencyExponent(code);
  if (!opts.signed) return formatter.format(major);
  if (minor > 0) return `+${formatter.format(major)}`;
  if (minor < 0) return `${MINUS_SIGN}${formatter.format(-major)}`;
  return formatter.format(0);
}
