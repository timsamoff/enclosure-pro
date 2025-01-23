const { ipcRenderer } = require('electron');

const canvas = document.getElementById('designCanvas');  // Keep consistent with the ID in your HTML
const ctx = canvas.getContext('2d');

// Default state for grid visibility and size
let showGrid = false;
let gridSize = 50; // Default grid size

// Resize canvas and redraw
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawCanvas();  // Redraw content after resizing
}

// Initial canvas drawing function
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas first

  console.log("Drawing Canvas...");

  // Draw the grid if showGrid is true
  if (showGrid) {
    drawGrid();
  }

  // Example: Additional drawing code can go here (like adding text, etc.)
  ctx.fillStyle = 'lightgray';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.fillText('Enclosure Pro', 50, 50);
}

// Function to draw grid lines
function drawGrid() {
  console.log("Drawing Grid...");
  ctx.strokeStyle = '#ddd';  // Light gray color for the grid lines
  ctx.lineWidth = 0.5;

  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.strokeRect(x, y, gridSize, gridSize);
    }
  }
}

// When the main process sends the current grid size to the renderer
ipcRenderer.on('send-grid-size', (event, size) => {
  document.getElementById('grid-size').value = size;  // Update the grid size field in Settings
});

// Handle grid size change from Settings window
ipcRenderer.on('update-grid-size', (event, newGridSize) => {
  gridSize = newGridSize;
  drawCanvas();  // Redraw the canvas with the new grid size
});

// Handle grid visibility toggle from the main process
ipcRenderer.on('toggle-grid', (event, isChecked) => {
  showGrid = isChecked;
  drawCanvas();  // Redraw the canvas whenever the grid state changes
});

// Initial canvas size setup and drawing
resizeCanvas();

// Resize event listener
window.addEventListener('resize', resizeCanvas);
