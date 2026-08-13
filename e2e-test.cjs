const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

function waitForServer(port, maxMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/api/staff?limit=1`, (res) => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('Server not ready'));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  // Start the server in a separate process
  console.log('Starting Next.js server...');
  const server = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, PORT: '3000' },
    detached: true,
    stdio: 'ignore'
  });
  server.unref();
  
  // Wait for server to be ready
  await waitForServer(3000);
  console.log('Server is ready');
  
  // Quick API test
  const staffData = await fetchJSON('http://localhost:3000/api/staff?limit=9999');
  console.log(`Staff count from API: ${staffData.staff?.length || 0}`);
  for (const s of (staffData.staff || [])) {
    console.log(`  - ${s.firstName} ${s.lastName} (${s.fonction})`);
  }
  
  // Now launch Playwright
  console.log('\nLaunching Playwright browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer']
  });
  console.log('Browser launched');
  
  // Check if server still responds
  try {
    const check = await fetchJSON('http://localhost:3000/api/staff?limit=1');
    console.log('Server still responds after browser launch:', !!check.staff);
  } catch(e) {
    console.log('Server died after browser launch:', e.message);
    await browser.close();
    process.exit(1);
  }
  
  const page = await browser.newPage();
  console.log('Page created');
  
  // Navigate
  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000', { timeout: 15000, waitUntil: 'domcontentloaded' });
  console.log('Page loaded');
  
  await page.waitForTimeout(8000);
  
  const bodyText = await page.innerText('body');
  console.log('Body text:', bodyText.substring(0, 300));
  
  await page.screenshot({ path: '/tmp/step1-login.png', fullPage: true });
  
  // Try to find and interact with login form
  const allInputs = page.locator('input');
  const inputCount = await allInputs.count();
  console.log(`\nFound ${inputCount} inputs on page`);
  
  for (let i = 0; i < inputCount; i++) {
    const type = await allInputs.nth(i).getAttribute('type') || 'text';
    const placeholder = await allInputs.nth(i).getAttribute('placeholder') || '';
    const id = await allInputs.nth(i).getAttribute('id') || '';
    const visible = await allInputs.nth(i).isVisible();
    console.log(`  Input ${i}: type="${type}" placeholder="${placeholder}" id="${id}" visible=${visible}`);
  }
  
  // Find and fill login form
  const emailField = page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').first();
  if (await emailField.count() > 0) {
    console.log('\nFound email field, filling login form...');
    await emailField.fill('admin@ecole.com');
    
    const pwdFields = page.locator('input[type="password"]');
    const pwdCount = await pwdFields.count();
    console.log(`Found ${pwdCount} password fields`);
    
    // Fill based on how many password fields there are
    // The login form has: institution password + user password
    for (let i = 0; i < pwdCount; i++) {
      const ph = await pwdFields.nth(i).getAttribute('placeholder') || '';
      const id = await pwdFields.nth(i).getAttribute('id') || '';
      console.log(`  Pwd field ${i}: placeholder="${ph}" id="${id}"`);
    }
    
    if (pwdCount >= 2) {
      await pwdFields.nth(0).fill('masomo2024');
      await pwdFields.nth(1).fill('admin123');
    } else if (pwdCount === 1) {
      await pwdFields.nth(0).fill('admin123');
    }
    
    await page.screenshot({ path: '/tmp/step2-filled.png', fullPage: true });
    
    // Click login button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Se connecter")').first();
    if (await submitBtn.count() > 0) {
      console.log('Clicking submit...');
      await submitBtn.click();
      await page.waitForTimeout(5000);
      
      const afterLogin = await page.innerText('body');
      console.log('\nAfter login text:', afterLogin.substring(0, 300));
      await page.screenshot({ path: '/tmp/step3-dashboard.png', fullPage: true });
      
      // Step 5: Click on Paramètres
      console.log('\nLooking for Paramètres link...');
      const settingsLink = page.locator('text=Paramètres').first();
      if (await settingsLink.count() > 0) {
        await settingsLink.click();
        await page.waitForTimeout(3000);
        
        const settingsText = await page.innerText('body');
        console.log('Settings page text:', settingsText.substring(0, 500));
        await page.screenshot({ path: '/tmp/step4-settings.png', fullPage: true });
      }
    }
  } else {
    console.log('\nNo email input found - page might still be loading or in error state');
  }
  
  await browser.close();
  console.log('\nTest complete.');
  
  // Kill server
  try { process.kill(-server.pid); } catch(e) {}
})().catch(e => {
  console.error('FATAL ERROR:', e.message);
  try { process.kill(-server.pid); } catch(e2) {}
  process.exit(1);
});
