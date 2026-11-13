// Renders static 3D organ images (transparent WebP, colour + clay) from the SAME shader the live
// canvas uses (src/features/patient/organ-shader.ts). Run: node --no-warnings scripts/render-organs.mjs
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { ORGAN_FRAG, ORGAN_VERT, ORGAN_INDEX, ORGAN_VIEW } from "../src/features/patient/organ-shader.ts";

const SIZE = 640;
const html = `<!doctype html><html><body style="margin:0"><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas><script>
const c=document.getElementById('c');
const gl=c.getContext('webgl',{premultipliedAlpha:true,alpha:true,preserveDrawingBuffer:true,antialias:false});
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,${JSON.stringify(ORGAN_VERT)}));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,${JSON.stringify(ORGAN_FRAG)}));gl.linkProgram(pr);gl.useProgram(pr);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
const U=n=>gl.getUniformLocation(pr,n);
window.render=(k,grey,fov,yaw)=>{gl.viewport(0,0,${SIZE},${SIZE});gl.uniform2f(U('uRes'),${SIZE},${SIZE});gl.uniform1f(U('uTime'),0.6);gl.uniform1f(U('uBeatAmt'),0);gl.uniform2f(U('uPtr'),0,0);
gl.uniform1i(U('uA'),k);gl.uniform1i(U('uB'),k);gl.uniform1f(U('uMix'),0);gl.uniform1f(U('uGrey'),grey);gl.uniform1f(U('uFov'),fov);gl.uniform1f(U('uYaw'),yaw);gl.uniform1f(U('uSway'),0);gl.uniform1f(U('uBounce'),0);
gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);return c.toDataURL('image/webp',0.92);};
window.ready=true;</script></body></html>`;

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--enable-webgl", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.setContent(html);
await page.waitForFunction("window.ready === true");
for (const [name, idx] of Object.entries(ORGAN_INDEX)) {
  const v = ORGAN_VIEW[name];
  for (const [variant, grey] of [["color", 0], ["grey", 1]]) {
    const url = await page.evaluate((k, g, f, y) => window.render(k, g, f, y), idx, grey, v.fov, v.yaw);
    writeFileSync(new URL(`../public/organs/${name}-${variant}.webp`, import.meta.url), Buffer.from(url.split(",")[1], "base64"));
  }
  console.log("rendered", name);
}
await browser.close();
