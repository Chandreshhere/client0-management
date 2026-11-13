// Screenshot helper for visual verification (uses the locally installed Google Chrome).
//
// Usage:
//   node scripts/shot.mjs <path-or-url> <out.png> [--w 1440] [--h 900] [--full]
//        [--cookie name=value]... [--click "<css selector>"]... [--wait 800]
//        [--scroll 600] [--hover "<css selector>"] [--type "<selector>::<text>"]
//
// Examples:
//   node scripts/shot.mjs /dashboard /tmp/d.png --cookie cl_role=nutritionist --cookie cl_plan=team
//   node scripts/shot.mjs /patients/p-kabir /tmp/p.png --w 1440 --h 1000 --full
//   node scripts/shot.mjs /schedule /tmp/s.png --click "button[aria-label='Create new']" --wait 600
//
// Prints console errors and page errors so runtime problems surface in the agent transcript.
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const [target, out] = args;
if (!target || !out) {
  console.error("usage: node scripts/shot.mjs <path-or-url> <out.png> [options]");
  process.exit(1);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));

const width = Number(opt("w", 1440));
const height = Number(opt("h", 900));
const full = args.includes("--full");
const wait = Number(opt("wait", 700));
const base = process.env.BASE_URL ?? "http://localhost:3417";
const url = target.startsWith("http") ? target : `${base}${target}`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-color-profile=srgb", "--enable-webgl", "--use-angle=metal", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: Number(opt("dpr", 1)) });
  const host = new URL(url).hostname;
  const cookies = all("cookie").map((c) => {
    const [name, ...v] = c.split("=");
    return { name, value: v.join("="), domain: host, path: "/" };
  });
  if (cookies.length) await browser.setCookie(...cookies);
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  const res = await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  console.log(`status ${res?.status()} ${url}`);
  await new Promise((r) => setTimeout(r, wait));
  const scroll = opt("scroll");
  if (scroll) {
    await page.evaluate((y) => window.scrollTo(0, Number(y)), scroll);
    await new Promise((r) => setTimeout(r, 900));
  }
  for (const sel of all("click")) {
    await page.waitForSelector(sel, { timeout: 8000 });
    await page.click(sel);
    await new Promise((r) => setTimeout(r, wait));
  }
  const hover = opt("hover");
  if (hover) {
    await page.hover(hover);
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const t of all("type")) {
    const [sel, text] = t.split("::");
    await page.type(sel, text);
    await new Promise((r) => setTimeout(r, 300));
  }
  await page.screenshot({ path: out, fullPage: full });
  console.log(`saved ${out}`);
  if (errors.length) console.log(errors.slice(0, 15).join("\n"));
} finally {
  await browser.close();
}
