import { buildTrayMenuTemplate, TRAY_MENU_IDS } from "../src/menu.js";

function labels(state: { startAtLogin: boolean; autostartAllowed: boolean }): (string | undefined)[] {
  return buildTrayMenuTemplate(state).map((item) => item.label);
}

test("lists open, copy phone link, start at login, a separator and quit in order", () => {
  const template = buildTrayMenuTemplate({ startAtLogin: false, autostartAllowed: true });
  expect(template.map((item) => item.type ?? "normal")).toEqual(["normal", "normal", "checkbox", "separator", "normal"]);
  expect(labels({ startAtLogin: false, autostartAllowed: true })).toEqual([
    "Open financeper",
    "Copy phone link",
    "Start at login",
    undefined,
    "Quit",
  ]);
});

test("gives every actionable item a stable id", () => {
  const ids = buildTrayMenuTemplate({ startAtLogin: true, autostartAllowed: true })
    .filter((item) => item.type !== "separator")
    .map((item) => item.id);
  expect(ids).toEqual([TRAY_MENU_IDS.open, TRAY_MENU_IDS.copyPhoneLink, TRAY_MENU_IDS.startAtLogin, TRAY_MENU_IDS.quit]);
  expect(new Set(ids).size).toBe(ids.length);
});

test.each([true, false])("reflects startAtLogin=%s in the checkbox", (startAtLogin) => {
  const item = buildTrayMenuTemplate({ startAtLogin, autostartAllowed: true }).find((entry) => entry.id === TRAY_MENU_IDS.startAtLogin);
  expect(item?.type).toBe("checkbox");
  expect(item?.checked).toBe(startAtLogin);
  expect(item?.enabled).toBe(true);
});

test("disables the start at login checkbox when autostart is not allowed", () => {
  const item = buildTrayMenuTemplate({ startAtLogin: false, autostartAllowed: false }).find((entry) => entry.id === TRAY_MENU_IDS.startAtLogin);
  expect(item?.enabled).toBe(false);
  expect(item?.checked).toBe(false);
});

test("attaches no click handlers so the template stays serialisable", () => {
  const template = buildTrayMenuTemplate({ startAtLogin: true, autostartAllowed: true });
  expect(template.every((item) => item.click === undefined)).toBe(true);
  expect(() => JSON.stringify(template)).not.toThrow();
});
