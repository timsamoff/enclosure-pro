const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'images');
const destDir = path.join(__dirname, '..', 'build');

// Ensure build directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy all files from images to build
fs.readdirSync(sourceDir).forEach(file => {
  const sourceFile = path.join(sourceDir, file);
  const destFile = path.join(destDir, file);
  
  // Check if it's a file (not a directory)
  if (fs.statSync(sourceFile).isFile()) {
    fs.copyFileSync(sourceFile, destFile);
    // console.log(`Copied: ${file} to build/`);
  }
});