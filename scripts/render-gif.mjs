// Renders a looping canvas page (exposing window.render(t), LOOP, W, H) to an animated GIF.
// usage: node render-gif.mjs <page.html> <out.gif> [scale=2] [fps=20]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const [page_, out, scale = "2", fps = "20"] = process.argv.slice(2);
const S = +scale, FPS = +fps;
const BROWSER = process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: S });
await page.goto(pathToFileURL(path.resolve(page_)).href);
await page.evaluate(() => document.fonts.ready);
const { LOOP, W, H } = await page.evaluate(() => ({ LOOP: window.LOOP, W: window.W, H: window.H }));

const frames = [];
for (let i = 0; i < FPS * LOOP; i++) {
  await page.evaluate(t => window.render(t), i / FPS);
  frames.push(PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })).data);
}
await browser.close();

// one global palette (255 colours + a reserved transparent slot); unchanged pixels become transparent
const palette = quantize(Buffer.concat(frames.filter((_, i) => i % 10 === 0)), 255);
const TRANSPARENT = palette.length;
palette.push([0, 0, 0]);

const gif = GIFEncoder();
let prev = null;
for (const data of frames) {
  const idx = applyPalette(data, palette);
  if (prev) for (let p = 0; p < idx.length; p++) idx[p] === prev[p] ? (idx[p] = TRANSPARENT) : (prev[p] = idx[p]);
  else prev = idx.slice();
  gif.writeFrame(idx, W * S, H * S, { palette, delay: 1000 / FPS, repeat: 0, transparent: true, transparentIndex: TRANSPARENT, dispose: 1 });
}
gif.finish();
fs.writeFileSync(out, gif.bytes());
console.log(`${out}: ${frames.length} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
