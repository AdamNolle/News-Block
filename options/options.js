import { newsCategories } from '../shared/news_sites.js';

let whitelist = new Set();
let customSites = new Set();
let currentQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  console.log('News Block: Options page loading...');
  
  // Load current whitelist, custom sites, and globally active settings from storage
  chrome.storage.sync.get(['whitelist', 'customSites', 'showMasterToggle', 'isDarkMode'], (result) => {
    console.log('News Block: Settings retrieved');
    whitelist = new Set(result.whitelist || []);
    customSites = new Set(result.customSites || []);
    
    // Apply Dark Mode directly on load
    const applyDarkTheme = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark-mode');
        const icon = document.querySelector('.nav-icon');
        if (icon) icon.src = '../assets/icon-128-dark.png';
      } else {
        document.documentElement.classList.remove('dark-mode');
        const icon = document.querySelector('.nav-icon');
        if (icon) icon.src = '../assets/icon-128.png';
      }
    };
    
    applyDarkTheme(result.isDarkMode === true);
    
    const darkToggle = document.getElementById('darkModeSetting');
    if (darkToggle) {
      darkToggle.checked = result.isDarkMode === true;
      darkToggle.addEventListener('change', (e) => {
        applyDarkTheme(e.target.checked);
        chrome.storage.sync.set({ isDarkMode: e.target.checked });
      });
    }

    // Set up global settings toggle
    const toggleSetting = document.getElementById('showMasterToggleSetting');
    if (toggleSetting) {
      toggleSetting.checked = result.showMasterToggle !== false;
      toggleSetting.addEventListener('change', (e) => {
        chrome.storage.sync.set({ showMasterToggle: e.target.checked });
      });
    }

    setTimeout(() => renderCategories(), 0);
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentQuery = e.target.value.toLowerCase().trim();
      setTimeout(() => renderCategories(), 0);
    });
  }

  const addBtn = document.getElementById('addSiteBtn');
  if (addBtn) addBtn.addEventListener('click', handleAddCustomSite);
  
  const siteInput = document.getElementById('customSiteInput');
  if (siteInput) {
    siteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddCustomSite();
    });
  }
});

function handleAddCustomSite() {
  const input = document.getElementById('customSiteInput');
  let domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  // Basic URL cleaning if they accidentally paste a full URL
  try {
    if (domain.startsWith('http')) {
      domain = new URL(domain).hostname;
    }
  } catch(e) {}
  
  // Remove www.
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }

  if (!customSites.has(domain)) {
    customSites.add(domain);
    chrome.storage.sync.set({ customSites: Array.from(customSites) }, () => {
      // If it was previously whitelisted somehow, remove it from whitelist since they just explicitly blocked it
      if (whitelist.has(domain)) {
        whitelist.delete(domain);
        chrome.storage.sync.set({ whitelist: Array.from(whitelist) });
      }
      
      input.value = '';
      setTimeout(() => renderCategories(), 0);
    });
  } else {
    input.value = '';
  }
}

function handleRemoveCustomSite(domain) {
  customSites.delete(domain);
  chrome.storage.sync.set({ customSites: Array.from(customSites) }, () => {
    setTimeout(() => renderCategories(), 0);
  });
}

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  console.log('News Block: Starting category render...');

  try {
    // Merge custom sites and standard categories for rendering
    const allCategories = {};
    if (customSites.size > 0) {
      allCategories['Your Custom Sites'] = Array.from(customSites);
    }
    
    // Safety check for massive export
    if (typeof newsCategories !== 'undefined' && newsCategories) {
      Object.assign(allCategories, newsCategories);
    } else {
      console.error('News Block Error: newsCategories blocklist failed to load or is empty.');
      container.innerHTML = '<p style="text-align: center; color: #ef4444; margin-top: 40px; font-weight: 500;">Error: Could not load the news blocklist. Please try reloading the extension.</p>';
      return;
    }

    const categoriesEntries = Object.entries(allCategories);
    if (categoriesEntries.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 50px;">No categories available.</p>';
      return;
    }

    for (const [category, domains] of categoriesEntries) {
      let visibleDomains = domains;
      if (currentQuery) {
        if (!category.toLowerCase().includes(currentQuery)) {
          visibleDomains = domains.filter(d => d.toLowerCase().includes(currentQuery));
        }
      }
      
      if (visibleDomains.length === 0) continue;
      
      const section = document.createElement('div');
      section.className = 'category-section';
      section.setAttribute('data-category', category.toLowerCase());
      
      const headerRow = document.createElement('div');
      headerRow.className = 'category-header-row';
      headerRow.style.display = 'flex';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.alignItems = 'center';
      headerRow.style.marginBottom = '24px';
      headerRow.style.paddingBottom = '12px';
      headerRow.style.borderBottom = '1px solid var(--border-color)';
      
      const header = document.createElement('h3');
      header.className = 'category-header';
      header.style.marginBottom = '0';
      header.style.borderBottom = 'none';
      header.style.paddingBottom = '0';
      header.textContent = category;
      headerRow.appendChild(header);

      // OPTIMIZED: Use Set.has instead of Array.includes for thousands of lookups
      const allAllowed = visibleDomains.every(d => whitelist.has(d));
      
      const masterToggleDiv = document.createElement('div');
      masterToggleDiv.className = 'toggle-group';
      masterToggleDiv.innerHTML = `
        <span style="font-size: 13px; font-weight: 500; margin-right: 12px; color: var(--text-main);">Toggle Entire Category:</span>
        <label class="switch">
          <input type="checkbox" class="category-master-toggle" ${allAllowed ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      
      masterToggleDiv.querySelector('.category-master-toggle').addEventListener('change', (e) => {
        const isAllowed = e.target.checked;
        
        if (isAllowed) {
          visibleDomains.forEach(d => whitelist.add(d));
        } else {
          visibleDomains.forEach(d => whitelist.delete(d));
        }
        
        chrome.storage.sync.set({ whitelist: Array.from(whitelist) }, () => {
          setTimeout(() => renderCategories(), 0);
        });
      });
      
      headerRow.appendChild(masterToggleDiv);
      section.appendChild(headerRow);
      
      const grid = document.createElement('div');
      grid.className = 'site-grid';
      
      // Batch rendering for performance
      const renderLimit = 50;
      const toRender = visibleDomains.slice(0, renderLimit);
      
      const appendBatch = (batch) => {
        batch.forEach(domain => {
          const siteItem = document.createElement('div');
          siteItem.className = 'site-item';
          siteItem.setAttribute('data-domain', domain.toLowerCase());
          
          const isAllowed = whitelist.has(domain);
          const isCustom = category === 'Your Custom Sites';
          
          let html = `
            <span class="domain-name">${domain}</span>
            <div class="toggle-group">
              <label class="switch">
                <input type="checkbox" class="site-toggle" data-domain="${domain}" ${isAllowed ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span class="status-label">${isAllowed ? 'Allowed' : 'Blocked'}</span>
          `;
          
          if (isCustom) {
            html += `<button class="delete-custom-btn" data-domain="${domain}" title="Remove custom site">✕</button>`;
          }
          
          html += `</div>`;
          siteItem.innerHTML = html;
          
          // Bind listeners immediately for this item
          siteItem.querySelector('.site-toggle').addEventListener('change', handleToggle);
          if (isCustom) {
            siteItem.querySelector('.delete-custom-btn').addEventListener('click', () => handleRemoveCustomSite(domain));
          }
          
          grid.appendChild(siteItem);
        });
      };
      
      appendBatch(toRender);
      section.appendChild(grid);
      
      // Load more logic
      let currentlyRenderedCount = toRender.length;
      if (currentlyRenderedCount < visibleDomains.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.style.cssText = 'margin-top: 20px; background: var(--panel-bg); border: 1px solid var(--border-color); color: var(--text-main); cursor: pointer; font-weight: 500; font-size: 14px; padding: 10px 16px; border-radius: 10px;';
        
        const updateBtn = () => {
          const remaining = visibleDomains.length - currentlyRenderedCount;
          loadMoreBtn.textContent = `Load next batch (${remaining.toLocaleString()} remaining)`;
        };
        updateBtn();
        
        loadMoreBtn.addEventListener('click', () => {
          const nextBatch = visibleDomains.slice(currentlyRenderedCount, currentlyRenderedCount + 200);
          appendBatch(nextBatch);
          currentlyRenderedCount += nextBatch.length;
          if (currentlyRenderedCount >= visibleDomains.length) {
            loadMoreBtn.remove();
          } else {
            updateBtn();
          }
        });
        
        const center = document.createElement('div');
        center.style.display = 'flex';
        center.style.justifyContent = 'center';
        center.appendChild(loadMoreBtn);
        section.appendChild(center);
      }
      
      container.appendChild(section);
    }
  } catch (err) {
    console.error('News Block: Rendering crash', err);
    container.innerHTML = `<p style="color: #ef4444; padding: 20px;">Rendering error: ${err.message}</p>`;
  }
  
  console.log('News Block: Category render completed.');
}

function handleToggle(e) {
  const domain = e.target.getAttribute('data-domain');
  const isAllowed = e.target.checked;
  const label = e.target.closest('.toggle-group').querySelector('.status-label');
  
  if (isAllowed) {
    whitelist.add(domain);
    if (label) label.textContent = 'Allowed';
  } else {
    whitelist.delete(domain);
    if (label) label.textContent = 'Blocked';
  }
  
  chrome.storage.sync.set({ whitelist: Array.from(whitelist) });
}


