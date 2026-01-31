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
    keywords: ['glass jar', 'concentrate jar', 'storage jar', 'extract jar', 'child resistant jar', 'CR jar', 'packaging jar', 'dispensary jar', 'cannabis jar', 'wax jar', 'glass container']
  },
  {
    name: 'PTFE Sheets',
    url: '/collections/ptfe-sheets',
    keywords: ['PTFE', 'teflon', 'nonstick sheet', 'purging sheet', 'extraction sheet', 'slab paper', 'PTFE paper']
  },
  {
    name: 'FEP Sheets',
    url: '/collections/fep-sheets',
    keywords: ['FEP', 'FEP film', 'clear nonstick', 'transparent nonstick', 'FEP sheet']
  },
  {
    name: 'Parchment Paper',
    url: '/collections/parchment-paper',
    keywords: ['parchment', 'parchment paper', 'release paper', 'rosin paper', 'rosin parchment', 'pressing paper', 'foil backed', 'extraction paper', 'press paper']
  },
  {
    name: 'Silicone Pads',
    url: '/collections/silicone-pads',
    keywords: ['silicone pad', 'silicone mat', 'dab mat', 'dab pad', 'Oil Slick pad', 'nonstick mat', 'work mat', 'silicone work surface']
  },
  {
    name: 'Extraction & Packaging',
    url: '/collections/extraction-packaging',
    keywords: ['extraction supplies', 'cannabis packaging', 'processor supplies', 'extract supplies', 'extraction equipment']
  },
  {
    name: 'Rosin Extraction',
    url: '/collections/rosin-extraction',
    keywords: ['rosin', 'rosin press', 'rosin extraction', 'solventless', 'rosin tech', 'pressing rosin', 'rosin supplies']
  },
  {
    name: 'Bulk PTFE & FEP',
    url: '/collections/bulk-ptfe-fep',
    keywords: ['bulk PTFE', 'bulk FEP', 'wholesale sheets', 'bulk nonstick', 'commercial extraction']
  },
  {
    name: 'Custom Packaging',
    url: '/collections/custom-packaging-options',
    keywords: ['custom packaging', 'custom labels', 'branded packaging', 'custom jars', 'dispensary packaging']
  }
];

// Secondary collections (link when relevant)
const SECONDARY_COLLECTIONS = [
  // Dabbing - Glass
  { name: 'Dab Rigs', url: '/collections/dab-rigs', keywords: ['dab rig', 'oil rig', 'concentrate rig', 'rig'] },
  { name: 'Quartz Bangers', url: '/collections/quartz-bangers', keywords: ['quartz banger', 'banger', 'quartz nail', 'quartz bucket'] },
  { name: 'Carb Caps', url: '/collections/carb-caps', keywords: ['carb cap', 'directional cap', 'bubble cap', 'spinner cap'] },
  { name: 'Dab Tools', url: '/collections/dab-tools', keywords: ['dab tool', 'dabber', 'dab pick', 'wax tool'] },
  { name: 'Nectar Collectors', url: '/collections/nectar-collectors', keywords: ['nectar collector', 'honey straw', 'dab straw', 'vertical dab'] },
  { name: 'Torches', url: '/collections/torches', keywords: ['torch', 'butane torch', 'dab torch', 'torch lighter'] },

  // Smoking - Glass
  { name: 'Bongs & Water Pipes', url: '/collections/bongs-water-pipes', keywords: ['bong', 'water pipe', 'glass bong', 'water bong', 'beaker bong', 'straight tube'] },
  { name: 'Hand Pipes', url: '/collections/hand-pipes', keywords: ['hand pipe', 'glass pipe', 'spoon pipe', 'dry pipe'] },
  { name: 'Bubblers', url: '/collections/bubblers', keywords: ['bubbler', 'glass bubbler', 'hammer bubbler', 'sherlock bubbler'] },
  { name: 'One Hitters & Chillums', url: '/collections/one-hitters-chillums', keywords: ['one hitter', 'chillum', 'bat', 'taster', 'dugout'] },
  { name: 'Novelty Pipes', url: '/collections/novelty-character-pipes', keywords: ['novelty pipe', 'character pipe', 'fun pipe', 'unique pipe'] },

  // Silicone Products
  { name: 'Silicone Pipes', url: '/collections/silicone-pipes', keywords: ['silicone pipe', 'unbreakable pipe', 'flexible pipe'] },
  { name: 'Silicone Bubblers', url: '/collections/silicone-bubblers', keywords: ['silicone bubbler', 'unbreakable bubbler'] },
  { name: 'Silicone Hand Pipes', url: '/collections/silicone-hand-pipes', keywords: ['silicone hand pipe', 'silicone spoon'] },
  { name: 'Silicone Nectar Collectors', url: '/collections/silicone-nectar-collectors', keywords: ['silicone nectar collector', 'silicone dab straw'] },
  { name: 'Silicone Rigs & Bongs', url: '/collections/silicone-rigs-bongs', keywords: ['silicone bong', 'silicone rig', 'silicone dab rig', 'unbreakable bong'] },

  // Accessories
  { name: 'Flower Bowls', url: '/collections/flower-bowls', keywords: ['flower bowl', 'bowl piece', 'slide', 'glass bowl'] },
  { name: 'Ash Catchers', url: '/collections/ash-catchers', keywords: ['ash catcher', 'ashcatcher', 'precooler'] },
  { name: 'Downstems', url: '/collections/downstems', keywords: ['downstem', 'down stem', 'diffuser'] },
  { name: 'Ashtrays', url: '/collections/ashtrays', keywords: ['ashtray', 'ash tray', 'debowler'] },
  { name: 'Grinders', url: '/collections/grinders', keywords: ['grinder', 'herb grinder', 'weed grinder', '4 piece grinder'] },

  // Storage
  { name: 'Concentrate Containers', url: '/collections/concentrate-containers', keywords: ['concentrate container', 'dab container', 'wax container', 'silicone container'] },
  { name: 'Storage Containers', url: '/collections/storage-containers', keywords: ['storage container', 'stash jar', 'storage jar', 'airtight container'] },

  // Rolling
  { name: 'Rolling Papers', url: '/collections/rolling-papers', keywords: ['rolling paper', 'papers', 'hemp papers', 'rice papers'] },
  { name: 'Cones', url: '/collections/rolling-papers-cones', keywords: ['cone', 'pre-roll', 'pre-rolled cone', 'preroll'] }
];

// Brand collections (link when mentioning these brands)
const BRAND_COLLECTIONS = [
  { name: '710 Sci', url: '/collections/710-sci', keywords: ['710 Sci', '710Sci', '710 Science'] },
  { name: 'Zig Zag', url: '/collections/zig-zag', keywords: ['Zig Zag', 'Zig-Zag', 'ZigZag'] },
  { name: 'Vibes', url: '/collections/vibes', keywords: ['Vibes', 'Vibes papers', 'Vibes rolling'] },
  { name: 'Cookies', url: '/collections/cookies', keywords: ['Cookies', 'Cookies brand'] },
  { name: 'Maven', url: '/collections/maven', keywords: ['Maven', 'Maven torch'] },
  { name: 'Monark', url: '/collections/monark', keywords: ['Monark', 'Monark glass'] },
  { name: 'Made in USA', url: '/collections/made-in-usa', keywords: ['Made in USA', 'American made', 'USA made', 'domestic'] }
];

// External authoritative sources by topic
const EXTERNAL_SOURCES = {
  health_safety: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['cannabis', 'health', 'strains', 'effects'] },
    { name: 'NORML', url: 'https://norml.org', topics: ['legalization', 'laws', 'policy', 'rights'] }
  ],
  science: [
    { name: 'Leafly', url: 'https://www.leafly.com', topics: ['terpenes', 'cannabinoids', 'science'] },
    { name: 'Weedmaps', url: 'https://weedmaps.com/learn', topics: ['cannabis science', 'research'] }
  ],
  industry: [
    { name: 'MJBizDaily', url: 'https://mjbizdaily.com', topics: ['industry', 'market', 'business', 'trends'] }
  ]
};

// Configuration
const CONFIG = {
  minSpacingChars: 200,        // Minimum characters between links
  internalLinksPerThousand: { min: 2, max: 5 },
  externalLinksPerArticle: { min: 1, max: 2 },
  anchorTextMinWords: 2,
  anchorTextMaxWords: 4
};

/**
 * Main function to inject hyperlinks into HTML content
 * @param {string} htmlContent - The HTML blog content
 * @param {string} articleTitle - The article title (to avoid self-linking)
 * @returns {string} - HTML content with links injected
 */
export function injectHyperlinks(htmlContent, articleTitle = '') {
  if (!htmlContent) return htmlContent;

  let content = htmlContent;
  const wordCount = countWords(content);
  const linkedCollections = new Set();
  let lastLinkPosition = -CONFIG.minSpacingChars; // Allow first link immediately

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

  // Process priority collections first, then secondary, then brands
  const allCollections = [...PRIORITY_COLLECTIONS, ...SECONDARY_COLLECTIONS, ...BRAND_COLLECTIONS];

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

  // Check if this position is inside a heading or existing link
  if (isInsideHeading(content, matchPosition) || isInsideLink(content, matchPosition)) {
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
    { pattern: /\b(health benefits?|medical)\b/i, source: 'health_safety', anchor: 'health benefits' }
  ];

  for (const opportunity of externalLinkOpportunities) {
    if (count >= maxExternal) break;

    const match = modifiedContent.match(opportunity.pattern);
    if (match && !isInsideLink(modifiedContent, match.index) && !isInsideHeading(modifiedContent, match.index)) {
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
 * Check if a position is inside an existing link
 */
function isInsideLink(content, position) {
  const beforeText = content.substring(0, position);
  const lastAOpen = beforeText.lastIndexOf('<a ');
  const lastAClose = beforeText.lastIndexOf('</a>');

  return lastAOpen > lastAClose;
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

export default {
  injectHyperlinks,
  getLinkStats,
  PRIORITY_COLLECTIONS,
  SECONDARY_COLLECTIONS,
  BRAND_COLLECTIONS
};
