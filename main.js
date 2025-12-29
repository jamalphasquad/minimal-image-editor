const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, screen, desktopCapturer, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

let mainWindow;
let captureWindow;
let capturedScreenshot = null;
let windowBounds = { width: 1200, height: 800 };
let settings = { captureShortcut: '' };

// Load saved settings
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

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
  
  // Register global shortcuts after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    registerGlobalShortcuts();
  });

  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    windowBounds = { width: bounds.width, height: bounds.height };
  });

  mainWindow.on('close', () => {
    fs.writeFileSync(boundsPath, JSON.stringify(windowBounds));
    // Unregister all shortcuts when closing
    globalShortcut.unregisterAll();
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

// Screen capture handlers
ipcMain.handle('show-capture-modal', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return { success: true };
});

ipcMain.handle('hide-capture-modal', async () => {
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.focus();
  }
  return { success: true };
});

ipcMain.handle('start-screen-capture', async () => {
  try {
    // First, minimize the main window to get it out of the way
    if (mainWindow) {
      mainWindow.minimize();
    }
    
    // Wait a moment for window to minimize
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Capture the screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().size
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const screenSource = sources[0];
    capturedScreenshot = screenSource.thumbnail; // Store screenshot globally
    const screenshotDataUrl = capturedScreenshot.toDataURL();
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    
    // Create fullscreen overlay window
    captureWindow = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      transparent: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      fullscreen: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    captureWindow.setIgnoreMouseEvents(false);
    
    // Load capture overlay HTML
    await captureWindow.loadFile('capture-overlay.html');
    
    // Send screenshot to overlay window
    captureWindow.webContents.send('set-screenshot', screenshotDataUrl);
    
    return { success: true };
  } catch (error) {
    if (mainWindow) {
      mainWindow.restore();
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('capture-screen-area', async (event, bounds) => {
  try {
    if (!capturedScreenshot) {
      throw new Error('No screenshot available');
    }
    
    // The bounds are already in screenshot coordinates from the overlay
    // Just round them to ensure integer pixel values
    const cropBounds = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
    
    // Crop the stored screenshot to the selected area
    const croppedImage = capturedScreenshot.crop(cropBounds);
    const buffer = croppedImage.toPNG();
    
    // Close capture window
    if (captureWindow) {
      captureWindow.close();
      captureWindow = null;
    }
    
    // Clear stored screenshot
    capturedScreenshot = null;
    
    // Restore main window and send captured image
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
      
      // Send captured image to renderer
      mainWindow.webContents.send('capture-result', {
        success: true,
        data: buffer.toString('base64')
      });
    }
    
    return {
      success: true,
      data: buffer.toString('base64')
    };
  } catch (error) {
    console.error('Screen capture error:', error);
    if (captureWindow) {
      captureWindow.close();
      captureWindow = null;
    }
    capturedScreenshot = null; // Clear stored screenshot
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('capture-result', {
        success: false,
        error: error.message
      });
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-screen-capture', async () => {
  if (captureWindow) {
    captureWindow.close();
    captureWindow = null;
  }
  capturedScreenshot = null; // Clear stored screenshot
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.focus();
  }
  return { success: true };
});

// Settings handlers
ipcMain.handle('get-settings', async () => {
  return settings;
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  
  // Re-register global shortcuts when settings change
  registerGlobalShortcuts();
  
  return { success: true };
});

// Global shortcuts
function registerGlobalShortcuts() {
  // Unregister all existing shortcuts first
  globalShortcut.unregisterAll();
  
  // Register screen capture shortcut if set
  if (settings.captureShortcut) {
    try {
      // Validate shortcut format (must have at least one modifier and one key)
      const parts = settings.captureShortcut.split('+');
      const modifiers = ['Ctrl', 'Command', 'Alt', 'Shift', 'CommandOrControl'];
      const hasModifier = parts.some(p => modifiers.includes(p));
      const hasKey = parts.some(p => !modifiers.includes(p));
      
      if (!hasModifier || !hasKey || parts.length < 2) {
        console.log('Invalid shortcut format, skipping:', settings.captureShortcut);
        return;
      }
      
      const registered = globalShortcut.register(settings.captureShortcut, () => {
        // Trigger screen capture directly
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger-global-capture');
        }
      });
      
      if (!registered) {
        console.error('Failed to register shortcut:', settings.captureShortcut);
      } else {
        console.log('Successfully registered shortcut:', settings.captureShortcut);
      }
    } catch (error) {
      console.error('Error registering shortcut:', error);
    }
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
