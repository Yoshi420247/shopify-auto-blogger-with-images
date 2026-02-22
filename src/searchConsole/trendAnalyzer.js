/**
 * Trend Analyzer Module
 *
 * Compares search performance between two periods to identify:
 * - Rising/trending pages (significant growth in clicks or impressions)
 * - High-performing pages (consistently high traffic)
 * - Pages with improving rankings (position moving up)
 *
 * Categorizes pages into:
 * - Blog pages (/blogs/...)
 * - Product pages (/products/...)
 * - Collection pages (/collections/...)
 */

import config from '../config.js';

// URL patterns for page categorization
const PAGE_PATTERNS = {
  blog: /\/blogs\//i,
  product: /\/products\//i,
  collection: /\/collections\//i
};

/**
 * Analyze two periods of GSC data and identify trends
 *
 * @param {Object} comparisonData - Output from fetchComparisonData()
 * @param {Object} options - Analysis options
 * @returns {Object} - { trendingBlogs, trendingProducts, trendingCollections, summary }
 */
export function analyzeTrends(comparisonData, options = {}) {
  const {
    minClicksRecent = 3,          // Minimum clicks in recent period to consider
    minImpressionsRecent = 20,    // Minimum impressions in recent period
    growthThreshold = 0.20,       // 20% growth = trending
    topN = 20                     // Max pages per category to return
  } = options;

  const { recentData, previousData } = comparisonData;

  // Build a lookup of previous period data by page URL
  const previousMap = new Map();
  for (const row of previousData) {
    previousMap.set(row.page, row);
  }

  // Calculate growth metrics for each page in the recent period
  const pagesWithTrends = recentData.map(recent => {
    const previous = previousMap.get(recent.page);

    const clicksGrowth = previous && previous.clicks > 0
      ? (recent.clicks - previous.clicks) / previous.clicks
      : recent.clicks > 0 ? 1.0 : 0; // New pages with clicks get 100% growth

    const impressionsGrowth = previous && previous.impressions > 0
      ? (recent.impressions - previous.impressions) / previous.impressions
      : recent.impressions > 0 ? 1.0 : 0;

    const positionChange = previous
      ? previous.position - recent.position // Positive = improved (lower position is better)
      : 0;

    // Composite trend score: weighted combination of growth factors
    const trendScore = (
      (clicksGrowth * 0.4) +
      (impressionsGrowth * 0.3) +
      (Math.min(positionChange / 10, 1) * 0.2) + // Normalize position change
      (Math.min(recent.clicks / 50, 1) * 0.1)     // Bonus for high absolute clicks
    );

    return {
      page: recent.page,
      recentClicks: recent.clicks,
      recentImpressions: recent.impressions,
      recentCtr: recent.ctr,
      recentPosition: recent.position,
      previousClicks: previous?.clicks || 0,
      previousImpressions: previous?.impressions || 0,
      previousPosition: previous?.position || null,
      clicksGrowth,
      impressionsGrowth,
      positionChange,
      trendScore,
      isNew: !previous,
      category: categorizePage(recent.page)
    };
  });

  // Filter to pages meeting minimum thresholds
  const qualifiedPages = pagesWithTrends.filter(p =>
    p.recentClicks >= minClicksRecent ||
    p.recentImpressions >= minImpressionsRecent
  );

  // Sort by trend score (highest first)
  qualifiedPages.sort((a, b) => b.trendScore - a.trendScore);

  // Split into categories
  const trendingBlogs = qualifiedPages
    .filter(p => p.category === 'blog')
    .slice(0, topN);

  const trendingProducts = qualifiedPages
    .filter(p => p.category === 'product')
    .slice(0, topN);

  const trendingCollections = qualifiedPages
    .filter(p => p.category === 'collection')
    .slice(0, topN);

  // Also find pages with significant growth regardless of category
  const risingPages = qualifiedPages
    .filter(p => p.clicksGrowth >= growthThreshold || p.impressionsGrowth >= growthThreshold)
    .slice(0, topN);

  // Find high-traffic pages (most clicks regardless of trend)
  const highTrafficPages = [...qualifiedPages]
    .sort((a, b) => b.recentClicks - a.recentClicks)
    .slice(0, topN);

  const summary = {
    totalPagesAnalyzed: pagesWithTrends.length,
    qualifiedPages: qualifiedPages.length,
    trendingBlogsCount: trendingBlogs.length,
    trendingProductsCount: trendingProducts.length,
    trendingCollectionsCount: trendingCollections.length,
    risingPagesCount: risingPages.length,
    recentRange: comparisonData.recentRange,
    previousRange: comparisonData.previousRange
  };

  return {
    trendingBlogs,
    trendingProducts,
    trendingCollections,
    risingPages,
    highTrafficPages,
    allTrends: qualifiedPages,
    summary
  };
}

/**
 * Categorize a page URL into blog, product, collection, or other
 */
function categorizePage(url) {
  if (PAGE_PATTERNS.blog.test(url)) return 'blog';
  if (PAGE_PATTERNS.product.test(url)) return 'product';
  if (PAGE_PATTERNS.collection.test(url)) return 'collection';
  return 'other';
}

/**
 * Extract the page handle/slug from a URL
 * e.g., "https://oilslickpad.com/products/cool-rig" -> "cool-rig"
 */
export function extractHandle(url) {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    // Handle relative URLs or malformed ones
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }
}

/**
 * Extract the collection or product path from a URL
 * e.g., "https://oilslickpad.com/collections/dab-rigs" -> "/collections/dab-rigs"
 */
export function extractPath(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Identify which trending product/collection pages would benefit from a new blog
 * Filters to pages that don't already have recent blog coverage
 *
 * @param {Object} trends - Output from analyzeTrends()
 * @param {Array} existingBlogs - List of existing blog articles with titles and URLs
 * @param {number} maxSuggestions - Maximum blog topics to suggest
 * @returns {Array} - Suggested blog targets with page info and topic ideas
 */
export function identifyBlogTargets(trends, existingBlogs = [], maxSuggestions = 3) {
  const { trendingProducts, trendingCollections } = trends;

  // Combine products and collections, prioritize by trend score
  const candidates = [
    ...trendingProducts.map(p => ({ ...p, type: 'product' })),
    ...trendingCollections.map(p => ({ ...p, type: 'collection' }))
  ].sort((a, b) => b.trendScore - a.trendScore);

  // Get existing blog titles for dedup check
  const existingTitlesLower = existingBlogs.map(b =>
    (b.title || '').toLowerCase()
  );

  const suggestions = [];

  for (const candidate of candidates) {
    if (suggestions.length >= maxSuggestions) break;

    const handle = extractHandle(candidate.page);
    const humanName = handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Check if there's already a recent blog about this topic
    const hasExistingCoverage = existingTitlesLower.some(title =>
      title.includes(handle.replace(/-/g, ' ')) ||
      handle.split('-').every(word => word.length > 3 && title.includes(word))
    );

    if (hasExistingCoverage) {
      console.log(`Skipping "${humanName}" - already has blog coverage`);
      continue;
    }

    suggestions.push({
      page: candidate.page,
      handle,
      humanName,
      type: candidate.type,
      trendScore: candidate.trendScore,
      recentClicks: candidate.recentClicks,
      recentImpressions: candidate.recentImpressions,
      clicksGrowth: candidate.clicksGrowth,
      positionChange: candidate.positionChange
    });
  }

  return suggestions;
}

/**
 * Identify trending blog pages that need hyperlink optimization
 * Returns blogs sorted by traffic where better linking could amplify results
 *
 * @param {Object} trends - Output from analyzeTrends()
 * @param {number} maxPages - Maximum pages to optimize
 * @returns {Array} - Blog pages that should have their links reviewed
 */
export function identifyBlogsForOptimization(trends, maxPages = 10) {
  const { trendingBlogs, highTrafficPages } = trends;

  // Combine trending blogs and high-traffic blogs, deduplicate
  const seen = new Set();
  const candidates = [];

  // First add trending blogs (rising traffic)
  for (const blog of trendingBlogs) {
    if (!seen.has(blog.page)) {
      seen.add(blog.page);
      candidates.push({ ...blog, reason: 'trending' });
    }
  }

  // Then add high-traffic blog pages
  for (const page of highTrafficPages) {
    if (page.category === 'blog' && !seen.has(page.page)) {
      seen.add(page.page);
      candidates.push({ ...page, reason: 'high-traffic' });
    }
  }

  return candidates.slice(0, maxPages);
}

/**
 * Print a formatted trend report to the console
 */
export function printTrendReport(trends) {
  const { summary, trendingBlogs, trendingProducts, trendingCollections, risingPages } = trends;

  console.log('\n' + '='.repeat(60));
  console.log('SEARCH CONSOLE TREND REPORT');
  console.log('='.repeat(60));
  console.log(`Period: ${summary.recentRange.start} to ${summary.recentRange.end}`);
  console.log(`vs: ${summary.previousRange.start} to ${summary.previousRange.end}`);
  console.log(`Pages analyzed: ${summary.totalPagesAnalyzed} (${summary.qualifiedPages} qualified)`);
  console.log('');

  if (trendingBlogs.length > 0) {
    console.log('--- TRENDING BLOG PAGES ---');
    trendingBlogs.slice(0, 5).forEach((p, i) => {
      const growth = (p.clicksGrowth * 100).toFixed(0);
      console.log(`  ${i + 1}. ${extractHandle(p.page)} | ${p.recentClicks} clicks (${growth > 0 ? '+' : ''}${growth}%) | pos ${p.recentPosition.toFixed(1)}`);
    });
    console.log('');
  }

  if (trendingProducts.length > 0) {
    console.log('--- TRENDING PRODUCT PAGES ---');
    trendingProducts.slice(0, 5).forEach((p, i) => {
      const growth = (p.clicksGrowth * 100).toFixed(0);
      console.log(`  ${i + 1}. ${extractHandle(p.page)} | ${p.recentClicks} clicks (${growth > 0 ? '+' : ''}${growth}%) | pos ${p.recentPosition.toFixed(1)}`);
    });
    console.log('');
  }

  if (trendingCollections.length > 0) {
    console.log('--- TRENDING COLLECTION PAGES ---');
    trendingCollections.slice(0, 5).forEach((p, i) => {
      const growth = (p.clicksGrowth * 100).toFixed(0);
      console.log(`  ${i + 1}. ${extractHandle(p.page)} | ${p.recentClicks} clicks (${growth > 0 ? '+' : ''}${growth}%) | pos ${p.recentPosition.toFixed(1)}`);
    });
    console.log('');
  }

  if (risingPages.length > 0) {
    console.log(`--- TOP RISING PAGES (${risingPages.length} total) ---`);
    risingPages.slice(0, 5).forEach((p, i) => {
      const growth = (p.clicksGrowth * 100).toFixed(0);
      console.log(`  ${i + 1}. [${p.category}] ${extractHandle(p.page)} | ${p.recentClicks} clicks (${growth > 0 ? '+' : ''}${growth}%)`);
    });
  }

  console.log('');
}

export default {
  analyzeTrends,
  extractHandle,
  extractPath,
  identifyBlogTargets,
  identifyBlogsForOptimization,
  printTrendReport
};
