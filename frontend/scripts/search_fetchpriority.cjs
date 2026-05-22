const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const files = walk(path.join(__dirname, '../src'));
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.toLowerCase().includes('fetchpriority')) {
    console.log(`Found in: ${file}`);
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('fetchpriority')) {
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
  }
});
