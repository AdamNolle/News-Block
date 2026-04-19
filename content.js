// content.js - News DOM Heuristics

function isNewsSite() {
    // 1. Meta / Schema tags
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType && ogType.content.toLowerCase() === 'article') {
        return true;
    }

    const schemas = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of schemas) {
        try {
            const json = JSON.parse(script.innerText);
            if (json["@type"] === "NewsArticle" || json["@type"] === "Article" || 
               (Array.isArray(json) && json.some(i => i["@type"] === "NewsArticle" || i["@type"] === "Article"))) {
                return true;
            }
        } catch(e) {}
    }

    // 2. Semantic HTML5 traits
    if (document.querySelector('article') && (document.querySelector('header h1') || document.querySelector('.author'))) {
        return true;
    }
    
    return false;
}

if (isNewsSite()) {
    chrome.runtime.sendMessage({action: 'blockTab'});
}
