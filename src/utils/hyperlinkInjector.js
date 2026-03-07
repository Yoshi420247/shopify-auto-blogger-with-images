/**
 * Hyperlink Injector Module (Enhanced)
 *
 * Automatically adds SEO-optimized internal and external links to blog content.
 * Follows Oil Slick Blog SEO Hyperlinking Guidelines.
 *
 * Enhancements (v2):
 * - Expanded from 20 to 17+ collection categories (ported from batch worker)
 * - Title attributes on ALL links for SEO and accessibility
 * - CTA "Shop Related Products" block generation
 * - Smarter keyword matching with priority scoring
 * - Better safety: isInsideCallout, isInsideScriptOrStyle checks
 */

// Base URL for all internal links
const BASE_URL = 'https://oilslickpad.com';

// All collections with priority scoring (higher = link first)
// Ported from link_worker.py LINK_RULES + expanded keywords
const COLLECTIONS = [
  // === PRIORITY (highest-margin core products) ===
  {
    name: 'Silicone Pads',
    url: '/collections/silicone-pads',
    keywords: ['silicone pad', 'silicone mat', 'dab pad', 'dab mat', 'Oil Slick pad', 'nonstick mat', 'nonstick pad', 'non-stick pad', 'non-stick mat', 'work mat', 'work surface'],
    anchor: 'silicone dab pads',
    priority: 10,
    category: 'storage'
  },
  {
    name: 'Glass Jars',
    url: '/collections/glass-jars',
    keywords: ['glass jar', 'concentrate jar', 'storage jar', 'extract jar', 'child resistant jar', 'CR jar', 'packaging jar', 'dispensary jar', 'cannabis jar', 'wax jar', 'stash jar'],
    anchor: 'concentrate containers',
    priority: 10,
    category: 'storage'
  },
  {
    name: 'Silicone Containers',
    url: '/collections/non-stick-silicone-dab-containers',
    keywords: ['silicone container', 'dab container', 'concentrate container', 'wax container', 'non-stick container', 'nonstick container', 'storage container'],
    anchor: 'silicone dab containers',
    priority: 10,
    category: 'storage'
  },
  {
    name: 'PTFE Sheets',
    url: '/collections/ptfe-sheets',
    keywords: ['PTFE', 'teflon', 'nonstick sheet', 'purging sheet', 'extraction sheet', 'slab paper', 'PTFE film'],
    anchor: 'PTFE sheets',
    priority: 9,
    category: 'extraction'
  },
  {
    name: 'FEP Sheets',
    url: '/collections/fep-sheets',
    keywords: ['FEP', 'FEP film', 'clear nonstick', 'transparent nonstick', 'FEP sheet'],
    anchor: 'FEP sheets',
    priority: 9,
    category: 'extraction'
  },
  {
    name: 'Parchment Paper',
    url: '/collections/parchment-paper',
    keywords: ['parchment', 'parchment paper', 'release paper', 'rosin paper', 'rosin parchment', 'pressing paper', 'foil backed', 'extraction paper'],
    anchor: 'parchment paper',
    priority: 9,
    category: 'extraction'
  },
  {
    name: 'Extraction & Packaging',
    url: '/collections/extraction-packaging',
    keywords: ['extraction supplies', 'cannabis packaging', 'processor supplies', 'extract supplies', 'rosin press supplies'],
    anchor: 'extraction supplies',
    priority: 7,
    category: 'extraction'
  },

  // === DABBING ACCESSORIES ===
  {
    name: 'Quartz Bangers',
    url: '/collections/quartz-bangers',
    keywords: ['quartz banger', 'banger', 'quartz nail', 'quartz bucket', 'terp slurper'],
    anchor: 'quartz bangers',
    priority: 9,
    category: 'dabbing'
  },
  {
    name: 'Quartz Inserts',
    url: '/collections/quartz-inserts',
    keywords: ['quartz insert', 'banger insert', 'terp pearl', 'terp pearls', 'ruby pearl'],
    anchor: 'quartz inserts & terp pearls',
    priority: 9,
    category: 'dabbing'
  },
  {
    name: 'Dab Rigs',
    url: '/collections/dab-rigs',
    keywords: ['dab rig', 'oil rig', 'concentrate rig', 'mini rig'],
    anchor: 'dab rigs',
    priority: 9,
    category: 'dabbing'
  },
  {
    name: 'Carb Caps',
    url: '/collections/carb-caps',
    keywords: ['carb cap', 'directional cap', 'bubble cap', 'spinner cap'],
    anchor: 'carb caps',
    priority: 8,
    category: 'dabbing'
  },
  {
    name: 'Dab Tools',
    url: '/collections/dab-tools',
    keywords: ['dab tool', 'dabber', 'dab pick', 'dab scoop', 'concentrate tool'],
    anchor: 'dab tools',
    priority: 8,
    category: 'dabbing'
  },
  {
    name: 'E-Nails',
    url: '/collections/enails',
    keywords: ['e-nail', 'enail', 'electronic nail', 'electric nail', 'e nail'],
    anchor: 'e-nails',
    priority: 8,
    category: 'dabbing'
  },
  {
    name: 'Nectar Collectors',
    url: '/collections/nectar-collectors',
    keywords: ['nectar collector', 'honey straw', 'dab straw'],
    anchor: 'nectar collectors',
    priority: 7,
    category: 'dabbing'
  },
  {
    name: 'Reclaim Catchers',
    url: '/collections/reclaimers-drop-downs',
    keywords: ['reclaim', 'reclaim catcher', 'drop down', 'dropdown', 'reclaimer'],
    anchor: 'reclaim catchers',
    priority: 7,
    category: 'dabbing'
  },
  {
    name: 'Torches',
    url: '/collections/torches',
    keywords: ['torch', 'butane torch', 'dab torch', 'blazer torch'],
    anchor: 'dab torches',
    priority: 6,
    category: 'dabbing'
  },

  // === SMOKING ===
  {
    name: 'Water Pipes & Bongs',
    url: '/collections/water-pipes',
    keywords: ['bong', 'water pipe', 'glass bong', 'silicone bong', 'waterpipe'],
    anchor: 'water pipes & bongs',
    priority: 7,
    category: 'smoking'
  },
  {
    name: 'Hand Pipes',
    url: '/collections/hand-pipes',
    keywords: ['hand pipe', 'glass pipe', 'spoon pipe', 'silicone pipe'],
    anchor: 'hand pipes',
    priority: 7,
    category: 'smoking'
  },
  {
    name: 'Bubblers',
    url: '/collections/bubblers',
    keywords: ['bubbler', 'mini bubbler'],
    anchor: 'bubblers',
    priority: 6,
    category: 'smoking'
  },
  {
    name: 'Grinders',
    url: '/collections/grinders',
    keywords: ['grinder', 'herb grinder', 'weed grinder'],
    anchor: 'grinders',
    priority: 5,
    category: 'smoking'
  },

  // === STORAGE & PACKAGING ===
  {
    name: 'Smell-Proof Storage',
    url: '/collections/storage-containers',
    keywords: ['smell proof', 'smell-proof', 'odor proof', 'odor-proof', 'stash box', 'stash bag'],
    anchor: 'smell-proof storage',
    priority: 8,
    category: 'storage'
  },
  {
    name: 'Mylar Bags',
    url: '/collections/mylar-bags',
    keywords: ['mylar bag', 'smell proof bag', 'mylar pouch'],
    anchor: 'mylar bags',
    priority: 6,
    category: 'storage'
  },

  // === ROLLING ===
  {
    name: 'Rolling Papers',
    url: '/collections/rolling-papers',
    keywords: ['rolling paper', 'papers', 'hemp paper', 'rice paper'],
    anchor: 'rolling papers',
    priority: 5,
    category: 'rolling'
  },
  {
    name: 'Cones',
    url: '/collections/rolling-papers-cones',
    keywords: ['cone', 'pre-roll', 'pre-rolled cone', 'preroll'],
    anchor: 'pre-rolled cones',
    priority: 5,
    category: 'rolling'
  },

  // === CLEANING ===
  {
    name: 'Cleaning Accessories',
    url: '/collections/accessories',
    keywords: ['cleaning', 'isopropyl', 'cleaning solution', 'pipe cleaner', 'glob mop'],
    anchor: 'cleaning accessories',
    priority: 5,
    category: 'accessories'
  }
];

// Sort by priority descending for processing order
const SORTED_COLLECTIONS = [...COLLECTIONS].sort((a, b) => b.priority - a.priority);

// External authoritative sources by topic (expanded for E-E-A-T)
const EXTERNAL_SOURCES = {
  health_safety: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['cannabis', 'health', 'strains', 'effects'] },
    { name: 'NORML', url: 'https://norml.org', topics: ['legalization', 'laws', 'policy', 'rights'] },
    { name: 'Americans for Safe Access', url: 'https://www.safeaccessnow.org', topics: ['patient', 'medical', 'safety'] }
  ],
  science: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['terpenes', 'cannabinoids', 'science'] },
    { name: 'Weedmaps', url: 'https://weedmaps.com/learn', topics: ['cannabis science', 'research'] },
    { name: 'Project CBD', url: 'https://www.projectcbd.org', topics: ['CBD', 'research', 'endocannabinoid'] }
  ],
  industry: [
    { name: 'MJBizDaily', url: 'https://mjbizdaily.com', topics: ['industry', 'market', 'business', 'trends'] },
    { name: 'Cannabis Business Times', url: 'https://www.cannabisbusinesstimes.com', topics: ['cultivation', 'processing', 'extraction'] },
    { name: 'High Times', url: 'https://hightimes.com', topics: ['culture', 'events', 'awards', '710'] }
  ],
  extraction: [
    { name: 'PurePressure', url: 'https://gopurepressure.com/blogs/rosin-education', topics: ['rosin', 'press', 'solventless', 'extraction'] }
  ]
};

// Configuration
const CONFIG = {
  minSpacingChars: 200,        // Minimum characters between links
  internalLinksPerThousand: { min: 2, max: 5 },
  blogLinksPerArticle: { min: 1, max: 3 },
  externalLinksPerArticle: { min: 1, max: 2 },
  anchorTextMinWords: 2,
  anchorTextMaxWords: 4,
  ctaMaxLinks: 4               // Max links in CTA block
};

/**
 * Main function to inject hyperlinks into HTML content
 * @param {string} htmlContent - The HTML blog content
 * @param {string} articleTitle - The article title (to avoid self-linking)
 * @param {Array} existingArticles - Existing blog articles for blog-to-blog linking
 * @returns {string} - HTML content with links injected
 */
export function injectHyperlinks(htmlContent, articleTitle = '', existingArticles = []) {
  if (!htmlContent) return htmlContent;

  let content = htmlContent;
  const wordCount = countWords(content);
  const linkedCollections = new Set();

  // Calculate target link counts based on article length
  const targetInternalLinks = Math.min(
    CONFIG.internalLinksPerThousand.max,
    Math.max(
      CONFIG.internalLinksPerThousand.min,
      Math.round((wordCount / 1000) * 3) // ~3 links per 1000 words
    )
  );

  console.log(`Hyperlinking: ${wordCount} words, targeting ${targetInternalLinks} internal links`);

  // Track link positions to enforce spacing
  const linkPositions = [];
  let internalLinksAdded = 0;
  const matchedCollections = []; // Track for CTA block

  // Process collections in priority order
  for (const collection of SORTED_COLLECTIONS) {
    if (internalLinksAdded >= targetInternalLinks) break;
    if (linkedCollections.has(collection.url)) continue;

    // Try each keyword for this collection
    for (const keyword of collection.keywords) {
      if (internalLinksAdded >= targetInternalLinks) break;
      if (linkedCollections.has(collection.url)) break;

      const result = addInternalLink(content, keyword, collection, linkPositions, articleTitle);
      if (result.added) {
        content = result.content;
        linkPositions.push(result.position);
        linkedCollections.add(collection.url);
        matchedCollections.push(collection);
        internalLinksAdded++;
        console.log(`  Added link: "${keyword}" -> ${collection.url}`);
        break; // Move to next collection
      }
    }
  }

  // Also scan for collections that MATCH the content but weren't linked inline
  // (these go into the CTA block)
  const textLower = stripHtml(content).toLowerCase();
  for (const collection of SORTED_COLLECTIONS) {
    if (linkedCollections.has(collection.url)) continue;
    for (const keyword of collection.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matchedCollections.push(collection);
        break;
      }
    }
  }

  // Add blog-to-blog links (builds topical authority)
  if (existingArticles.length > 0) {
    const blogLinksResult = addBlogToBlogLinks(content, existingArticles, articleTitle, linkPositions);
    if (blogLinksResult.count > 0) {
      content = blogLinksResult.content;
      console.log(`  Added ${blogLinksResult.count} blog-to-blog link(s)`);
    }
  }

  // Add external links (1-2 per article)
  const externalLinksAdded = addExternalLinks(content, linkPositions);
  if (externalLinksAdded.count > 0) {
    content = externalLinksAdded.content;
    console.log(`  Added ${externalLinksAdded.count} external link(s)`);
  }

  console.log(`Hyperlinking complete: ${internalLinksAdded} internal, ${externalLinksAdded.count} external`);

  // Store matched collections for CTA block generation (accessible via getLastMatchedCollections)
  _lastMatchedCollections = matchedCollections;

  return content;
}

// Internal state for CTA block generation
let _lastMatchedCollections = [];

/**
 * Build a "Shop Related Products" CTA block based on matched collections
 * Should be called AFTER injectHyperlinks()
 * @param {Array} matchedCollections - Optional override; uses last matched if not provided
 * @returns {string} - HTML CTA block or empty string if no matches
 */
export function buildCtaBlock(matchedCollections = null) {
  const collections = matchedCollections || _lastMatchedCollections;
  if (!collections || collections.length === 0) return '';

  // Deduplicate by URL and take top N by priority
  const seen = new Set();
  const unique = [];
  for (const col of collections) {
    if (!seen.has(col.url)) {
      seen.add(col.url);
      unique.push(col);
    }
  }

  // Sort by priority and take top links
  unique.sort((a, b) => b.priority - a.priority);
  const topLinks = unique.slice(0, CONFIG.ctaMaxLinks);

  const linksHtml = topLinks.map(col => {
    const displayName = col.anchor.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    return `<li><a href="${BASE_URL}${col.url}" title="Shop ${col.anchor} at Oil Slick">${displayName}</a></li>`;
  }).join('\n');

  return `
<div style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin:30px 0;">
<h3 style="margin-top:0;color:#333;">Shop Related Products</h3>
<p>Find premium products for everything mentioned in this guide:</p>
<ul>
${linksHtml}
</ul>
<p><a href="${BASE_URL}/collections/all" title="Browse all Oil Slick products" style="color:#2563eb;font-weight:bold;">Browse All Products &rarr;</a></p>
</div>`;
}

/**
 * Get the collections that were matched in the last injectHyperlinks() call
 * Useful for external CTA block generation
 */
export function getLastMatchedCollections() {
  return _lastMatchedCollections;
}

/**
 * Add blog-to-blog internal links for topical authority
 * Links to related existing blog articles based on keyword overlap
 */
function addBlogToBlogLinks(content, existingArticles, currentTitle, existingPositions) {
  let modifiedContent = content;
  let count = 0;
  const maxBlogLinks = CONFIG.blogLinksPerArticle.max;
  const linkedUrls = new Set();

  // Build keyword-to-article map from existing articles
  const articleKeywords = existingArticles
    .filter(article => {
      const title = (article.title || '').toLowerCase();
      return title !== currentTitle.toLowerCase() && article.url;
    })
    .map(article => {
      const title = article.title || '';
      const words = title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['the', 'and', 'for', 'your', 'that', 'this', 'with', 'from', 'best', 'guide', 'complete'].includes(w));

      const phrases = [];
      for (let i = 0; i < words.length - 1; i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      if (words.length > 0) {
        phrases.push(words[0]);
      }

      return { title, url: article.url, handle: article.handle, phrases };
    })
    .filter(a => a.phrases.length > 0);

  for (const article of articleKeywords) {
    if (count >= maxBlogLinks) break;
    if (linkedUrls.has(article.url)) continue;

    for (const phrase of article.phrases) {
      if (count >= maxBlogLinks) break;

      const escapedPhrase = escapeRegex(phrase);
      const pattern = new RegExp(
        `(?<![<\\/a-zA-Z])\\b(${escapedPhrase}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
        'i'
      );

      const match = modifiedContent.match(pattern);
      if (!match) continue;

      const matchPosition = match.index;
      if (!isSafePosition(modifiedContent, matchPosition)) continue;

      // Check spacing
      if (isTooClose(matchPosition, existingPositions)) continue;

      // Build the blog link URL
      let blogUrl = article.url;
      if (!blogUrl.startsWith('http')) {
        blogUrl = `${BASE_URL}${blogUrl.startsWith('/') ? '' : '/'}${blogUrl}`;
      }

      const titleAttr = `Read: ${article.title}`;
      const linkedText = `<a href="${blogUrl}" title="${escapeHtmlAttr(titleAttr)}">${match[1]}</a>`;
      modifiedContent = modifiedContent.substring(0, matchPosition) +
        linkedText +
        modifiedContent.substring(matchPosition + match[1].length);

      existingPositions.push(matchPosition);
      linkedUrls.add(article.url);
      count++;
      console.log(`  Added blog link: "${phrase}" -> ${article.title}`);
      break;
    }
  }

  return { content: modifiedContent, count };
}

/**
 * Add a single internal link for a keyword (with title attribute)
 */
function addInternalLink(content, keyword, collection, existingPositions, articleTitle) {
  const escapedKeyword = escapeRegex(keyword);

  const pattern = new RegExp(
    `(?<![<\\/a-zA-Z])\\b(${escapedKeyword}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
    'i'
  );

  const match = content.match(pattern);
  if (!match) {
    return { added: false };
  }

  const matchPosition = match.index;
  const matchedText = match[1];

  // Comprehensive safety checks
  if (!isSafePosition(content, matchPosition)) {
    return { added: false };
  }

  // Check spacing from other links
  if (isTooClose(matchPosition, existingPositions)) {
    return { added: false };
  }

  // Build the link with title attribute
  const fullUrl = `${BASE_URL}${collection.url}`;
  const titleAttr = `Shop ${collection.anchor} at Oil Slick`;
  const linkedText = `<a href="${fullUrl}" title="${escapeHtmlAttr(titleAttr)}">${matchedText}</a>`;

  content = content.substring(0, matchPosition) + linkedText + content.substring(matchPosition + matchedText.length);

  return {
    added: true,
    content,
    position: matchPosition
  };
}

/**
 * Add external links to authoritative sources (with title attribute)
 */
function addExternalLinks(content, existingPositions) {
  let modifiedContent = content;
  let count = 0;
  const maxExternal = CONFIG.externalLinksPerArticle.max;

  const externalLinkOpportunities = [
    { pattern: /\b(terpene|terpenes|terps)\b/i, source: 'science', anchor: 'terpenes' },
    { pattern: /\b(cannabinoid|cannabinoids|THC|CBD)\b/i, source: 'science', anchor: 'cannabinoids' },
    { pattern: /\b(cannabis industry|market trends?)\b/i, source: 'industry', anchor: 'cannabis industry' },
    { pattern: /\b(health benefits?|medical)\b/i, source: 'health_safety', anchor: 'health benefits' },
    { pattern: /\b(rosin press|solventless extract|hash rosin)\b/i, source: 'extraction', anchor: 'rosin' },
    { pattern: /\b(710 cup|cannabis cup|emerald cup)\b/i, source: 'industry', anchor: 'cannabis events' }
  ];

  for (const opportunity of externalLinkOpportunities) {
    if (count >= maxExternal) break;

    const match = modifiedContent.match(opportunity.pattern);
    if (match && isSafePosition(modifiedContent, match.index)) {
      if (isTooClose(match.index, existingPositions)) continue;

      const sources = EXTERNAL_SOURCES[opportunity.source];
      if (sources && sources.length > 0) {
        const source = sources[Math.floor(Math.random() * sources.length)];
        const titleAttr = `Learn more about ${opportunity.anchor} on ${source.name}`;
        const linkedText = `<a href="${source.url}" title="${escapeHtmlAttr(titleAttr)}" rel="noopener noreferrer" target="_blank">${match[0]}</a>`;

        modifiedContent = modifiedContent.substring(0, match.index) +
          linkedText +
          modifiedContent.substring(match.index + match[0].length);

        existingPositions.push(match.index);
        count++;
      }
    }
  }

  return { content: modifiedContent, count };
}

// ═══════════════════════════════════════════════════════════
// SAFETY HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Combined safety check for a position
 */
function isSafePosition(content, position) {
  return !isInsideHeading(content, position) &&
         !isInsideLink(content, position) &&
         !isInsideHtmlTag(content, position) &&
         !isInsideFigure(content, position) &&
         !isInsideCallout(content, position) &&
         !isInsideScriptOrStyle(content, position);
}

/**
 * Check if position is too close to existing link positions
 */
function isTooClose(position, existingPositions) {
  for (const pos of existingPositions) {
    if (Math.abs(position - pos) < CONFIG.minSpacingChars) {
      return true;
    }
  }
  return false;
}

function isInsideHeading(content, position) {
  const beforeText = content.substring(0, position);
  for (let level = 1; level <= 4; level++) {
    const lastOpen = beforeText.lastIndexOf(`<h${level}`);
    const lastClose = beforeText.lastIndexOf(`</h${level}>`);
    if (lastOpen > lastClose) return true;
  }
  return false;
}

function isInsideHtmlTag(content, position) {
  const beforeText = content.substring(0, position);
  const lastOpenAngle = beforeText.lastIndexOf('<');
  const lastCloseAngle = beforeText.lastIndexOf('>');
  return lastOpenAngle > lastCloseAngle;
}

function isInsideLink(content, position) {
  const beforeText = content.substring(0, position);
  const lastAOpen = beforeText.lastIndexOf('<a ');
  const lastAClose = beforeText.lastIndexOf('</a>');
  return lastAOpen > lastAClose;
}

function isInsideFigure(content, position) {
  const beforeText = content.substring(0, position);
  const lastFigureOpen = beforeText.lastIndexOf('<figure');
  const lastFigureClose = beforeText.lastIndexOf('</figure>');
  return lastFigureOpen > lastFigureClose;
}

/**
 * Check if position is inside a callout/tip box (styled divs with border-left)
 * These boxes have their own formatting and links inside them look odd
 */
function isInsideCallout(content, position) {
  const beforeText = content.substring(0, position);
  // Callout boxes use border-left: 4px solid styling
  const lastCalloutOpen = beforeText.lastIndexOf('border-left: 4px solid');
  if (lastCalloutOpen === -1) return false;
  // Check if we've closed that div
  const afterCallout = beforeText.substring(lastCalloutOpen);
  const divOpens = (afterCallout.match(/<div/g) || []).length;
  const divCloses = (afterCallout.match(/<\/div>/g) || []).length;
  return divOpens > divCloses;
}

/**
 * Check if position is inside a script or style tag
 */
function isInsideScriptOrStyle(content, position) {
  const beforeText = content.substring(0, position);
  for (const tag of ['script', 'style']) {
    const lastOpen = beforeText.lastIndexOf(`<${tag}`);
    const lastClose = beforeText.lastIndexOf(`</${tag}>`);
    if (lastOpen > lastClose) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function countWords(html) {
  const textOnly = html.replace(/<[^>]+>/g, ' ');
  return textOnly.split(/\s+/).filter(w => w.length > 0).length;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Get link statistics for content
 */
export function getLinkStats(htmlContent) {
  const internalLinks = (htmlContent.match(/<a href="https:\/\/oilslickpad\.com[^"]*"/g) || []).length;
  const externalLinks = (htmlContent.match(/<a href="https?:\/\/(?!oilslickpad\.com)[^"]*"/g) || []).length;
  const hasCta = htmlContent.includes('Shop Related Products');
  const wordCount = countWords(htmlContent);

  return {
    wordCount,
    internalLinks,
    externalLinks,
    hasCta,
    internalLinkDensity: (internalLinks / wordCount * 1000).toFixed(2),
    meetsGuidelines: internalLinks >= 2 && internalLinks <= 5 && externalLinks >= 1 && externalLinks <= 2
  };
}

/**
 * Clean up orphaned bold text that looks like missing hyperlinks.
 * AI sometimes bolds phrases it intends as link anchors, but the hyperlink
 * injector doesn't always match them. This converts matching bold text to
 * collection links, and strips bold from the rest so it doesn't look broken.
 */
export function cleanOrphanedBoldText(htmlContent) {
  if (!htmlContent) return htmlContent;

  let content = htmlContent;

  // Build a lookup: keyword -> collection (with full data for title attr)
  const keywordMap = new Map();
  for (const col of COLLECTIONS) {
    for (const kw of col.keywords) {
      keywordMap.set(kw.toLowerCase(), col);
    }
  }

  // Find all <strong>...</strong> tags
  const strongRegex = /<strong>([^<]+)<\/strong>/g;
  const matches = [];
  let m;
  while ((m = strongRegex.exec(content)) !== null) {
    matches.push({
      fullMatch: m[0],
      innerText: m[1],
      index: m.index
    });
  }

  // Process in reverse so replacements don't shift indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, innerText, index } = matches[i];

    // Skip if inside a callout box
    const before = content.substring(Math.max(0, index - 300), index);
    if (before.includes('border-left: 4px solid') && !before.includes('</div>')) continue;

    // Skip if this is a callout label
    if (/^(Pro Tip|Warning|Note|Important):?$/i.test(innerText.trim())) continue;

    // Skip if inside a heading, link, or figure
    if (isInsideHeading(content, index)) continue;
    if (isInsideLink(content, index)) continue;
    if (isInsideFigure(content, index)) continue;

    // Skip structured data labels
    const afterBold = content.substring(index + fullMatch.length, index + fullMatch.length + 50);
    if (/^\s*\n\s*[-\u2022]/.test(afterBold)) continue;

    // Try to match the bold text to a collection
    const textLower = innerText.toLowerCase().trim();
    let matched = false;

    for (const [keyword, col] of keywordMap) {
      if (textLower.includes(keyword) || keyword.includes(textLower)) {
        const fullUrl = `${BASE_URL}${col.url}`;
        const titleAttr = `Shop ${col.anchor} at Oil Slick`;
        const replacement = `<a href="${fullUrl}" title="${escapeHtmlAttr(titleAttr)}">${innerText}</a>`;
        content = content.substring(0, index) + replacement + content.substring(index + fullMatch.length);
        matched = true;
        break;
      }
    }

    // If no collection match, strip the bold entirely (plain text)
    if (!matched) {
      content = content.substring(0, index) + innerText + content.substring(index + fullMatch.length);
    }
  }

  return content;
}

export default {
  injectHyperlinks,
  getLinkStats,
  cleanOrphanedBoldText,
  buildCtaBlock,
  getLastMatchedCollections,
  COLLECTIONS,
  SORTED_COLLECTIONS
};
/**
 * Hyperlink Injector Module
 *
 * Automatically adds SEO-optimized internal and external links to blog content.
 * Follows Oil Slick Blog SEO Hyperlinking Guidelines.
 */

// Base URL for all internal links
const BASE_URL = 'https://oilslickpad.com';

// Priority collections (highest margin - link these first)
const PRIORITY_COLLECTIONS = [
  {
    name: 'Glass Jars',
    url: '/collections/glass-jars',
    keywords: ['glass jar', 'concentrate jar', 'storage jar', 'extract jar', 'child resistant jar', 'CR jar', 'packaging jar', 'dispensary jar', 'cannabis jar', 'wax jar']
  },
  {
    name: 'PTFE Sheets',
    url: '/collections/ptfe-sheets',
    keywords: ['PTFE', 'teflon', 'nonstick sheet', 'purging sheet', 'extraction sheet', 'slab paper']
  },
  {
    name: 'FEP Sheets',
    url: '/collections/fep-sheets',
    keywords: ['FEP', 'FEP film', 'clear nonstick', 'transparent nonstick']
  },
  {
    name: 'Parchment Paper',
    url: '/collections/parchment-paper',
    keywords: ['parchment', 'parchment paper', 'release paper', 'rosin paper', 'rosin parchment', 'pressing paper', 'foil backed', 'extraction paper']
  },
  {
    name: 'Silicone Pads',
    url: '/collections/silicone-pads',
    keywords: ['silicone pad', 'silicone mat', 'dab mat', 'dab pad', 'Oil Slick pad', 'nonstick mat', 'work mat']
  },
  {
    name: 'Extraction & Packaging',
    url: '/collections/extraction-packaging',
    keywords: ['extraction supplies', 'cannabis packaging', 'processor supplies', 'extract supplies']
  }
];

// Secondary collections (link when relevant)
const SECONDARY_COLLECTIONS = [
  // Dabbing
  { name: 'Dab Rigs', url: '/collections/dab-rigs', keywords: ['dab rig', 'oil rig', 'concentrate rig'] },
  { name: 'Quartz Bangers', url: '/collections/quartz-bangers', keywords: ['quartz banger', 'banger', 'quartz nail'] },
  { name: 'Carb Caps', url: '/collections/carb-caps', keywords: ['carb cap', 'directional cap', 'bubble cap'] },
  { name: 'Dab Tools', url: '/collections/dab-tools', keywords: ['dab tool', 'dabber'] },
  { name: 'Nectar Collectors', url: '/collections/nectar-collectors', keywords: ['nectar collector', 'honey straw', 'dab straw'] },
  { name: 'Torches', url: '/collections/torches', keywords: ['torch', 'butane torch', 'dab torch'] },
  // Smoking
  { name: 'Bongs', url: '/collections/bongs', keywords: ['bong', 'water pipe', 'glass bong'] },
  { name: 'Hand Pipes', url: '/collections/hand-pipes', keywords: ['hand pipe', 'glass pipe', 'spoon pipe'] },
  { name: 'Bubblers', url: '/collections/bubblers', keywords: ['bubbler'] },
  { name: 'Grinders', url: '/collections/grinders', keywords: ['grinder', 'herb grinder'] },
  // Storage
  { name: 'Concentrate Containers', url: '/collections/concentrate-containers', keywords: ['concentrate container', 'dab container', 'wax container'] },
  { name: 'Mylar Bags', url: '/collections/mylar-bags', keywords: ['mylar bag', 'smell proof bag'] },
  // Rolling
  { name: 'Rolling Papers', url: '/collections/rolling-papers', keywords: ['rolling paper', 'papers'] },
  { name: 'Cones', url: '/collections/rolling-papers-cones', keywords: ['cone', 'pre-roll', 'pre-rolled cone'] }
];

// External authoritative sources by topic (expanded for E-E-A-T)
const EXTERNAL_SOURCES = {
  health_safety: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['cannabis', 'health', 'strains', 'effects'] },
    { name: 'NORML', url: 'https://norml.org', topics: ['legalization', 'laws', 'policy', 'rights'] },
    { name: 'Americans for Safe Access', url: 'https://www.safeaccessnow.org', topics: ['patient', 'medical', 'safety'] }
  ],
  science: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['terpenes', 'cannabinoids', 'science'] },
    { name: 'Weedmaps', url: 'https://weedmaps.com/learn', topics: ['cannabis science', 'research'] },
    { name: 'Project CBD', url: 'https://www.projectcbd.org', topics: ['CBD', 'research', 'endocannabinoid'] }
  ],
  industry: [
    { name: 'MJBizDaily', url: 'https://mjbizdaily.com', topics: ['industry', 'market', 'business', 'trends'] },
    { name: 'Cannabis Business Times', url: 'https://www.cannabisbusinesstimes.com', topics: ['cultivation', 'processing', 'extraction'] },
    { name: 'High Times', url: 'https://hightimes.com', topics: ['culture', 'events', 'awards', '710'] }
  ],
  extraction: [
    { name: 'PurePressure', url: 'https://gopurepressure.com/blogs/rosin-education', topics: ['rosin', 'press', 'solventless', 'extraction'] }
  ]
};

// Configuration
const CONFIG = {
  minSpacingChars: 200,        // Minimum characters between links
  internalLinksPerThousand: { min: 2, max: 5 },
  blogLinksPerArticle: { min: 1, max: 3 }, // Blog-to-blog links
  externalLinksPerArticle: { min: 1, max: 2 },
  anchorTextMinWords: 2,
  anchorTextMaxWords: 4
};

/**
 * Main function to inject hyperlinks into HTML content
 * @param {string} htmlContent - The HTML blog content
 * @param {string} articleTitle - The article title (to avoid self-linking)
 * @param {Array} existingArticles - Existing blog articles for blog-to-blog linking
 * @returns {string} - HTML content with links injected
 */
export function injectHyperlinks(htmlContent, articleTitle = '', existingArticles = []) {
  if (!htmlContent) return htmlContent;

  let content = htmlContent;
  const wordCount = countWords(content);
  const linkedCollections = new Set();

  // Calculate target link counts
  const targetInternalLinks = Math.min(
    CONFIG.internalLinksPerThousand.max,
    Math.max(
      CONFIG.internalLinksPerThousand.min,
      Math.round((wordCount / 1000) * 3) // ~3 links per 1000 words
    )
  );

  console.log(`Hyperlinking: ${wordCount} words, targeting ${targetInternalLinks} internal links`);

  // Track link positions to enforce spacing
  const linkPositions = [];
  let internalLinksAdded = 0;

  // Process priority collections first
  const allCollections = [...PRIORITY_COLLECTIONS, ...SECONDARY_COLLECTIONS];

  for (const collection of allCollections) {
    if (internalLinksAdded >= targetInternalLinks) break;
    if (linkedCollections.has(collection.url)) continue;

    // Try each keyword for this collection
    for (const keyword of collection.keywords) {
      if (internalLinksAdded >= targetInternalLinks) break;
      if (linkedCollections.has(collection.url)) break;

      const result = addInternalLink(content, keyword, collection.url, linkPositions, articleTitle);
      if (result.added) {
        content = result.content;
        linkPositions.push(result.position);
        linkedCollections.add(collection.url);
        internalLinksAdded++;
        console.log(`  Added link: "${keyword}" -> ${collection.url}`);
        break; // Move to next collection
      }
    }
  }

  // Add blog-to-blog links (builds topical authority)
  if (existingArticles.length > 0) {
    const blogLinksResult = addBlogToBlogLinks(content, existingArticles, articleTitle, linkPositions);
    if (blogLinksResult.count > 0) {
      content = blogLinksResult.content;
      console.log(`  Added ${blogLinksResult.count} blog-to-blog link(s)`);
    }
  }

  // Add external links (1-2 per article)
  const externalLinksAdded = addExternalLinks(content, linkPositions);
  if (externalLinksAdded.count > 0) {
    content = externalLinksAdded.content;
    console.log(`  Added ${externalLinksAdded.count} external link(s)`);
  }

  console.log(`Hyperlinking complete: ${internalLinksAdded} internal, ${externalLinksAdded.count} external`);

  return content;
}

/**
 * Add blog-to-blog internal links for topical authority
 * Links to related existing blog articles based on keyword overlap
 */
function addBlogToBlogLinks(content, existingArticles, currentTitle, existingPositions) {
  let modifiedContent = content;
  let count = 0;
  const maxBlogLinks = CONFIG.blogLinksPerArticle.max;
  const linkedUrls = new Set();

  // Build keyword-to-article map from existing articles
  const articleKeywords = existingArticles
    .filter(article => {
      const title = (article.title || '').toLowerCase();
      // Don't link to self
      return title !== currentTitle.toLowerCase() && article.url;
    })
    .map(article => {
      const title = article.title || '';
      // Extract meaningful phrases (2-4 words) from title for matching
      const words = title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['the', 'and', 'for', 'your', 'that', 'this', 'with', 'from', 'best', 'guide', 'complete'].includes(w));

      // Build anchor phrases from consecutive meaningful words
      const phrases = [];
      for (let i = 0; i < words.length - 1; i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      if (words.length > 0) {
        phrases.push(words[0]); // Single keyword fallback
      }

      return {
        title,
        url: article.url,
        handle: article.handle,
        phrases
      };
    })
    .filter(a => a.phrases.length > 0);

  // Try to link to related articles
  for (const article of articleKeywords) {
    if (count >= maxBlogLinks) break;
    if (linkedUrls.has(article.url)) continue;

    for (const phrase of article.phrases) {
      if (count >= maxBlogLinks) break;

      const escapedPhrase = escapeRegex(phrase);
      const pattern = new RegExp(
        `(?<![<\\/a-zA-Z])\\b(${escapedPhrase}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
        'i'
      );

      const match = modifiedContent.match(pattern);
      if (!match) continue;

      const matchPosition = match.index;
      if (isInsideHeading(modifiedContent, matchPosition) || isInsideLink(modifiedContent, matchPosition) || isInsideHtmlTag(modifiedContent, matchPosition) || isInsideFigure(modifiedContent, matchPosition)) continue;

      // Check spacing
      let tooClose = false;
      for (const pos of existingPositions) {
        if (Math.abs(matchPosition - pos) < CONFIG.minSpacingChars) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Build the blog link URL
      let blogUrl = article.url;
      if (!blogUrl.startsWith('http')) {
        blogUrl = `${BASE_URL}${blogUrl.startsWith('/') ? '' : '/'}${blogUrl}`;
      }

      const linkedText = `<a href="${blogUrl}">${match[1]}</a>`;
      modifiedContent = modifiedContent.substring(0, matchPosition) +
        linkedText +
        modifiedContent.substring(matchPosition + match[1].length);

      existingPositions.push(matchPosition);
      linkedUrls.add(article.url);
      count++;
      console.log(`  Added blog link: "${phrase}" -> ${article.title}`);
      break; // Move to next article
    }
  }

  return { content: modifiedContent, count };
}

/**
 * Add a single internal link for a keyword
 */
function addInternalLink(content, keyword, collectionUrl, existingPositions, articleTitle) {
  // Create case-insensitive regex to find the keyword
  // But NOT inside existing links, headings, or HTML tags
  const escapedKeyword = escapeRegex(keyword);

  // Pattern: Find keyword that is:
  // - Not inside an <a> tag
  // - Not inside a heading tag (h1-h6)
  // - Not already linked
  // - In regular paragraph text
  const pattern = new RegExp(
    `(?<![<\\/a-zA-Z])\\b(${escapedKeyword}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
    'i'
  );

  const match = content.match(pattern);
  if (!match) {
    return { added: false };
  }

  const matchPosition = match.index;
  const matchedText = match[1];

  // Check if this position is inside a heading, existing link, HTML tag attributes, or figure element
  if (isInsideHeading(content, matchPosition) || isInsideLink(content, matchPosition) || isInsideHtmlTag(content, matchPosition) || isInsideFigure(content, matchPosition)) {
    return { added: false };
  }

  // Check spacing from other links
  for (const pos of existingPositions) {
    if (Math.abs(matchPosition - pos) < CONFIG.minSpacingChars) {
      return { added: false };
    }
  }

  // Build the link
  const fullUrl = `${BASE_URL}${collectionUrl}`;
  const linkedText = `<a href="${fullUrl}">${matchedText}</a>`;

  // Replace only the first occurrence
  content = content.substring(0, matchPosition) + linkedText + content.substring(matchPosition + matchedText.length);

  return {
    added: true,
    content,
    position: matchPosition
  };
}

/**
 * Add external links to authoritative sources
 */
function addExternalLinks(content, existingPositions) {
  let modifiedContent = content;
  let count = 0;
  const maxExternal = CONFIG.externalLinksPerArticle.max;

  // Look for topics that could use external links
  const externalLinkOpportunities = [
    { pattern: /\b(terpene|terpenes|terps)\b/i, source: 'science', anchor: 'terpenes' },
    { pattern: /\b(cannabinoid|cannabinoids|THC|CBD)\b/i, source: 'science', anchor: 'cannabinoids' },
    { pattern: /\b(cannabis industry|market trends?)\b/i, source: 'industry', anchor: 'cannabis industry' },
    { pattern: /\b(health benefits?|medical)\b/i, source: 'health_safety', anchor: 'health benefits' },
    { pattern: /\b(rosin press|solventless extract|hash rosin)\b/i, source: 'extraction', anchor: 'rosin' },
    { pattern: /\b(710 cup|cannabis cup|emerald cup)\b/i, source: 'industry', anchor: 'cannabis events' }
  ];

  for (const opportunity of externalLinkOpportunities) {
    if (count >= maxExternal) break;

    const match = modifiedContent.match(opportunity.pattern);
    if (match && !isInsideLink(modifiedContent, match.index) && !isInsideHeading(modifiedContent, match.index) && !isInsideHtmlTag(modifiedContent, match.index) && !isInsideFigure(modifiedContent, match.index)) {
      // Check spacing
      let tooClose = false;
      for (const pos of existingPositions) {
        if (Math.abs(match.index - pos) < CONFIG.minSpacingChars) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Get a source for this topic
      const sources = EXTERNAL_SOURCES[opportunity.source];
      if (sources && sources.length > 0) {
        const source = sources[Math.floor(Math.random() * sources.length)];
        const linkedText = `<a href="${source.url}" rel="noopener noreferrer" target="_blank">${match[0]}</a>`;

        modifiedContent = modifiedContent.substring(0, match.index) +
          linkedText +
          modifiedContent.substring(match.index + match[0].length);

        existingPositions.push(match.index);
        count++;
      }
    }
  }

  return { content: modifiedContent, count };
}

/**
 * Check if a position is inside a heading tag
 */
function isInsideHeading(content, position) {
  // Find the most recent opening tag before this position
  const beforeText = content.substring(0, position);

  // Check for unclosed heading tags
  const lastH1Open = beforeText.lastIndexOf('<h1');
  const lastH1Close = beforeText.lastIndexOf('</h1>');
  if (lastH1Open > lastH1Close) return true;

  const lastH2Open = beforeText.lastIndexOf('<h2');
  const lastH2Close = beforeText.lastIndexOf('</h2>');
  if (lastH2Open > lastH2Close) return true;

  const lastH3Open = beforeText.lastIndexOf('<h3');
  const lastH3Close = beforeText.lastIndexOf('</h3>');
  if (lastH3Open > lastH3Close) return true;

  const lastH4Open = beforeText.lastIndexOf('<h4');
  const lastH4Close = beforeText.lastIndexOf('</h4>');
  if (lastH4Open > lastH4Close) return true;

  return false;
}

/**
 * Check if a position is inside any HTML tag's attributes
 * (e.g. inside <img alt="...">, <figure style="...">, <figcaption ...>)
 * Prevents injecting <a> tags into attribute values which breaks the tag.
 */
function isInsideHtmlTag(content, position) {
  const beforeText = content.substring(0, position);

  // Find the last '<' and '>' before this position
  const lastOpenAngle = beforeText.lastIndexOf('<');
  const lastCloseAngle = beforeText.lastIndexOf('>');

  // If the last '<' is after the last '>', we're inside a tag
  return lastOpenAngle > lastCloseAngle;
}

/**
 * Check if a position is inside an existing link
 */
function isInsideLink(content, position) {
  const beforeText = content.substring(0, position);
  const lastAOpen = beforeText.lastIndexOf('<a ');
  const lastAClose = beforeText.lastIndexOf('</a>');

  return lastAOpen > lastAClose;
}

/**
 * Check if a position is inside a <figure> element.
 * Prevents injecting links into <img> alt text and <figcaption> content,
 * which corrupts the HTML and breaks image display.
 */
function isInsideFigure(content, position) {
  const beforeText = content.substring(0, position);
  const lastFigureOpen = beforeText.lastIndexOf('<figure');
  const lastFigureClose = beforeText.lastIndexOf('</figure>');

  return lastFigureOpen > lastFigureClose;
}

/**
 * Count words in HTML content (excluding tags)
 */
function countWords(html) {
  const textOnly = html.replace(/<[^>]+>/g, ' ');
  return textOnly.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get link statistics for content
 */
export function getLinkStats(htmlContent) {
  const internalLinks = (htmlContent.match(/<a href="https:\/\/oilslickpad\.com[^"]*"/g) || []).length;
  const externalLinks = (htmlContent.match(/<a href="https?:\/\/(?!oilslickpad\.com)[^"]*"/g) || []).length;
  const wordCount = countWords(htmlContent);

  return {
    wordCount,
    internalLinks,
    externalLinks,
    internalLinkDensity: (internalLinks / wordCount * 1000).toFixed(2),
    meetsGuidelines: internalLinks >= 2 && internalLinks <= 5 && externalLinks >= 1 && externalLinks <= 2
  };
}

/**
 * Clean up orphaned bold text that looks like missing hyperlinks.
 * AI sometimes bolds phrases it intends as link anchors, but the hyperlink
 * injector doesn't always match them. This converts matching bold text to
 * collection links, and strips bold from the rest so it doesn't look broken.
 */
export function cleanOrphanedBoldText(htmlContent) {
  if (!htmlContent) return htmlContent;

  let content = htmlContent;

  // Build a lookup: keyword -> collection URL (all collections)
  const allCollections = [...PRIORITY_COLLECTIONS, ...SECONDARY_COLLECTIONS];
  const keywordMap = new Map();
  for (const col of allCollections) {
    for (const kw of col.keywords) {
      keywordMap.set(kw.toLowerCase(), col.url);
    }
  }

  // Find all <strong>...</strong> tags
  // We process them in reverse order to preserve string positions
  const strongRegex = /<strong>([^<]+)<\/strong>/g;
  const matches = [];
  let m;
  while ((m = strongRegex.exec(content)) !== null) {
    matches.push({
      fullMatch: m[0],
      innerText: m[1],
      index: m.index
    });
  }

  // Process in reverse so replacements don't shift indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, innerText, index } = matches[i];

    // Skip if inside a callout box (these are styled divs with colored backgrounds)
    const before = content.substring(Math.max(0, index - 300), index);
    if (before.includes('border-left: 4px solid') && !before.includes('</div>')) continue;

    // Skip if this is a callout label (Pro Tip:, Warning:, Note:, Important:)
    if (/^(Pro Tip|Warning|Note|Important):?$/i.test(innerText.trim())) continue;

    // Skip if this is inside a heading
    if (isInsideHeading(content, index)) continue;

    // Skip if already inside a link
    if (isInsideLink(content, index)) continue;

    // Skip if inside a figure element (img alt or figcaption)
    if (isInsideFigure(content, index)) continue;

    // Skip structured data labels (e.g., "Budget Option ($15-25)" used for comparison lists)
    // These start lines and are followed by a list
    const afterBold = content.substring(index + fullMatch.length, index + fullMatch.length + 50);
    if (/^\s*\n\s*[-•]/.test(afterBold)) continue;

    // Try to match the bold text to a collection
    const textLower = innerText.toLowerCase().trim();
    let matched = false;

    for (const [keyword, url] of keywordMap) {
      if (textLower.includes(keyword) || keyword.includes(textLower)) {
        // Convert bold to a link
        const fullUrl = `${BASE_URL}${url}`;
        const replacement = `<a href="${fullUrl}">${innerText}</a>`;
        content = content.substring(0, index) + replacement + content.substring(index + fullMatch.length);
        matched = true;
        break;
      }
    }

    // If no collection match, strip the bold entirely (plain text)
    if (!matched) {
      content = content.substring(0, index) + innerText + content.substring(index + fullMatch.length);
    }
  }

  return content;
}

export default {
  injectHyperlinks,
  getLinkStats,
  cleanOrphanedBoldText,
  PRIORITY_COLLECTIONS,
  SECONDARY_COLLECTIONS
};
