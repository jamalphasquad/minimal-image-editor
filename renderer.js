const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const drawCanvas = document.getElementById('draw-canvas');
const canvasWrapper = document.getElementById('canvas-wrapper');
const ctx = canvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');

// Create temporary canvas for highlighter
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

let currentTool = 'pen';
let isDrawing = false;
let startX, startY;
let currentColor = '#ff0000';
let lineWidth = 2;
let imageLoaded = false;
let cropMode = false;
let cropStartX, cropStartY, cropEndX, cropEndY;
let zoomLevel = 1;
let minZoom = 0.1;
let maxZoom = 10;
let history = [];
let historyStep = -1;
let maxHistory = 50;
let highlighterSnapshot = null;

// Initialize
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupEventListeners();
}

function resizeCanvas() {
  // Don't resize canvas on window resize if image is loaded
  // Canvas size is now determined by image size
  if (imageLoaded && window.currentImage) {
    drawImage(window.currentImage);
  }
}

function setupEventListeners() {
  // File operations
  document.getElementById('open-btn').addEventListener('click', openFile);
  document.getElementById('save-btn').addEventListener('click', saveFile);
  document.getElementById('paste-btn').addEventListener('click', pasteFromClipboard);
  document.getElementById('copy-btn').addEventListener('click', copyToClipboard);
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('redo-btn').addEventListener('click', redo);
  document.getElementById('screenshot-btn').addEventListener('click', showCaptureModal);
  
  // Tools
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentTool = e.target.dataset.tool;
      cropMode = false;
    });
  });
  
  document.getElementById('crop-btn').addEventListener('click', () => {
    cropMode = true;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  });
  
  document.getElementById('resize-btn').addEventListener('click', showResizeDialog);
  
  // Color and line width
  document.getElementById('color-picker').addEventListener('change', (e) => {
    currentColor = e.target.value;
  });
  
  document.getElementById('line-width').addEventListener('input', (e) => {
    lineWidth = parseInt(e.target.value);
    document.getElementById('line-width-value').textContent = lineWidth;
  });
  
  // Drawing events
  drawCanvas.addEventListener('mousedown', handleMouseDown);
  drawCanvas.addEventListener('mousemove', handleMouseMove);
  drawCanvas.addEventListener('mouseup', handleMouseUp);
  drawCanvas.addEventListener('mouseout', handleMouseUp);
  
  // Resize dialog
  document.getElementById('resize-ok-btn').addEventListener('click', performResize);
  document.getElementById('resize-cancel-btn').addEventListener('click', hideResizeDialog);
  
  // Capture modal
  document.getElementById('start-capture-btn').addEventListener('click', startScreenCapture);
  document.getElementById('exit-capture-btn').addEventListener('click', hideCaptureModal);
  
  // Listen for captured image from main process
  ipcRenderer.on('captured-image', (event, imageData) => {
    loadCapturedImage(imageData);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteFromClipboard();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyToClipboard();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      openFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
      e.preventDefault();
      redo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  });
  
  // Zoom controls
  document.getElementById('zoom-in-btn').addEventListener('click', () => zoomBy(0.1));
  document.getElementById('zoom-out-btn').addEventListener('click', () => zoomBy(-0.1));
  
  // Mouse wheel zoom
  const container = document.getElementById('canvas-container');
  container.addEventListener('wheel', handleWheelZoom, { passive: false });
  
  // Touchpad pinch zoom
  let lastTouchDistance = 0;
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lastTouchDistance = getTouchDistance(e.touches);
    }
  });
  
  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const delta = newDistance - lastTouchDistance;
      zoomBy(delta * 0.01);
      lastTouchDistance = newDistance;
    }
  }, { passive: false });
}

// File operations
async function openFile() {
  const result = await ipcRenderer.invoke('open-file');
  if (result) {
    const img = new Image();
    img.onload = () => {
      window.currentImage = img;
      imageLoaded = true;
      drawImage(img);
    };
    img.src = `data:image/png;base64,${result.data}`;
  }
}

async function saveFile() {
  if (!imageLoaded) return;
  
  // Merge draw canvas onto main canvas
  ctx.drawImage(drawCanvas, 0, 0);
  
  const imageData = canvas.toDataURL('image/png');
  const result = await ipcRenderer.invoke('save-file', imageData);
  
  if (result.success) {
    console.log('Image saved:', result.path);
  }
}

async function pasteFromClipboard() {
  const result = await ipcRenderer.invoke('paste-from-clipboard');
  if (result.success) {
    const img = new Image();
    img.onload = () => {
      window.currentImage = img;
      imageLoaded = true;
      drawImage(img);
    };
    img.src = `data:image/png;base64,${result.data}`;
  }
}

async function copyToClipboard() {
  if (!imageLoaded) return;
  
  // Merge draw canvas onto main canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  tempCtx.drawImage(drawCanvas, 0, 0);
  
  const imageData = tempCanvas.toDataURL('image/png');
  await ipcRenderer.invoke('copy-to-clipboard', imageData);
}

function drawImage(img) {
  // Set canvas size to match image size
  canvas.width = img.width;
  canvas.height = img.height;
  drawCanvas.width = img.width;
  drawCanvas.height = img.height;
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  
  // Set wrapper size to match canvas
  canvasWrapper.style.width = img.width + 'px';
  canvasWrapper.style.height = img.height + 'px';
  
  // Draw image at full size
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  
  // Clear draw canvas
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  
  // Store image bounds for drawing
  window.imageBounds = { x: 0, y: 0, width: img.width, height: img.height };
  
  // Apply zoom
  updateZoom();
  
  // Save initial state
  saveState();
}

// Drawing functions
function handleMouseDown(e) {
  const rect = drawCanvas.getBoundingClientRect();
  startX = (e.clientX - rect.left) / zoomLevel;
  startY = (e.clientY - rect.top) / zoomLevel;
  
  if (cropMode) {
    cropStartX = startX;
    cropStartY = startY;
    isDrawing = true;
    return;
  }
  
  isDrawing = true;
  
  if (currentTool === 'pen') {
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
  } else if (currentTool === 'highlighter') {
    // Save current draw canvas state and prepare temp canvas
    highlighterSnapshot = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.beginPath();
    tempCtx.moveTo(startX, startY);
  }
}

function handleMouseMove(e) {
  if (!isDrawing) return;
  
  const rect = drawCanvas.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) / zoomLevel;
  const currentY = (e.clientY - rect.top) / zoomLevel;
  
  if (cropMode) {
    cropEndX = currentX;
    cropEndY = currentY;
    drawCropPreview();
    return;
  }
  
  if (currentTool === 'pen') {
    drawCtx.strokeStyle = currentColor;
    drawCtx.lineWidth = lineWidth;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.globalAlpha = 1;
    
    drawCtx.lineTo(currentX, currentY);
    drawCtx.stroke();
  } else if (currentTool === 'highlighter') {
    // Draw on temp canvas with full opacity
    tempCtx.strokeStyle = currentColor;
    tempCtx.lineWidth = lineWidth * 3;
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    tempCtx.globalAlpha = 1;
    
    tempCtx.lineTo(currentX, currentY);
    tempCtx.stroke();
    
    // Restore snapshot and composite temp canvas with transparency
    drawCtx.putImageData(highlighterSnapshot, 0, 0);
    drawCtx.globalAlpha = 0.3;
    drawCtx.drawImage(tempCanvas, 0, 0);
    drawCtx.globalAlpha = 1;
  } else {
    // For shapes, clear and redraw
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawShape(startX, startY, currentX, currentY);
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;
  
  const rect = drawCanvas.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) / zoomLevel;
  const currentY = (e.clientY - rect.top) / zoomLevel;
  
  if (cropMode) {
    cropEndX = currentX;
    cropEndY = currentY;
    performCrop();
    isDrawing = false;
    cropMode = false;
    return;
  }
  
  if (currentTool !== 'pen' && currentTool !== 'highlighter') {
    drawShape(startX, startY, currentX, currentY);
  }
  
  isDrawing = false;
  drawCtx.globalAlpha = 1;
  
  // Save state after drawing
  saveState();
}

function drawShape(x1, y1, x2, y2) {
  drawCtx.strokeStyle = currentColor;
  drawCtx.lineWidth = lineWidth;
  drawCtx.globalAlpha = 1;
  
  if (currentTool === 'line') {
    drawCtx.beginPath();
    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.stroke();
  } else if (currentTool === 'rectangle') {
    drawCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (currentTool === 'circle') {
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    drawCtx.beginPath();
    drawCtx.arc(x1, y1, radius, 0, 2 * Math.PI);
    drawCtx.stroke();
  }
}

function drawCropPreview() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  
  // Draw semi-transparent overlay
  drawCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  
  // Clear crop area
  const x = Math.min(cropStartX, cropEndX);
  const y = Math.min(cropStartY, cropEndY);
  const width = Math.abs(cropEndX - cropStartX);
  const height = Math.abs(cropEndY - cropStartY);
  
  drawCtx.clearRect(x, y, width, height);
  
  // Draw crop rectangle
  drawCtx.strokeStyle = '#ffffff';
  drawCtx.lineWidth = 2;
  drawCtx.strokeRect(x, y, width, height);
}

function performCrop() {
  if (!imageLoaded) return;
  
  const x = Math.min(cropStartX, cropEndX);
  const y = Math.min(cropStartY, cropEndY);
  const width = Math.abs(cropEndX - cropStartX);
  const height = Math.abs(cropEndY - cropStartY);
  
  if (width < 10 || height < 10) {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    return;
  }
  
  // Create temporary canvas with cropped image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Draw the cropped portion
  tempCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  tempCtx.drawImage(drawCanvas, x, y, width, height, 0, 0, width, height);
  
  // Load cropped image
  const img = new Image();
  img.onload = () => {
    window.currentImage = img;
    drawImage(img);
    saveState();
  };
  img.src = tempCanvas.toDataURL();
}

// Resize dialog
function showResizeDialog() {
  if (!imageLoaded || !window.imageBounds) return;
  
  const img = window.currentImage;
  document.getElementById('resize-width').value = img.width;
  document.getElementById('resize-height').value = img.height;
  document.getElementById('resize-dialog').style.display = 'flex';
}

function hideResizeDialog() {
  document.getElementById('resize-dialog').style.display = 'none';
}

async function performResize() {
  const width = document.getElementById('resize-width').value;
  const height = document.getElementById('resize-height').value;
  
  if (!width || !height || width <= 0 || height <= 0) return;
  
  // Merge canvases
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  tempCtx.drawImage(drawCanvas, 0, 0);
  
  const imageData = tempCanvas.toDataURL('image/png');
  const result = await ipcRenderer.invoke('resize-image', imageData, width, height);
  
  if (result.success) {
    const img = new Image();
    img.onload = () => {
      window.currentImage = img;
      drawImage(img);
      hideResizeDialog();
    };
    img.src = `data:image/png;base64,${result.data}`;
  }
}

// History management
function saveState() {
  if (!imageLoaded) return;
  
  // Merge canvases into one
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  tempCtx.drawImage(drawCanvas, 0, 0);
  
  // Remove any states after current step
  history = history.slice(0, historyStep + 1);
  
  // Add new state
  history.push(tempCanvas.toDataURL());
  
  // Limit history size
  if (history.length > maxHistory) {
    history.shift();
  } else {
    historyStep++;
  }
  
  updateUndoRedoButtons();
}

function undo() {
  if (historyStep > 0) {
    historyStep--;
    restoreState(history[historyStep]);
    updateUndoRedoButtons();
  }
}

function redo() {
  if (historyStep < history.length - 1) {
    historyStep++;
    restoreState(history[historyStep]);
    updateUndoRedoButtons();
  }
}

function restoreState(dataUrl) {
  const img = new Image();
  img.onload = () => {
    // Clear both canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    
    // Draw restored state
    ctx.drawImage(img, 0, 0);
    window.currentImage = img;
  };
  img.src = dataUrl;
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  
  undoBtn.disabled = historyStep <= 0;
  redoBtn.disabled = historyStep >= history.length - 1;
}

// Zoom functions
function handleWheelZoom(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    zoomBy(delta);
  }
}

function zoomBy(delta) {
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel + delta));
  setZoom(newZoom);
}

function setZoom(zoom) {
  zoomLevel = zoom;
  updateZoom();
}

function updateZoom() {
  if (!imageLoaded) return;
  
  canvasWrapper.style.transform = `scale(${zoomLevel})`;
  canvasWrapper.style.transformOrigin = 'center center';
  
  document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Screen capture functions
async function showCaptureModal() {
  const captureModal = document.getElementById('capture-modal');
  captureModal.style.display = 'block';
}

async function hideCaptureModal() {
  const captureModal = document.getElementById('capture-modal');
  captureModal.style.display = 'none';
}

async function startScreenCapture() {
  // Hide capture modal first
  const captureModal = document.getElementById('capture-modal');
  captureModal.style.display = 'none';
  
  // Wait for capture result
  ipcRenderer.once('capture-result', async (event, captureResult) => {
    if (captureResult.success) {
      loadCapturedImage(captureResult.data);
    } else {
      console.error('Capture failed:', captureResult.error);
    }
  });
  
  // Start screen capture process (this will minimize window and show overlay)
  const result = await ipcRenderer.invoke('start-screen-capture');
  
  if (!result.success) {
    console.error('Failed to start capture:', result.error);
  }
}

function loadCapturedImage(imageData) {
  const img = new Image();
  img.onload = () => {
    window.currentImage = img;
    imageLoaded = true;
    drawImage(img);
  };
  img.src = `data:image/png;base64,${imageData}`;
}

// Start the app
init();
