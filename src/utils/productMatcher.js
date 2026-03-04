/**
 * Product Matcher Module
 *
 * Matches blog topics and image descriptions to real Shopify inventory products.
 * When a match is found, provides product photos as AI reference images and
 * product URLs for linking in the blog.
 */

import { searchProducts } from '../publishers/shopifyPublisher.js';

/**
 * Extract search keywords from a blog topic or image description.
 * Strips filler words and returns meaningful product-related terms.
 *
 * @param {string} text - Topic title or image description
 * @returns {string[]} Array of search keyword phrases to try
 */
function extractSearchTerms(text) {
  const lower = text.toLowerCase();

  // Common product keywords in this niche
  const productTerms = [
    'nectar collector', 'nectar tip', 'dab rig', 'dab pad', 'dab mat',
    'bong', 'water pipe', 'glass rig', 'silicone pad', 'silicone mat',
    'quartz banger', 'carb cap', 'dab tool', 'grinder', 'torch',
    'reclaim catcher', 'ash catcher', 'percolator', 'recycler',
    'terp slurper', 'terp pearl', 'bubble cap', 'spinner cap',
    'glass adapter', 'down stem', 'diffuser', 'splash guard',
    'concentrate jar', 'silicone jar', 'stash jar', 'container',
    'rolling tray', 'hand pipe', 'chillum', 'one hitter',
    'enail', 'e-nail', 'electric nail', 'dab pen', 'wax pen',
    'oil slick', 'slick pad', 'slick mat', 'slick sheet',
    'ceramic tip', 'titanium nail', 'quartz nail', 'ceramic nail',
    'dabber', 'scoop tool', 'cap', 'rig', 'banger'
  ];

  const matches = [];

  // Check for known product terms (multi-word first, then single)
  const sortedTerms = [...productTerms].sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    if (lower.includes(term)) {
      matches.push(term);
    }
  }

  // If no product terms found, try extracting nouns from the title
  if (matches.length === 0) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
      'or', 'if', 'while', 'about', 'up', 'your', 'our', 'my', 'his', 'her',
      'its', 'their', 'this', 'that', 'these', 'those', 'what', 'which',
      'who', 'whom', 'best', 'complete', 'guide', 'ultimate', 'top',
      'review', 'tips', 'tricks', 'new', 'old', '2024', '2025', '2026', '2027'
    ]);

    const words = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Try pairs of adjacent words as a search
    for (let i = 0; i < words.length - 1; i++) {
      matches.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  // Deduplicate and limit
  return [...new Set(matches)].slice(0, 5);
}

/**
 * Find matching products from Shopify inventory for a given blog topic.
 *
 * @param {string} topic - The blog topic/title
 * @param {Array} cachedProducts - Already-fetched products (e.g., from vendor query) to check first
 * @returns {Object} { products: Array, searchTermUsed: string|null }
 */
export async function findMatchingProducts(topic, cachedProducts = []) {
  const searchTerms = extractSearchTerms(topic);

  if (searchTerms.length === 0) {
    return { products: [], searchTermUsed: null };
  }

  // First check cached products (already fetched vendor products) for matches
  if (cachedProducts.length > 0) {
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      const matches = cachedProducts.filter(p => {
        const titleLower = (p.title || '').toLowerCase();
        const typeLower = (p.productType || '').toLowerCase();
        const tagsLower = (p.tags || []).join(' ').toLowerCase();
        return titleLower.includes(termLower) ||
               typeLower.includes(termLower) ||
               tagsLower.includes(termLower);
      });

      if (matches.length > 0) {
        console.log(`  Product match (cached): "${term}" -> ${matches.length} product(s)`);
        return { products: matches.slice(0, 3), searchTermUsed: term };
      }
    }
  }

  // If no cached match, search Shopify directly
  for (const term of searchTerms) {
    try {
      const results = await searchProducts(term, 5);
      if (results.length > 0) {
        console.log(`  Product match (search): "${term}" -> ${results.length} product(s)`);
        return { products: results.slice(0, 3), searchTermUsed: term };
      }
    } catch (e) {
      // Search failed, try next term
    }
  }

  console.log(`  No matching products found for topic: "${topic}"`);
  return { products: [], searchTermUsed: null };
}

/**
 * Match image descriptions to specific products.
 * For each image marker, find the most relevant product to use as a reference.
 *
 * @param {Array} imageMarkers - Array of { marker, description } from content generator
 * @param {Array} matchedProducts - Products already matched to the topic
 * @returns {Array} imageMarkers enriched with product reference data
 */
export function matchImagesToProducts(imageMarkers, matchedProducts) {
  if (!matchedProducts || matchedProducts.length === 0) {
    return imageMarkers.map(m => ({ ...m, referenceProduct: null }));
  }

  return imageMarkers.map((marker, index) => {
    const descLower = marker.description.toLowerCase();

    // Try to find a product whose title/type matches this specific image description
    let bestMatch = null;
    let bestScore = 0;

    for (const product of matchedProducts) {
      let score = 0;
      const titleWords = (product.title || '').toLowerCase().split(/\s+/);
      const typeWords = (product.productType || '').toLowerCase().split(/\s+/);

      for (const word of [...titleWords, ...typeWords]) {
        if (word.length > 2 && descLower.includes(word)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    // Fall back to first product if no specific match but at least some relevance
    if (!bestMatch && index === 0 && matchedProducts.length > 0) {
      bestMatch = matchedProducts[0];
    }

    if (bestMatch) {
      // Pick the best product image (featured image or first available)
      const imageUrl = bestMatch.featuredImage?.url ||
                       (bestMatch.images && bestMatch.images[0]?.url) ||
                       null;

      return {
        ...marker,
        referenceProduct: {
          title: bestMatch.title,
          handle: bestMatch.handle,
          imageUrl,
          productUrl: bestMatch.onlineStoreUrl ||
                      `https://oilslickpad.com/products/${bestMatch.handle}`,
          allImages: bestMatch.images || []
        }
      };
    }

    return { ...marker, referenceProduct: null };
  });
}

/**
 * Get the product URL for linking in blog content.
 * @param {Object} product - Shopify product object
 * @returns {string} Full product URL
 */
export function getProductUrl(product) {
  return product.onlineStoreUrl ||
         `https://oilslickpad.com/products/${product.handle}`;
}

export default {
  findMatchingProducts,
  matchImagesToProducts,
  getProductUrl
};
