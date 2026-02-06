const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:4000';

test('full e2e flow: register, create budget, convert, stats', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // switch to register
  await page.click('text=Switch to register');

  const name = 'e2e_' + Date.now();
  await page.fill('input[placeholder="username"]', name);
  await page.fill('input[placeholder="email"]', `${name}@example.com`);
  await page.fill('input[placeholder="password"]', 'password123');
  await page.click('text=Register');

  // wait for welcome
  await page.waitForSelector('text=Welcome', { timeout: 5000 });

  // go to Budgets
  await page.click('text=Budgets');
  await page.waitForSelector('input[placeholder="Budget name"]');

  // create a budget
  await page.fill('input[placeholder="Budget name"]', 'Groceries');
  await page.fill('input[placeholder="Target amount"]', '250');
  await page.click('text=Create');

  // wait for created budget card
  await page.waitForSelector('text=Groceries');

  // click Convert→EUR and capture dialog
  page.on('dialog', async dialog => {
    console.log('dialog message:', dialog.message());
    await dialog.accept();
  });

  await page.click('text=Convert→EUR');

  // go to Reports and ensure stats are visible
  await page.click('text=Reports');
  await page.waitForSelector('pre');
  const preText = await page.textContent('pre');
  expect(preText).toBeTruthy();
});
