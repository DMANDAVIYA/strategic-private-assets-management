import { getAccessInfo } from "@financeper/server";
import { preferredAccessUrl } from "@financeper/shared";
import { app, clipboard, dialog, Menu, nativeImage, Tray, type MenuItem, type MenuItemConstructorOptions, type NativeImage } from "electron";
import { autostartEnabled, setAutostart } from "./autostart.js";
import { buildTrayMenuTemplate, TRAY_MENU_IDS } from "./menu.js";
import { iconPath } from "./paths.js";

export type TrayOptions = {
  port: number;
  autostartAllowed: boolean;
  open(): void;
  quit(): void | Promise<void>;
};

function trayImage(): NativeImage {
  const source = nativeImage.createFromPath(iconPath);
  const image = nativeImage.createEmpty();
  image.addRepresentation({ scaleFactor: 1, buffer: source.resize({ width: 16, height: 16 }).toPNG() });
  image.addRepresentation({ scaleFactor: 2, buffer: source.resize({ width: 32, height: 32 }).toPNG() });
  return image;
}

async function phoneLink(port: number): Promise<string | null> {
  try {
    return preferredAccessUrl(await getAccessInfo({ port }));
  } catch {
    return null;
  }
}

async function copyPhoneLink(port: number): Promise<void> {
  const url = await phoneLink(port);
  if (url === null) {
    await dialog.showMessageBox({ type: "info", title: "financeper", message: "No network address found." });
    return;
  }
  clipboard.writeText(url);
}

function startAtLogin(options: TrayOptions): boolean {
  return options.autostartAllowed && autostartEnabled();
}

export function createTray(options: TrayOptions): Tray {
  const tray = new Tray(trayImage());
  tray.setToolTip(`financeper · running on port ${options.port}`);
  const handlers: Record<string, (item: MenuItem) => void> = {
    [TRAY_MENU_IDS.open]: () => options.open(),
    [TRAY_MENU_IDS.copyPhoneLink]: () => void copyPhoneLink(options.port),
    [TRAY_MENU_IDS.startAtLogin]: (item) => {
      if (options.autostartAllowed) {
        setAutostart(item.checked);
      }
      render();
    },
    [TRAY_MENU_IDS.quit]: () => void options.quit(),
  };
  const withHandlers = (template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
    template.map((item) => (item.id !== undefined && handlers[item.id] ? { ...item, click: handlers[item.id] } : item));
  const render = (): void => {
    const state = { startAtLogin: startAtLogin(options), autostartAllowed: options.autostartAllowed };
    tray.setContextMenu(Menu.buildFromTemplate(withHandlers(buildTrayMenuTemplate(state))));
  };
  render();
  tray.on("click", () => options.open());
  tray.on("double-click", () => options.open());
  return tray;
}
