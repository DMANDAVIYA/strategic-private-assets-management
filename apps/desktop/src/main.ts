import { autostartAllowed, autostartMarkerPath, dbPath, isDev, migrationsDir, staticDir } from "./paths.js";
import { startServer, type RunningServer } from "@financeper/server";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { app, BrowserWindow, dialog, type Tray } from "electron";
import { createTray } from "./tray.js";

const PORT = 7777;
const SERVER_ORIGIN = `http://127.0.0.1:${PORT}`;
const DEV_ORIGIN = "http://localhost:5173";
const ALLOWED_ORIGINS = new Set([SERVER_ORIGIN, DEV_ORIGIN]);
const RETRY_LOAD_MS = 500;

let mainWindow: BrowserWindow | null = null;
let server: RunningServer | null = null;
let tray: Tray | null = null;
let quitting = false;

function showWindow(): void {
  if (mainWindow === null) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function isAllowedUrl(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function createWindow(entryUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#1B2730",
    autoHideMenuBar: true,
    title: "financeper",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
    }
  });
  window.webContents.on("did-fail-load", (_event, _code, _description, failedUrl, isMainFrame) => {
    if (isMainFrame && failedUrl === entryUrl) {
      setTimeout(() => void window.loadURL(entryUrl), RETRY_LOAD_MS);
    }
  });
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  void window.loadURL(entryUrl);
  return window;
}

async function quit(): Promise<void> {
  quitting = true;
  tray?.destroy();
  tray = null;
  try {
    await server?.close();
  } finally {
    server = null;
    app.quit();
  }
}

function registerAutostartOnce(): void {
  if (!autostartAllowed || existsSync(autostartMarkerPath)) {
    return;
  }
  app.setLoginItemSettings({ openAtLogin: true });
  mkdirSync(dirname(autostartMarkerPath), { recursive: true });
  writeFileSync(autostartMarkerPath, "");
}

function isAddressInUse(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "EADDRINUSE";
}

async function start(): Promise<void> {
  process.env.MIGRATIONS_DIR = migrationsDir;
  const desktopToken = randomBytes(32).toString("base64url");
  try {
    server = await startServer({ dbPath, host: "0.0.0.0", port: PORT, staticDir, desktopToken });
  } catch (error) {
    if (isAddressInUse(error)) {
      dialog.showErrorBox("financeper", `financeper is already running or port ${PORT} is in use.`);
      app.quit();
      return;
    }
    throw error;
  }
  const origin = isDev ? DEV_ORIGIN : SERVER_ORIGIN;
  mainWindow = createWindow(`${origin}/desktop/enter?token=${desktopToken}`);
  tray = createTray({ port: PORT, autostartAllowed, open: showWindow, quit });
  registerAutostartOnce();
}

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => undefined);
  app.on("before-quit", () => {
    quitting = true;
  });
  app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      dialog.showErrorBox("financeper", error instanceof Error ? error.message : String(error));
      app.quit();
    });
} else {
  app.quit();
}
