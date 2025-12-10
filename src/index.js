/**
 * Shopify Auto-Blogger with AI Images
 *
 * Main orchestrator that coordinates:
 * 1. Scraping existing blogs and competitor sites
 * 2. Generating new content with OpenAI GPT-4o
 * 3. Creating images with Gemini Nano Banana Pro
 * 4. Publishing to Shopify
 *
 * Designed to run as a GitHub Action on a schedule.
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
  testConnection,
  getOrCreateBlog,
  createArticle,
  getArticles
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

  // Validate required environment variables
  if (!validateEnvironment()) {
    process.exit(1);
  }

  try {
    // Step 1: Test Shopify connection
    console.log('\n--- STEP 1: Testing Shopify Connection ---');
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(`Shopify connection failed: ${connectionTest.error}`);
    }
    console.log('Shopify connection: OK');

    // Step 2: Analyze existing content
    console.log('\n--- STEP 2: Analyzing Existing Content ---');
    const existingBlogs = await scrapeAllBlogs(10);
    console.log(`Found ${existingBlogs.blogs.length} existing blog posts`);
    console.log(`Analysis: ${JSON.stringify(existingBlogs.analysis, null, 2)}`);

    // Step 3: Analyze competitors
    console.log('\n--- STEP 3: Analyzing Competitors ---');
    const competitorData = await analyzeAllCompetitors();
    const trendingTopics = extractTrendingTopics(competitorData);
    const industryContext = buildIndustryContext(trendingTopics);
    console.log(`Analyzed ${competitorData.length} competitor sites`);
    console.log(`Found ${trendingTopics.totalArticlesAnalyzed} competitor articles`);
    console.log(`Top trending topics: ${trendingTopics.trendingTopics.slice(0, 5).map(t => t.topic).join(', ')}`);

    // Step 4: Generate content ideas
    console.log('\n--- STEP 4: Generating Content Ideas ---');
    const contentIdeas = await generateTopicIdeas({
      existingBlogAnalysis: existingBlogs.analysis,
      competitorInsights: trendingTopics,
      contentGaps: existingBlogs.analysis.contentGaps
    });
    console.log(`Generated ${contentIdeas.length} content ideas`);

    // Step 5: Decide what to create
    console.log('\n--- STEP 5: Determining Content to Create ---');
    const contentPlan = planContent(existingBlogs, contentIdeas);
    console.log(`Plan: ${contentPlan.action}`);
    console.log(`Topic: ${contentPlan.topic}`);

    // Step 6: Generate the blog post
    console.log('\n--- STEP 6: Generating Blog Content ---');
    let generatedPost;

    if (contentPlan.action === 'update') {
      console.log('Rewriting existing post...');
      generatedPost = await rewriteExistingPost(
        contentPlan.existingPost,
        trendingTopics.allTitles
      );
    } else {
      console.log('Creating new post...');
      generatedPost = await generateBlogPost({
        topic: contentPlan.topic,
        targetKeywords: getKeywordsForTopic(contentPlan.topic),
        competitorInsights: trendingTopics.allTitles,
        industryContext
      });
    }

    console.log(`Generated post: "${generatedPost.title}"`);
    console.log(`Word count: ${generatedPost.wordCount}`);
    console.log(`Author style: ${generatedPost.authorStyle}`);
    console.log(`SEO audit: ${JSON.stringify(generatedPost.seoAudit)}`);

    // Step 7: Generate images
    console.log('\n--- STEP 7: Generating Images ---');
    let images = [];
    if (generatedPost.imageMarkers && generatedPost.imageMarkers.length > 0) {
      images = await generateBlogImages(generatedPost.imageMarkers, generatedPost.title);
      console.log(`Generated ${images.filter(i => i.success).length}/${images.length} images`);
    } else {
      console.log('No image markers found in content');
    }

    // Step 8: Prepare content with images
    console.log('\n--- STEP 8: Preparing Final Content ---');
    const finalContent = prepareContentWithImages(generatedPost, images);

    // Step 9: Publish to Shopify
    console.log('\n--- STEP 9: Publishing to Shopify ---');
    const blog = await getOrCreateBlog('News');
    console.log(`Publishing to blog: ${blog.title || blog.handle}`);

    const publishedArticle = await createArticle(blog.id, {
      title: generatedPost.title,
      body: finalContent,
      metaDescription: generatedPost.metaDescription,
      author: 'Oil Slick Pad',
      tags: getTagsForTopic(contentPlan.topic),
      published: true,
      imageUrl: images[0]?.success ? imageToDataUrl(images[0]) : null,
      imageAlt: images[0]?.altText || generatedPost.title
    });

    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS! Blog post published.');
    console.log('='.repeat(60));
    console.log(`Title: ${publishedArticle?.title || generatedPost.title}`);
    console.log(`URL: ${publishedArticle?.onlineStoreUrl || 'Check your Shopify admin'}`);
    console.log(`Article ID: ${publishedArticle?.id}`);
    console.log(`Completed at: ${new Date().toISOString()}`);

    return {
      success: true,
      article: publishedArticle,
      stats: {
        wordCount: generatedPost.wordCount,
        imagesGenerated: images.filter(i => i.success).length,
        competitorsAnalyzed: competitorData.length,
        topicSource: contentPlan.action
      }
    };

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR: Auto-blogger failed');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error(error.stack);

    return {
      success: false,
      error: error.message
    };
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
 * Plan what content to create based on analysis
 */
function planContent(existingBlogs, contentIdeas) {
  // Priority 1: Update outdated posts (older than 6 months)
  const outdatedPosts = existingBlogs.analysis.outdatedPosts || [];
  if (outdatedPosts.length > 0) {
    const postToUpdate = outdatedPosts[Math.floor(Math.random() * outdatedPosts.length)];
    return {
      action: 'update',
      topic: postToUpdate.title,
      existingPost: existingBlogs.blogs.find(b => b.title === postToUpdate.title) || postToUpdate,
      reason: 'Updating outdated content'
    };
  }

  // Priority 2: Fill content gaps
  const contentGaps = existingBlogs.analysis.contentGaps || [];
  if (contentGaps.length > 0) {
    return {
      action: 'new',
      topic: contentGaps[0],
      reason: 'Filling content gap'
    };
  }

  // Priority 3: Create from generated ideas
  if (contentIdeas.length > 0) {
    const idea = contentIdeas[0];
    return {
      action: 'new',
      topic: idea.title || idea.topic,
      reason: `New content idea: ${idea.type || 'general'}`
    };
  }

  // Fallback: Default topic
  return {
    action: 'new',
    topic: 'The Ultimate Guide to Choosing Your First Dab Pad',
    reason: 'Default evergreen topic'
  };
}

/**
 * Get relevant keywords for a topic
 */
function getKeywordsForTopic(topic) {
  const topicLower = topic.toLowerCase();
  const keywords = [...config.seo.focusKeywords];

  // Add topic-specific keywords
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
 * Prepare content with embedded images
 */
function prepareContentWithImages(post, images) {
  let content = post.body;

  // Replace image markers with actual images or placeholders
  images.forEach((img, index) => {
    const marker = img.originalMarker;
    if (marker && content.includes(marker)) {
      if (img.success && img.imageData) {
        const dataUrl = imageToDataUrl(img);
        const imgHtml = `<figure class="blog-image">
  <img src="${dataUrl}" alt="${img.altText}" loading="lazy" />
  <figcaption>${img.description}</figcaption>
</figure>`;
        content = content.replace(marker, imgHtml);
      } else {
        // Use placeholder for failed images
        content = content.replace(marker, `<!-- Image placeholder: ${img.description} -->`);
      }
    }
  });

  // Remove any remaining image markers
  content = content.replace(/\[IMAGE:[^\]]+\]/g, '');

  return content;
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
