const fs = require('fs');

try {
  const path = "C:\\Users\\ASUS\\Downloads\\localhost_3000-20260522T215938.json";
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  console.log("=== CLS CULPRITS INSIGHT ===");
  const audit = data.audits["cls-culprits-insight"] || {};
  console.log(JSON.stringify(audit.details || {}, null, 2));

} catch (err) {
  console.error("Error:", err);
}
