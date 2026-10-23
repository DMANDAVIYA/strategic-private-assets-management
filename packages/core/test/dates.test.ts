import { isIsoDate, isMonth, monthOf, monthRange, previousMonths, todayIso } from "../src/dates.js";

test("todayIso reports the calendar date in the given time zone", () => {
  expect(todayIso("America/New_York", Date.UTC(2026, 2, 1, 3, 30))).toBe("2026-02-28");
  expect(todayIso("UTC", Date.UTC(2026, 2, 1, 3, 30))).toBe("2026-03-01");
  expect(todayIso("Asia/Kolkata", Date.UTC(2026, 11, 31, 20, 0))).toBe("2027-01-01");
  expect(todayIso("America/New_York", Date.UTC(2026, 6, 4, 3, 30))).toBe("2026-07-03");
});

test("todayIso defaults to the current time", () => {
  expect(todayIso("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("isIsoDate accepts only real calendar dates", () => {
  expect(isIsoDate("2026-02-28")).toBe(true);
  expect(isIsoDate("2028-02-29")).toBe(true);
  expect(isIsoDate("2026-02-29")).toBe(false);
  expect(isIsoDate("2026-02-30")).toBe(false);
  expect(isIsoDate("2026-13-01")).toBe(false);
  expect(isIsoDate("2026-00-10")).toBe(false);
  expect(isIsoDate("2026-04-31")).toBe(false);
  expect(isIsoDate("2026-4-01")).toBe(false);
  expect(isIsoDate("20260401")).toBe(false);
  expect(isIsoDate("2026-04-01T00:00:00Z")).toBe(false);
  expect(isIsoDate("")).toBe(false);
});

test("isMonth accepts YYYY-MM with a valid month", () => {
  expect(isMonth("2026-01")).toBe(true);
  expect(isMonth("2026-12")).toBe(true);
  expect(isMonth("2026-13")).toBe(false);
  expect(isMonth("2026-00")).toBe(false);
  expect(isMonth("2026-1")).toBe(false);
  expect(isMonth("2026-01-01")).toBe(false);
  expect(isMonth("")).toBe(false);
});

test("monthOf takes the month from an iso date", () => {
  expect(monthOf("2026-02-28")).toBe("2026-02");
  expect(monthOf("2025-12-01")).toBe("2025-12");
});

test("monthRange covers the first to the last day", () => {
  expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  expect(monthRange("2100-02")).toEqual({ from: "2100-02-01", to: "2100-02-28" });
  expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
});

test("previousMonths lists oldest first and ends with the given month", () => {
  expect(previousMonths("2026-01", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  expect(previousMonths("2026-06", 1)).toEqual(["2026-06"]);
  expect(previousMonths("2026-03", 13)).toEqual([
    "2025-03",
    "2025-04",
    "2025-05",
    "2025-06",
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
  ]);
  expect(previousMonths("2026-01", 0)).toEqual([]);
});
