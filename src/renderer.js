const canvas = document.getElementById('pedalCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 400;

// Draw a basic enclosure
ctx.fillStyle = '#ccc';
ctx.fillRect(100, 100, 600, 200);
ctx.fillStyle = '#000';
ctx.fillText('Your Pedal Layout Here', 300, 200);

const interact = require('interactjs');

interact('#pedalCanvas').on('tap', function(event) {
  alert('Canvas clicked!');
});
