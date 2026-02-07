"use strict";
const electron = require("electron");
const path = require("path");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const isDev = process.env.NODE_ENV === "development";
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: path__namespace.join(__dirname, "preload.js")
    }
  });
  mainWindow.loadURL(
    isDev ? "http://localhost:5173" : `file://${path__namespace.join(__dirname, "../dist/index.html")}`
  );
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
