const puppeteer = require('puppeteer');

async function run(){
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args:['--no-sandbox','--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    const base = 'http://localhost:4000';
    await page.goto(base, {waitUntil:'networkidle2'});
    await page.waitForSelector('input[placeholder="username"]',{timeout:15000});

    // switch to register if present
    await page.evaluate(()=>{
      const btn = Array.from(document.querySelectorAll('button')).find(b=>/Switch to register/i.test(b.textContent));
      if(btn) btn.click();
    });

    const username = 'puppeteer_' + Date.now();
    await page.type('input[placeholder="username"]', username);
    await page.type('input[placeholder="email"]', username + '@example.com');
    await page.type('input[placeholder="password"]', 'passw0rd');

    // submit register
    await page.click('button[type="submit"]');
    await page.waitForSelector('h1');
    const h1 = await page.$eval('h1', el => el.innerText);
    console.log('H1:', h1);

    // create budget
    await page.waitForSelector('input[placeholder="Budget name"]');
    await page.type('input[placeholder="Budget name"]', 'E2E Fund');
    await page.type('input[placeholder="Target amount"]', '1234');
    await page.click('button[type="submit"]');

    // wait for budget to appear
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.budget')).some(el => el.innerText.includes('E2E Fund'));
    }, {timeout:10000});

    console.log('E2E: budget created and visible');
  } catch (err) {
    console.error('E2E error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      try { await browser.close(); } catch(e){ /* ignore */ }
    }
  }
}

run();
