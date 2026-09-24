const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crm', {
  load: () => ipcRenderer.sendSync('crm:load'),
  // Синхронно, чтобы сохранение перед закрытием окна гарантированно дошло до диска.
  save: (data) => ipcRenderer.sendSync('crm:save', data),
  copyText: (text) => ipcRenderer.invoke('crm:copy-text', text),
  copyImage: (dataUrl) => ipcRenderer.invoke('crm:copy-image', dataUrl)
});
