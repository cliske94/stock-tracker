let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (err) {
  // fallback to common global path inside Playwright container
  try { ({ chromium } = require('/usr/local/lib/node_modules/playwright')); } catch (err2) { throw err; }
}

(async ()=>{
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  const base = 'http://localhost:4000';
  console.log('Visiting', base);
  await page.goto(base, {waitUntil: 'networkidle'});

  // optionally switch to register
  const switchBtn = await page.$('text=Switch to register');
  if(switchBtn) { console.log('Switching to register'); await switchBtn.click(); }

  const username = 'playwright_' + Date.now();
  await page.fill('input[placeholder="username"]', username);
  await page.fill('input[placeholder="email"]', username + '@example.com');
  await page.fill('input[placeholder="password"]', 'passw0rd');

  console.log('Submitting register for', username);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForSelector('h1')
  ]);

  const h1 = await page.textContent('h1');
  console.log('H1:', h1.trim());

  // create budget
  await page.fill('input[placeholder="Budget name"]', 'E2E Fund');
  await page.fill('input[placeholder="Target amount"]', '4321');
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('.budget')).some(el => el.innerText.includes('E2E Fund'));
  }, {timeout: 10000});

  console.log('E2E: budget created and visible');
  await browser.close();
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
