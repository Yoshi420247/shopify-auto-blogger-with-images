/**
 * Configuration for the Shopify Auto-Blogger
 * All sensitive values are loaded from environment variables
 */

export const config = {
  // Your Shopify store
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || 'oilslickpad.com',
    adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    apiVersion: '2024-10'
  },

  // OpenAI Configuration (GPT-5.1 - released November 2025)
  // Note: GPT-5.1 with reasoning_effort does not support custom temperature
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-5.1', // GPT-5.1 with adaptive reasoning (Nov 2025)
    maxOutputTokens: 8192,
    reasoningEffort: 'medium' // Options: 'none', 'low', 'medium', 'high'
  },

  // Gemini Configuration (Nano Banana Pro 3.0 for image generation)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    imageModel: 'gemini-3-pro-image-preview', // Nano Banana Pro 3.0 (Gemini 3 Pro Image)
    textModel: 'gemini-3-pro',
    imageSize: '2K', // Options: 1K, 2K, 4K
    aspectRatio: '16:9'
  },

  // Blog generation settings
  blog: {
    minWords: 1200,
    maxWords: 2000,
    imagesPerPost: 3,
    imageAspectRatio: '16:9',

    // ============ BEHAVIOR CONTROLS ============
    // Number of blogs to generate per run (1-10)
    blogsPerRun: parseInt(process.env.BLOGS_PER_RUN) || 1,

    // Content mode - what type of blogs to create
    // Options:
    //   'new'    - Only create fresh new blogs from research
    //   'update' - Only rewrite/update existing old blogs
    //   'mixed'  - Smart mix: prioritize updates, then create new (recommended)
    //   'auto'   - AI decides based on content analysis (default)
    mode: process.env.BLOG_MODE || 'auto',

    // Update threshold - how old (in days) before a post is considered for update
    updateThresholdDays: parseInt(process.env.UPDATE_THRESHOLD_DAYS) || 180, // 6 months

    // Priority for 'auto' and 'mixed' modes (higher = more priority)
    priorities: {
      updateOutdated: 3,    // Rewriting old posts
      fillContentGaps: 2,   // Topics competitors cover that you don't
      trendingTopics: 2,    // Hot topics from competitor analysis
      freshContent: 1       // Completely new topic ideas
    },

    // Skip publishing (dry run) - useful for testing
    dryRun: process.env.DRY_RUN === 'true' || false
  },

  // Your website and niche
  website: {
    url: 'https://oilslickpad.com',
    blogPath: '/blogs/news',
    niche: 'cannabis accessories, dab pads, oil slick pads, concentrate tools'
  },

  // Competitor websites to analyze for trends
  competitors: [
    'https://www.grasscity.com/blog',
    'https://dankgeek.com/blogs/news',
    'https://www.smokecartel.com/blogs/news',
    'https://www.hemper.co/blogs/hemper-blog',
    'https://www.dailyhighclub.com/blogs/news'
  ],

  // SEO settings
  seo: {
    focusKeywords: [
      'dab pad',
      'oil slick pad',
      'silicone dab mat',
      'concentrate pad',
      'dab station',
      'dabbing accessories',
      'wax pad',
      'dab tray',
      'silicone mat dabbing',
      'cannabis accessories'
    ],
    targetAudience: 'cannabis enthusiasts, dabbing community, concentrate users'
  }
};

export default config;
