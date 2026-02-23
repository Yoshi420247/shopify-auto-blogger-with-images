/**
 * Configuration for the Shopify Auto-Blogger
 * All sensitive values are loaded from environment variables
 */

export const config = {
  // Your Shopify store
  shopify: {
    storeDomain: (process.env.SHOPIFY_STORE_DOMAIN || 'oilslickpad.com').trim(),
    adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    apiVersion: '2025-04'
  },

  // AI Model Selection
  // Options: 'claude-sonnet' (default, Claude Sonnet 4.6), 'gpt-5.2' (OpenAI GPT-5.2)
  aiModel: process.env.AI_MODEL || 'claude-sonnet',

  // OpenAI Configuration (GPT-5.2 - current best model)
  // Note: GPT-5.2 with reasoning_effort does not support custom temperature
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-5.2', // GPT-5.2 - current best model
    maxOutputTokens: 8192,
    reasoningEffort: 'medium' // Options: 'none', 'low', 'medium', 'high'
  },

  // Anthropic Configuration (Claude Sonnet 4.6 - alternative model)
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6', // Claude Sonnet 4.6
    utilityModel: 'claude-haiku-4-5-20251001', // Haiku 4.5 for utility tasks (review, dedup) - saves ~40% on text costs
    maxOutputTokens: 8192
  },

  // Image Provider Selection
  // Options: 'gemini' (default, Gemini 3 Pro Image - $0.039/image),
  //          'gpt-image-1' (OpenAI gpt-image-1 High quality - $0.167/image)
  // gpt-image-1 produces higher quality images but costs ~4x more per image
  imageProvider: process.env.IMAGE_PROVIDER || 'gemini',

  // Gemini Configuration (Nano Banana Pro 3.0 for image generation)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    imageModel: 'gemini-3-pro-image-preview', // Nano Banana Pro 3.0 (Gemini 3 Pro Image)
    textModel: 'gemini-3-pro',
    imageSize: '1K', // Use 1K for faster uploads and smaller file sizes (Options: 1K, 2K, 4K)
    aspectRatio: '16:9'
  },

  // GPT Image Configuration (gpt-image-1 - premium image generation)
  gptImage: {
    model: 'gpt-image-1',
    quality: process.env.GPT_IMAGE_QUALITY || 'high', // Options: 'low', 'medium', 'high'
    size: '1536x1024', // Landscape format (closest to 16:9)
    outputFormat: 'png'
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
    contentCategory: process.env.CONTENT_CATEGORY || 'auto',

    // Content format - what structure the blog takes
    // Options: 'auto', 'standard', 'listicle', 'deep_dive', 'quick_guide', 'comparison', 'myth_busting'
    contentFormat: process.env.CONTENT_FORMAT || 'auto',

    // Update threshold - how old (in days) before a post is considered for update
    updateThresholdDays: parseInt(process.env.UPDATE_THRESHOLD_DAYS) || 180, // 6 months

    // Priority for 'auto' and 'mixed' modes (higher = more priority)
    priorities: {
      updateOutdated: 3,    // Rewriting old posts
      fillContentGaps: 2,   // Topics competitors cover that you don't
      trendingTopics: 2,    // Hot topics from competitor analysis
      gscOpportunities: 4,  // GSC-identified keyword opportunities (highest priority)
      pillarCluster: 3,     // Missing pillar/cluster articles
      freshContent: 1       // Completely new topic ideas
    },

    // Skip publishing (dry run) - useful for testing
    dryRun: process.env.DRY_RUN === 'true' || false
  },

  // ============ RUN STRATEGY ============
  // Controls what the unified auto-blogger does each run
  // Options:
  //   'gsc-analyze'    - GSC analysis + link optimization only (no new blog)
  //   'gsc-informed'   - New blog with topic picked from GSC data
  //   'category-rotate' - New blog cycling through content categories
  //   'strategic'      - Pillar/cluster content, gap fills, strike-distance targeting
  //   'full-pipeline'  - GSC analysis + link optimization + new blog
  //   'auto'           - Determine best strategy from schedule/context
  runStrategy: process.env.RUN_STRATEGY || 'auto',

  // ============ CONTENT CATEGORIES (7 categories) ============
  contentCategories: {
    // 1. Dabbing and storage focused content
    dabbing_storage: {
      name: 'Dabbing & Storage',
      vendor: null,
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

    // 2. Products with vendor tag "What You Need" (renamed to product_spotlight)
    product_spotlight: {
      name: 'Product Spotlight',
      vendor: 'What You Need',
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
    },

    // 3. Science & education content (terpenes, chemistry, materials)
    science_education: {
      name: 'Science & Education',
      vendor: null,
      topicPool: [
        'How Terpenes Affect Your Dab Experience',
        'The Chemistry Behind Live Resin Extraction',
        'Why Quartz Beats Titanium for Flavor',
        'Boiling Points of Cannabinoids Explained',
        'Medical-Grade Silicone: What Makes It Safe',
        'How Rosin Pressing Actually Works',
        'The Physics of Percolation in Water Pipes',
        'Terpene Profiles: Myrcene vs Limonene vs Pinene',
        'What Happens to Concentrates at Different Temps',
        'PTFE vs FEP vs Silicone: Materials Science for Dabbers',
        'Why Cold Start Dabbing Preserves More Terpenes',
        'Decarboxylation: The Science of Activating THC',
        'How Humidity Degrades Your Concentrates',
        'The Truth About BPA and Silicone Safety',
        'Understanding Viscosity in Different Concentrate Types',
        'Why Glass is Still King: Borosilicate Science',
        'Heat Retention: Comparing Banger Materials',
        'The Entourage Effect and Why Full Spectrum Matters',
        'How Light Exposure Damages Your Stash',
        'Water Filtration Science: What Actually Gets Filtered'
      ],
      keywords: ['terpenes', 'cannabinoids', 'science', 'extraction', 'temperature', 'chemistry', 'materials']
    },

    // 4. Culture & lifestyle content
    culture_lifestyle: {
      name: 'Culture & Lifestyle',
      vendor: null,
      topicPool: [
        'Building the Perfect Smoke Spot at Home',
        'Dab Etiquette: Unwritten Rules of the Sesh',
        'How to Host a Dab Night Done Right',
        'Stoner Organization: Keeping Your Gear in Order',
        'The Evolution of Dabbing Culture',
        'Concentrate Tourism: States Worth Visiting',
        'Gift Guide for the Dabber Who Has Everything',
        'Morning Dab Routine: Setting Up Your Day',
        'Building a Dab Collection on a Budget',
        'The Art of the Solo Session',
        'Dab Room Aesthetics: Design Ideas That Work',
        'Cannabis Accessories as Home Decor',
        'Seasonal Dabbing: How Weather Affects Your Sessions',
        'The Social Side of Concentrate Culture',
        'Minimalist Dab Setups That Actually Work',
        'How to Travel With Your Gear Safely',
        'Dab Station Upgrades Under $50',
        'The Ritual of Cleaning: Making Maintenance Enjoyable',
        'Concert and Festival Dab Kit Essentials',
        'Apartment-Friendly Dabbing Solutions'
      ],
      keywords: ['lifestyle', 'culture', 'session', 'setup', 'community', 'ritual', 'sesh']
    },

    // 5. Comparison & review content (high purchase intent)
    comparison_review: {
      name: 'Comparisons & Reviews',
      vendor: null,
      topicPool: [
        'Silicone Dab Pads vs Glass Mats: Real Comparison',
        'Puffco Peak Pro vs Carta Focus V: Which Wins?',
        'Budget Bangers vs Premium Quartz: Worth the Upgrade?',
        'Titanium vs Quartz vs Ceramic Nails Compared',
        'Mini Rig vs Full Size: Which Should You Buy?',
        'Butane Torch vs E-Nail: Pros and Cons',
        'Glass Jars vs Silicone Containers for Storage',
        'Recycler vs Straight Tube: Performance Test',
        'Terp Slurper vs Standard Banger: Side by Side',
        'Cheap vs Expensive Carb Caps: Does It Matter?',
        'Parchment Paper vs PTFE Sheets for Pressing',
        'ISO vs Specialty Cleaners: What Cleans Best',
        'Spinner Cap vs Bubble Cap vs Directional Flow',
        'Thick vs Thin Glass Bongs: What Matters More',
        'American Glass vs Import: Worth the Premium?',
        'Dry Herb Vape vs Dab Rig: Different Experiences',
        'Electric Dab Tools vs Manual: Precision Test',
        'Glob Mops vs Regular Q-Tips: The Real Difference',
        'Mylar vs Glass for Long-Term Concentrate Storage',
        'Insert vs Direct Dab: Temperature Comparison'
      ],
      keywords: ['vs', 'comparison', 'review', 'best', 'tested', 'compared', 'which is better']
    },

    // 6. Troubleshooting content (problem/solution, high search intent)
    troubleshooting: {
      name: 'Troubleshooting',
      vendor: null,
      topicPool: [
        'Why Your Dabs Taste Burnt and How to Fix It',
        'Dab Rig Not Hitting Right? Try These Fixes',
        'How to Fix a Chazzed Quartz Banger',
        'Why Your Concentrate Changed Color in Storage',
        'Fixing Airflow Issues in Your Bong',
        'Why Your Torch Keeps Going Out',
        'How to Remove Stuck Reclaim From Your Rig',
        'Why Your E-Rig Isn\'t Producing Vapor',
        'Fixing Water Level Problems in Your Piece',
        'Why Your Dabs Pop and Sizzle (and How to Stop It)',
        'How to Salvage Dried Out Concentrates',
        'Solving Joint Size Compatibility Issues',
        'Why Your Glass Piece Smells Even After Cleaning',
        'How to Fix a Loose Banger That Won\'t Stay',
        'Dealing With Silicone Taste in New Containers',
        'Why Your Dab Pad is Staining and How to Clean It',
        'Troubleshooting Your Rosin Press Results',
        'How to Fix Harsh Hits From Your Rig',
        'Why Your Carb Cap Isn\'t Working Properly',
        'Fixing Common Cold Start Dab Mistakes'
      ],
      keywords: ['fix', 'troubleshoot', 'problem', 'why', 'not working', 'how to fix', 'solution']
    },

    // 7. Industry trends & news (fresh, timely content)
    industry_trends: {
      name: 'Industry Trends',
      vendor: null,
      topicPool: [
        'What\'s New in Dab Technology This Year',
        'How Cannabis Legalization is Changing Accessories',
        'The Rise of Solventless Concentrates',
        'Smart Rigs and Connected Dabbing Tech',
        'Sustainability in Cannabis Accessories',
        'The Growing Market for Premium Glass',
        'How Dispensary Culture is Evolving',
        'New Materials Changing Dab Accessories',
        'The Portable Concentrate Revolution',
        'What Cannabis Legalization Means for Accessories',
        'Social Consumption Lounges and What They Need',
        'The Future of Electronic Dabbing',
        'Cannabis Industry Packaging Innovations',
        'Why Handmade Glass is Making a Comeback',
        'The Terpene Awareness Movement',
        'How Lab Testing Changed Concentrate Quality',
        'The Shift From Flower to Concentrates',
        'Accessory Trends From the Biggest Cannabis Expos',
        'What Gen Z is Buying in Cannabis Accessories',
        'The Impact of 710 Culture on Product Design'
      ],
      keywords: ['trends', 'industry', 'new', 'future', 'innovation', 'market', 'legalization']
    }
  },

  // ============ CONTENT FORMAT TYPES ============
  // Controls the structure and style of generated content
  contentFormats: {
    standard: {
      name: 'Standard Article',
      wordRange: [1200, 2000],
      imagesPerPost: 3,
      description: 'Comprehensive article with H2/H3 structure, 5-7 sections',
      promptInstructions: `Write a comprehensive, well-structured blog post with 5-7 major sections.
Use ## for main headings and ### for subsections. Include 2-3 callout boxes.
Target 1200-2000 words. Make each section standalone and quotable for AI search.`
    },
    listicle: {
      name: 'Listicle',
      wordRange: [1000, 1600],
      imagesPerPost: 2,
      description: 'Numbered list format: "7 Things...", "10 Best..."',
      promptInstructions: `Write a numbered list article (e.g., "7 Things...", "10 Best...").
Each list item should have:
- A bold numbered heading (## 1. Title Here)
- 100-150 words of explanation
- Specific details, not generic fluff
- At least 2 items should include a **Pro Tip:** callout
Open with a 2-3 sentence hook, close with a brief wrap-up.
Target 1000-1600 words. This format is great for skimmers.`
    },
    deep_dive: {
      name: 'Deep Dive',
      wordRange: [2000, 3000],
      imagesPerPost: 4,
      description: 'Authoritative pillar content, 2500+ words',
      promptInstructions: `Write an in-depth, authoritative pillar article. This should be the definitive resource on this topic.
Requirements:
- 2000-3000 words minimum
- 7-10 major sections with detailed subsections
- Include specific data points, temperatures, measurements, prices
- At least 5 question-based headings for FAQ schema
- 3-4 callout boxes (Pro Tip, Warning, Note)
- Include a structured comparison section where relevant
- Provide a clear table of contents style opening
- Each section should work as a standalone answer for AI search extraction
This is cornerstone content meant to establish authority.`
    },
    quick_guide: {
      name: 'Quick Guide',
      wordRange: [600, 900],
      imagesPerPost: 1,
      description: 'Focused, concise answer piece targeting featured snippets',
      promptInstructions: `Write a focused, concise quick guide. This targets featured snippets and voice search.
Requirements:
- 600-900 words only. Be tight and efficient.
- Open with a DIRECT 1-2 sentence answer to the topic question
- Use 3-4 short sections with ## headings
- Each section: 2-3 short paragraphs max
- Include one bulleted list of key takeaways
- Include one **Pro Tip:** callout
- End with a 1-2 sentence actionable conclusion
The first paragraph is the most important - it should be quotable as a featured snippet.`
    },
    comparison: {
      name: 'Head-to-Head Comparison',
      wordRange: [1200, 1800],
      imagesPerPost: 2,
      description: 'Structured X vs Y with clear winner declarations',
      promptInstructions: `Write a structured head-to-head comparison article.
Format:
- Open with a brief overview of both options (2-3 sentences)
- ## Quick Verdict (1-2 sentences declaring a winner for different use cases)
- ## [Category 1]: Compare specific aspects
- ## [Category 2]: Compare another aspect
- Continue for 5-6 comparison categories
- Each category section: state the winner clearly and why
- Use structured comparison lists (NOT tables):
  **Option A**
  - Feature: value
  - Best for: use case
  **Option B**
  - Feature: value
  - Best for: use case
- ## Final Verdict with clear recommendations based on user type
- Include **Pro Tip:** boxes for nuanced advice
Declare winners. Don't hedge everything. Readers want opinions.`
    },
    myth_busting: {
      name: 'Myth Busting',
      wordRange: [1000, 1500],
      imagesPerPost: 2,
      description: '"5 Myths About..." format, high engagement',
      promptInstructions: `Write a myth-busting article that debunks common misconceptions.
Format:
- Open with a hook about how much bad info exists on this topic
- ## Myth #1: [State the myth as people believe it]
- **The Truth:** [Direct correction in first sentence]
- Then 100-150 words explaining why the myth is wrong with specifics
- Repeat for 5-7 myths
- Close with a "What Actually Matters" section summarizing what readers should focus on
This format works because:
- People love proving they were wrong about something
- Each myth/truth pair is a perfect standalone snippet for AI search
- Question/answer format matches how people search
Be bold with the corrections. Don't soften the truth.`
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
    forceProductBlog: process.env.FORCE_PRODUCT_BLOG === 'true' || false,

    // Strike-distance thresholds for keyword targeting
    strikeDistance: {
      minPosition: 5,    // Only target keywords ranking 5th or worse
      maxPosition: 20,   // Don't bother with keywords past page 2
      minImpressions: 50, // Must have meaningful impressions
      maxCtr: 0.03       // Low CTR means room for improvement
    }
  },

  // SEO settings
  seo: {
    focusKeywords: [
      // Brand/product keywords
      'dab pad', 'oil slick pad', 'silicone dab mat', 'concentrate pad',
      'dab station', 'dabbing accessories', 'wax pad', 'dab tray',
      'silicone mat dabbing', 'cannabis accessories',
      // Dabbing educational (high-volume informational)
      'how to dab', 'dabbing guide', 'best dab temperature', 'cold start dab',
      'low temp dab', 'how to take a dab', 'dabbing for beginners',
      // Product category keywords
      'dab rig', 'quartz banger', 'carb cap', 'dab tool', 'nectar collector',
      'e-nail', 'dab torch', 'terp pearls', 'dab insert',
      // Storage & extraction
      'concentrate storage', 'how to store concentrates', 'glass jars for wax',
      'PTFE sheets', 'FEP sheets', 'parchment paper rosin', 'rosin press',
      // Cleaning & maintenance
      'how to clean dab rig', 'how to clean quartz banger', 'isopropyl cleaning',
      'reclaim dab', 'dab rig maintenance',
      // Comparisons (high intent)
      'dab rig vs bong', 'quartz vs titanium nail', 'silicone vs glass dab pad',
      'e-nail vs torch', 'live rosin vs live resin',
      // Culture & trends
      '710 meaning', 'solventless concentrates', 'hash rosin',
      'cannabis concentrate types', 'shatter vs wax vs budder'
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
      },
      'concentrate-types': {
        pillar: 'Every Type of Cannabis Concentrate Explained',
        clusters: [
          'Live Resin vs Live Rosin: What\'s the Difference',
          'Shatter vs Wax: Which is Better for Dabbing',
          'What is Budder and How Do You Dab It',
          'Solventless Concentrates: The Complete Guide',
          'Hash Rosin: Why It\'s Worth the Premium'
        ],
        keywords: ['concentrates', 'live resin', 'rosin', 'shatter', 'wax', 'budder']
      }
    }
  },

  // ============ CATEGORY ROTATION TRACKING ============
  // Cycles through categories to ensure even coverage
  categoryRotation: {
    // Order to cycle through categories (each run picks the next one)
    order: [
      'dabbing_storage',
      'science_education',
      'product_spotlight',
      'culture_lifestyle',
      'comparison_review',
      'troubleshooting',
      'industry_trends'
    ]
  },

  // ============ FORMAT ROTATION ============
  // Ensures variety in content formats
  formatRotation: {
    // Weighted distribution: standard articles are most common, but we mix in others
    weights: {
      standard: 3,      // ~30% of content
      listicle: 2,       // ~20%
      comparison: 2,     // ~20%
      myth_busting: 1,   // ~10%
      deep_dive: 1,      // ~10%
      quick_guide: 1     // ~10%
    }
  }
};

export default config;
