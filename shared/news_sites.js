export const newsCategories = {
  "Core Global Publishers": [
    "cnn.com", "nytimes.com", "foxnews.com", "bbc.com", "usatoday.com", 
    "wsj.com", "washingtonpost.com", "nbcnews.com", "theguardian.com", 
    "npr.org", "reuters.com", "bloomberg.com", "businessinsider.com", "forbes.com",
    "cnbc.com", "msnbc.com", "nypost.com"
  ]
};

export function getAllNewsDomains() {
  return newsCategories["Core Global Publishers"];
}
