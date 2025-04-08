import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  targetUrl: 'https://www.piattaformaunicanazionale.it/idr',
  apiEndpoint: 'https://api.pun.piattaformaunicanazionale.it/v1/chargepoints/public/map/search',
  networkIdleTimeout: 30000,
  outputDirectory: path.join(__dirname, 'output')
};

/**
 * Main function to run the scraping process
 */
async function main() {
  console.log('Starting script...');

  let browser;

  try {
    browser = await puppeteer.launch();
    console.log('Browser launched successfully.');

    const page = await browser.newPage();
    console.log('Page created successfully.');

    // Activate DevTools protocol
    await page.createCDPSession();
    console.log('DevTools protocol activated.');

    // Prepare output directory
    await prepareOutputDirectory();

    // Set up response collection
    const responses = [];
    page.on('response', async (response) => {
      const request = response.request();
      const url = request.url();

      if(url.includes(CONFIG.apiEndpoint)) {
        try {
          console.log('Map search response detected');
          const responseText = await response.text();
          if(responseText.trim()) {
            responses.push(responseText);
          }
        } catch (error) {
          console.error('Error processing response:', error.message);
        }
      }
    });

    // Navigate to the target page
    console.log('Navigating to the page...');
    await page.goto(CONFIG.targetUrl);
    console.log('Page loaded.');

    // Wait for network traffic to settle
    console.log('Waiting for network traffic to settle...');
    await waitForNetworkIdle(page, CONFIG.networkIdleTimeout);

    // Save responses
    await saveResponses(responses);

    console.log('Process completed successfully.');
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    if(browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

/**
 * Prepare the output directory by cleaning it if it exists
 */
async function prepareOutputDirectory() {
  console.log('Output directory path:', CONFIG.outputDirectory);

  if(fs.existsSync(CONFIG.outputDirectory)) {
    const files = fs.readdirSync(CONFIG.outputDirectory);

    for(const file of files) {
      const filePath = path.join(CONFIG.outputDirectory, file);
      fs.unlinkSync(filePath);
      console.log(`Deleted ${file}`);
    }
  } else {
    console.log('Output directory does not exist. It will be created.');
  }
}

/**
 * Save the collected responses to JSON files
 * @param {Array} responses - Array of response strings to save
 */
async function saveResponses(responses) {
  console.log('Saving JSON responses...');

  if(!fs.existsSync(CONFIG.outputDirectory)) {
    fs.mkdirSync(CONFIG.outputDirectory, { recursive: true });
  }

  const timestamp = Date.now();

  for(let i = 0; i < responses.length; i++) {
    const fileName = `response_${i}_${timestamp}.json`;
    const filePath = path.join(CONFIG.outputDirectory, fileName);
    fs.writeFileSync(filePath, responses[i]);
    console.log(`Saved ${fileName}`);
  }
}

/**
 * Wait for network traffic to become idle
 * @param {Page} page - Puppeteer page object
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForNetworkIdle(page, timeout) {
  return new Promise((resolve) => {
    let lastRequestTime = Date.now();
    let idleTimeout;

    const onRequest = () => {
      lastRequestTime = Date.now();
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(checkIdle, timeout);
    };

    const checkIdle = () => {
      if(Date.now() - lastRequestTime >= timeout) {
        console.log('Network traffic is idle. Continuing...');
        resolve();
      } else {
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(checkIdle, timeout);
      }
    };

    page.on('request', onRequest);

    // Initial timeout
    idleTimeout = setTimeout(checkIdle, timeout);
  });
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
