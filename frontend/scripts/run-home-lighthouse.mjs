import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const reportPath = join(process.cwd(), 'lighthouse-home-preview.json');
const url = 'http://127.0.0.1:4173/home';
const MIN_SCORE = 90;
const run = (commandLine, options = {}) =>
  new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(commandLine, {
      shell: true,
      stdio: options.stdio ?? 'inherit',
      ...options,
    });

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
      } else {
        console.error(stderr);
        reject(new Error(`${commandLine} exited with ${code}`));
      }
    });
  });

const waitForPreview = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // Preview is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Preview server did not become ready at ${url}`);
};

const preview = spawn('npm run preview:lighthouse', {
  shell: true,
  stdio: 'ignore',
});

const stopPreview = () => {
  if (!preview.killed) {
    preview.kill();
  }
};

process.on('exit', stopPreview);
process.on('SIGINT', () => {
  stopPreview();
  process.exit(130);
});

try {
  if (existsSync(reportPath)) {
    unlinkSync(reportPath);
  }
  await waitForPreview();
  await run(
    `npx lighthouse ${url} --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="${reportPath}" --chrome-flags="--headless=new --disable-extensions --no-sandbox" --quiet`,
    { allowFailure: false, stdio: 'pipe' },
  );

  if (!existsSync(reportPath)) {
    throw new Error('Lighthouse did not write a report.');
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const score = (category) => Math.round(report.categories[category].score * 100);
  const metric = (audit) => report.audits[audit]?.displayValue ?? 'n/a';
  const performanceScore = score('performance');

  console.log('\nHome production preview Lighthouse');
  console.log(`URL: ${url}`);
  console.log('Note: this audits the production preview build, not the Vite dev server on localhost:3000.');
  console.log(`Performance: ${performanceScore}`);
  console.log(`Accessibility: ${score('accessibility')}`);
  console.log(`Best Practices: ${score('best-practices')}`);
  console.log(`SEO: ${score('seo')}`);
  console.log(`FCP: ${metric('first-contentful-paint')}`);
  console.log(`LCP: ${metric('largest-contentful-paint')}`);
  console.log(`TBT: ${metric('total-blocking-time')}`);
  console.log(`CLS: ${metric('cumulative-layout-shift')}`);
  console.log(`Speed Index: ${metric('speed-index')}`);
  console.log(`Report: ${reportPath}`);

  if (performanceScore < MIN_SCORE) {
    process.exitCode = 1;
    console.error(`Performance score ${performanceScore} is below the required ${MIN_SCORE}+ target.`);
  }
} finally {
  stopPreview();
}
