const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');
let count = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = content.replace(/<button\b(?![^>]*type=)/g, '<button type="button"');
  if (content !== modified) {
    fs.writeFileSync(file, modified, 'utf8');
    count++;
    console.log('Fixed', file);
  }
});
console.log('Total files fixed:', count);
