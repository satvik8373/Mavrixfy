const fs = require('fs');

try {
  const path = "C:\\Users\\ASUS\\Downloads\\localhost_3000-20260522T215938.json";
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  console.log("Lighthouse Version:", data.lighthouseVersion);
  console.log("Requested URL:", data.requestedUrl);
  console.log("\n=== METRICS ===");
  const metrics = [
    "first-contentful-paint",
    "largest-contentful-paint",
    "speed-index",
    "total-blocking-time",
    "max-potential-fid",
    "cumulative-layout-shift",
    "interactive"
  ];
  metrics.forEach(m => {
    const audit = data.audits[m] || {};
    console.log(`${m}: score=${audit.score} display=${audit.displayValue} (${audit.numericValue})`);
  });

  console.log("\n=== LOW SCORE AUDITS (< 0.8) ===");
  Object.keys(data.audits).forEach(k => {
    const v = data.audits[k];
    if (v.score !== null && typeof v.score === 'number' && v.score < 0.8) {
      console.log(`${k}: score=${v.score} display=${v.displayValue} | title=${v.title}`);
    }
  });

  console.log("\n=== CUMULATIVE LAYOUT SHIFT DETAILS ===");
  const cls_audit = data.audits["cumulative-layout-shift"] || {};
  const details = cls_audit.details || {};
  console.log(JSON.stringify(details, null, 2).substring(0, 2000));

  console.log("\n=== RENDER BLOCKING RESOURCES ===");
  const rb = data.audits["render-blocking-resources"] || {};
  console.log(`Render Blocking: score=${rb.score} display=${rb.displayValue}`);
  console.log(JSON.stringify(rb.details || {}, null, 2));

  console.log("\n=== UNUSED JAVASCRIPT ===");
  const uj = data.audits["unused-javascript"] || {};
  console.log(`Unused JS: score=${uj.score} display=${uj.displayValue}`);
  console.log(JSON.stringify(uj.details || {}, null, 2).substring(0, 2000));

  console.log("\n=== OFFSCREEN IMAGES ===");
  const oi = data.audits["offscreen-images"] || {};
  console.log(`Offscreen Images: score=${oi.score} display=${oi.displayValue}`);
  console.log(JSON.stringify(oi.details || {}, null, 2).substring(0, 2000));

  console.log("\n=== UNUSED CSS RULES ===");
  const uc = data.audits["unused-css-rules"] || {};
  console.log(`Unused CSS: score=${uc.score} display=${uc.displayValue}`);
  console.log(JSON.stringify(uc.details || {}, null, 2).substring(0, 2000));

} catch (err) {
  console.error("Error:", err);
}
