import { app } from "electron";

export const HIDDEN_FLAG = "--hidden";

export const startHidden = process.argv.includes(HIDDEN_FLAG);

export function setAutostart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_FLAG] });
}

export function autostartEnabled(): boolean {
  return app.getLoginItemSettings({ args: [HIDDEN_FLAG] }).openAtLogin;
}
