const fs = require('fs');
async function run(){
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch(e) { console.error('puppeteer not installed'); process.exit(2); }
  const url = process.argv[2] || 'http://localhost:19092/viewer_gltf.html';
  const outPrefix = process.argv[3] || '/tmp/viewer_gltf';
  console.log('Headless check URL:', url);
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.setViewport({width:1400, height:900});
  page.on('console', msg => console.log('PAGE_CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR', err && err.stack ? err.stack : err));
  page.on('requestfailed', req => { const f = req.failure() || {}; console.log('REQUEST_FAILED', req.url(), f.errorText || f); });

  try {
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 20000});
    console.log('PAGE_LOADED');
    await page.waitForTimeout(800);

    // Semantic (default) screenshot
    const semanticOut = outPrefix + '_semantic.png';
    await page.screenshot({path: semanticOut, fullPage: true});
    console.log('SCREENSHOT_SAVED', semanticOut);

    // Timeline mode: switch viewMode -> timeline, set slider, then screenshot
    try {
      await page.evaluate(() => {
        const vm = document.getElementById('viewMode');
        if(vm){ vm.value = 'timeline'; vm.dispatchEvent(new Event('change')); }
      });
      await page.waitForTimeout(600);
      // set slider to middle
      await page.evaluate(() => {
        const s = document.getElementById('timeSlider');
        if(s){ const max = Number(s.max||100); s.value = Math.floor(max/2); s.dispatchEvent(new Event('input')); }
      });
      await page.waitForTimeout(900);
      const timelineOut = outPrefix + '_timeline.png';
      await page.screenshot({path: timelineOut, fullPage: true});
      console.log('SCREENSHOT_SAVED', timelineOut);
    } catch (e) { console.warn('Timeline capture failed', e && e.message); }

    // Heatmap mode: switch and screenshot
    try {
      await page.evaluate(() => {
        const vm = document.getElementById('viewMode');
        if(vm){ vm.value = 'heatmap'; vm.dispatchEvent(new Event('change')); }
      });
      await page.waitForTimeout(700);
      const heatOut = outPrefix + '_heatmap.png';
      await page.screenshot({path: heatOut, fullPage: true});
      console.log('SCREENSHOT_SAVED', heatOut);
    } catch (e) { console.warn('Heatmap capture failed', e && e.message); }

  } catch (e) {
    console.error('NAV_ERROR', e && e.message ? e.message : e);
    try { const html = await page.content(); fs.writeFileSync('/tmp/viewer_gltf_page.html', html, 'utf8'); console.log('WROTE /tmp/viewer_gltf_page.html'); } catch(_){ }
    await browser.close();
    process.exit(3);
  }
  await browser.close();
  process.exit(0);
}

run().catch(e=>{ console.error('UNCAUGHT', e); process.exit(1); });
