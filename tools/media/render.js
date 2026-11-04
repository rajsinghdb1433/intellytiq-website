// Renders tools/media/*.html frame-by-frame (deterministic) and encodes looping mp4 + poster with ffmpeg.
// Usage: node tools/media/render.js   (needs Playwright + ffmpeg)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const jobs = [{ src: 'hero.html', out: 'hero', T: 8, fps: 30, crf: 29 }, { src: 'pipeline.html', out: 'pipeline', T: 10, fps: 30, crf: 28 }];
(async () => {
  const b = await chromium.launch(); const outDir = path.join(__dirname, '..', '..', 'assets', 'video'); fs.mkdirSync(outDir, { recursive: true });
  for (const j of jobs.filter(j => !process.argv[2] || j.out === process.argv[2])) {
    const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); await pg.goto('file://' + path.join(__dirname, j.src));
    const tmp = fs.mkdtempSync('/tmp/frames-'); const n = j.T * j.fps;
    for (let i = 0; i < n; i++) { await pg.evaluate(t => render(t), i / j.fps); await pg.screenshot({ path: `${tmp}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 }); }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(j.fps), '-i', `${tmp}/f%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(j.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(outDir, j.out + '.mp4')]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${tmp}/f0000.jpg`, '-vf', 'scale=1280:-1', '-q:v', '5', path.join(outDir, j.out + '.jpg')]);
    fs.rmSync(tmp, { recursive: true }); console.log(j.out, (fs.statSync(path.join(outDir, j.out + '.mp4')).size / 1e6).toFixed(2) + ' MB'); await pg.close();
  }
  await b.close();
})();
