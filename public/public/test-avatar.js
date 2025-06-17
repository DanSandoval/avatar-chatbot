const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false, // Set to true if you don't need to see the browser
    devtools: true  // Open DevTools to see console
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`Console ${msg.type()}: ${msg.text()}`);
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log('Page error:', error.message);
  });
  
  try {
    // Navigate to localhost:3000
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait a bit for the page to fully load
    await page.waitForTimeout(2000);
    
    // Take a screenshot before clicking
    await page.screenshot({ path: 'before-click.png' });
    
    // Try to find and click the "Start Avatar Session" button
    console.log('Looking for "Start Avatar Session" button...');
    
    // Try multiple selectors
    const buttonSelectors = [
      'button:has-text("Start Avatar Session")',
      'button:has-text("start avatar session")',
      'button[class*="start"]',
      'button'
    ];
    
    let button = null;
    for (const selector of buttonSelectors) {
      try {
        button = await page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (button && await button.isVisible()) {
      console.log('Clicking the button...');
      await button.click();
      
      // Wait for potential errors
      await page.waitForTimeout(3000);
      
      // Take a screenshot after clicking
      await page.screenshot({ path: 'after-click.png' });
      
      // Check for any error messages on the page
      const errorSelectors = [
        '[class*="error"]',
        '[class*="Error"]',
        '.alert',
        '.warning',
        'div:has-text("error")',
        'div:has-text("avatar not found")'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const errorElements = await page.locator(selector).all();
          for (const element of errorElements) {
            const text = await element.textContent();
            if (text && text.trim()) {
              console.log(`Error found: ${text}`);
            }
          }
        } catch (e) {
          // Continue
        }
      }
    } else {
      console.log('Could not find "Start Avatar Session" button');
      
      // List all buttons on the page
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} buttons on the page:`);
      for (const btn of allButtons) {
        const text = await btn.textContent();
        console.log(`  - "${text}"`);
      }
    }
    
    // Print all console messages
    console.log('\n=== All Console Messages ===');
    consoleMessages.forEach(msg => {
      console.log(`${msg.type}: ${msg.text}`);
    });
    
    // Print all page errors
    console.log('\n=== All Page Errors ===');
    pageErrors.forEach(error => {
      console.log(error);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Keep browser open for debugging
    console.log('\nTest complete. Press Ctrl+C to close the browser.');
    await new Promise(() => {}); // Keep the script running
  }
})();