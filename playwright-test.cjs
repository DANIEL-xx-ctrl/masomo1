const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  console.log('Browser launched');
  
  const page = await browser.newPage();
  console.log('Page created');
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  // Step 1: Navigate
  console.log('\n=== STEP 1: Navigate to login page ===');
  await page.goto('http://localhost:3000', { timeout: 30000, waitUntil: 'load' });
  console.log('Page loaded');
  await page.waitForTimeout(8000);
  
  const bodyText = await page.innerText('body');
  console.log('Body text:', bodyText.substring(0, 300));
  
  await page.screenshot({ path: '/tmp/step1-login-page.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Step 2: Login
  console.log('\n=== STEP 2: Login ===');
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"], input[id="email"]').first();
  const emailCount = await emailInput.count();
  console.log('Email input count:', emailCount);
  
  if (emailCount > 0) {
    await emailInput.fill('admin@ecole.com');
    
    const passwordInputs = page.locator('input[type="password"]');
    const pwdCount = await passwordInputs.count();
    console.log('Password inputs count:', pwdCount);
    
    for (let i = 0; i < pwdCount; i++) {
      const placeholder = await passwordInputs.nth(i).getAttribute('placeholder');
      const id = await passwordInputs.nth(i).getAttribute('id');
      console.log(`Password input ${i}: placeholder="${placeholder}" id="${id}"`);
    }
    
    if (pwdCount >= 2) {
      await passwordInputs.nth(0).fill('masomo2024');
      await passwordInputs.nth(1).fill('admin123');
    } else if (pwdCount === 1) {
      await passwordInputs.nth(0).fill('admin123');
    }
    
    await page.screenshot({ path: '/tmp/step2-login-filled.png', fullPage: true });
    
    const loginBtn = page.locator('button:has-text("Se connecter"), button:has-text("Connexion"), button[type="submit"]').first();
    if (await loginBtn.count() > 0) {
      await loginBtn.click();
      console.log('Clicked login');
      await page.waitForTimeout(5000);
      
      const afterLogin = await page.innerText('body');
      console.log('After login:', afterLogin.substring(0, 300));
      await page.screenshot({ path: '/tmp/step3-after-login.png', fullPage: true });
    }
  } else {
    console.log('No email input found. Checking page state...');
    // Get all inputs
    const allInputs = page.locator('input');
    const inputCount = await allInputs.count();
    console.log(`Total inputs: ${inputCount}`);
    for (let i = 0; i < inputCount; i++) {
      const type = await allInputs.nth(i).getAttribute('type');
      const placeholder = await allInputs.nth(i).getAttribute('placeholder');
      const id = await allInputs.nth(i).getAttribute('id');
      console.log(`Input ${i}: type="${type}" placeholder="${placeholder}" id="${id}"`);
    }
  }
  
  await browser.close();
  console.log('\nTest complete.');
})().catch(e => {
  console.error('FATAL ERROR:', e.message);
  process.exit(1);
});
