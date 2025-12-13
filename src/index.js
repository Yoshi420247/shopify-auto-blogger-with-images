/**
 * Shopify Auto-Blogger with AI Images
 *
 * Main orchestrator that coordinates:
 * 1. Scraping existing blogs and competitor sites
 * 2. Generating new content with OpenAI GPT-5.1
 * 3. Creating images with Gemini Nano Banana Pro 3.0
 * 4. Publishing to Shopify
 *
 * Supports multiple blogs per run and different content modes.
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
import { getRandomPseudonym } from './utils/authorStyles.js';
import {
  testConnection,
  getOrCreateBlog,
  createArticle,
  getArticles,
  uploadImageToFiles,
  markdownToHtml
} from './publishers/shopifyPublisher.js';

/**
 * Main execution function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('SHOPIFY AUTO-BLOGGER WITH AI IMAGES');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  // Show configuration
  console.log('Configuration:');
  console.log(`  - Blogs per run: ${config.blog.blogsPerRun}`);
  console.log(`  - Mode: ${config.blog.mode}`);
  console.log(`  - Dry run: ${config.blog.dryRun}`);
  console.log(`  - Custom topic: ${process.env.CUSTOM_TOPIC || 'None'}`);
  console.log('');

  // Validate required environment variables
  if (!validateEnvironment()) {
    process.exit(1);
  }

  const results = [];
  let researchData = null;

  try {
    // Step 1: Test Shopify connection (skip if dry run)
    if (!config.blog.dryRun) {
      console.log('\n--- STEP 1: Testing Shopify Connection ---');
      const connectionTest = await testConnection();
      if (!connectionTest.success) {
        throw new Error(`Shopify connection failed: ${connectionTest.error}`);
      }
      console.log('Shopify connection: OK');
    } else {
      console.log('\n--- STEP 1: Skipping Shopify Connection (Dry Run) ---');
    }

    // Step 2: Research phase (do once for all blogs)
    console.log('\n--- STEP 2: Research Phase ---');
    researchData = await doResearch();

    // Step 3: Generate content plans
    console.log('\n--- STEP 3: Planning Content ---');
    const contentPlans = planMultipleBlogs(researchData, config.blog.blogsPerRun);
    console.log(`Planned ${contentPlans.length} blog(s) to create`);

    // Track topics used in this run to prevent duplicates
    const topicsUsedThisRun = [];

    // Step 4: Generate and publish each blog
    for (let i = 0; i < contentPlans.length; i++) {
      const plan = contentPlans[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`BLOG ${i + 1}/${contentPlans.length}: ${plan.topic}`);
      console.log(`Mode: ${plan.action} | Reason: ${plan.reason}`);
      console.log('='.repeat(60));

      try {
        // Pass topics used this run to the blog generator
        const result = await generateAndPublishBlog(plan, researchData, topicsUsedThisRun);
        results.push(result);

        // If successful, track this topic to prevent duplicates
        if (result.success && result.title) {
          topicsUsedThisRun.push({
            title: result.title,
            topic: plan.topic,
            publishedAt: new Date().toISOString()
          });
          console.log(`Tracking topic "${result.title}" to prevent duplicates`);
        }

        console.log(`Blog ${i + 1} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      } catch (blogError) {
        console.error(`Blog ${i + 1} failed:`, blogError.message);
        results.push({ success: false, error: blogError.message, plan });
      }

      // Delay between blogs to avoid rate limits
      if (i < contentPlans.length - 1) {
        console.log('\nWaiting 10 seconds before next blog...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    // Summary
    printSummary(results);

    const allSuccessful = results.every(r => r.success);
    return { success: allSuccessful, results };

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR: Auto-blogger failed');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error(error.stack);

    return { success: false, error: error.message };
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = [
    { key: 'SHOPIFY_ADMIN_API_TOKEN', value: config.shopify.adminApiToken },
    { key: 'SHOPIFY_STORE_DOMAIN', value: config.shopify.storeDomain },
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey },
    { key: 'GEMINI_API_KEY', value: config.gemini.apiKey }
  ];

  const missing = required.filter(r => !r.value);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(m => console.error(`  - ${m.key}`));
    return false;
  }

  console.log('Environment validation: OK');
  return true;
}

/**
 * Do research phase - scrape blogs and competitors
 */
async function doResearch() {
  // Analyze existing content
  console.log('Analyzing existing blogs...');
  const existingBlogs = await scrapeAllBlogs(15);
  console.log(`Found ${existingBlogs.blogs.length} existing blog posts`);

  // Analyze competitors
  console.log('Analyzing competitors...');
  const competitorData = await analyzeAllCompetitors();
  const trendingTopics = extractTrendingTopics(competitorData);
  const industryContext = buildIndustryContext(trendingTopics);
  console.log(`Analyzed ${competitorData.length} competitor sites`);
  console.log(`Found ${trendingTopics.totalArticlesAnalyzed} competitor articles`);

  // Generate content ideas
  console.log('Generating content ideas...');
  const contentIdeas = await generateTopicIdeas({
    existingBlogAnalysis: existingBlogs.analysis,
    competitorInsights: trendingTopics,
    contentGaps: existingBlogs.analysis.contentGaps
  });
  console.log(`Generated ${contentIdeas.length} content ideas`);

  return {
    existingBlogs,
    competitorData,
    trendingTopics,
    industryContext,
    contentIdeas
  };
}

/**
 * Plan multiple blogs based on mode and count
 */
function planMultipleBlogs(researchData, count) {
  const { existingBlogs, contentIdeas, trendingTopics } = researchData;
  const mode = config.blog.mode;
  const customTopic = process.env.CUSTOM_TOPIC;

  // If custom topic provided, just use that
  if (customTopic) {
    return [{
      action: 'new',
      topic: customTopic,
      reason: 'Custom topic specified'
    }];
  }

  const plans = [];
  const usedTopics = new Set();

  // Get outdated posts
  const outdatedPosts = existingBlogs.analysis.outdatedPosts || [];
  const contentGaps = existingBlogs.analysis.contentGaps || [];

  for (let i = 0; i < count; i++) {
    let plan = null;

    switch (mode) {
      case 'update':
        // Only update existing posts
        plan = getUpdatePlan(outdatedPosts, existingBlogs.blogs, usedTopics);
        break;

      case 'new':
        // Only create new posts
        plan = getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics);
        break;

      case 'mixed':
        // Alternate between updates and new
        if (i % 2 === 0 && outdatedPosts.length > 0) {
          plan = getUpdatePlan(outdatedPosts, existingBlogs.blogs, usedTopics);
        } else {
          plan = getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics);
        }
        break;

      case 'auto':
      default:
        // Prioritize based on config.blog.priorities
        plan = getAutoPlan(outdatedPosts, existingBlogs.blogs, contentIdeas, contentGaps, trendingTopics, usedTopics);
        break;
    }

    if (plan) {
      plans.push(plan);
      usedTopics.add(plan.topic.toLowerCase());
    }
  }

  // If no plans generated, add default
  if (plans.length === 0) {
    plans.push({
      action: 'new',
      topic: 'The Ultimate Guide to Choosing Your First Dab Pad',
      reason: 'Default evergreen topic'
    });
  }

  return plans;
}

/**
 * Get a plan for updating an existing post
 */
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

/**
 * Get a plan for creating new content
 */
function getNewPlan(contentIdeas, contentGaps, trendingTopics, usedTopics) {
  // Try content gaps first
  for (const gap of contentGaps) {
    if (!usedTopics.has(gap.toLowerCase())) {
      return {
        action: 'new',
        topic: gap,
        reason: 'Filling content gap'
      };
    }
  }

  // Try generated ideas
  for (const idea of contentIdeas) {
    const topic = idea.title || idea.topic;
    if (topic && !usedTopics.has(topic.toLowerCase())) {
      return {
        action: 'new',
        topic,
        reason: `Content idea: ${idea.type || 'general'}`
      };
    }
  }

  // Try trending topics
  for (const trend of trendingTopics.trendingTopics || []) {
    if (!usedTopics.has(trend.topic?.toLowerCase())) {
      return {
        action: 'new',
        topic: `Guide to ${trend.topic}`,
        reason: 'Trending topic'
      };
    }
  }

  return null;
}

/**
 * Get auto-planned content based on priorities
 */
function getAutoPlan(outdatedPosts, allBlogs, contentIdeas, contentGaps, trendingTopics, usedTopics) {
  const priorities = config.blog.priorities;

  // Build weighted options
  const options = [];

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
    options.push({
      weight: priorities.fillContentGaps,
      plan: {
        action: 'new',
        topic: gap,
        reason: 'Filling content gap'
      }
    });
  }

  // Trending topics
  const trend = (trendingTopics.trendingTopics || []).find(t => !usedTopics.has(t.topic?.toLowerCase()));
  if (trend) {
    options.push({
      weight: priorities.trendingTopics,
      plan: {
        action: 'new',
        topic: `Guide to ${trend.topic}`,
        reason: 'Trending topic'
      }
    });
  }

  // Fresh content ideas
  const idea = contentIdeas.find(i => !usedTopics.has((i.title || i.topic)?.toLowerCase()));
  if (idea) {
    options.push({
      weight: priorities.freshContent,
      plan: {
        action: 'new',
        topic: idea.title || idea.topic,
        reason: `Fresh content: ${idea.type || 'general'}`
      }
    });
  }

  // Sort by weight (highest first) and return top
  options.sort((a, b) => b.weight - a.weight);
  return options[0]?.plan || null;
}

/**
 * Generate and publish a single blog
 * @param {Object} plan - The content plan
 * @param {Object} researchData - Research data from earlier phases
 * @param {Array} topicsUsedThisRun - Topics already used in this run (to prevent duplicates)
 */
async function generateAndPublishBlog(plan, researchData, topicsUsedThisRun = []) {
  const { trendingTopics, industryContext, existingBlogs, contentIdeas } = researchData;

  // STEP 1: Check if topic was recently covered (skip for updates)
  let finalTopic = plan.topic;
  if (plan.action !== 'update') {
    console.log('\n--- Checking Topic Uniqueness ---');

    // Combine existing articles with topics used in this run
    const existingArticles = existingBlogs?.blogs || [];
    const allRecentArticles = [
      ...existingArticles,
      ...topicsUsedThisRun  // Add topics from this run
    ];

    console.log(`Checking against ${existingArticles.length} existing + ${topicsUsedThisRun.length} from this run`);

    const topicCheck = await getUniqueTopic(plan.topic, allRecentArticles, contentIdeas);

    if (topicCheck.wasChanged) {
      console.log(`Topic changed: "${plan.topic}" -> "${topicCheck.topic}"`);
      console.log(`Reason: ${topicCheck.reason}`);
      finalTopic = topicCheck.topic;
    } else {
      console.log(`Topic "${finalTopic}" is unique - proceeding`);
    }
  }

  // STEP 2: Generate content
  console.log('\n--- Generating Blog Content ---');
  let generatedPost;

  if (plan.action === 'update' && plan.existingPost) {
    generatedPost = await rewriteExistingPost(plan.existingPost, trendingTopics.allTitles);
  } else {
    generatedPost = await generateBlogPost({
      topic: finalTopic,
      targetKeywords: getKeywordsForTopic(finalTopic),
      competitorInsights: trendingTopics.allTitles,
      industryContext
    });
  }

  console.log(`Generated: "${generatedPost.title}"`);
  console.log(`Word count: ${generatedPost.wordCount}`);
  console.log(`Author style: ${generatedPost.authorStyle}`);

  // STEP 3: Generate images
  console.log('\n--- Generating Images ---');
  let images = [];
  if (generatedPost.imageMarkers && generatedPost.imageMarkers.length > 0) {
    images = await generateBlogImages(generatedPost.imageMarkers, generatedPost.title);
    const successfulImages = images.filter(i => i.success);
    console.log(`Generated ${successfulImages.length}/${images.length} images`);

    successfulImages.forEach((img, idx) => {
      console.log(`  Image ${idx + 1}: ${img.imageData ? `${Math.round(img.imageData.length / 1024)}KB` : 'NO DATA'} - ${img.model || 'unknown model'}`);
    });
  } else {
    console.log('No image markers found in content');
  }

  // STEP 4: Prepare content - upload inline images to Shopify Files and embed by URL
  let finalContent = await prepareContentWithImages(generatedPost, images, generatedPost.title);

  // STEP 5: AI Content Review - Fix formatting issues before publishing
  console.log('\n--- AI Content Review ---');
  finalContent = await reviewAndFixContent(finalContent, generatedPost.title);

  // Publish (unless dry run)
  if (config.blog.dryRun) {
    console.log('\n[DRY RUN] Skipping publish. Would have published:');
    console.log(`  Title: ${generatedPost.title}`);
    console.log(`  Words: ${generatedPost.wordCount}`);
    console.log(`  Images: ${images.filter(i => i.success).length}`);

    return {
      success: true,
      dryRun: true,
      title: generatedPost.title,
      wordCount: generatedPost.wordCount,
      images: images.filter(i => i.success).length
    };
  }

  // STEP 6: Publish to Shopify
  console.log('\n--- Publishing to Shopify ---');
  const blog = await getOrCreateBlog('News');

  // Get featured image data (first successful image)
  const featuredImage = images.find(img => img.success && img.imageData);

  // Get a random author pseudonym for this article
  const authorName = getRandomPseudonym();
  console.log(`Author byline: ${authorName}`);

  const publishedArticle = await createArticle(blog.id, {
    title: generatedPost.title,
    body: finalContent,
    metaDescription: generatedPost.metaDescription,
    author: authorName,
    tags: getTagsForTopic(finalTopic),
    published: true,
    imageData: featuredImage?.imageData || null,
    imageAlt: featuredImage?.altText || generatedPost.title
  });

  console.log(`Published: ${publishedArticle?.onlineStoreUrl || publishedArticle?.id || 'Success'}`);

  return {
    success: true,
    article: publishedArticle,
    title: generatedPost.title,
    wordCount: generatedPost.wordCount,
    images: images.filter(i => i.success).length
  };
}

/**
 * Get relevant keywords for a topic
 */
function getKeywordsForTopic(topic) {
  const topicLower = topic.toLowerCase();
  const keywords = [...config.seo.focusKeywords];

  if (topicLower.includes('guide') || topicLower.includes('how')) {
    keywords.unshift('dabbing guide', 'how to dab');
  }
  if (topicLower.includes('clean')) {
    keywords.unshift('clean dab tools', 'dab maintenance');
  }
  if (topicLower.includes('temperature') || topicLower.includes('temp')) {
    keywords.unshift('dab temperature', 'low temp dabs');
  }
  if (topicLower.includes('beginner')) {
    keywords.unshift('beginner dabbing', 'first dab rig');
  }

  return keywords.slice(0, 10);
}

/**
 * Get tags for a topic
 */
function getTagsForTopic(topic) {
  const baseTags = ['dabbing', 'cannabis accessories', 'dab pads'];
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('guide')) baseTags.push('guide', 'how-to');
  if (topicLower.includes('review')) baseTags.push('review', 'product review');
  if (topicLower.includes('clean')) baseTags.push('maintenance', 'cleaning');
  if (topicLower.includes('silicone')) baseTags.push('silicone', 'dab mat');
  if (topicLower.includes('beginner')) baseTags.push('beginners', 'getting started');

  return [...new Set(baseTags)].slice(0, 8);
}

/**
 * Prepare content - upload images, embed URLs, then convert markdown to HTML
 * First image is also used as featured image (uploaded via REST API)
 */
async function prepareContentWithImages(post, images, title) {
  // Start with raw markdown body
  let content = post.body;

  // Get successful images
  const successfulImages = images.filter(img => img.success && img.imageData);

  // Upload images to Shopify Files and get URLs
  console.log('Uploading inline images to Shopify Files...');
  const uploadedImages = [];

  for (let i = 0; i < successfulImages.length; i++) {
    const img = successfulImages[i];
    const filename = `blog-image-${Date.now()}-${i + 1}.png`;

    try {
      const uploaded = await uploadImageToFiles(img.imageData, filename, img.altText || img.description);
      if (uploaded && uploaded.url) {
        uploadedImages.push({
          url: uploaded.url,
          altText: img.altText || img.description || `${title} image ${i + 1}`
        });
        console.log(`  Image ${i + 1}: Uploaded to ${uploaded.url.substring(0, 50)}...`);
      } else {
        console.log(`  Image ${i + 1}: Upload failed, skipping`);
      }
    } catch (err) {
      console.log(`  Image ${i + 1}: Error - ${err.message}`);
    }

    // Small delay between uploads
    if (i < successfulImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Replace each [IMAGE: ...] marker with actual image HTML using URLs
  let imageIndex = 0;
  content = content.replace(/\[IMAGE:[^\]]+\]/g, (match) => {
    if (imageIndex < uploadedImages.length) {
      const img = uploadedImages[imageIndex];
      imageIndex++;

      // Create responsive image HTML with typography rules
      // Images: border-radius 12px, margin-top 1.2em, margin-bottom 0.6em
      // Captions: 15px, line-height 1.5, margin-top 0.4em, margin-bottom 1.2em
      return `
<figure style="margin: 1.2em 0 0.6em 0; text-align: center;">
  <img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">
  <figcaption style="font-size: 15px; line-height: 1.5; font-weight: 400; color: #666; margin-top: 0.4em; margin-bottom: 1.2em; font-style: italic;">${img.altText}</figcaption>
</figure>
`;
    }
    // No more images available, remove the marker
    return '';
  });

  // NOW convert markdown to HTML (images are already HTML, they'll be preserved)
  console.log('Converting markdown to HTML...');
  content = markdownToHtml(content);

  // Clean up any extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

/**
 * Print summary of all results
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total blogs attempted: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  results.forEach((r, i) => {
    if (r.success) {
      console.log(`  ${i + 1}. ${r.title} - ${r.wordCount} words, ${r.images} images ${r.dryRun ? '[DRY RUN]' : ''}`);
    } else {
      console.log(`  ${i + 1}. FAILED: ${r.error}`);
    }
  });

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run the main function
main()
  .then(result => {
    if (result.success) {
      console.log('\nExiting with success status.');
      process.exit(0);
    } else {
      console.log('\nExiting with error status.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
