const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

function waitForServer(port, maxMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/api/staff?limit=1`, (res) => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('Server not ready'));
        else setTimeout(check, 1000);
      });
    };
    check();
  });
}

(async () => {
  // Start the server
  console.log('Starting Next.js server...');
  const server = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0' },
    detached: true,
    stdio: 'ignore'
  });
  server.unref();
  
  await waitForServer(3000);
  console.log('Server is ready');
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer']
  });
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Navigate to login page
  await page.goto('http://localhost:3000', { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Step 1: Fill institution password
  const instPwdField = page.locator('input[type="password"]').first();
  await instPwdField.fill('masomo2024');
  const continueBtn = page.locator('button:has-text("Continuer")').first();
  await continueBtn.click();
  await page.waitForTimeout(3000);
  
  // Step 2: Fill user credentials
  const emailField = page.locator('input[type="email"], input[placeholder*="mail"], input[placeholder*="Mail"]').first();
  if (await emailField.count() > 0) {
    await emailField.fill('admin@ecole.com');
  }
  const pwdFields = page.locator('input[type="password"]');
  const pwdCount = await pwdFields.count();
  if (pwdCount >= 1) {
    await pwdFields.nth(pwdCount - 1).fill('admin123');
  }
  
  const submitBtn = page.locator('button[type="submit"], button:has-text("Se connecter")').first();
  await submitBtn.click();
  await page.waitForTimeout(8000);
  
  // Take dashboard screenshot
  await page.screenshot({ path: '/tmp/verify-dashboard.png', fullPage: true });
  console.log('Screenshot: /tmp/verify-dashboard.png');
  
  // ========================
  // VERIFICATION
  // ========================
  console.log('\n========================================');
  console.log('VERIFICATION RESULTS');
  console.log('========================================\n');
  
  const institutionName = 'Lycée Bilingue de Douala';
  const pageContent = await page.content();
  const fullPageText = await page.innerText('body');
  
  // 1. HEADER BAR
  console.log('1. INSTITUTION NAME IN HEADER BAR:');
  const header = page.locator('header, [role="banner"]').first();
  if (await header.count() > 0) {
    const headerText = await header.innerText();
    const hasInst = headerText.includes('Lycée') || headerText.includes('Douala');
    console.log(`   Status: ${hasInst ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (hasInst) {
      // Look for emerald/green colored elements in header
      const headerHtml = await header.innerHTML();
      const hasEmerald = headerHtml.includes('emerald');
      console.log(`   Has emerald styling: ${hasEmerald ? '✅' : '❌'}`);
      console.log(`   Header text: "${headerText.substring(0, 200).replace(/\n/g, ' | ')}"`);
    }
  } else {
    console.log('   Status: ❌ Header element not found');
  }
  
  // 2. SIDEBAR
  console.log('\n2. INSTITUTION NAME IN SIDEBAR (under MASOMO):');
  const sidebar = page.locator('aside, [data-sidebar]').first();
  if (await sidebar.count() > 0) {
    const sidebarText = await sidebar.innerText();
    const hasInst = sidebarText.includes('Lycée') || sidebarText.includes('Douala');
    const hasMASOMO = sidebarText.includes('MASOMO');
    console.log(`   Status: ${hasInst ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (hasInst) {
      // Check if MASOMO appears before institution name
      const masomoIdx = sidebarText.indexOf('MASOMO');
      const instIdx = sidebarText.indexOf('Lycée');
      console.log(`   MASOMO appears: ${hasMASOMO ? '✅' : '❌'}`);
      console.log(`   Institution name appears ${instIdx > masomoIdx ? 'after' : 'before'} MASOMO: ${instIdx > masomoIdx ? '✅' : '❌'}`);
    }
    // Get sidebar HTML for styling check
    const sidebarHtml = await sidebar.innerHTML();
    const hasEmeraldSidebar = sidebarHtml.includes('emerald');
    console.log(`   Has emerald styling: ${hasEmeraldSidebar ? '✅' : '❌'}`);
  } else {
    console.log('   Status: ❌ Sidebar element not found');
  }
  
  // 3. DASHBOARD BANNER
  console.log('\n3. INSTITUTION NAME BANNER AT TOP OF DASHBOARD:');
  const hasInst = fullPageText.includes('Lycée') || fullPageText.includes('Douala');
  console.log(`   Status: ${hasInst ? '✅ FOUND' : '❌ NOT FOUND'}`);
  
  // Find the specific section that contains the institution name
  const instElements = page.locator('text=Lycée Bilingue de Douala');
  const instCount = await instElements.count();
  console.log(`   Number of visible elements with exact institution name: ${instCount}`);
  for (let i = 0; i < instCount; i++) {
    const tagName = await instElements.nth(i).evaluate(el => el.tagName);
    const cls = await instElements.nth(i).evaluate(el => el.className);
    const parentCls = await instElements.nth(i).evaluate(el => el.parentElement?.className || '');
    console.log(`   Element ${i}: <${tagName}> class="${cls.substring(0, 80)}" parent-class="${parentCls.substring(0, 80)}"`);
  }
  
  // 4. DOM OCCURRENCES
  console.log('\n4. DOM OCCURRENCES:');
  const exactCount = (pageContent.match(/Lycée Bilingue de Douala/g) || []).length;
  console.log(`   "Lycée Bilingue de Douala" appears ${exactCount} time(s) in the DOM`);
  
  // 5. USER AVATAR DROPDOWN
  console.log('\n5. USER AVATAR DROPDOWN:');
  // Find the user menu button - typically in the header/sidebar area
  const allBtns = page.locator('button');
  const btnCount = await allBtns.count();
  
  let dropdownFound = false;
  for (let i = 0; i < btnCount; i++) {
    try {
      const ariaHasPopup = await allBtns.nth(i).getAttribute('aria-haspopup') || '';
      const ariaLabel = await allBtns.nth(i).getAttribute('aria-label') || '';
      const text = await allBtns.nth(i).innerText().catch(() => '') || '';
      
      if (ariaHasPopup === 'menu' || ariaHasPopup === 'true') {
        if (text.includes('Admin') || text.includes('Système') || text.includes('ADM') || 
            ariaLabel.includes('menu') || ariaLabel.includes('user') || ariaLabel.includes('User') ||
            ariaLabel.includes('options')) {
          console.log(`   Found dropdown button: text="${text.substring(0, 60).replace(/\n/g, ' | ')}" aria-label="${ariaLabel}"`);
          await allBtns.nth(i).click();
          await page.waitForTimeout(1500);
          dropdownFound = true;
          
          await page.screenshot({ path: '/tmp/verify-avatar-dropdown.png', fullPage: true });
          console.log('   Screenshot: /tmp/verify-avatar-dropdown.png');
          
          const dropdownText = await page.innerText('body');
          const hasInstInDropdown = dropdownText.includes('Lycée') || dropdownText.includes('Douala');
          console.log(`   Institution name in dropdown: ${hasInstInDropdown ? '✅ FOUND' : '❌ NOT FOUND'}`);
          
          if (hasInstInDropdown) {
            // Find the institution text in the dropdown
            const dropdownLines = dropdownText.split('\n').filter(l => 
              l.includes('Lycée') || l.includes('Douala') || l.includes('Bilingue') || l.includes('institution')
            );
            dropdownLines.forEach(l => console.log(`   → ${l.trim().substring(0, 150)}`));
          }
          
          await page.keyboard.press('Escape');
          break;
        }
      }
    } catch(e) {
      // Skip this button
    }
  }
  
  if (!dropdownFound) {
    console.log('   ❌ Could not find avatar dropdown button');
  }
  
  // Final screenshot
  await page.screenshot({ path: '/tmp/verify-final.png', fullPage: true });
  console.log('\nFinal screenshot: /tmp/verify-final.png');
  
  // Summary
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Institution name: "Lycée Bilingue de Douala"');
  console.log(`DOM occurrences: ${exactCount}`);
  console.log(`Header bar: ${fullPageText.includes('Lycée') ? 'VISIBLE' : 'NOT VISIBLE'}`);
  console.log(`Sidebar: ${fullPageText.includes('Lycée') ? 'VISIBLE' : 'NOT VISIBLE'}`);
  console.log(`Dashboard: ${fullPageText.includes('Lycée') ? 'VISIBLE' : 'NOT VISIBLE'}`);
  
  await browser.close();
  console.log('\nDone.');
  
  try { process.kill(-server.pid); } catch(e) {}
})().catch(e => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});
