import { getAllNewsDomains } from './shared/news_sites.js';

const defaultDomains = getAllNewsDomains();
const defaultDomainsSet = new Set(defaultDomains);
let whitelist = new Set();
let customSites = new Set();
let extensionActive = true;

// Load the current whitelist and custom sites into memory on startup for fastest possible tab closure
chrome.storage.sync.get(["whitelist", "customSites", "extensionActive", "isDarkMode"], (result) => {
  whitelist = new Set(result.whitelist || []);
  customSites = new Set(result.customSites || []);
  extensionActive = result.extensionActive !== false;
  
  if (result.isDarkMode) {
    chrome.action.setIcon({
      path: {
        "16": "assets/icon-16-dark.png",
        "48": "assets/icon-48-dark.png",
        "128": "assets/icon-128-dark.png"
      }
    });
  }
});

// Regex for news URLs
const newsRegex = /(\/article\/|\/story\/|\/news\/|\/\d{4}\/\d{2}\/\d{2}\/|news\.|tribune\.)/i;

// Listen for dynamic DOM heuristic matches
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'blockTab' && sender.tab && extensionActive) {
        let url; try { url = new URL(sender.url); } catch(e) { return; }
        let hostname = url.hostname.toLowerCase();
        
        let isWhitelisted = Array.from(whitelist).some(w => hostname === w || hostname.endsWith("." + w));
        if (!isWhitelisted) {
            chrome.tabs.remove(sender.tab.id).catch(()=>{});
        }
    }
});

// Listen for updates from the options page
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.whitelist) {
      whitelist = new Set(changes.whitelist.newValue || []);
    }
    if (changes.customSites) {
      customSites = new Set(changes.customSites.newValue || []);
    }
    if (changes.extensionActive) {
      extensionActive = changes.extensionActive.newValue !== false;
    }
    if (changes.isDarkMode) {
      const isDark = changes.isDarkMode.newValue;
      chrome.action.setIcon({
        path: {
          "16": `assets/icon-16${isDark ? '-dark' : ''}.png`,
          "48": `assets/icon-48${isDark ? '-dark' : ''}.png`,
          "128": `assets/icon-128${isDark ? '-dark' : ''}.png`
        }
      });
    }
  }
});

/**
 * Checks if a hostname matches any blocked domains or their subdomains efficiently.
 * @param {string} hostname
 * @returns {string|null} The matched domain or null
 */
function getMatchedDomain(hostname) {
  const parts = hostname.toLowerCase().split('.');
  
  // Start from the largest possible domain (full hostname) and go down to the primary domain
  // e.g. for sub.news.cnn.com, check: sub.news.cnn.com, news.cnn.com, cnn.com
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (defaultDomainsSet.has(candidate) || customSites.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Intercept navigations
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionActive) return;
  
  // Only target main frame navigations (frameId 0)
  if (details.frameId === 0) {
    let url;
    try {
      url = new URL(details.url);
    } catch (e) {
      return;
    }

    const hostname = url.hostname.toLowerCase();
    const matchedDomain = getMatchedDomain(hostname);

    if (matchedDomain || newsRegex.test(details.url)) {
      // Check whitelist dynamically across all subdomains
      let isWhitelisted = Array.from(whitelist).some(w => hostname === w || hostname.endsWith("." + w));
      if (!isWhitelisted) {
        // Not whitelisted - aggressively close the tab immediately with no feedback
        chrome.tabs.remove(details.tabId).catch(() => {});
      }
    }
  }
});
