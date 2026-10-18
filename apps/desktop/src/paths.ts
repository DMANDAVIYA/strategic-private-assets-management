import { app } from "electron";
import { join } from "node:path";

const APP_NAME = "financeper";

app.setName(APP_NAME);
app.setPath("userData", process.env.FP_USER_DATA || join(app.getPath("appData"), APP_NAME));

export const isDev = !app.isPackaged;

export const autostartAllowed = app.isPackaged && !process.env.FP_NO_AUTOSTART;

export const dbPath = join(app.getPath("userData"), "data.db");

export const autostartMarkerPath = join(app.getPath("userData"), "autostart-registered");

export const staticDir = isDev ? undefined : join(process.resourcesPath, "web");

export const migrationsDir = isDev
  ? join(__dirname, "..", "..", "..", "packages", "server", "drizzle")
  : join(process.resourcesPath, "drizzle");

export const iconPath = join(__dirname, "..", "resources", "icon.png");
