const { app, BrowserWindow, Menu, ipcMain, clipboard, ClipboardItem, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'crm-data.json');

let mainWindow = null;
// После «Сбросить к демо-данным» окно перезагружается; сохранения, которые
// страница успеет отправить перед выгрузкой, не должны вернуть старую базу.
let ignoreSaves = false;

function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Не удалось прочитать базу:', e);
    return null;
  }
}

function writeData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Пишем во временный файл и переименовываем, чтобы при сбое не остаться с битой базой.
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile);
}

ipcMain.on('crm:load', (event) => {
  ignoreSaves = false;
  event.returnValue = readData();
});

ipcMain.on('crm:save', (event, data) => {
  if (ignoreSaves) { event.returnValue = false; return; }
  try {
    writeData(data);
    event.returnValue = true;
  } catch (e) {
    console.error('Не удалось сохранить базу:', e);
    event.returnValue = false;
  }
});

ipcMain.handle('crm:copy-text', (event, text) => clipboard.writeText(String(text)));

ipcMain.handle('crm:copy-image', (event, dataUrl) => {
  const png = Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
  if (!png.length) throw new Error('empty image');
  return clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
});

async function backupData() {
  if (!fs.existsSync(dataFile)) {
    await dialog.showMessageBox(mainWindow, { type: 'info', message: 'Пока нечего сохранять — база ещё не создана.' });
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Резервная копия базы',
    defaultPath: `crm-backup-${stamp}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return;
  fs.copyFileSync(dataFile, filePath);
}

async function restoreData() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Восстановить базу из резервной копии',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    if (!Array.isArray(data.companies) || !Array.isArray(data.deals)) throw new Error('bad format');
  } catch (e) {
    dialog.showErrorBox('Не получилось', 'Файл не похож на резервную копию CRM.');
    return;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Восстановить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    message: 'Заменить текущую базу данными из резервной копии?',
    detail: 'Текущие данные будут перезаписаны.'
  });
  if (response !== 0) return;
  ignoreSaves = true;
  writeData(data);
  mainWindow.reload();
}

async function resetToDemo() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Сбросить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    message: 'Сбросить базу к демо-данным?',
    detail: 'Все внесённые данные будут удалены. Если они нужны — сначала сделайте резервную копию.'
  });
  if (response !== 0) return;
  ignoreSaves = true;
  fs.rmSync(dataFile, { force: true });
  mainWindow.reload();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Файл',
      submenu: [
        { label: 'Сохранить резервную копию…', click: backupData },
        { label: 'Восстановить из резервной копии…', click: restoreData },
        { type: 'separator' },
        { label: 'Открыть папку с данными', click: () => shell.openPath(dataDir) },
        { label: 'Сбросить к демо-данным…', click: resetToDemo },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Выход' }])
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Обычный масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'CRM «Прозвон»',
    backgroundColor: '#faf7f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
