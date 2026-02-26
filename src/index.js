/**
 * Unified Shopify Auto-Blogger
 *
 * Single entry point that handles all strategies:
 * - gsc-analyze:    GSC trend analysis + link optimization (no new blog)
 * - gsc-informed:   Blog generation with topic picked from GSC data
 * - category-rotate: Blog generation cycling through content categories
 * - strategic:      Pillar/cluster content, gap fills, strike-distance targeting
 * - full-pipeline:  GSC analysis + link optimization + new blog
 * - auto:           Determine best strategy from context
 *
 * Consolidates the old auto-blogger.yml and search-console-checker.yml into one.
 */

import config from './config.js';
import { scrapeAllBlogs, analyzeExistingBlogs } from './scrapers/blogScraper.js';
import {
  analyzeAllCompetitors,
  extractTrendingTopics,
  generateContentIdeas,
  buildIndustryContext
} from './scrapers/competitorScraper.js';
import {
  generateBlogPost,
  generateTopicIdeas,
  rewriteExistingPost
} from './generators/contentGenerator.js';
import {
  generateBlogImages,
  imageToDataUrl
} from './generators/imageGenerator.js';
import {
  reviewAndFixContent,
  getUniqueTopic
} from './generators/contentReviewer.js';
import { getRandomPseudonym, getAuthorBio } from './utils/authorStyles.js';
import { injectHyperlinks, getLinkStats, cleanOrphanedBoldText } from './utils/hyperlinkInjector.js';
import {
  testConnection,
  getOrCreateBlog,
  createArticle,
  updateArticle,
  getArticles,
  getAllArticleTitles,
  uploadImageToFiles,
  markdownToHtml,
  getProductsByVendor
} from './publishers/shopifyPublisher.js';
import { getCachedOrFetch, getCacheStatus } from './utils/researchCache.js';
import {
  scoreContent,
  generateImageFilename,
  generateAllStructuredData
} from './utils/seoOptimizer.js';
import { printCostReport } from './utils/costTracker.js';
import { createCompletion } from './utils/aiClient.js';

// Search Console imports (optional - only used when GSC credentials available)
let gscAvailable = false;
let fetchComparisonData, testGSCConnection, querySearchAnalyticsByQuery;
let analyzeTrends, identifyBlogTargets, identifyBlogsForOptimization, printTrendReport, extractHandle;
let optimizeBlogLinks;
let generateTargetedTopic, buildTargetLinkingInstructions, isProductBlogDue, recordProductBlogWritten;

try {
  const gscClient = await import('./searchConsole/searchConsoleClient.js');
  fetchComparisonData = gscClient.fetchComparisonData;
  testGSCConnection = gscClient.testConnection;
  querySearchAnalyticsByQuery = gscClient.querySearchAnalyticsByQuery;

  const trendModule = await import('./searchConsole/trendAnalyzer.js');
  analyzeTrends = trendModule.analyzeTrends;
  identifyBlogTargets = trendModule.identifyBlogTargets;
  identifyBlogsForOptimization = trendModule.identifyBlogsForOptimization;
  printTrendReport = trendModule.printTrendReport;
  extractHandle = trendModule.extractHandle;

  const optimizerModule = await import('./searchConsole/blogOptimizer.js');
  optimizeBlogLinks = optimizerModule.optimizeBlogLinks;

  const writerModule = await import('./searchConsole/productBlogWriter.js');
  generateTargetedTopic = writerModule.generateTargetedTopic;
  buildTargetLinkingInstructions = writerModule.buildTargetLinkingInstructions;
  isProductBlogDue = writerModule.isProductBlogDue;
  recordProductBlogWritten = writerModule.recordProductBlogWritten;

  gscAvailable = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
} catch (e) {
  console.log('Search Console modules not available:', e.message);
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('UNIFIED AUTO-BLOGGER');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);

  const strategy = config.runStrategy;
  console.log(`Strategy: ${strategy}`);
  console.log(`GSC available: ${gscAvailable}`);
  console.log(`Mode: ${config.blog.mode}`);
  console.log(`Category: ${config.blog.contentCategory}`);
  console.log(`Format: ${config.blog.contentFormat}`);
  console.log(`Blogs per run: ${config.blog.blogsPerRun}`);
  console.log(`Dry run: ${config.blog.dryRun}`);
  console.log('');

  if (!validateEnvironment()) {
    process.exit(1);
  }

  try {
    let result;

    switch (strategy) {
      case 'gsc-analyze':
        result = await runGSCAnalysis();
        break;

      case 'gsc-informed':
        result = await runGSCInformedBlog();
        break;

      case 'category-rotate':
        result = await runCategoryRotation();
        break;

      case 'strategic':
        result = await runStrategicBlog();
        break;

      case 'full-pipeline':
        result = await runFullPipeline();
        break;

      case 'auto':
      default:
        result = await runAuto();
        break;
    }

    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    printCostReport();
    return result;

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR: Unified auto-blogger failed');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error(error.stack);
    printCostReport();
    return { success: false, error: error.message };
  }
}

// ============================================================
// STRATEGY: GSC Analysis Only
// ============================================================

async function runGSCAnalysis() {
  console.log('\n--- STRATEGY: GSC Analysis + Link Optimization ---');

  if (!gscAvailable) {
    console.log('GSC not configured - skipping analysis');
    return { success: true, strategy: 'gsc-analyze', skipped: true };
  }

  const results = { gscConnected: false, trendsAnalyzed: false, blogsOptimized: 0, errors: [] };

  // Test connections
  const gscResult = await testGSCConnection();
  if (!gscResult.success) {
    throw new Error(`GSC connection failed: ${gscResult.error}`);
  }
  results.gscConnected = true;

  if (!config.blog.dryRun) {
    const shopifyResult = await testConnection();
    if (!shopifyResult.success) {
      throw new Error(`Shopify connection failed: ${shopifyResult.error}`);
    }
  }

  // Fetch and analyze trends
  console.log('\nFetching Search Console data...');
  const comparisonData = await fetchComparisonData(7);
  const trends = analyzeTrends(comparisonData);
  results.trendsAnalyzed = true;
  printTrendReport(trends);

  // Gather blog context
  const existingBlogs = await getCachedOrFetch('existingBlogs', async () => {
    return await scrapeAllBlogs(15);
  });
  const existingArticlesList = existingBlogs?.blogs || [];

  // Optimize hyperlinks in trending blog pages
  console.log('\n--- Optimizing Trending Blog Hyperlinks ---');
  const blogsToOptimize = identifyBlogsForOptimization(trends, 5);
  console.log(`Found ${blogsToOptimize.length} trending blogs to optimize`);

  if (blogsToOptimize.length > 0) {
    const trendingProductPages = [...trends.trendingProducts, ...trends.trendingCollections];

    for (const blogPage of blogsToOptimize) {
      try {
        const handle = extractHandle(blogPage.page);
        console.log(`\nOptimizing: ${handle} (${blogPage.reason})`);

        const article = await fetchArticleByHandle(handle);
        if (!article) {
          console.log(`  Could not find article for handle: ${handle}`);
          continue;
        }

        const optimResult = await optimizeBlogLinks(
          article, trendingProductPages, existingArticlesList, { dryRun: config.blog.dryRun }
        );

        if (optimResult.optimized && optimResult.updatedContent && !config.blog.dryRun) {
          await updateArticle(article.id, { body: optimResult.updatedContent });
          console.log(`  Updated article in Shopify: ${article.title}`);
          results.blogsOptimized++;
        } else if (optimResult.optimized && config.blog.dryRun) {
          console.log(`  [DRY RUN] Would update: ${article.title}`);
          results.blogsOptimized++;
        }

        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error(`  Error optimizing blog: ${error.message}`);
        results.errors.push(error.message);
      }
    }
  }

  printGSCSummary(results);
  return { success: true, strategy: 'gsc-analyze', results };
}

// ============================================================
// STRATEGY: GSC-Informed Blog Generation
// ============================================================

async function runGSCInformedBlog() {
  console.log('\n--- STRATEGY: GSC-Informed Blog Generation ---');

  // Do standard research
  const researchData = await doResearch();
  let gscTopicData = null;

  // If GSC is available, find the highest-opportunity topic
  if (gscAvailable) {
    try {
      gscTopicData = await findGSCOpportunityTopic(researchData);
    } catch (e) {
      console.log(`GSC topic selection failed: ${e.message} - falling back to standard`);
    }
  }

  // Build content plans
  let contentPlans;
  if (gscTopicData) {
    contentPlans = [{
      action: 'new',
      topic: gscTopicData.topic,
      reason: `GSC opportunity: ${gscTopicData.reason}`,
      targetKeywords: gscTopicData.targetKeywords,
      gscData: gscTopicData,
      format: gscTopicData.format || 'standard'
    }];
  } else {
    contentPlans = await planMultipleBlogs(researchData, config.blog.blogsPerRun);
  }

  return await executeContentPlans(contentPlans, researchData);
}

// ============================================================
// STRATEGY: Category Rotation
// ============================================================

async function runCategoryRotation() {
  console.log('\n--- STRATEGY: Category Rotation ---');

  const researchData = await doResearch();

  // Determine which category to use
  let category = config.blog.contentCategory;
  if (category === 'auto') {
    category = getNextCategory();
    console.log(`Rotated to category: ${category}`);
  }

  // Pick a format for variety (category rotation doesn't know topic yet, so no hint)
  const format = config.blog.contentFormat === 'auto' ? pickWeightedFormat() : config.blog.contentFormat;
  console.log(`Content format: ${format}`);

  const categoryConfig = config.contentCategories[category];
  if (!categoryConfig) {
    console.log(`Unknown category "${category}", falling back to auto`);
    const contentPlans = await planMultipleBlogs(researchData, config.blog.blogsPerRun);
    return await executeContentPlans(contentPlans, researchData);
  }

  // Build plans from the selected category
  const contentPlans = await planCategoryBlogs(researchData, category, format, config.blog.blogsPerRun);
  return await executeContentPlans(contentPlans, researchData);
}

// ============================================================
// STRATEGY: Strategic (Pillar/Cluster, Gap Fill, Strike Distance)
// ============================================================

async function runStrategicBlog() {
  console.log('\n--- STRATEGY: Strategic Blog ---');

  const researchData = await doResearch();
  let contentPlans = [];

  // Priority 1: Check for missing pillar/cluster content
  const clusterPlan = findMissingClusterContent(researchData);
  if (clusterPlan) {
    console.log(`Found missing cluster content: ${clusterPlan.topic}`);
    contentPlans.push(clusterPlan);
  }

  // Priority 2: GSC strike-distance keywords
  if (contentPlans.length === 0 && gscAvailable) {
    try {
      const strikePlan = await findStrikeDistanceOpportunity(researchData);
      if (strikePlan) {
        console.log(`Found strike-distance opportunity: ${strikePlan.topic}`);
        contentPlans.push(strikePlan);
      }
    } catch (e) {
      console.log(`Strike-distance check failed: ${e.message}`);
    }
  }

  // Priority 3: Content gaps from competitor analysis
  if (contentPlans.length === 0) {
    const gapPlan = findContentGap(researchData);
    if (gapPlan) {
      console.log(`Found content gap: ${gapPlan.topic}`);
      contentPlans.push(gapPlan);
    }
  }

  // Priority 4: GSC product blog (weekly)
  if (contentPlans.length === 0 && gscAvailable) {
    try {
      const productBlogPlan = await findProductBlogOpportunity(researchData);
      if (productBlogPlan) {
        console.log(`Product blog opportunity: ${productBlogPlan.topic}`);
        contentPlans.push(productBlogPlan);
      }
    } catch (e) {
      console.log(`Product blog check failed: ${e.message}`);
    }
  }

  // Fallback: standard auto planning
  if (contentPlans.length === 0) {
    console.log('No strategic opportunities found, falling back to auto');
    contentPlans = await planMultipleBlogs(researchData, config.blog.blogsPerRun);
  }

  return await executeContentPlans(contentPlans, researchData);
}

// ============================================================
// STRATEGY: Full Pipeline (GSC + Blog)
// ============================================================

async function runFullPipeline() {
  console.log('\n--- STRATEGY: Full Pipeline ---');

  // Run GSC analysis first
  if (gscAvailable) {
    await runGSCAnalysis();
  }

  // Then generate a GSC-informed blog
  return await runGSCInformedBlog();
}

// ============================================================
// STRATEGY: Auto (determine from context)
// ============================================================

async function runAuto() {
  console.log('\n--- STRATEGY: Auto ---');

  // If custom topic provided, just write it
  if (process.env.CUSTOM_TOPIC) {
    const researchData = await doResearch();
    const contentPlans = [{
      action: 'new',
      topic: process.env.CUSTOM_TOPIC,
      reason: 'Custom topic specified'
    }];
    return await executeContentPlans(contentPlans, researchData);
  }

  // Otherwise use the standard blog generation with all intelligence
  const researchData = await doResearch();
  const contentPlans = await planMultipleBlogs(researchData, config.blog.blogsPerRun);
  return await executeContentPlans(contentPlans, researchData);
}

// ============================================================
// RESEARCH PHASE
// ============================================================

async function doResearch() {
  console.log('\n--- Research Phase ---');

  const cacheStatus = getCacheStatus();
  if (Object.keys(cacheStatus).length > 0) {
    console.log('Cache status:', Object.entries(cacheStatus)
      .map(([k, v]) => `${k}: ${v.fresh ? 'FRESH' : 'STALE'} (${v.ageMinutes}min)`)
      .join(', '));
  }

  // Analyze existing content (cached for 6 hours)
  console.log('Analyzing existing blogs...');
  const existingBlogs = await getCachedOrFetch('existingBlogs', async () => {
    return await scrapeAllBlogs(15);
  });
  console.log(`Found ${existingBlogs.blogs.length} existing blog posts`);

  // Fetch ALL article titles from Shopify API for accurate dedup (cached for 6 hours)
  console.log('Fetching all article titles for dedup...');
  let allArticleTitles = [];
  try {
    allArticleTitles = await getCachedOrFetch('allArticleTitles', async () => {
      const blog = await getOrCreateBlog('News');
      return await getAllArticleTitles(blog.id);
    });
    console.log(`Total articles for dedup: ${allArticleTitles.length}`);
  } catch (e) {
    console.log(`Failed to fetch article titles, falling back to scraped data: ${e.message}`);
  }

  // Analyze competitors (cached for 12 hours)
  console.log('Analyzing competitors...');
  const competitorData = await getCachedOrFetch('competitorData', async () => {
    return await analyzeAllCompetitors();
  });
  console.log(`Analyzed ${competitorData.length} competitor sites`);

  // Extract trending topics (cached for 12 hours)
  const trendingTopics = await getCachedOrFetch('trendingTopics', async () => {
    return extractTrendingTopics(competitorData);
  });
  const industryContext = buildIndustryContext(trendingTopics);
  console.log(`Found ${trendingTopics.totalArticlesAnalyzed} competitor articles`);

  // Generate content ideas (cached for 24 hours)
  console.log('Generating content ideas...');
  const contentIdeas = await getCachedOrFetch('contentIdeas', async () => {
    return await generateTopicIdeas({
      existingBlogAnalysis: existingBlogs.analysis,
      competitorInsights: trendingTopics,
      contentGaps: existingBlogs.analysis.contentGaps
    });
  });
  console.log(`Generated ${contentIdeas.length} content ideas`);

  // Always fetch vendor products so they're available for any strategy/category
  // (Previously only fetched when CONTENT_CATEGORY was explicitly product_spotlight,
  // which meant auto-rotation to product_spotlight had no products)
  let vendorProducts = [];
  const productVendor = config.contentCategories?.product_spotlight?.vendor;
  if (productVendor) {
    console.log(`Fetching products from vendor: ${productVendor}...`);
    vendorProducts = await getCachedOrFetch('vendorProducts', async () => {
      return await getProductsByVendor(productVendor, 25);
    });
    console.log(`Found ${vendorProducts.length} products from vendor`);
  }

  // Fetch GSC data if available (for GSC-informed strategies)
  let gscTrends = null;
  if (gscAvailable) {
    try {
      console.log('Fetching Search Console data...');
      const comparisonData = await fetchComparisonData(7);
      gscTrends = analyzeTrends(comparisonData);
      console.log(`GSC: ${gscTrends.summary.qualifiedPages} qualified pages analyzed`);
    } catch (e) {
      console.log(`GSC data fetch failed: ${e.message}`);
    }
  }

  return {
    existingBlogs,
    allArticleTitles,
    competitorData,
    trendingTopics,
    industryContext,
    contentIdeas,
    vendorProducts,
    gscTrends
  };
}

// ============================================================
// GSC OPPORTUNITY DETECTION
// ============================================================

/**
 * Map AI-generated contentType to our format system
 * Prevents mismatches like myth_busting on a buying guide
 */
const CONTENT_TYPE_TO_FORMAT = {
  'guide': 'standard',
  'how-to': 'standard',
  'review': 'standard',
  'comparison': 'comparison',
  'listicle': 'listicle',
  'deep-dive': 'deep_dive',
  'quick-guide': 'quick_guide'
};

/**
 * Find the best topic opportunity from GSC data
 * Looks for: strike-distance keywords, high impressions/low CTR, rising queries
 */
async function findGSCOpportunityTopic(researchData) {
  if (!gscAvailable || !researchData.gscTrends) return null;

  const trends = researchData.gscTrends;
  const existingArticles = researchData.existingBlogs?.blogs || [];

  // Strategy 1: Find trending products/collections that need blog support
  const blogTargets = identifyBlogTargets(trends, existingArticles, 3);
  if (blogTargets.length > 0) {
    const target = blogTargets[0];
    const topicData = await generateTargetedTopic(target, existingArticles);
    const format = CONTENT_TYPE_TO_FORMAT[topicData.contentType] || 'standard';
    console.log(`GSC topic contentType: "${topicData.contentType}" -> format: "${format}"`);
    return {
      topic: topicData.topic,
      targetKeywords: topicData.targetKeywords,
      reason: `Trending ${target.type}: ${target.humanName} (+${(target.clicksGrowth * 100).toFixed(0)}% clicks)`,
      gscTarget: target,
      topicData,
      format
    };
  }

  // Strategy 2: Find strike-distance keywords
  const strikePlan = await findStrikeDistanceOpportunity(researchData);
  if (strikePlan) {
    return {
      topic: strikePlan.topic,
      targetKeywords: strikePlan.targetKeywords || [],
      reason: strikePlan.reason
    };
  }

  return null;
}

/**
 * Find keywords ranking in positions 5-20 with decent impressions
 * These are "strike distance" keywords where a targeted article could push to page 1
 */
async function findStrikeDistanceOpportunity(researchData) {
  if (!gscAvailable) return null;

  const thresholds = config.searchConsole.strikeDistance;

  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 14);

    const formatDate = d => d.toISOString().split('T')[0];
    const queryData = await querySearchAnalyticsByQuery(formatDate(startDate), formatDate(endDate));

    // Filter for strike-distance keywords
    const opportunities = queryData
      .filter(row =>
        row.position >= thresholds.minPosition &&
        row.position <= thresholds.maxPosition &&
        row.impressions >= thresholds.minImpressions &&
        row.ctr <= thresholds.maxCtr
      )
      .sort((a, b) => b.impressions - a.impressions);

    if (opportunities.length === 0) return null;

    // Find an opportunity that doesn't already have dedicated blog coverage
    const existingTitles = (researchData.existingBlogs?.blogs || [])
      .map(b => (b.title || '').toLowerCase());

    for (const opp of opportunities.slice(0, 10)) {
      const queryWords = opp.query.toLowerCase().split(/\s+/);
      const hasExistingCoverage = existingTitles.some(title =>
        queryWords.every(w => w.length > 3 ? title.includes(w) : true)
      );

      if (!hasExistingCoverage) {
        return {
          action: 'new',
          topic: buildTopicFromQuery(opp.query),
          targetKeywords: [opp.query, ...queryWords.filter(w => w.length > 3)],
          reason: `Strike-distance keyword: "${opp.query}" (pos ${opp.position.toFixed(1)}, ${opp.impressions} impressions)`,
          format: 'standard'
        };
      }
    }
  } catch (e) {
    console.log(`Strike-distance search failed: ${e.message}`);
  }

  return null;
}

/**
 * Convert a search query into a blog topic
 */
function buildTopicFromQuery(query) {
  const q = query.trim().toLowerCase();

  // If already a question, capitalize and return
  if (q.startsWith('how') || q.startsWith('what') || q.startsWith('why') || q.startsWith('where') || q.startsWith('when')) {
    return q.replace(/\b\w/g, c => c.toUpperCase());
  }

  // If it contains "best", make it a guide
  if (q.includes('best')) {
    return q.replace(/\b\w/g, c => c.toUpperCase()) + ': Top Picks and Guide';
  }

  // If it contains "vs", make it a comparison
  if (q.includes(' vs ') || q.includes(' versus ')) {
    return q.replace(/\b\w/g, c => c.toUpperCase()) + ': Which is Better';
  }

  // Default: make it a guide
  return `Guide to ${q.replace(/\b\w/g, c => c.toUpperCase())}`;
}

// ============================================================
// PILLAR/CLUSTER CONTENT PLANNING
// ============================================================

/**
 * Find missing pillar or cluster articles and generate a plan
 */
function findMissingClusterContent(researchData) {
  const existingTitles = (researchData.existingBlogs?.blogs || [])
    .map(b => (b.title || '').toLowerCase());

  const clusters = config.seo.topicClusters;

  for (const [clusterId, cluster] of Object.entries(clusters)) {
    // Check if pillar exists
    const pillarExists = existingTitles.some(t =>
      similarityScore(t, cluster.pillar.toLowerCase()) > 0.5
    );

    if (!pillarExists) {
      return {
        action: 'new',
        topic: cluster.pillar,
        reason: `Missing pillar content for "${clusterId}" cluster`,
        format: 'deep_dive',
        targetKeywords: cluster.keywords,
        clusterInfo: { clusterId, type: 'pillar', relatedArticles: cluster.clusters }
      };
    }

    // Check for missing cluster articles
    for (const clusterArticle of cluster.clusters) {
      const clusterExists = existingTitles.some(t =>
        similarityScore(t, clusterArticle.toLowerCase()) > 0.4
      );

      if (!clusterExists) {
        return {
          action: 'new',
          topic: clusterArticle,
          reason: `Missing cluster article for "${clusterId}" pillar`,
          format: 'standard',
          targetKeywords: cluster.keywords,
          clusterInfo: { clusterId, type: 'cluster', pillar: cluster.pillar }
        };
      }
    }
  }

  return null;
}

/**
 * Simple word-overlap similarity score between two strings
 */
function similarityScore(a, b) {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * Find content gaps from competitor analysis
 */
function findContentGap(researchData) {
  const contentGaps = researchData.existingBlogs?.analysis?.contentGaps || [];
  const existingTitles = (researchData.existingBlogs?.blogs || [])
    .map(b => (b.title || '').toLowerCase());

  for (const gap of contentGaps) {
    if (!existingTitles.some(t => t.includes(gap.toLowerCase().substring(0, 15)))) {
      return {
        action: 'new',
        topic: gap,
        reason: 'Content gap vs competitors',
        format: 'standard'
      };
    }
  }

  return null;
}

/**
 * Check if a product-targeted blog is due from GSC trends
 */
async function findProductBlogOpportunity(researchData) {
  if (!gscAvailable || !researchData.gscTrends) return null;

  const productBlogDue = await isProductBlogDue();
  if (!productBlogDue && !config.searchConsole.forceProductBlog) return null;

  const existingArticles = researchData.existingBlogs?.blogs || [];
  const blogTargets = identifyBlogTargets(researchData.gscTrends, existingArticles, 1);

  if (blogTargets.length === 0) return null;

  const target = blogTargets[0];
  const topicData = await generateTargetedTopic(target, existingArticles);

  return {
    action: 'new',
    topic: topicData.topic,
    reason: `Weekly product blog: ${target.humanName}`,
    targetKeywords: topicData.targetKeywords,
    gscTarget: target,
    topicData,
    isProductBlog: true,
    format: CONTENT_TYPE_TO_FORMAT[topicData.contentType] || 'standard'
  };
}

// ============================================================
// CONTENT PLANNING
// ============================================================

/**
 * Plan blogs from a specific category with format
 */
async function planCategoryBlogs(researchData, category, format, count) {
  const categoryConfig = config.contentCategories[category];
  if (!categoryConfig) return [];

  // Use ALL article titles from Shopify API for dedup (not just scraped 15)
  const existingTitles = getAllExistingTitles(researchData);

  // Normalize to { topic, productImage } objects
  let topicPool = (categoryConfig.topicPool || []).map(t => ({ topic: t, productImage: null }));

  // For product_spotlight, use AI to generate creative product-specific topics
  if (category === 'product_spotlight' && researchData.vendorProducts?.length > 0) {
    const productTopics = await generateProductTopics(researchData.vendorProducts, existingTitles);
    topicPool = [...productTopics, ...topicPool];
  }

  // Filter out topics that overlap with ANY existing article
  topicPool = topicPool.filter(item => !isTopicCoveredByExisting(item.topic, existingTitles));

  // If hardcoded pool is exhausted, ask AI for fresh topics
  if (topicPool.length < count) {
    console.log(`Only ${topicPool.length} unused topics remain in ${category}, generating fresh ones with AI...`);
    const freshTopics = await generateFreshCategoryTopics(
      categoryConfig.name,
      categoryConfig.keywords || [],
      existingTitles
    );
    const freshFiltered = freshTopics
      .filter(t => !isTopicCoveredByExisting(t, existingTitles))
      .map(t => ({ topic: t, productImage: null }));
    topicPool = [...topicPool, ...freshFiltered];
  }

  // Shuffle for variety
  topicPool = shuffleArray(topicPool);

  const plans = [];
  const usedTopics = new Set();

  for (let i = 0; i < count && i < topicPool.length; i++) {
    const item = topicPool[i];
    if (!usedTopics.has(item.topic.toLowerCase())) {
      plans.push({
        action: 'new',
        topic: item.topic,
        productImage: item.productImage,
        reason: `Category: ${categoryConfig.name}`,
        category,
        format
      });
      usedTopics.add(item.topic.toLowerCase());
    }
  }

  return plans;
}

/**
 * Plan multiple blogs based on mode and priorities
 */
async function planMultipleBlogs(researchData, count) {
  const { existingBlogs, contentIdeas, trendingTopics, vendorProducts } = researchData;
  const mode = config.blog.mode;
  const contentCategory = config.blog.contentCategory;
  const customTopic = process.env.CUSTOM_TOPIC;

  if (customTopic) {
    return [{
      action: 'new',
      topic: customTopic,
      reason: 'Custom topic specified'
    }];
  }

  const plans = [];
  const usedTopics = new Set();
  const outdatedPosts = existingBlogs.analysis.outdatedPosts || [];
  const contentGaps = existingBlogs.analysis.contentGaps || [];

  // Use ALL article titles for dedup
  const existingTitles = getAllExistingTitles(researchData);

  // Check if we're using a specific content category
  const categoryConfig = config.contentCategories?.[contentCategory];

  if (categoryConfig) {
    console.log(`Using content category: ${categoryConfig.name}`);

    // Normalize to { topic, productImage } objects
    let topicPool = (categoryConfig.topicPool || []).map(t => ({ topic: t, productImage: null }));

    if (contentCategory === 'product_spotlight' && vendorProducts && vendorProducts.length > 0) {
      const productTopics = await generateProductTopics(vendorProducts, existingTitles);
      topicPool = [...productTopics, ...topicPool];
    }

    topicPool = topicPool.filter(item => !isTopicCoveredByExisting(item.topic, existingTitles));

    // If pool is exhausted, generate fresh topics with AI
    if (topicPool.length < count) {
      console.log(`Only ${topicPool.length} unused topics in ${contentCategory}, generating fresh ones...`);
      const freshTopics = await generateFreshCategoryTopics(
        categoryConfig.name,
        categoryConfig.keywords || [],
        existingTitles
      );
      const freshFiltered = freshTopics
        .filter(t => !isTopicCoveredByExisting(t, existingTitles))
        .map(t => ({ topic: t, productImage: null }));
      topicPool = [...topicPool, ...freshFiltered];
    }

    topicPool = shuffleArray(topicPool);

    for (let i = 0; i < count && i < topicPool.length; i++) {
      const item = topicPool[i];
      if (!usedTopics.has(item.topic.toLowerCase())) {
        plans.push({
          action: 'new',
          topic: item.topic,
          productImage: item.productImage,
          reason: `Content category: ${categoryConfig.name}`,
          category: contentCategory
        });
        usedTopics.add(item.topic.toLowerCase());
      }
    }

    if (plans.length < count) {
      console.log(`Need ${count - plans.length} more topics, falling back to generic selection`);
    }
  }

  // Fill remaining slots with standard topic selection
  for (let i = plans.length; i < count; i++) {
    let plan = null;

    switch (mode) {
      case 'update':
        plan = getUpdatePlan(outdatedPosts, existingBlogs.blogs, usedTopics);
        break;
      case 'new':
        plan = getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics);
        break;
      case 'mixed':
        if (i % 2 === 0 && outdatedPosts.length > 0) {
          plan = getUpdatePlan(outdatedPosts, existingBlogs.blogs, usedTopics);
        } else {
          plan = getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics);
        }
        break;
      case 'auto':
      default:
        plan = getAutoPlan(outdatedPosts, existingBlogs.blogs, contentIdeas, contentGaps, trendingTopics, usedTopics, researchData);
        break;
    }

    if (plan) {
      plans.push(plan);
      usedTopics.add(plan.topic.toLowerCase());
    }
  }

  if (plans.length === 0) {
    const defaultTopic = categoryConfig?.topicPool?.[0] || 'The Ultimate Guide to Choosing Your First Dab Pad';
    plans.push({
      action: 'new',
      topic: defaultTopic,
      reason: 'Default evergreen topic'
    });
  }

  return plans;
}

function getUpdatePlan(outdatedPosts, allBlogs, usedTopics) {
  for (const post of outdatedPosts) {
    if (!usedTopics.has(post.title?.toLowerCase())) {
      return {
        action: 'update',
        topic: post.title,
        existingPost: allBlogs.find(b => b.title === post.title) || post,
        reason: 'Updating outdated content'
      };
    }
  }
  return null;
}

function getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics) {
  for (const gap of contentGaps) {
    if (!usedTopics.has(gap.toLowerCase())) {
      return { action: 'new', topic: gap, reason: 'Filling content gap' };
    }
  }

  for (const idea of contentIdeas) {
    const topic = idea.title || idea.topic;
    if (topic && !usedTopics.has(topic.toLowerCase())) {
      return { action: 'new', topic, reason: `Content idea: ${idea.type || 'general'}` };
    }
  }

  for (const trend of trendingTopics.trendingTopics || []) {
    if (!usedTopics.has(trend.topic?.toLowerCase())) {
      return { action: 'new', topic: `Guide to ${trend.topic}`, reason: 'Trending topic' };
    }
  }

  return null;
}

function getAutoPlan(outdatedPosts, allBlogs, contentIdeas, contentGaps, trendingTopics, usedTopics, researchData) {
  const priorities = config.blog.priorities;
  const options = [];

  // GSC opportunities (highest priority if available)
  if (researchData?.gscTrends && identifyBlogTargets) {
    const existingArticles = researchData.existingBlogs?.blogs || [];
    const blogTargets = identifyBlogTargets(researchData.gscTrends, existingArticles, 1);
    if (blogTargets.length > 0) {
      const target = blogTargets[0];
      options.push({
        weight: priorities.gscOpportunities,
        plan: {
          action: 'new',
          topic: `Guide to ${target.humanName}`,
          reason: `GSC: trending ${target.type} (${target.recentClicks} clicks)`,
          gscTarget: target
        }
      });
    }
  }

  // Missing pillar/cluster content
  const clusterPlan = findMissingClusterContent(researchData || {});
  if (clusterPlan) {
    options.push({ weight: priorities.pillarCluster, plan: clusterPlan });
  }

  // Outdated posts
  if (outdatedPosts.length > 0) {
    const post = outdatedPosts.find(p => !usedTopics.has(p.title?.toLowerCase()));
    if (post) {
      options.push({
        weight: priorities.updateOutdated,
        plan: {
          action: 'update',
          topic: post.title,
          existingPost: allBlogs.find(b => b.title === post.title) || post,
          reason: 'Updating outdated content'
        }
      });
    }
  }

  // Content gaps
  const gap = contentGaps.find(g => !usedTopics.has(g.toLowerCase()));
  if (gap) {
    options.push({ weight: priorities.fillContentGaps, plan: { action: 'new', topic: gap, reason: 'Filling content gap' } });
  }

  // Trending topics
  const trend = (trendingTopics.trendingTopics || []).find(t => !usedTopics.has(t.topic?.toLowerCase()));
  if (trend) {
    options.push({ weight: priorities.trendingTopics, plan: { action: 'new', topic: `Guide to ${trend.topic}`, reason: 'Trending topic' } });
  }

  // Fresh content ideas
  const idea = contentIdeas.find(i => !usedTopics.has((i.title || i.topic)?.toLowerCase()));
  if (idea) {
    options.push({ weight: priorities.freshContent, plan: { action: 'new', topic: idea.title || idea.topic, reason: `Fresh content: ${idea.type || 'general'}` } });
  }

  options.sort((a, b) => b.weight - a.weight);
  return options[0]?.plan || null;
}

// ============================================================
// CONTENT EXECUTION
// ============================================================

/**
 * Execute a list of content plans (generate + publish)
 */
async function executeContentPlans(contentPlans, researchData) {
  if (!config.blog.dryRun) {
    console.log('\n--- Testing Shopify Connection ---');
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(`Shopify connection failed: ${connectionTest.error}`);
    }
    console.log('Shopify connection: OK');
  }

  console.log(`\nExecuting ${contentPlans.length} content plan(s)`);

  const results = [];
  const topicsUsedThisRun = [];

  for (let i = 0; i < contentPlans.length; i++) {
    const plan = contentPlans[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BLOG ${i + 1}/${contentPlans.length}: ${plan.topic}`);
    console.log(`Mode: ${plan.action} | Reason: ${plan.reason}`);
    if (plan.format) console.log(`Format: ${plan.format}`);
    console.log('='.repeat(60));

    try {
      const result = await generateAndPublishBlog(plan, researchData, topicsUsedThisRun);
      results.push(result);

      if (result.success && result.title) {
        topicsUsedThisRun.push({
          title: result.title,
          topic: plan.topic,
          publishedAt: new Date().toISOString()
        });
      }

      // Record product blog if applicable
      if (result.success && plan.isProductBlog && recordProductBlogWritten) {
        await recordProductBlogWritten({
          topic: result.title,
          targetPage: plan.gscTarget?.page,
          publishedAt: new Date().toISOString()
        });
      }

      console.log(`Blog ${i + 1} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (blogError) {
      console.error(`Blog ${i + 1} failed:`, blogError.message);
      results.push({ success: false, error: blogError.message, plan });
    }

    if (i < contentPlans.length - 1) {
      console.log('\nWaiting 10 seconds before next blog...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  printSummary(results);

  const allSuccessful = results.every(r => r.success);
  return { success: allSuccessful, results };
}

/**
 * Generate and publish a single blog
 */
async function generateAndPublishBlog(plan, researchData, topicsUsedThisRun = []) {
  const { trendingTopics, industryContext, existingBlogs, contentIdeas } = researchData;

  // STEP 1: Check topic uniqueness
  let finalTopic = plan.topic;
  if (plan.action !== 'update') {
    console.log('\n--- Checking Topic Uniqueness ---');
    // Combine API-fetched titles + scraped blogs + topics from this run
    const existingArticles = existingBlogs?.blogs || [];
    const apiTitles = (researchData.allArticleTitles || []).map(a => ({ title: a.title, publishedAt: a.publishedAt }));
    const allRecentArticles = [...apiTitles, ...existingArticles, ...topicsUsedThisRun];

    const topicCheck = await getUniqueTopic(plan.topic, allRecentArticles, contentIdeas);
    if (topicCheck.wasChanged) {
      console.log(`Topic changed: "${plan.topic}" -> "${topicCheck.topic}"`);
      finalTopic = topicCheck.topic;
    } else {
      console.log(`Topic "${finalTopic}" is unique - proceeding`);
    }
  }

  // Determine content format
  const format = plan.format || config.blog.contentFormat;
  const resolvedFormat = format === 'auto' ? pickWeightedFormat(finalTopic) : format;
  const formatConfig = config.contentFormats[resolvedFormat] || config.contentFormats.standard;
  console.log(`Content format: ${formatConfig.name}`);

  // STEP 2: Generate content
  console.log('\n--- Generating Blog Content ---');
  let generatedPost;

  if (plan.action === 'update' && plan.existingPost) {
    generatedPost = await rewriteExistingPost(plan.existingPost, trendingTopics.allTitles);
  } else {
    generatedPost = await generateBlogPost({
      topic: finalTopic,
      targetKeywords: plan.targetKeywords || getKeywordsForTopic(finalTopic),
      competitorInsights: trendingTopics.allTitles,
      industryContext,
      contentFormat: formatConfig,
      clusterInfo: plan.clusterInfo || null
    });
  }

  console.log(`Generated: "${generatedPost.title}"`);
  console.log(`Word count: ${generatedPost.wordCount}`);
  console.log(`Author style: ${generatedPost.authorStyle}`);

  // STEP 3: Generate images
  console.log('\n--- Generating Images ---');
  let images = [];

  if (config.blog.dryRun) {
    console.log('[DRY RUN] Skipping image generation');
    if (generatedPost.imageMarkers?.length > 0) {
      images = generatedPost.imageMarkers.map(marker => ({
        success: false, description: marker.description, skipped: true, reason: 'dry-run'
      }));
    }
  } else if (generatedPost.imageMarkers?.length > 0) {
    images = await generateBlogImages(generatedPost.imageMarkers, generatedPost.title);
    const successfulImages = images.filter(i => i.success);
    console.log(`Generated ${successfulImages.length}/${images.length} images`);
  } else {
    console.log('No image markers found');
  }

  // Determine primary keyword early (needed for image alt text and quality scoring)
  const primaryKeyword = (plan.targetKeywords || getKeywordsForTopic(finalTopic))[0];

  // STEP 4: Upload images and convert markdown to HTML
  const { html: htmlContent, uploadedImages } = await uploadImagesAndConvertHtml(generatedPost, images, generatedPost.title, primaryKeyword);

  // STEP 4b: Replace [IMAGE:] markers with HTML comment placeholders BEFORE review.
  // The AI reviewer was destroying [IMAGE:] markers by converting them to empty
  // <figure><figcaption> tags without <img>. HTML comments are invisible to the
  // reviewer and survive intact.
  const { content: protectedContent, markers: savedMarkers } = protectImageMarkers(htmlContent);

  // STEP 5: AI Content Review (HTML comments are invisible to the reviewer)
  console.log('\n--- AI Content Review ---');
  let finalContent = await reviewAndFixContent(protectedContent, generatedPost.title);

  // STEP 5b: Restore placeholders and insert actual images
  finalContent = restoreAndInsertImages(finalContent, savedMarkers, uploadedImages);
  console.log(`Inserted ${uploadedImages.length} inline image(s) into content`);

  // STEP 6: Quality Gate
  console.log('\n--- Content Quality Check ---');
  const qualityScore = scoreContent(finalContent, primaryKeyword, generatedPost.title);
  console.log(`Quality: ${qualityScore.score}/100 (${qualityScore.grade})`);
  console.log(`  GEO signals: definitions=${qualityScore.hasDefinitionalSentence ? 'YES' : 'NO'}, attribution=${qualityScore.hasAttribution ? 'YES' : 'NO'}, data=${qualityScore.hasSpecificData ? 'YES' : 'NO'}, experience=${qualityScore.hasExperienceSignal ? 'YES' : 'NO'}`);
  console.log(`  Snippet readiness: ${qualityScore.questionHeadings} question headings, ${qualityScore.listItems} list items`);
  if (qualityScore.issues.length > 0) {
    console.log(`  Issues: ${qualityScore.issues.join('; ')}`);
  }

  // STEP 7: Inject SEO Hyperlinks
  console.log('\n--- Injecting SEO Hyperlinks ---');
  const existingArticlesList = existingBlogs?.blogs || [];
  finalContent = injectHyperlinks(finalContent, generatedPost.title, existingArticlesList);
  finalContent = cleanOrphanedBoldText(finalContent);

  // If this is a cluster article, add links back to the pillar
  if (plan.clusterInfo?.type === 'cluster' && plan.clusterInfo.pillar) {
    finalContent = addClusterPillarLink(finalContent, plan.clusterInfo.pillar, existingArticlesList);
  }

  // If this is a pillar article, add links DOWN to existing cluster articles
  if (plan.clusterInfo?.type === 'pillar' || !plan.clusterInfo) {
    finalContent = addPillarToClusterLinks(finalContent, generatedPost.title, existingArticlesList);
  }

  const linkStats = getLinkStats(finalContent);
  console.log(`Links: ${linkStats.internalLinks} internal, ${linkStats.externalLinks} external`);

  // STEP 8: Inject structured data (JSON-LD)
  console.log('\n--- Injecting Structured Data ---');
  const authorName = getRandomPseudonym();
  const structuredData = generateAllStructuredData({
    title: generatedPost.title,
    metaDescription: generatedPost.metaDescription,
    author: authorName,
    wordCount: generatedPost.wordCount,
    keywords: plan.targetKeywords || getKeywordsForTopic(finalTopic),
    images: images.filter(i => i.success)
  }, finalContent);

  if (structuredData) {
    finalContent = structuredData + '\n' + finalContent;
    const hasFAQ = structuredData.includes('FAQPage');
    const hasHowTo = structuredData.includes('"HowTo"');
    const schemaTypes = ['Article', 'Breadcrumb', hasFAQ ? 'FAQ' : null, hasHowTo ? 'HowTo' : null].filter(Boolean);
    console.log(`Structured data injected: ${schemaTypes.join(', ')}`);
    if (!hasFAQ && qualityScore.questionHeadings >= 2) {
      console.warn('WARNING: Content has question headings but FAQ schema was not generated. Check heading format.');
    }
    if (!hasFAQ && qualityScore.questionHeadings < 2) {
      console.warn('WARNING: Not enough question headings for FAQ schema. Articles with FAQ rich results get 2-3x more clicks.');
    }
  }

  // STEP 9: Add author bio for E-E-A-T
  const authorBio = getAuthorBio(authorName);
  const authorBioHtml = `<div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 1.2em 1.5em; margin: 2em 0 1em 0; text-align: left;">
<p style="font-weight: 700; margin: 0 0 0.4em 0; font-size: 16px;">About the Author</p>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #555;">${authorBio}</p>
</div>`;
  finalContent = finalContent + '\n' + authorBioHtml;
  console.log(`Author bio added for ${authorName}`);

  // STEP 10: Add "Related Reading" section
  finalContent = addRelatedReadingSection(finalContent, generatedPost.title, existingArticlesList);

  // Publish
  if (config.blog.dryRun) {
    console.log('\n[DRY RUN] Would publish:');
    console.log(`  Title: ${generatedPost.title}`);
    console.log(`  Words: ${generatedPost.wordCount}`);
    console.log(`  Quality: ${qualityScore.grade} (${qualityScore.score}/100)`);
    console.log(`  Format: ${formatConfig.name}`);
    return { success: true, dryRun: true, title: generatedPost.title, wordCount: generatedPost.wordCount, qualityScore: qualityScore.score };
  }

  // FINAL SAFETY: Remove broken image tag fragments that leaked as visible text.
  // When hyperlink injection (or AI review) corrupts an <img> tag, the tail end
  // renders as raw text like: `dab tools on ..." style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">`
  // Match our specific image style signature that is NOT inside a valid <img> tag.
  finalContent = finalContent.replace(/[^<>]*?"\s*style="max-width:\s*100%;\s*height:\s*auto;\s*border-radius:\s*12px;"\s*loading="lazy"\s*>/g, (match, offset) => {
    // Check if this is inside a valid <img> tag by looking backwards for <img
    const before = finalContent.substring(Math.max(0, offset - 500), offset);
    if (/<img\s[^>]*$/.test(before)) {
      return match; // Part of a valid tag, keep it
    }
    return ''; // Orphaned fragment, remove it
  });

  // STEP 10: Publish to Shopify
  console.log('\n--- Publishing to Shopify ---');
  const blog = await getOrCreateBlog('News');

  // For product blogs, prefer the real product image from the store over AI-generated ones
  const hasProductImage = plan.productImage?.url;
  const featuredImage = images.find(img => img.success && img.imageData);

  const articleOptions = {
    title: generatedPost.title,
    body: finalContent,
    metaDescription: generatedPost.metaDescription,
    author: authorName,
    tags: getTagsForTopic(finalTopic, plan.category),
    published: true,
    imageAlt: generatedPost.title
  };

  if (hasProductImage) {
    console.log(`Using real product image: ${plan.productImage.url}`);
    articleOptions.imageUrl = plan.productImage.url;
    articleOptions.imageAlt = plan.productImage.altText || generatedPost.title;
  } else if (featuredImage) {
    articleOptions.imageData = featuredImage.imageData;
    articleOptions.imageAlt = featuredImage.altText || generatedPost.title;
  }

  const publishedArticle = await createArticle(blog.id, articleOptions);

  console.log(`Published: ${publishedArticle?.onlineStoreUrl || publishedArticle?.id || 'Success'}`);

  return {
    success: true,
    article: publishedArticle,
    title: generatedPost.title,
    wordCount: generatedPost.wordCount,
    qualityScore: qualityScore.score,
    images: images.filter(i => i.success).length,
    format: formatConfig.name
  };
}

// ============================================================
// HELPERS
// ============================================================

function validateEnvironment() {
  const required = [
    { key: 'SHOPIFY_ADMIN_API_TOKEN', value: config.shopify.adminApiToken },
    { key: 'SHOPIFY_STORE_DOMAIN', value: config.shopify.storeDomain },
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey }
  ];

  const missing = required.filter(r => !r.value);
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(m => console.error(`  - ${m.key}`));
    return false;
  }

  if (!config.gemini.apiKey) {
    console.warn('GEMINI_API_KEY not set - images will be skipped');
  }

  console.log('Environment validation: OK');
  return true;
}

// ============================================================
// DEDUP HELPERS
// ============================================================

/**
 * Combine all article titles from Shopify API + scraped data into one lowercase list.
 * Ensures dedup checks against EVERY published article, not just 15.
 */
function getAllExistingTitles(researchData) {
  const titleSet = new Set();

  // Primary: API-fetched titles (all articles)
  if (researchData.allArticleTitles?.length > 0) {
    for (const a of researchData.allArticleTitles) {
      if (a.title) titleSet.add(a.title.toLowerCase().trim());
    }
  }

  // Secondary: scraped titles (fallback / overlap is fine)
  if (researchData.existingBlogs?.blogs?.length > 0) {
    for (const b of researchData.existingBlogs.blogs) {
      if (b.title) titleSet.add(b.title.toLowerCase().trim());
    }
  }

  return [...titleSet];
}

/**
 * Check if a proposed topic is already covered by any existing article.
 * Uses word-overlap scoring instead of brittle substring matching.
 */
function isTopicCoveredByExisting(proposedTopic, existingTitles) {
  const proposed = proposedTopic.toLowerCase();

  // Extract meaningful words (drop common filler words)
  const stopWords = new Set(['the', 'a', 'an', 'is', 'it', 'to', 'of', 'for', 'and', 'or',
    'in', 'on', 'at', 'by', 'how', 'what', 'why', 'your', 'you', 'our', 'its', 'with',
    'vs', 'best', 'top', 'guide', 'complete', 'ultimate', 'review', 'honest', 'worth']);

  const proposedWords = proposed.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (proposedWords.length === 0) return false;

  for (const existing of existingTitles) {
    const existingWords = new Set(existing.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w)));

    // Count how many meaningful proposed words appear in the existing title
    const overlap = proposedWords.filter(w => existingWords.has(w)).length;
    const overlapRatio = overlap / proposedWords.length;

    // If 60%+ of the meaningful words match, it's a duplicate subject
    if (overlapRatio >= 0.6 && overlap >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Use AI to generate diverse, creative blog topic angles for real products.
 * Avoids the template trap ("X: Complete Review and Guide" for every product).
 * Returns array of { topic, productImage } objects.
 */
async function generateProductTopics(products, existingTitles = []) {
  if (!products || products.length === 0) return [];

  // Build a product summary for the AI
  const productList = products.slice(0, 15).map(p => {
    const parts = [p.title];
    if (p.productType) parts.push(`(${p.productType})`);
    if (p.description) parts.push(`- ${p.description.substring(0, 100)}`);
    return parts.join(' ');
  }).join('\n');

  const existingSample = existingTitles.slice(0, 30).join('\n');

  const prompt = `You are a cannabis accessories content strategist for oilslickpad.com.

PRODUCTS WE SELL:
${productList}

ARTICLES WE ALREADY HAVE (do NOT repeat these subjects):
${existingSample || '(none yet)'}

Generate 8 unique blog topic ideas that feature specific products from our catalog. Requirements:
- Each topic should naturally reference a specific product by name
- Use diverse angles: how-to, comparison, lifestyle, seasonal, problem-solving, myths
- Do NOT use generic templates like "X: Complete Review" or "Is X Worth It?" for every product
- Make topics that a real person would search for
- Each topic should be genuinely DIFFERENT in angle and subject matter
- Keep titles under 70 characters

Respond with ONLY a JSON array of strings, one topic per element. Example:
["Why the Mini Recycler is Perfect for Solo Sessions", "Cold Start Dabbing With a Quartz Banger: Step by Step"]`;

  try {
    const result = await createCompletion({
      messages: [
        { role: 'system', content: 'You are a content strategist. Respond only with a JSON array of topic strings.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 800,
      useUtilityModel: true,
      label: 'Product topic generation'
    });

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const topics = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(topics)) return [];

    // Match each topic to a product by checking which product name appears in it
    return topics.filter(t => typeof t === 'string' && t.length > 10).map(topic => {
      const matchedProduct = products.find(p =>
        p.title && topic.toLowerCase().includes(p.title.toLowerCase().split(' ').slice(0, 3).join(' '))
      );
      return {
        topic,
        productImage: matchedProduct?.featuredImage || null
      };
    });
  } catch (error) {
    console.error('AI product topic generation failed, using simple fallback:', error.message);
    // Simple fallback — pick 3 random products, 1 topic each
    const shuffled = shuffleArray([...products]).slice(0, 3);
    return shuffled.map(p => ({
      topic: `${p.title}: What to Know Before You Buy`,
      productImage: p.featuredImage || null
    }));
  }
}

/**
 * Use AI to generate fresh topics for a category when the hardcoded pool is exhausted.
 * Returns array of topic strings.
 */
async function generateFreshCategoryTopics(categoryName, keywords, existingTitles) {
  const existingSample = existingTitles.slice(0, 40).join('\n');

  const prompt = `You are a cannabis accessories content strategist for oilslickpad.com.

CONTENT CATEGORY: ${categoryName}
RELEVANT KEYWORDS: ${keywords.join(', ')}

ARTICLES WE ALREADY HAVE (do NOT repeat these subjects):
${existingSample || '(none yet)'}

Generate 5 unique blog topic ideas for this category. Requirements:
- Topics must be genuinely different from existing articles
- Mix formats: how-to, listicle, comparison, myth-busting, seasonal
- Target real search queries people actually type
- Be specific — not vague fluff like "Everything About Dabs"
- Keep titles under 70 characters

Respond with ONLY a JSON array of strings.`;

  try {
    const result = await createCompletion({
      messages: [
        { role: 'system', content: 'You are a content strategist. Respond only with a JSON array of topic strings.' },
        { role: 'user', content: prompt }
      ],
      maxTokens: 500,
      useUtilityModel: true,
      label: 'Fresh category topic generation'
    });

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const topics = JSON.parse(jsonMatch[0]);
    return Array.isArray(topics) ? topics.filter(t => typeof t === 'string' && t.length > 10) : [];
  } catch (error) {
    console.error('AI topic generation failed:', error.message);
    return [];
  }
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get the next content category in the rotation.
 * Cycles through all 7 categories — one per day, repeating weekly.
 */
function getNextCategory() {
  const order = config.categoryRotation.order;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const idx = dayOfYear % order.length;
  console.log(`Category rotation: day ${dayOfYear} → index ${idx} → ${order[idx]} (cycle: ${order.join(' → ')})`);
  return order[idx];
}

/**
 * Pick a content format based on weighted distribution
 * Optionally accepts a topic string to avoid mismatches
 * (e.g. don't pick myth_busting for "buying guide" topics)
 */
function pickWeightedFormat(topic) {
  const weights = { ...config.formatRotation.weights };

  // If we have a topic, suppress formats that don't match
  if (topic) {
    const topicLower = topic.toLowerCase();

    // Suppress myth_busting unless topic naturally fits
    const mythKeywords = ['myth', 'truth', 'misconception', 'wrong', 'mistake', 'lie', 'fact'];
    if (!mythKeywords.some(kw => topicLower.includes(kw))) {
      delete weights.myth_busting;
    }

    // Suppress comparison unless topic involves "vs" or comparing
    const compKeywords = ['vs', 'versus', 'compar', 'which', 'better', 'difference'];
    if (!compKeywords.some(kw => topicLower.includes(kw))) {
      delete weights.comparison;
    }

    // Boost listicle for "best", "top", numbered topics
    const listicleKeywords = ['best', 'top', 'essential', 'must-have', 'favorite'];
    if (listicleKeywords.some(kw => topicLower.includes(kw))) {
      weights.listicle = (weights.listicle || 0) + 3;
    }

    // Boost deep_dive for "complete guide", "ultimate", "everything"
    const deepKeywords = ['complete', 'ultimate', 'everything', 'comprehensive', 'definitive'];
    if (deepKeywords.some(kw => topicLower.includes(kw))) {
      weights.deep_dive = (weights.deep_dive || 0) + 3;
    }

    // Boost quick_guide for "how to", "quick", short questions
    const quickKeywords = ['how to', 'quick', 'fast', 'simple', 'easy'];
    if (quickKeywords.some(kw => topicLower.includes(kw))) {
      weights.quick_guide = (weights.quick_guide || 0) + 2;
    }
  }

  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  let random = Math.random() * totalWeight;
  for (const [format, weight] of entries) {
    random -= weight;
    if (random <= 0) return format;
  }

  return 'standard';
}

function getKeywordsForTopic(topic) {
  const topicLower = topic.toLowerCase();
  const keywords = [...config.seo.focusKeywords];

  if (topicLower.includes('guide') || topicLower.includes('how')) keywords.unshift('dabbing guide', 'how to dab');
  if (topicLower.includes('clean')) keywords.unshift('clean dab tools', 'dab maintenance');
  if (topicLower.includes('temperature') || topicLower.includes('temp')) keywords.unshift('dab temperature', 'low temp dabs');
  if (topicLower.includes('beginner')) keywords.unshift('beginner dabbing', 'first dab rig');
  if (topicLower.includes('storage') || topicLower.includes('store')) keywords.unshift('concentrate storage', 'wax storage');
  if (topicLower.includes('terpene') || topicLower.includes('terp')) keywords.unshift('terpene preservation', 'terpenes');
  if (topicLower.includes('rig') || topicLower.includes('bong')) keywords.unshift('dab rig', 'glass rig');
  if (topicLower.includes('banger') || topicLower.includes('quartz')) keywords.unshift('quartz banger', 'banger');

  return keywords.slice(0, 10);
}

function getTagsForTopic(topic, category) {
  const baseTags = ['dabbing', 'cannabis accessories'];
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('guide')) baseTags.push('guide');
  if (topicLower.includes('review')) baseTags.push('review');
  if (topicLower.includes('clean')) baseTags.push('maintenance');
  if (topicLower.includes('silicone') || topicLower.includes('pad')) baseTags.push('dab pads');
  if (topicLower.includes('beginner')) baseTags.push('beginners');
  if (topicLower.includes('vs') || topicLower.includes('comparison')) baseTags.push('comparison');
  if (topicLower.includes('rig') || topicLower.includes('bong')) baseTags.push('dab rigs');
  if (topicLower.includes('storage') || topicLower.includes('container')) baseTags.push('storage');
  if (topicLower.includes('terpene')) baseTags.push('terpenes');
  if (topicLower.includes('myth') || topicLower.includes('truth')) baseTags.push('myth busting');

  if (category) {
    const catConfig = config.contentCategories[category];
    if (catConfig) baseTags.push(catConfig.name.toLowerCase());
  }

  return [...new Set(baseTags)].slice(0, 8);
}

/**
 * Add a "Related Reading" section at the end of article content
 */
function addRelatedReadingSection(content, currentTitle, existingArticles) {
  if (!existingArticles || existingArticles.length === 0) return content;

  // Use meaningful words (4+ chars, excluding stop words)
  const stopWords = ['the', 'and', 'for', 'your', 'that', 'this', 'with', 'from', 'best', 'guide', 'complete', 'what', 'how', 'will', 'have', 'about', 'into', 'more', 'when', 'than'];
  const titleWords = currentTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
  const related = [];

  // Check if current article belongs to a topic cluster
  let currentCluster = null;
  for (const cluster of Object.values(config.seo?.topicClusters || {})) {
    const clusterKeywords = [cluster.pillar, ...(cluster.clusters || [])].map(t => t.toLowerCase());
    if (clusterKeywords.some(kw => currentTitle.toLowerCase().includes(kw.split(' ').slice(0, 3).join(' ')))) {
      currentCluster = cluster;
      break;
    }
  }

  for (const article of existingArticles) {
    if ((article.title || '').toLowerCase() === currentTitle.toLowerCase()) continue;
    if (!article.url && !article.handle) continue;

    const articleTitleLower = (article.title || '').toLowerCase();
    // Require 2+ meaningful word overlap (not just 1 random match)
    const overlap = titleWords.filter(w => articleTitleLower.includes(w)).length;

    let score = overlap;

    // Boost articles in the same topic cluster
    if (currentCluster) {
      const clusterKeywords = [currentCluster.pillar, ...(currentCluster.clusters || [])].map(t => t.toLowerCase());
      if (clusterKeywords.some(kw => articleTitleLower.includes(kw.split(' ').slice(0, 3).join(' ')))) {
        score += 3; // Strong boost for same-cluster articles
      }
    }

    if (overlap >= 2 || score >= 3) {
      const url = article.url || `https://oilslickpad.com/blogs/news/${article.handle}`;
      related.push({ title: article.title, url, score });
    }
  }

  related.sort((a, b) => b.score - a.score);
  const topRelated = related.slice(0, 3);

  if (topRelated.length < 1) return content;

  const relatedHtml = `
<div style="margin-top: 2em; padding: 1.5em; background: #f8f8f8; border-radius: 12px; text-align: left;">
<h3 style="margin-top: 0; font-size: 1.1em; text-align: left;">Related Reading</h3>
<ul style="list-style: none; padding: 0; margin: 0;">
${topRelated.map(r => `<li style="margin-bottom: 0.5em;"><a href="${r.url}" style="color: #2563eb; text-decoration: underline;">${r.title}</a></li>`).join('\n')}
</ul>
</div>`;

  return content + relatedHtml;
}

/**
 * Add a link from cluster article back to its pillar article
 */
function addClusterPillarLink(content, pillarTitle, existingArticles) {
  const pillar = existingArticles.find(a =>
    similarityScore((a.title || '').toLowerCase(), pillarTitle.toLowerCase()) > 0.4
  );

  if (!pillar) return content;

  const pillarUrl = pillar.url || `https://oilslickpad.com/blogs/news/${pillar.handle}`;

  const firstH2 = content.indexOf('<h2');
  if (firstH2 > 0) {
    const pillarCallout = `<p style="font-size: 0.95em; color: #555; margin-bottom: 1em;"><em>This article is part of our comprehensive <a href="${pillarUrl}">${pillarTitle}</a>.</em></p>\n`;
    content = content.substring(0, firstH2) + pillarCallout + content.substring(firstH2);
  }

  return content;
}

/**
 * For pillar articles: add links DOWN to existing cluster articles
 * Creates a "Topics in this guide" section before the last H2
 */
function addPillarToClusterLinks(content, currentTitle, existingArticles) {
  // Find which cluster this pillar belongs to
  let matchedCluster = null;
  for (const cluster of Object.values(config.seo?.topicClusters || {})) {
    if (similarityScore(currentTitle.toLowerCase(), cluster.pillar.toLowerCase()) > 0.4) {
      matchedCluster = cluster;
      break;
    }
  }
  if (!matchedCluster) return content;

  // Find existing cluster articles
  const clusterLinks = [];
  for (const clusterTopic of (matchedCluster.clusters || [])) {
    const match = existingArticles.find(a =>
      similarityScore((a.title || '').toLowerCase(), clusterTopic.toLowerCase()) > 0.3
    );
    if (match) {
      const url = match.url || `https://oilslickpad.com/blogs/news/${match.handle}`;
      clusterLinks.push({ title: match.title, url });
    }
  }

  if (clusterLinks.length === 0) return content;

  console.log(`Pillar article: adding ${clusterLinks.length} cluster link(s)`);

  // Build "Explore This Topic" section
  const clusterHtml = `
<div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 1.2em 1.5em; margin: 1.5em 0; text-align: left;">
<p style="font-weight: 700; margin: 0 0 0.6em 0; font-size: 16px;">Explore This Topic</p>
<ul style="margin: 0; padding-left: 1.2em; line-height: 1.8;">
${clusterLinks.map(l => `<li><a href="${l.url}" style="color: #2563eb; text-decoration: underline;">${l.title}</a></li>`).join('\n')}
</ul>
</div>`;

  // Insert before the last H2 (near end of content, before conclusion)
  const h2Positions = [];
  let searchIdx = 0;
  while (true) {
    const pos = content.indexOf('<h2', searchIdx);
    if (pos === -1) break;
    h2Positions.push(pos);
    searchIdx = pos + 1;
  }

  if (h2Positions.length >= 2) {
    // Insert before last H2
    const insertPos = h2Positions[h2Positions.length - 1];
    content = content.substring(0, insertPos) + clusterHtml + '\n' + content.substring(insertPos);
  } else {
    // Append near end
    content = content + '\n' + clusterHtml;
  }

  return content;
}

/**
 * Phase 1: Upload images to Shopify and convert markdown to HTML.
 * Preserves [IMAGE:] markers so content review doesn't break <img> tags.
 * Returns { html, uploadedImages } for Phase 2.
 */
async function uploadImagesAndConvertHtml(post, images, title, primaryKeyword = '') {
  let content = post.body;
  const successfulImages = images.filter(img => img.success && img.imageData);

  console.log('Uploading inline images to Shopify Files...');
  const uploadedImages = [];

  for (let i = 0; i < successfulImages.length; i++) {
    const img = successfulImages[i];
    const filename = generateImageFilename(img.description || title, i);

    try {
      // Build SEO-optimized alt text: include primary keyword if not already present
      let altText = img.altText || img.description || `${title} image ${i + 1}`;
      if (primaryKeyword && !altText.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        const keywordPrefix = primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1);
        altText = `${keywordPrefix} - ${altText}`;
        if (altText.length > 125) {
          altText = altText.substring(0, 122) + '...';
        }
      }
      const uploaded = await uploadImageToFiles(img.imageData, filename, altText);
      if (uploaded?.url) {
        uploadedImages.push({
          url: uploaded.url,
          altText
        });
        console.log(`  Image ${i + 1}: Uploaded to ${uploaded.url.substring(0, 50)}...`);
      }
    } catch (err) {
      console.log(`  Image ${i + 1}: Error - ${err.message}`);
    }

    if (i < successfulImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Convert markdown to HTML but keep [IMAGE:] markers intact
  content = markdownToHtml(content);
  content = content.replace(/\n{3,}/g, '\n\n');

  return { html: content, uploadedImages };
}

/**
 * Protect [IMAGE:] markers from AI reviewer corruption.
 * Replaces them with HTML comment placeholders that the reviewer ignores.
 * Also unwraps any <p> wrapper so <figure> won't end up inside <p>.
 */
function protectImageMarkers(htmlContent) {
  const markers = [];
  let index = 0;

  const content = htmlContent.replace(/(<p[^>]*>)?\s*\[IMAGE:([^\]]*)\]\s*(<\/p>)?/g, (match, pOpen, desc, pClose) => {
    markers.push(desc.trim());
    return `<!--IMG_PLACEHOLDER_${index++}-->`;
  });

  return { content, markers };
}

/**
 * Restore image placeholders and insert actual <figure><img> HTML.
 * Runs AFTER AI review so images can't be corrupted.
 * Uses clean description for figcaption, SEO text for alt attribute.
 */
function restoreAndInsertImages(htmlContent, savedMarkers, uploadedImages) {
  let content = htmlContent;

  // Replace each placeholder with the corresponding uploaded image
  for (let i = 0; i < savedMarkers.length; i++) {
    const placeholder = `<!--IMG_PLACEHOLDER_${i}-->`;

    if (i < uploadedImages.length) {
      const img = uploadedImages[i];
      // Use original description for figcaption (human-readable),
      // and SEO-optimized altText for the alt attribute
      const caption = savedMarkers[i];
      // Unwrap surrounding <p> tags if the placeholder ended up inside one
      const figureHtml = `<figure style="margin: 1.2em 0 0.6em 0; text-align: center;"><img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy"><figcaption style="font-size: 15px; line-height: 1.5; font-weight: 400; color: #666; margin-top: 0.4em; margin-bottom: 1.2em; font-style: italic;">${caption}</figcaption></figure>`;

      // If placeholder is wrapped in a <p>, replace the whole <p>
      const wrappedPattern = new RegExp(`<p[^>]*>\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`);
      if (wrappedPattern.test(content)) {
        content = content.replace(wrappedPattern, figureHtml);
      } else {
        content = content.replace(placeholder, figureHtml);
      }
    } else {
      // No image available - remove placeholder cleanly
      const wrappedPattern = new RegExp(`<p[^>]*>\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`);
      content = content.replace(wrappedPattern, '');
      content = content.replace(placeholder, '');
    }
  }

  // Clean up any leftover [IMAGE:] markers that survived (shouldn't happen, but safety net)
  content = content.replace(/\[IMAGE:[^\]]*\]/g, '');
  // Clean up any leftover placeholders
  content = content.replace(/<!--IMG_PLACEHOLDER_\d+-->/g, '');
  // Clean up empty <figure> tags the AI reviewer may have created from old markers
  content = content.replace(/<figure[^>]*>\s*(?:&lt;)?\s*<figcaption[^>]*>[^<]*<\/figcaption>\s*<\/figure>/g, '');

  return content;
}

/**
 * Fetch a blog article by its handle/slug from Shopify
 */
async function fetchArticleByHandle(handle) {
  try {
    const blog = await getOrCreateBlog('News');
    const blogId = blog.id;
    const articles = await getArticles(blogId, 50);

    const match = articles.find(a =>
      a.handle === handle || (a.handle || '').toLowerCase() === handle.toLowerCase()
    );

    if (!match) return null;

    const { default: axios } = await import('axios');
    const numericBlogId = blogId.toString().split('/').pop();
    const numericArticleId = match.id.toString().split('/').pop();

    const domain = config.shopify.storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const endpoint = `https://${domain}/admin/api/${config.shopify.apiVersion}/blogs/${numericBlogId}/articles/${numericArticleId}.json`;

    const response = await axios.get(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.shopify.adminApiToken
      },
      timeout: 15000
    });

    return response.data?.article || null;
  } catch (error) {
    console.error(`Error fetching article "${handle}":`, error.message);
    return null;
  }
}

function printGSCSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('GSC ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`GSC Connected: ${results.gscConnected ? 'Yes' : 'No'}`);
  console.log(`Trends Analyzed: ${results.trendsAnalyzed ? 'Yes' : 'No'}`);
  console.log(`Blogs Optimized: ${results.blogsOptimized}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
    results.errors.forEach(e => console.log(`  - ${e}`));
  }
}

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total blogs attempted: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  results.forEach((r, i) => {
    if (r.success) {
      console.log(`  ${i + 1}. ${r.title} - ${r.wordCount} words ${r.format ? `[${r.format}]` : ''} ${r.dryRun ? '[DRY RUN]' : ''}`);
    } else {
      console.log(`  ${i + 1}. FAILED: ${r.error}`);
    }
  });

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run
main()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
