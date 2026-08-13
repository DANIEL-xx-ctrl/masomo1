import { chromium } from 'playwright';

async function runTests() {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] 
  });
  
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);
  
  console.log('=== STEP 1: Login Page ===');
  console.log('Title:', await page.title());
  
  const instPasswordField = await page.$('input[id="institutionPassword"]');
  const emailField = await page.$('input[id="email"]');
  console.log('Institution password field exists:', !!instPasswordField);
  console.log('Email field exists:', !!emailField);
  
  if (instPasswordField) {
    // Check the institution step heading
    const step1Heading = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 ? h2.textContent : 'No h2 found';
    });
    console.log('Step 1 heading:', step1Heading);
    
    // Check for Continuer button
    const continuerBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Continuer'));
      return btn ? btn.textContent?.trim() : 'Not found';
    });
    console.log('Continuer button:', continuerBtn);
    
    // Enter correct institution password
    console.log('\n--- Entering correct institution password: masomo2024 ---');
    await instPasswordField.fill('masomo2024');
    
    // Click Continuer
    const continuerButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.includes('Continuer'));
    });
    if (continuerButton) {
      await continuerButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Check if Step 2 appeared
    const emailFieldStep2 = await page.$('input[id="email"]');
    const passwordFieldStep2 = await page.$('input[id="password"]');
    console.log('After institution verify - Email field exists:', !!emailFieldStep2);
    console.log('After institution verify - Password field exists:', !!passwordFieldStep2);
    
    const step2Heading = await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      return h2s.map(h => h.textContent).join(' | ');
    });
    console.log('Step 2 heading:', step2Heading);
    
    // Enter user credentials
    console.log('\n--- Entering user credentials ---');
    if (emailFieldStep2) {
      await emailFieldStep2.fill('admin@ecole.com');
    }
    if (passwordFieldStep2) {
      await passwordFieldStep2.fill('admin123');
    }
    
    // Click Se connecter
    const loginBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.includes('Se connecter'));
    });
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(3000);
    }
    
    // Check if logged in
    console.log('\n=== After Login ===');
    const afterLoginText = await page.evaluate(() => document.body.innerText);
    console.log('Page text (first 1500):', afterLoginText.substring(0, 1500));
    
    // Check for user name in navbar
    const hasAdminName = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Admin');
    });
    console.log('Admin name visible in page:', hasAdminName);
    
    // Check for school year selector
    const hasSchoolYear = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('2024-2025') || text.includes('2023-2024');
    });
    console.log('School year visible:', hasSchoolYear);
    
    // Navigate to Settings
    console.log('\n--- Navigating to Settings ---');
    const settingsBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const navItems = Array.from(document.querySelectorAll('nav button, nav a'));
      const all = [...buttons, ...navItems];
      return all.find(b => b.textContent?.includes('Paramètres'));
    });
    
    if (!settingsBtn || !(await settingsBtn.isVisible())) {
      // Try clicking from sidebar
      const settingsLink = await page.evaluateHandle(() => {
        const items = Array.from(document.querySelectorAll('button'));
        return items.find(b => b.textContent?.includes('Paramètres'));
      });
      if (settingsLink) {
        await settingsLink.click();
        await page.waitForTimeout(2000);
      }
    } else {
      await settingsBtn.click();
      await page.waitForTimeout(2000);
    }
    
    const settingsText = await page.evaluate(() => document.body.innerText);
    console.log('Settings page text (first 1500):', settingsText.substring(0, 1500));
    
    // Check for institution password field in settings
    const instPwdInSettings = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const instPwdLabel = labels.find(l => l.textContent?.includes("Mot de passe d'institution") || l.textContent?.includes('institution'));
      return !!instPwdLabel;
    });
    console.log('Institution password label in Settings:', instPwdInSettings);
    
    // Now test wrong institution password
    console.log('\n=== Testing WRONG institution password ===');
    // Log out
    const logoutBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent?.includes('Déconnexion'));
    });
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Check if back at login
    const instPwdFieldAgain = await page.$('input[id="institutionPassword"]');
    console.log('Back at login Step 1:', !!instPwdFieldAgain);
    
    if (instPwdFieldAgain) {
      await instPwdFieldAgain.fill('wrongpassword123');
      
      const continuerBtn2 = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.textContent?.includes('Continuer'));
      });
      if (continuerBtn2) {
        await continuerBtn2.click();
        await page.waitForTimeout(2000);
      }
      
      // Check for error message
      const errorText = await page.evaluate(() => {
        const errorEl = document.querySelector('[class*="destructive"]');
        return errorEl ? errorEl.textContent : 'No error element found';
      });
      console.log('Error message displayed:', errorText);
      
      // Check if still on step 1
      const stillOnStep1 = await page.$('input[id="institutionPassword"]');
      console.log('Still on Step 1 (error did not advance):', !!stillOnStep1);
    }
  } else {
    console.log('ERROR: No institution password field found! Current page structure:');
    const allInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).map(i => ({ id: i.id, type: i.type, placeholder: i.placeholder }));
    });
    console.log('All inputs:', JSON.stringify(allInputs));
  }
  
  await browser.close();
}

runTests().catch(e => { console.error('TEST ERROR:', e.message); process.exit(1); });
