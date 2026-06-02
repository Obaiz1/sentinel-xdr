const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXPORT_DIR = __dirname;
const CODE_DIR = path.join(EXPORT_DIR, 'code');
const SCREENSHOTS_DIR = path.join(EXPORT_DIR, 'screenshots');
const DESKTOP_DIR = path.join(SCREENSHOTS_DIR, 'desktop');
const TABLET_DIR = path.join(SCREENSHOTS_DIR, 'tablet');
const MOBILE_DIR = path.join(SCREENSHOTS_DIR, 'mobile');

// Ensure directories
[DESKTOP_DIR, TABLET_DIR, MOBILE_DIR].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// Viewport profiles
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, dir: DESKTOP_DIR },
  { name: 'tablet', width: 768, height: 1024, dir: TABLET_DIR },
  { name: 'mobile-390', width: 390, height: 844, dir: MOBILE_DIR },
  { name: 'mobile-430', width: 430, height: 932, dir: MOBILE_DIR },
];

async function main() {
  console.log("Checking if puppeteer is installed...");
  try {
    require.resolve('puppeteer');
  } catch (e) {
    console.log("Puppeteer not found. Installing puppeteer locally...");
    execSync('npm install puppeteer --no-save', { stdio: 'inherit', cwd: EXPORT_DIR });
  }

  const puppeteer = require('puppeteer');
  console.log("Launching headless browser using local Chrome...");
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const files = fs.readdirSync(CODE_DIR).filter(f => f.endsWith('.html'));
  console.log(`Found ${files.length} HTML files to capture.`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(CODE_DIR, file);
    const fileUrl = `file://${filePath}`;
    const slug = file.replace('.html', '');

    console.log(`\nRendering: ${file} (${i + 1}/${files.length})`);
    const page = await browser.newPage();

    try {
      await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Inject css overrides if needed
      await page.addStyleTag({ content: 'body { overflow-x: hidden !important; }' });

      for (const vp of VIEWPORTS) {
        await page.setViewport({ width: vp.width, height: vp.height });
        // Wait a small moment for styles / tailwind CDN to lay out
        await new Promise(r => setTimeout(r, 600));

        let filename = `${slug}.png`;
        if (vp.name === 'mobile-390') filename = `${slug}_390.png`;
        if (vp.name === 'mobile-430') filename = `${slug}_430.png`;

        const destPath = path.join(vp.dir, filename);
        await page.screenshot({ path: destPath, fullPage: false });
        console.log(`  - Captured ${vp.name} (${vp.width}px) -> ${filename}`);
      }
    } catch (err) {
      console.error(`Error rendering ${file}:`, err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log("\nAll responsive screenshots captured successfully!");
}

main().catch(err => {
  console.error("Capture process failed:", err);
  process.exit(1);
});
