// electron/preload.js — Minimal preload script for MASOMO
// Context isolation is enabled, so this runs in an isolated context.
// We expose a small, safe API to the renderer via contextBridge.

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('masomo', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
})
