const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\093aff83-5c5e-42d2-9548-87c7570db544\\.system_generated\\logs\\overview.txt";
const outPath = "e:\\Mavrixfy\\Mavrixfy-web\\frontend\\scripts\\logs_summary.txt";

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  let summary = '';
  
  lines.forEach((line, idx) => {
    try {
      const data = JSON.parse(line);
      summary += `Line ${idx} (${data.type}, ${data.source}, ${data.created_at}):\n`;
      if (data.type === 'USER_INPUT') {
        summary += `CONTENT: ${data.content.substring(0, 1000)}...\n\n`;
      } else if (data.type === 'PLANNER_RESPONSE') {
        summary += `CONTENT: ${data.content.substring(0, 500)}...\n`;
        if (data.tool_calls) {
          summary += `TOOL CALLS: ${JSON.stringify(data.tool_calls)}\n`;
        }
        summary += `\n`;
      }
    } catch (err) {
      summary += `Line ${idx}: Error parsing JSON: ${err.message}\n\n`;
    }
  });
  
  fs.writeFileSync(outPath, summary, 'utf8');
  console.log("Written log summary to:", outPath);
} catch (e) {
  console.error("Error:", e);
}
