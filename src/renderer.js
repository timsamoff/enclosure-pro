const { electron } = window;

let gridSize = 50;
let gridColor = '#D3D3D3';  // Default light gray color
let showGrid = false;

// Load current grid settings
electron.sendGridSettings();

// Grid settings updates
electron.onGridSettingsReceived((event, settings) => {
  gridSize = settings.gridSize;
  gridColor = settings.gridColor;
  updateGridSettings();
});

// Grid toggle events
electron.onToggleGrid((event, isChecked) => {
  showGrid = isChecked;
  drawCanvas();
});

// Draw the canvas with or without the grid
function drawCanvas() {
  const canvas = document.getElementById('designCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear canvas

  if (showGrid) {
    drawGrid(ctx);
  }
}

// Draw grid
function drawGrid(ctx) {
  const gridSpacing = gridSize;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;

  // Horizontal grid lines
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Vertical grid lines
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// Update display of grid settings
function updateGridSettings() {
  const gridSizeDisplay = document.getElementById('grid-size-display');
  gridSizeDisplay.textContent = `Grid Size: ${gridSize}`;
  const gridColorDisplay = document.getElementById('grid-color-display');
  gridColorDisplay.textContent = `Grid Color: ${gridColor}`;
}
