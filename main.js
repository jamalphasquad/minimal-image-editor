const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

let mainWindow;
let windowBounds = { width: 1200, height: 800 };

// Load saved window bounds
const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');
if (fs.existsSync(boundsPath)) {
  try {
    windowBounds = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
  } catch (e) {
    console.error('Error loading window bounds:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    windowBounds = { width: bounds.width, height: bounds.height };
  });

  mainWindow.on('close', () => {
    fs.writeFileSync(boundsPath, JSON.stringify(windowBounds));
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle open file dialog
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'tiff'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const imageBuffer = fs.readFileSync(filePath);
    return {
      path: filePath,
      data: imageBuffer.toString('base64')
    };
  }
  return null;
});

// Handle save file dialog
ipcMain.handle('save-file', async (event, imageData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'PNG', extensions: ['png'] },
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'BMP', extensions: ['bmp'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    try {
      const image = await Jimp.read(buffer);
      await image.writeAsync(result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Cancelled' };
});

// Handle image resize
ipcMain.handle('resize-image', async (event, imageData, width, height) => {
  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const image = await Jimp.read(buffer);
    await image.resize(parseInt(width), parseInt(height));
    const resizedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    
    return {
      success: true,
      data: resizedBuffer.toString('base64')
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle clipboard paste
ipcMain.handle('paste-from-clipboard', async () => {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    const buffer = image.toPNG();
    return {
      success: true,
      data: buffer.toString('base64')
    };
  }
  return { success: false };
});

// Handle clipboard copy
ipcMain.handle('copy-to-clipboard', async (event, imageData) => {
  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const image = nativeImage.createFromBuffer(buffer);
    clipboard.writeImage(image);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
