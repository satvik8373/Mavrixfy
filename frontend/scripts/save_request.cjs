const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\093aff83-5c5e-42d2-9548-87c7570db544\\.system_generated\\logs\\overview.txt";
const outputPath = path.join(__dirname, '../scripts/full_request.txt');

try {
  const fileContent = fs.readFileSync(logPath, 'utf8');
  const lines = fileContent.split('\n');
  if (lines.length > 0) {
    const firstLine = JSON.parse(lines[0]);
    fs.writeFileSync(outputPath, firstLine.content, 'utf8');
    console.log("Saved full user request to full_request.txt. Size:", firstLine.content.length);
  }
} catch (e) {
  console.error("Error:", e);
}
