/**
 * Daily Search Console Checker
 *
 * Runs automatically each day to:
 * 1. Check Google Search Console for trending/high-performing pages
 * 2. Optimize hyperlinks in trending blog pages
 * 3. Write 1 blog per week targeting trending product/collection pages
 *
 * Entry point: `node src/searchConsoleChecker.js`
 */

import config from './config.js';
import {
  fetchComparisonData,
  testConnection as testGSCConnection,
  querySearchAnalyticsByQuery
} from './searchConsole/searchConsoleClient.js';
import {
  analyzeTrends,
  identifyBlogTargets,
  identifyBlogsForOptimization,
  printTrendReport,
  extractHandle
} from './searchConsole/trendAnalyzer.js';
import {
  optimizeBlogLinks
} from './searchConsole/blogOptimizer.js';
import {
  generateTargetedTopic,
  buildTargetLinkingInstructions,
  isProductBlogDue,
  recordProductBlogWritten
} from './searchConsole/productBlogWriter.js';
import {
  testConnection as testShopifyConnection,
  getOrCreateBlog,
  createArticle,
  updateArticle,
  getArticles,
  uploadImageToFiles,
  markdownToHtml,
  getProductsByVendor
} from './publishers/shopifyPublisher.js';
import { scrapeAllBlogs } from './scrapers/blogScraper.js';
import { generateBlogPost } from './generators/contentGenerator.js';
import { generateBlogImages } from './generators/imageGenerator.js';
import { reviewAndFixContent } from './generators/contentReviewer.js';
import { injectHyperlinks, getLinkStats } from './utils/hyperlinkInjector.js';
import { scoreContent, generateImageFilename } from './utils/seoOptimizer.js';
import { getRandomPseudonym } from './utils/authorStyles.js';
import { getCachedOrFetch } from './utils/researchCache.js';
import axios from 'axios';

/**
 * Main entry point for the daily Search Console check
 */
async function main() {
  console.log('='.repeat(60));
  console.log('DAILY SEARCH CONSOLE CHECKER');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const dryRun = process.env.DRY_RUN === 'true';
  if (dryRun) {
    console.log('[DRY RUN MODE] No changes will be published\n');
  }

  // Validate environment
  if (!validateEnvironment()) {
    process.exit(1);
  }

  const results = {
    gscConnected: false,
    trendsAnalyzed: false,
    blogsOptimized: 0,
    productBlogWritten: false,
    errors: []
  };

  try {
    // ===== STEP 1: Test connections =====
    console.log('\n--- STEP 1: Testing Connections ---');

    const gscResult = await testGSCConnection();
    if (!gscResult.success) {
      throw new Error(`Google Search Console connection failed: ${gscResult.error}`);
    }
    results.gscConnected = true;
    console.log('Google Search Console: OK');

    if (!dryRun) {
      const shopifyResult = await testShopifyConnection();
      if (!shopifyResult.success) {
        throw new Error(`Shopify connection failed: ${shopifyResult.error}`);
      }
      console.log('Shopify: OK');
    }

    // ===== STEP 2: Fetch and analyze Search Console data =====
    console.log('\n--- STEP 2: Fetching Search Console Data ---');

    const comparisonData = await fetchComparisonData(7); // Compare last 7 days vs previous 7 days
    const trends = analyzeTrends(comparisonData);
    results.trendsAnalyzed = true;

    // Print the trend report
    printTrendReport(trends);

    // ===== STEP 3: Fetch existing blog articles for context =====
    console.log('\n--- STEP 3: Gathering Blog Context ---');

    const existingBlogs = await getCachedOrFetch('existingBlogs', async () => {
      return await scrapeAllBlogs(15);
    });
    const existingArticlesList = existingBlogs?.blogs || [];
    console.log(`Found ${existingArticlesList.length} existing blog articles`);

    // ===== STEP 4: Optimize hyperlinks in trending blog pages =====
    console.log('\n--- STEP 4: Optimizing Trending Blog Hyperlinks ---');

    const blogsToOptimize = identifyBlogsForOptimization(trends, 5);
    console.log(`Found ${blogsToOptimize.length} trending blogs to optimize`);

    if (blogsToOptimize.length > 0) {
      const trendingProductPages = [
        ...trends.trendingProducts,
        ...trends.trendingCollections
      ];

      for (const blogPage of blogsToOptimize) {
        try {
          const handle = extractHandle(blogPage.page);
          console.log(`\nOptimizing: ${handle} (${blogPage.reason})`);

          // Fetch the full article content from Shopify
          const article = await fetchArticleByHandle(handle);
          if (!article) {
            console.log(`  Could not find article for handle: ${handle}`);
            continue;
          }

          // Optimize the links
          const optimResult = await optimizeBlogLinks(
            article,
            trendingProductPages,
            existingArticlesList,
            { dryRun }
          );

          if (optimResult.optimized && optimResult.updatedContent && !dryRun) {
            // Update the article in Shopify
            await updateArticle(article.id, {
              body: optimResult.updatedContent
            });
            console.log(`  Updated article in Shopify: ${article.title}`);
            results.blogsOptimized++;
          } else if (optimResult.optimized && dryRun) {
            console.log(`  [DRY RUN] Would update: ${article.title} (${optimResult.changes.length} changes)`);
            results.blogsOptimized++;
          }

          // Delay between articles
          await new Promise(r => setTimeout(r, 2000));

        } catch (error) {
          console.error(`  Error optimizing blog: ${error.message}`);
          results.errors.push(`Blog optimization: ${error.message}`);
        }
      }
    }

    // ===== STEP 5: Write product-targeted blog (weekly) =====
    console.log('\n--- STEP 5: Product-Targeted Blog Check ---');

    const productBlogDue = await isProductBlogDue();
    if (!productBlogDue) {
      console.log('Product blog not due yet (weekly cadence)');
    } else {
      const blogTargets = identifyBlogTargets(trends, existingArticlesList, 1);

      if (blogTargets.length === 0) {
        console.log('No suitable product/collection targets found for a new blog');
      } else {
        const target = blogTargets[0];
        console.log(`\nTarget: ${target.humanName} (${target.type})`);
        console.log(`  Trend: ${target.recentClicks} clicks, ${(target.clicksGrowth * 100).toFixed(0)}% growth`);

        try {
          const blogResult = await writeProductTargetedBlog(target, existingArticlesList, dryRun);
          if (blogResult.success) {
            results.productBlogWritten = true;
            console.log(`Product-targeted blog published: "${blogResult.title}"`);
          }
        } catch (error) {
          console.error(`Error writing product blog: ${error.message}`);
          results.errors.push(`Product blog: ${error.message}`);
        }
      }
    }

    // ===== SUMMARY =====
    printSummary(results);

    return { success: true, results };

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR: Search Console checker failed');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error(error.stack);

    results.errors.push(error.message);
    printSummary(results);

    return { success: false, results };
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = [
    { key: 'GOOGLE_SERVICE_ACCOUNT_JSON', value: process.env.GOOGLE_SERVICE_ACCOUNT_JSON },
    { key: 'SHOPIFY_ADMIN_API_TOKEN', value: config.shopify.adminApiToken },
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey }
  ];

  const missing = required.filter(r => !r.value);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(m => console.error(`  - ${m.key}`));
    return false;
  }

  // Gemini API key is optional for this workflow (only needed for images)
  if (!config.gemini.apiKey) {
    console.warn('GEMINI_API_KEY not set - product blog images will be skipped');
  }

  console.log('Environment validation: OK');
  return true;
}

/**
 * Fetch a blog article by its handle/slug from Shopify
 *
 * @param {string} handle - The article handle/slug
 * @returns {Object|null} - Article object with id, title, body_html, etc.
 */
async function fetchArticleByHandle(handle) {
  try {
    // First get the blog
    const blog = await getOrCreateBlog('News');
    const blogId = blog.id;

    // Fetch articles and find the matching one
    const articles = await getArticles(blogId, 50);

    const match = articles.find(a =>
      a.handle === handle || (a.handle || '').toLowerCase() === handle.toLowerCase()
    );

    if (!match) return null;

    // We need the full article with body content
    // The getArticles call may not include body, so fetch it via REST
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

/**
 * Write a blog post targeting a trending product/collection page
 * Uses the full content generation pipeline from the main auto-blogger
 */
async function writeProductTargetedBlog(target, existingArticles, dryRun) {
  // Step 1: Generate a targeted topic
  console.log('\nGenerating targeted blog topic...');
  const topicData = await generateTargetedTopic(target, existingArticles);
  console.log(`Topic: "${topicData.topic}"`);
  console.log(`Angle: ${topicData.angle}`);
  console.log(`Keywords: ${topicData.targetKeywords.join(', ')}`);

  // Step 2: Build special linking instructions for the content generator
  const linkingInstructions = buildTargetLinkingInstructions(target, topicData);

  // Step 3: Generate blog content with the extra linking instructions
  console.log('\nGenerating blog content...');
  const generatedPost = await generateBlogPost({
    topic: topicData.topic,
    targetKeywords: topicData.targetKeywords,
    industryContext: {
      hotProducts: [{ product: target.humanName }]
    },
    // Append linking instructions to the topic so the content generator sees them
    existingContent: null,
    competitorInsights: null
  });

  console.log(`Generated: "${generatedPost.title}" (${generatedPost.wordCount} words)`);

  // Step 4: Generate images (skip if dry run or no Gemini key)
  let images = [];
  if (!dryRun && config.gemini.apiKey && generatedPost.imageMarkers?.length > 0) {
    console.log('\nGenerating images...');
    images = await generateBlogImages(generatedPost.imageMarkers, generatedPost.title);
    const successful = images.filter(i => i.success);
    console.log(`Generated ${successful.length}/${images.length} images`);
  } else {
    console.log('\nSkipping image generation');
    images = (generatedPost.imageMarkers || []).map(m => ({
      success: false,
      description: m.description,
      skipped: true
    }));
  }

  // Step 5: Prepare content with images
  let finalContent = await prepareContent(generatedPost, images, generatedPost.title);

  // Step 6: AI content review
  console.log('\nReviewing content...');
  finalContent = await reviewAndFixContent(finalContent, generatedPost.title);

  // Step 7: Quality scoring
  const qualityScore = scoreContent(
    finalContent,
    topicData.targetKeywords[0] || target.humanName,
    generatedPost.title
  );
  console.log(`Quality: ${qualityScore.score}/100 (${qualityScore.grade})`);

  // Step 8: Inject hyperlinks with extra emphasis on the target page
  console.log('\nInjecting hyperlinks...');

  // First, manually add a link to the target page if not already linked
  finalContent = ensureTargetPageLinked(finalContent, target, topicData);

  // Then run the standard hyperlink injector
  finalContent = injectHyperlinks(finalContent, generatedPost.title, existingArticles);

  const linkStats = getLinkStats(finalContent);
  console.log(`Links: ${linkStats.internalLinks} internal, ${linkStats.externalLinks} external`);

  // Step 9: Publish
  if (dryRun) {
    console.log('\n[DRY RUN] Would publish:');
    console.log(`  Title: ${generatedPost.title}`);
    console.log(`  Target: ${target.humanName} (${target.page})`);
    console.log(`  Words: ${generatedPost.wordCount}`);
    console.log(`  Quality: ${qualityScore.grade}`);

    return { success: true, dryRun: true, title: generatedPost.title };
  }

  console.log('\nPublishing to Shopify...');
  const blog = await getOrCreateBlog('News');
  const authorName = getRandomPseudonym();

  const featuredImage = images.find(i => i.success && i.imageData);

  const publishedArticle = await createArticle(blog.id, {
    title: generatedPost.title,
    body: finalContent,
    metaDescription: generatedPost.metaDescription,
    author: authorName,
    tags: buildProductBlogTags(target, topicData),
    published: true,
    imageData: featuredImage?.imageData || null,
    imageAlt: featuredImage?.altText || generatedPost.title
  });

  console.log(`Published: ${publishedArticle?.id || 'Success'}`);

  // Record that we wrote a product blog
  await recordProductBlogWritten({
    topic: generatedPost.title,
    targetPage: target.page,
    publishedAt: new Date().toISOString()
  });

  return {
    success: true,
    title: generatedPost.title,
    article: publishedArticle,
    target: target.page,
    qualityScore: qualityScore.score
  };
}

/**
 * Ensure the target product/collection page is linked in the blog content
 */
function ensureTargetPageLinked(html, target, topicData) {
  // Check if the target URL is already linked
  const targetPath = extractPath(target.page);
  if (html.includes(target.page) || html.includes(targetPath)) {
    console.log('  Target page already linked');
    return html;
  }

  // Try to find a natural place to add the link using the link phrases
  const phrases = topicData.linkPhrases || [target.humanName.toLowerCase()];

  for (const phrase of phrases) {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?<![<\\/a-zA-Z"=])\\b(${escapedPhrase}s?)\\b(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
      'i'
    );

    const match = html.match(pattern);
    if (match) {
      const pos = match.index;

      // Verify not inside a tag attribute or heading
      const before = html.substring(0, pos);
      const lastAOpen = before.lastIndexOf('<a ');
      const lastAClose = before.lastIndexOf('</a>');
      if (lastAOpen > lastAClose) continue;

      // Insert the link
      const targetUrl = target.page.startsWith('http') ? target.page : `https://oilslickpad.com${target.page}`;
      const linkedText = `<a href="${targetUrl}">${match[1]}</a>`;
      html = html.substring(0, pos) + linkedText + html.substring(pos + match[1].length);
      console.log(`  Added target link: "${match[1]}" -> ${targetUrl}`);
      return html;
    }
  }

  console.log('  Could not find natural place to link target page');
  return html;
}

/**
 * Extract path from URL
 */
function extractPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Prepare content with images (mirrors the main auto-blogger pipeline)
 */
async function prepareContent(post, images, title) {
  let content = post.body;
  const successfulImages = images.filter(img => img.success && img.imageData);

  // Upload images to Shopify
  const uploadedImages = [];
  for (let i = 0; i < successfulImages.length; i++) {
    const img = successfulImages[i];
    const filename = generateImageFilename(img.description || title, i);

    try {
      const uploaded = await uploadImageToFiles(img.imageData, filename, img.altText || img.description);
      if (uploaded?.url) {
        uploadedImages.push({
          url: uploaded.url,
          altText: img.altText || img.description || `${title} image ${i + 1}`
        });
      }
    } catch (err) {
      console.log(`  Image ${i + 1} upload failed: ${err.message}`);
    }

    if (i < successfulImages.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Replace image markers
  let imageIndex = 0;
  content = content.replace(/\[IMAGE:[^\]]+\]/g, () => {
    if (imageIndex < uploadedImages.length) {
      const img = uploadedImages[imageIndex++];
      return `
<figure style="margin: 1.2em 0 0.6em 0; text-align: center;">
  <img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">
  <figcaption style="font-size: 15px; line-height: 1.5; font-weight: 400; color: #666; margin-top: 0.4em; margin-bottom: 1.2em; font-style: italic;">${img.altText}</figcaption>
</figure>
`;
    }
    return '';
  });

  // Convert markdown to HTML
  content = markdownToHtml(content);
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

/**
 * Build tags for a product-targeted blog post
 */
function buildProductBlogTags(target, topicData) {
  const tags = ['search-console-targeted', 'seo-boost'];

  if (target.type === 'product') tags.push('product-spotlight');
  if (target.type === 'collection') tags.push('collection-guide');

  // Add keywords as tags
  for (const kw of (topicData.targetKeywords || []).slice(0, 3)) {
    tags.push(kw.toLowerCase().replace(/\s+/g, '-'));
  }

  // Add content type
  if (topicData.contentType) {
    tags.push(topicData.contentType);
  }

  return [...new Set(tags)].slice(0, 8);
}

/**
 * Print execution summary
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('DAILY SEARCH CONSOLE CHECKER - SUMMARY');
  console.log('='.repeat(60));
  console.log(`GSC Connected: ${results.gscConnected ? 'Yes' : 'No'}`);
  console.log(`Trends Analyzed: ${results.trendsAnalyzed ? 'Yes' : 'No'}`);
  console.log(`Blogs Optimized: ${results.blogsOptimized}`);
  console.log(`Product Blog Written: ${results.productBlogWritten ? 'Yes' : 'No'}`);

  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

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
