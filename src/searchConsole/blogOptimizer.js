/**
 * Blog Hyperlink Optimizer
 *
 * For trending/high-traffic blog pages identified by Search Console data:
 * 1. Fetches the current blog content from Shopify
 * 2. Analyzes existing internal links
 * 3. Uses AI to determine optimal link placements based on current trends
 * 4. Updates the article with improved hyperlinks
 *
 * Goal: Ensure trending blog pages have optimal internal links to
 * maximize the value of incoming organic traffic.
 */

import hyperlinkInjectorDefaults, { getLinkStats } from '../utils/hyperlinkInjector.js';
import { extractHandle } from './trendAnalyzer.js';

const { PRIORITY_COLLECTIONS, SECONDARY_COLLECTIONS } = hyperlinkInjectorDefaults;

const BASE_URL = 'https://oilslickpad.com';

/**
 * Analyze and optimize hyperlinks in a single blog article
 *
 * @param {Object} article - Shopify article object with id, title, body_html/body
 * @param {Array} trendingProducts - Trending product/collection pages from GSC
 * @param {Array} existingArticles - Other blog articles for blog-to-blog linking
 * @param {Object} options - { dryRun: boolean }
 * @returns {Object} - { optimized, changes, linkStats }
 */
export async function optimizeBlogLinks(article, trendingProducts = [], existingArticles = [], options = {}) {
  const { dryRun = false } = options;
  const articleTitle = article.title || '';
  const bodyHtml = article.body_html || article.body || '';

  if (!bodyHtml) {
    console.log(`  Skipping "${articleTitle}" - no body content`);
    return { optimized: false, changes: [], reason: 'no content' };
  }

  console.log(`\nAnalyzing links in: "${articleTitle}"`);

  // Step 1: Get current link stats
  const currentStats = getLinkStats(bodyHtml);
  console.log(`  Current: ${currentStats.internalLinks} internal, ${currentStats.externalLinks} external links`);

  // Step 2: Extract all existing links from the content
  const existingLinks = extractLinks(bodyHtml);
  console.log(`  Found ${existingLinks.internal.length} internal, ${existingLinks.external.length} external, ${existingLinks.broken.length} potentially broken`);

  // Step 3: Build the list of high-value link targets (trending pages)
  const linkTargets = buildLinkTargets(trendingProducts);

  // Step 4: Determine what link improvements are needed
  const improvements = await analyzeForImprovements(bodyHtml, articleTitle, existingLinks, linkTargets, existingArticles);

  if (improvements.length === 0) {
    console.log(`  No link improvements needed for "${articleTitle}"`);
    return { optimized: false, changes: [], reason: 'already optimal' };
  }

  console.log(`  Found ${improvements.length} link improvement(s)`);

  // Step 5: Apply improvements to the content
  let updatedContent = bodyHtml;
  const appliedChanges = [];

  for (const improvement of improvements) {
    const result = applyLinkImprovement(updatedContent, improvement);
    if (result.applied) {
      updatedContent = result.content;
      appliedChanges.push(improvement);
      console.log(`  Applied: ${improvement.type} - "${improvement.description}"`);
    }
  }

  if (appliedChanges.length === 0) {
    console.log(`  No improvements could be applied`);
    return { optimized: false, changes: [], reason: 'could not apply' };
  }

  // Step 6: Verify the updated content
  const newStats = getLinkStats(updatedContent);
  console.log(`  Updated: ${newStats.internalLinks} internal, ${newStats.externalLinks} external links`);

  return {
    optimized: true,
    articleId: article.id,
    articleTitle,
    originalStats: currentStats,
    newStats,
    changes: appliedChanges,
    updatedContent: dryRun ? null : updatedContent,
    dryRun
  };
}

/**
 * Extract all links from HTML content
 */
function extractLinks(html) {
  const internal = [];
  const external = [];
  const broken = [];

  // Match all <a href="..."> tags
  const linkRegex = /<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const anchorText = match[2].replace(/<[^>]+>/g, '').trim();

    if (url.includes('oilslickpad.com') || url.startsWith('/')) {
      internal.push({ url, anchorText, fullMatch: match[0] });
    } else if (url.startsWith('http')) {
      external.push({ url, anchorText, fullMatch: match[0] });
    } else if (url === '#' || url === '' || !url.startsWith('http') && !url.startsWith('/') && !url.startsWith('#')) {
      broken.push({ url, anchorText, fullMatch: match[0] });
    }
  }

  return { internal, external, broken };
}

/**
 * Build prioritized link targets from trending product/collection data
 */
function buildLinkTargets(trendingPages) {
  const targets = [];

  // Add trending product/collection pages as high-priority targets
  for (const page of trendingPages) {
    const handle = extractHandle(page.page);
    const humanName = handle.replace(/-/g, ' ');

    targets.push({
      url: page.page,
      path: new URL(page.page).pathname,
      name: humanName,
      keywords: humanName.split(' ').filter(w => w.length > 2),
      priority: 'high',
      reason: `Trending (${page.recentClicks} clicks, ${(page.clicksGrowth * 100).toFixed(0)}% growth)`
    });
  }

  // Add priority collections that aren't already in trending
  const trendingPaths = new Set(targets.map(t => t.path));
  for (const collection of PRIORITY_COLLECTIONS) {
    if (!trendingPaths.has(collection.url)) {
      targets.push({
        url: `${BASE_URL}${collection.url}`,
        path: collection.url,
        name: collection.name,
        keywords: collection.keywords,
        priority: 'medium',
        reason: 'Priority collection'
      });
    }
  }

  return targets;
}

/**
 * Use AI to analyze the content and determine what link improvements to make
 */
async function analyzeForImprovements(html, title, existingLinks, linkTargets, existingArticles) {
  const improvements = [];

  // Rule 1: Fix broken links
  for (const broken of existingLinks.broken) {
    improvements.push({
      type: 'fix_broken',
      description: `Fix broken link "${broken.anchorText}" (href="${broken.url}")`,
      anchorText: broken.anchorText,
      oldUrl: broken.url,
      fullMatch: broken.fullMatch
    });
  }

  // Rule 2: Add links to trending pages that are mentioned but not linked
  const plainText = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  const linkedUrls = new Set(existingLinks.internal.map(l => l.url));

  for (const target of linkTargets) {
    // Skip if already linked
    const isAlreadyLinked = [...linkedUrls].some(url =>
      url.includes(target.path)
    );
    if (isAlreadyLinked) continue;

    // Check if any keyword for this target appears in the text
    const matchedKeyword = target.keywords.find(kw =>
      kw.length > 3 && plainText.includes(kw.toLowerCase())
    );

    if (matchedKeyword) {
      improvements.push({
        type: 'add_trending_link',
        description: `Link "${matchedKeyword}" to trending ${target.name} (${target.reason})`,
        keyword: matchedKeyword,
        targetUrl: target.url.startsWith('http') ? target.url : `${BASE_URL}${target.path}`,
        targetName: target.name,
        priority: target.priority
      });
    }
  }

  // Rule 3: Add blog-to-blog links if under the minimum
  if (existingLinks.internal.filter(l => l.url.includes('/blogs/')).length < 2 && existingArticles.length > 0) {
    // Find related articles based on keyword overlap
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);

    for (const article of existingArticles.slice(0, 20)) {
      if ((article.title || '').toLowerCase() === title.toLowerCase()) continue;

      const articleTitleLower = (article.title || '').toLowerCase();
      const overlap = titleWords.filter(w => articleTitleLower.includes(w));

      if (overlap.length >= 1) {
        // Find a phrase from this related article's title that appears in our content
        const articleWords = articleTitleLower.split(/\s+/).filter(w =>
          w.length > 4 && !['guide', 'complete', 'ultimate', 'about', 'every'].includes(w)
        );

        const matchableWord = articleWords.find(w => plainText.includes(w));
        if (matchableWord) {
          const blogUrl = article.url || `${BASE_URL}/blogs/news/${article.handle || ''}`;
          improvements.push({
            type: 'add_blog_link',
            description: `Link "${matchableWord}" to related blog "${article.title}"`,
            keyword: matchableWord,
            targetUrl: blogUrl,
            targetTitle: article.title
          });
          break; // Only add one blog-to-blog link suggestion
        }
      }
    }
  }

  // Limit total improvements to avoid over-linking
  return improvements.slice(0, 5);
}

/**
 * Apply a single link improvement to HTML content
 */
function applyLinkImprovement(html, improvement) {
  switch (improvement.type) {
    case 'fix_broken': {
      // Remove broken links (unwrap the anchor tag, keep text)
      if (improvement.fullMatch) {
        const replacement = improvement.anchorText;
        const newHtml = html.replace(improvement.fullMatch, replacement);
        if (newHtml !== html) {
          return { applied: true, content: newHtml };
        }
      }
      return { applied: false };
    }

    case 'add_trending_link':
    case 'add_blog_link': {
      const keyword = improvement.keyword;
      const targetUrl = improvement.targetUrl;

      // Find the keyword in paragraph text (not in headings or existing links)
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(?<![<\\/a-zA-Z"=])\\b(${escapedKeyword}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)(?![^"]*")`,
        'i'
      );

      const match = html.match(pattern);
      if (!match) return { applied: false };

      const matchPos = match.index;

      // Verify we're not inside a heading or existing link
      const before = html.substring(0, matchPos);
      const lastAOpen = before.lastIndexOf('<a ');
      const lastAClose = before.lastIndexOf('</a>');
      if (lastAOpen > lastAClose) return { applied: false };

      const lastHOpen = before.lastIndexOf('<h');
      const lastHClose = Math.max(
        before.lastIndexOf('</h1>'),
        before.lastIndexOf('</h2>'),
        before.lastIndexOf('</h3>'),
        before.lastIndexOf('</h4>')
      );
      if (lastHOpen > lastHClose) return { applied: false };

      // Insert the link
      const linkedText = `<a href="${targetUrl}">${match[1]}</a>`;
      const newHtml = html.substring(0, matchPos) + linkedText + html.substring(matchPos + match[1].length);

      return { applied: true, content: newHtml };
    }

    default:
      return { applied: false };
  }
}

/**
 * Process multiple blog articles for optimization
 *
 * @param {Array} blogsToOptimize - From identifyBlogsForOptimization()
 * @param {Function} fetchArticleFn - Function to fetch full article content by URL/handle
 * @param {Array} trendingProducts - Trending product/collection pages
 * @param {Array} allArticles - All existing blog articles for cross-linking
 * @param {Object} options - { dryRun, maxArticles }
 * @returns {Array} - Results for each optimization attempt
 */
export async function optimizeMultipleBlogs(blogsToOptimize, fetchArticleFn, trendingProducts, allArticles, options = {}) {
  const { dryRun = false, maxArticles = 5 } = options;
  const results = [];

  const toProcess = blogsToOptimize.slice(0, maxArticles);
  console.log(`\nOptimizing hyperlinks in ${toProcess.length} trending blog(s)...`);

  for (const blogPage of toProcess) {
    try {
      const handle = extractHandle(blogPage.page);
      const article = await fetchArticleFn(handle);

      if (!article) {
        console.log(`  Could not fetch article for: ${handle}`);
        results.push({ page: blogPage.page, optimized: false, reason: 'article not found' });
        continue;
      }

      const result = await optimizeBlogLinks(article, trendingProducts, allArticles, { dryRun });
      results.push(result);

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      console.error(`  Error optimizing ${blogPage.page}:`, error.message);
      results.push({ page: blogPage.page, optimized: false, reason: error.message });
    }
  }

  return results;
}

export default {
  optimizeBlogLinks,
  optimizeMultipleBlogs
};
