# Image Editor

A minimal yet powerful image editor built with Electron. Edit images, capture screenshots, annotate with drawing tools, and more.

## Features

### Image Operations
- **Open Image**: Load images from your computer (JPG, PNG, BMP, GIF, TIFF)
- **Save Image**: Export your edited images as PNG, JPG, or BMP
- **Paste from Clipboard**: Quickly paste images from clipboard
- **Copy to Clipboard**: Copy edited images for use in other applications
- **Screen Capture**: Capture any area of your screen with a selection tool
- **Resize**: Change image dimensions
- **Crop**: Select and crop specific areas

### Drawing Tools
- **Pen**: Freehand drawing
- **Line**: Draw straight lines
- **Circle**: Draw circles
- **Rectangle**: Draw rectangles
- **Highlighter**: Transparent highlighting with thicker strokes

### Image Viewing
- **Zoom In/Out**: Use mouse wheel (Ctrl/Cmd + Scroll) or buttons
- **Zoom to Cursor**: Zoom towards your cursor position when scrolling over image
- **Reset Zoom**: Return to 100% zoom
- **Fit to Screen**: Auto-scale image to fit in window
- **Pan**: Scroll to navigate large or zoomed images

### Customization
- **Themes**: Choose from Dark, Light, Nord, Dracula, or Solarized themes
- **Global Shortcuts**: Set keyboard shortcuts that work even when app is minimized
- **Color Picker**: Choose any color for drawing tools
- **Adjustable Brush Size**: Set line width from 1-20 pixels

### History
- **Undo/Redo**: Full history support for all operations including cropping
- **Up to 50 steps**: Navigate through your editing history

## Installation & Development

### Prerequisites
- Node.js (v16 or higher)
- npm

### Setup
```bash
# Clone or download the repository
cd minimal-image-editor

# Install dependencies
npm install

# Run the app in development mode
npm start
```

## Usage

### Opening Images
1. Click the **📁 Open** button
2. Or press **Ctrl/Cmd + O**
3. Or paste from clipboard with **Ctrl/Cmd + V**

### Screen Capture
**Method 1: Using the modal**
1. Click the **📸 Screen Capture** button
2. Click **Capture Screen Area**
3. Draw a rectangle around the area you want to capture

**Method 2: Using global shortcut**
1. Click **⚙️ Settings**
2. Go to **Shortcuts** tab
3. Click the input field and press your desired key combination (e.g., Ctrl+Shift+S)
4. Now use that shortcut anytime, even when the app is minimized

### Drawing on Images
1. Load an image
2. Select a drawing tool (Pen, Line, Circle, Rectangle, or Highlighter)
3. Choose a color with the color picker
4. Adjust the brush size with the slider
5. Draw on the image

### Cropping
1. Click the **✂️ Crop** button
2. Draw a rectangle around the area you want to keep
3. The image will be cropped when you release the mouse

### Resizing
1. Click the **⇔ Resize** button
2. Enter new width and height
3. Click **OK**

### Zooming
- **Zoom with mouse wheel**: Hold Ctrl/Cmd and scroll over the image
- **Zoom buttons**: Use **+** and **-** buttons
- **Reset zoom**: Click **⟲** to return to 100%
- **Fit to screen**: Click **⛶** to auto-fit image in window

### Changing Themes
1. Click **⚙️ Settings**
2. Select the **Theme** tab
3. Click on any theme preview to apply it

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Image | Ctrl/Cmd + O |
| Save Image | Ctrl/Cmd + S |
| Paste | Ctrl/Cmd + V |
| Copy | Ctrl/Cmd + C |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y |
| Zoom In | Ctrl/Cmd + Scroll Up |
| Zoom Out | Ctrl/Cmd + Scroll Down |

## Building for Distribution

### Development Build
```bash
npm start
```

### Package (Create app bundle without installer)
```bash
npm run package
```
Output: `out/image-editor-<platform>-<arch>/`

### Make (Create installers)
```bash
npm run make
```

#### Output Locations

**macOS:**
- DMG Installer: `out/make/*.dmg`
- ZIP Archive: `out/make/zip/darwin/*.zip`

**Windows:**
- Installer: `out/make/squirrel.windows/*.exe`
- ZIP Archive: `out/make/zip/win32/*.zip`

### Platform-Specific Builds

**Important**: You can only build for your current operating system:
- On macOS → Build for macOS
- On Windows → Build for Windows
- On Linux → Build for Linux

To create builds for multiple platforms, use:
- Separate machines for each platform
- CI/CD services (GitHub Actions, etc.)
- Cloud build services

### Testing Builds

After `npm run package`:
- **macOS**: Open `out/image-editor-darwin-x64/image-editor.app`
- **Windows**: Run `out/image-editor-win32-x64/image-editor.exe`

After `npm run make`:
- **macOS**: Install from the DMG in `out/make/`
- **Windows**: Run the installer from `out/make/squirrel.windows/`

## Configuration

Edit `forge.config.js` to customize:
- Application name
- Executable name
- Bundle ID
- Maker configurations
- Build targets

Edit `main.js` to modify:
- Window size and properties
- IPC handlers
- Global shortcuts

Edit `renderer.js` to customize:
- UI behavior
- Drawing tools
- Keyboard shortcuts

## File Structure

```
minimal-image-editor/
├── main.js                 # Main Electron process
├── renderer.js            # Renderer process (UI logic)
├── index.html             # Main UI
├── capture-overlay.html   # Screen capture overlay
├── styles.css             # Application styles
├── forge.config.js        # Build configuration
├── package.json           # Dependencies and scripts
└── out/                   # Build output (created after building)
```

## Technical Details

- **Framework**: Electron 28
- **Image Processing**: Jimp
- **Build Tool**: Electron Forge
- **Supported Image Formats**: JPG, PNG, BMP, GIF, TIFF
- **Platform Support**: macOS, Windows, Linux

## Troubleshooting

### App won't start
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Build fails
```bash
# Clear forge cache
rm -rf out/
npm run make
```

### Global shortcuts not working
1. Check that you've set a valid shortcut (modifier + key)
2. Ensure no other app is using the same shortcut
3. Try a different key combination

### Screen capture shows black screen
- Make sure to grant screen recording permissions on macOS (System Settings > Privacy & Security > Screen Recording)

## License

MIT

## Credits

Built with Electron and Jimp.
