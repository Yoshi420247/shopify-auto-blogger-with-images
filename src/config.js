/**
 * Configuration for the Shopify Auto-Blogger
 * All sensitive values are loaded from environment variables
 */

export const config = {
  // Your Shopify store
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || 'oilslickpad.com',
    adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    apiVersion: '2025-04'
  },

  // OpenAI Configuration (GPT-5.2 - current best model)
  // Note: GPT-5.2 with reasoning_effort does not support custom temperature
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-5.2', // GPT-5.2 - current best model
    maxOutputTokens: 8192,
    reasoningEffort: 'medium' // Options: 'none', 'low', 'medium', 'high'
  },

  // Gemini Configuration (Nano Banana Pro 3.0 for image generation)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    imageModel: 'gemini-3-pro-image-preview', // Nano Banana Pro 3.0 (Gemini 3 Pro Image)
    textModel: 'gemini-3-pro',
    imageSize: '1K', // Use 1K for faster uploads and smaller file sizes (Options: 1K, 2K, 4K)
    aspectRatio: '16:9'
  },

  // Blog generation settings
  blog: {
    minWords: 1200,
    maxWords: 2000,
    imagesPerPost: 2, // Reduced from 3 to save on Gemini API costs
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

    // Content category - which type of content to generate
    // Options:
    //   'dabbing_storage' - Focus on dabbing techniques and storage solutions (2 per day)
    //   'what_you_need'   - Focus on products with vendor tag "What You Need" like bongs, rigs (3 per day)
    //   'auto'            - Let the system decide (default)
    contentCategory: process.env.CONTENT_CATEGORY || 'auto',

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

  // Content categories - topic focus areas for different article types
  contentCategories: {
    // Dabbing and storage focused content (2 articles per day)
    dabbing_storage: {
      name: 'Dabbing & Storage',
      vendor: null, // No product vendor filtering
      topicPool: [
        'The Ultimate Guide to Storing Concentrates',
        'How to Keep Your Dabs Fresh Longer',
        'Best Storage Containers for Wax and Shatter',
        'Temperature Control: Storing Concentrates Safely',
        'Silicone vs Glass Storage: Pros and Cons',
        'Dabbing 101: A Beginner\'s Complete Guide',
        'Low Temp Dabs vs High Temp: Which is Better?',
        'How to Clean Your Dab Rig Like a Pro',
        'The Science of Terpene Preservation',
        'Setting Up the Perfect Dab Station',
        'Essential Dab Tools Every Enthusiast Needs',
        'How to Prevent Concentrate Waste',
        'Travel-Friendly Storage Solutions for Concentrates',
        'Humidity and Your Concentrates: What You Need to Know',
        'The Art of Cold Start Dabbing',
        'Maintaining Your Dab Pad: Tips and Tricks',
        'Concentrate Types Explained: Wax, Shatter, Budder, and More',
        'Why Your Dabs Taste Bad and How to Fix It',
        'The Benefits of Silicone Dab Mats',
        'Organizing Your Concentrate Collection'
      ],
      keywords: ['storage', 'dabbing', 'dab pad', 'concentrate storage', 'dab mat', 'dab station', 'oil slick']
    },

    // Products with vendor tag "What You Need" (3 articles per day)
    what_you_need: {
      name: 'Bongs, Rigs & Accessories',
      vendor: 'What You Need', // Filter products by this vendor tag
      topicPool: [
        'Choosing Your First Bong: A Complete Guide',
        'Dab Rigs vs Bongs: Understanding the Difference',
        'The Best Glass Rigs for Flavor Chasers',
        'Mini Rigs: Why Smaller Can Be Better',
        'Recycler Rigs Explained: How They Work',
        'Percolator Types: Which is Right for You?',
        'How to Season a New Glass Piece',
        'Quartz Bangers: The Ultimate Guide',
        'Carb Caps: Why You Need One',
        'E-Rigs vs Traditional Rigs: Pros and Cons',
        'The Best Rig Sizes for Home Use',
        'Travel Rigs: Portable Options That Don\'t Suck',
        'Understanding Glass Thickness in Bongs',
        'Terp Slurpers: Are They Worth the Hype?',
        'How to Choose the Right Nail for Your Rig',
        'Bong Accessories That Actually Matter',
        'Scientific Glass vs Heady Glass: What\'s the Difference?',
        'Maintaining Your Glass Collection',
        'The Rise of Puffco and Electronic Rigs',
        'Budget Rigs That Don\'t Compromise on Quality'
      ],
      keywords: ['bong', 'dab rig', 'glass rig', 'percolator', 'quartz banger', 'carb cap', 'recycler']
    }
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

  // Google Search Console settings
  searchConsole: {
    // Comparison period in days (compares recent N days vs previous N days)
    comparisonPeriodDays: 7,
    // Minimum clicks in recent period to consider a page "qualified"
    minClicksRecent: 3,
    // Minimum impressions in recent period
    minImpressionsRecent: 20,
    // Growth threshold to classify as "trending" (0.20 = 20% growth)
    growthThreshold: 0.20,
    // Maximum trending blog pages to optimize per run
    maxBlogsToOptimize: 5,
    // Day of week to write product-targeted blog (0=Sun, 1=Mon, ..., 6=Sat)
    productBlogDay: parseInt(process.env.PRODUCT_BLOG_DAY) || 1,
    // Force product blog regardless of weekly cadence
    forceProductBlog: process.env.FORCE_PRODUCT_BLOG === 'true' || false
  },

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
    targetAudience: 'cannabis enthusiasts, dabbing community, concentrate users',

    // Topic authority clusters (pillar + cluster model)
    // Each pillar topic links to its cluster articles, building topical authority
    topicClusters: {
      'dabbing-guide': {
        pillar: 'The Complete Guide to Dabbing',
        clusters: [
          'Best Dab Temperatures for Every Concentrate',
          'Cold Start Dabbing: The Complete Technique',
          'Low Temp vs High Temp Dabs',
          'How to Take Your First Dab',
          'Dabbing Safety Tips Every Beginner Needs'
        ],
        keywords: ['dabbing', 'how to dab', 'dab temperature', 'dabbing guide']
      },
      'dab-pad-guide': {
        pillar: 'Everything You Need to Know About Dab Pads',
        clusters: [
          'Silicone vs Glass Dab Mats',
          'How to Clean Your Dab Pad',
          'Best Dab Pad Materials Compared',
          'Setting Up the Perfect Dab Station',
          'Why Every Dabber Needs a Dab Mat'
        ],
        keywords: ['dab pad', 'dab mat', 'silicone mat', 'dab station']
      },
      'concentrate-storage': {
        pillar: 'The Ultimate Guide to Storing Concentrates',
        clusters: [
          'Best Containers for Wax and Shatter',
          'How Temperature Affects Your Concentrates',
          'Terpene Preservation: Keeping Flavor Fresh',
          'Silicone vs Glass Storage Containers',
          'Travel-Friendly Concentrate Storage'
        ],
        keywords: ['concentrate storage', 'wax storage', 'terpene preservation']
      },
      'dab-rig-guide': {
        pillar: 'How to Choose the Right Dab Rig',
        clusters: [
          'Mini Rigs vs Full Size: Which is Better',
          'Recycler Rigs Explained',
          'Quartz Bangers: The Complete Guide',
          'E-Rigs vs Traditional Dab Rigs',
          'Best Budget Dab Rigs That Actually Work'
        ],
        keywords: ['dab rig', 'glass rig', 'quartz banger', 'recycler rig']
      },
      'cleaning-maintenance': {
        pillar: 'How to Clean All Your Dab Gear',
        clusters: [
          'Cleaning Your Dab Rig Step by Step',
          'Best Way to Clean Quartz Bangers',
          'How to Reclaim Concentrate from Your Rig',
          'Dab Tool Maintenance Tips',
          'When to Replace Your Dab Accessories'
        ],
        keywords: ['clean dab rig', 'clean banger', 'dab maintenance']
      }
    }
  }
};

export default config;
