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
      if (isInsideHeading(modifiedContent, matchPosition) || isInsideLink(modifiedContent, matchPosition)) continue;

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
    { pattern: /\b(health benefits?|medical)\b/i, source: 'health_safety', anchor: 'health benefits' },
    { pattern: /\b(rosin press|solventless extract|hash rosin)\b/i, source: 'extraction', anchor: 'rosin' },
    { pattern: /\b(710 cup|cannabis cup|emerald cup)\b/i, source: 'industry', anchor: 'cannabis events' }
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
