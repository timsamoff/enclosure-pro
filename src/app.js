const { ipcRenderer } = require('electron');

const canvas = document.getElementById('designCanvas');
const ctx = canvas.getContext('2d');

// Default grid state
let showGrid = false;
let gridSize = 50;
let gridColor = '#dddddd';

// Resize canvas and redraw
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawCanvas();
}

// Draw canvas content and grid
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  if (showGrid) {
    drawGrid();
  }

  ctx.fillStyle = 'lightgray';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.fillText('Enclosure Pro', 50, 50);
}

// Draw grid lines on canvas
function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;

  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.strokeRect(x, y, gridSize, gridSize);
    }
  }
}

// Listen for grid visibility toggle
ipcRenderer.on('toggle-grid', (event, isChecked) => {
  showGrid = isChecked;
  drawCanvas();
});

// Listen for grid settings (size and color)
ipcRenderer.on('send-grid-settings', (event, settings) => {
  gridSize = settings.gridSize;
  gridColor = settings.gridColor;
  drawCanvas();
});

// Initial canvas setup
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
