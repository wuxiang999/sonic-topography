//
// render-video.mjs
// Renders sonic-topography visualization to a WebM video using headless Chrome.
// Usage: node render-video.mjs [duration_seconds] [output_path]
//   - duration_seconds: how many seconds of video to render (default: 30)
//   - output_path: path to save the WebM file (default: /opt/render-output/render.webm)
//

const RENDER_DURATION = Number(process.argv[2] || 30);
const OUTPUT_PATH = process.argv[3] || "./render-output.webm";
const STATIC_AUDIO = process.env.STATIC_AUDIO_PATH || "./static-audio/grey-track.mp3";

import puppeteer from "puppeteer";
import fs from "node:fs";
import { execSync } from "node:child_process";

console.log(`Render config: duration=${RENDER_DURATION}s output=${OUTPUT_PATH}`);

// Launch headless Chrome with WebGL support
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "",
  args: [
    "--no-sandbox", "--disable-setuid-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle", "--use-angle=swiftshader",
    "--enable-webgl", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--disable-gpu-sandbox",
    "--no-zygote", "--mute-audio",
  ],
});

const page = await browser.newPage();
page.on("console", msg => {
  const t = msg.text();
  // Only log important messages
  if (t.includes("Render mode:") || t.includes("Error") || t.includes("error")) {
    console.log("[PAGE]", t);
  }
});
page.on("pageerror", err => console.log("[ERROR]", String(err)));

// Navigate to render page with duration param
const url = `${process.env.RENDER_BASE_URL || 'http://localhost:4173/music/'}?render=1&dur=${RENDER_DURATION}`;
console.log(`Navigating to ${url}...`);
await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
console.log("Page loaded.");

// Wait for recording to start
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const state = await page.evaluate(() => (window).__recorderState ?? "waiting");
  if (state.startsWith("recording")) {
    console.log(`Recording started after ${i + 1}s (state=${state})`);
    break;
  }
  if (i % 5 === 4) console.log(`  waiting... (${i + 1}s) state=${state}`);
}

// Wait for recording to complete (duration + a bit extra for encoding)
const totalWaitMs = (RENDER_DURATION + 15) * 1000;
console.log(`Waiting ${RENDER_DURATION + 15}s for recording to complete...`);

let result = null;
for (let i = 0; i < Math.ceil(totalWaitMs / 1000); i++) {
  await new Promise(r => setTimeout(r, 1000));
  result = await page.evaluate(() => ({
    done: !!(window).__renderDone,
    state: (window).__recorderState ?? "?",
    hasData: !!(window).__renderResult,
    dataLen: ((window).__renderResult?.length ?? 0),
  }));
  if (result.done && result.hasData) {
    console.log(`Render complete: state=${result.state}, data=${result.dataLen} chars`);
    break;
  }
}

if (!result || !result.hasData) {
  console.error("Render failed or timed out. Final state:", JSON.stringify(result));
  // Try to extract what we have
  const finalResult = await page.evaluate(() => ({
    running: !!(window).__renderRunning,
    recorderState: (window).__recorderState,
    hasResult: !!(window).__renderResult,
    error: (window).__renderError ?? null,
  }));
  console.error("Final state:", JSON.stringify(finalResult, null, 2));
  await browser.close();
  process.exit(1);
}

// Extract base64 encoded WebM data
const base64Data = await page.evaluate(() => (window).__renderResult);
if (!base64Data || typeof base64Data !== "string") {
  console.error("No render result data");
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("Browser closed. Saving video...");

// Save base64 to file
const matches = base64Data.match(/^data:video\/webm;base64,(.+)$/);
if (!matches) {
  console.error("Invalid base64 format (length=" + base64Data.length + ", prefix=" + base64Data.substring(0, 50) + ")");
  // Try without prefix
  const raw = Buffer.from(base64Data, "base64");
  if (raw.length > 100) {
    console.log(`Raw base64 decode gave ${raw.length} bytes, saving...`);
    fs.writeFileSync(OUTPUT_PATH, raw);
    console.log(`Raw video saved to ${OUTPUT_PATH} (${raw.length} bytes)`);
  } else {
    process.exit(1);
  }
} else {
  const raw = Buffer.from(matches[1], "base64");
  fs.writeFileSync(OUTPUT_PATH, raw);
  console.log(`Video saved to ${OUTPUT_PATH} (${raw.length} bytes)`);
}

// Check if audio file exists for merging
if (fs.existsSync(STATIC_AUDIO)) {
  const mergedPath = OUTPUT_PATH.replace(/\.webm$/, "-with-audio.mp4");
  console.log(`Merging with audio: ${STATIC_AUDIO} -> ${mergedPath}`);
  try {
    execSync(
      `ffmpeg -y -i "${OUTPUT_PATH}" -i "${STATIC_AUDIO}" -c:v copy -c:a aac -shortest "${mergedPath}" 2>&1`,
      { stdio: "pipe", timeout: 60000 }
    );
    console.log(`Merged video saved to ${mergedPath}`);
  } catch (e) {
    console.error("FFmpeg merge failed (non-fatal):", String(e).substring(0, 200));
  }
}

console.log("Done!");
