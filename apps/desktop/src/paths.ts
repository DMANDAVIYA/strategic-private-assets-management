import { app } from "electron";
import { join } from "node:path";

const userDataOverride = process.env.FP_USER_DATA;
if (userDataOverride) {
  app.setPath("userData", userDataOverride);
}

export const isDev = !app.isPackaged;

export const autostartAllowed = app.isPackaged && !process.env.FP_NO_AUTOSTART;

export const dbPath = join(app.getPath("userData"), "data.db");

export const autostartMarkerPath = join(app.getPath("userData"), "autostart-registered");

export const staticDir = isDev ? undefined : join(process.resourcesPath, "web");

export const migrationsDir = isDev
  ? join(__dirname, "..", "..", "..", "packages", "server", "drizzle")
  : join(process.resourcesPath, "drizzle");

export const iconPath = join(__dirname, "..", "resources", "icon.png");
