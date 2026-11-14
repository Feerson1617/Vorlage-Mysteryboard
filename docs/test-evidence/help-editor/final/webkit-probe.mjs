import { webkit } from '@playwright/test';
console.log('Playwright WebKit executable:', webkit.executablePath());
try {
 const browser = await webkit.launch();
 console.log('Launched:', browser.version());
 await browser.close();
} catch (error) { console.log('OPEN — launch failed:', error.message); }
console.log('WebKit 26.5: no installed executable available. No compatibility pass claimed.');
