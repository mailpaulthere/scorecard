// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need. Run: node scripts/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const svg = fs.readFileSync(path.join(__dirname, '../public/icons/icon.svg'), 'utf8');
const out = (n) => path.join(__dirname, '../public/icons', n);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (name, size, pad) => {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(
      `<body style="margin:0;background:#0f3d2e;display:grid;place-items:center;height:${size}px">` +
        `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
    );
    await page.screenshot({ path: out(name), omitBackground: false });
  };
  await shot('icon-192.png', 192, 0);
  await shot('icon-512.png', 512, 0);
  await shot('icon-maskable-512.png', 512, 0.1);
  await shot('apple-touch-icon.png', 180, 0);
  await browser.close();
})();
