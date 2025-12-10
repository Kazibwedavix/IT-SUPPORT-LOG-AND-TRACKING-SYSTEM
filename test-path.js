const path = require('path');
const fs = require('fs');

// Test the path resolution used in server.js
const frontendPath = path.join(__dirname, '../frontend/build');

console.log('Current directory (__dirname):', __dirname);
console.log('Frontend path:', frontendPath);
console.log('Absolute frontend path:', path.resolve(frontendPath));
console.log('Frontend build exists:', fs.existsSync(frontendPath));

if (fs.existsSync(frontendPath)) {
  console.log('Contents of frontend build:', fs.readdirSync(frontendPath));
  console.log('Index.html exists:', fs.existsSync(path.join(frontendPath, 'index.html')));
} else {
  console.log('Frontend build directory not found!');
}

// Test the backend directory structure
console.log('\nBackend directory contents:', fs.readdirSync(__dirname));

// Test the root directory structure
const rootDir = path.join(__dirname, '..');
console.log('Root directory:', rootDir);
console.log('Root directory contents:', fs.readdirSync(rootDir));
