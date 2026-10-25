// Quick look: open the office, print the agents' positions and screenshot a few camera poses.
//   node lucifer-promo/probe.mjs <out dir> '<json list of poses>'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';

const out = process.argv[2] ?? '/tmp/probe';
const poses = JSON.parse(process.argv[3] ?? '[]');
const W = Number(process.env.W ?? 540), H = Number(process.env.H ?? 960), DPR = Number(process.env.DPR ?? 2);
mkdirSync(out, { recursive: true });

const page = await launch({ width: W, height: H });
await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./director.js', import.meta.url), 'utf8') });
await page.send('Page.navigate', { url: 'http://localhost:5173/' });
await new Promise((r) => setTimeout(r, 6000));
await page.evaluate(`__cap.init()`);
await page.evaluate(`(() => { const s = __cap.office.getState(); s.setLang('vi'); s.closeGuide?.(); if (s.followWork) s.toggleFollow(); if (${process.env.HUD ? 'false' : 's.panelsVisible'}) s.togglePanels(); return true })()`);
console.log(JSON.stringify(await page.evaluate(`__cap.agents()`)));
console.log(JSON.stringify(await page.evaluate(`Object.values(__cap.office.getState().agents).map(a => [a.id, a.name, a.title, a.managerId ?? a.reportsTo ?? a.manager ?? null, a.department ?? a.departmentId])`)));
await page.evaluate(`__cap.start()`);
for (let i = 0; i < 30; i++) await page.evaluate(`__cap.step(33.333)`);

for (const [i, pose] of poses.entries()) {
  await page.evaluate(`__cap.pose = ${JSON.stringify(pose)}`);
  for (let k = 0; k < 3; k++) await page.evaluate(`__cap.step(33.333)`);
  const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  writeFileSync(`${out}/pose-${i}.jpg`, Buffer.from(data, 'base64'));
}
if (!poses.length) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  writeFileSync(`${out}/default.jpg`, Buffer.from(data, 'base64'));
}
await page.close();
