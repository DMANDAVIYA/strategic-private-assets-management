import type { MenuItemConstructorOptions } from "electron";

export type TrayMenuState = { startAtLogin: boolean; autostartAllowed: boolean };

export const TRAY_MENU_IDS = {
  open: "open",
  copyPhoneLink: "copy-phone-link",
  startAtLogin: "start-at-login",
  quit: "quit",
} as const;

export function buildTrayMenuTemplate(state: TrayMenuState): MenuItemConstructorOptions[] {
  return [
    { id: TRAY_MENU_IDS.open, label: "Open financeper" },
    { id: TRAY_MENU_IDS.copyPhoneLink, label: "Copy phone link" },
    {
      id: TRAY_MENU_IDS.startAtLogin,
      label: "Start at login",
      type: "checkbox",
      checked: state.startAtLogin && state.autostartAllowed,
      enabled: state.autostartAllowed,
    },
    { type: "separator" },
    { id: TRAY_MENU_IDS.quit, label: "Quit" },
  ];
}
