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
    //   'dabbing_storage'   - Dabbing techniques, concentrate storage, dab station setups
    //   'glass_and_rigs'    - Bongs, dab rigs, bubblers, water pipes, glass pieces
    //   'rosin_extraction'  - Rosin pressing, PTFE/FEP/parchment for extraction, purging
    //   'rolling_culture'   - Rolling papers, cones, wraps, trays, rolling technique
    //   'packaging_supply'  - Glass jars, mylar bags, joint tubes, dispensary/B2B packaging
    //   'silicone_travel'   - Silicone pipes, bongs, bubblers, travel-friendly, unbreakable gear
    //   'accessories_tools' - Grinders, torches, dab tools, carb caps, bangers, everyday essentials
    //   'auto'              - Rotates through all categories based on day of week
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

  // Content categories - 7 distinct niches covering the full product catalog
  // The 'auto' category rotates through all of these based on day of week
  contentCategories: {
    // Category 1: Dabbing and concentrate storage
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
        'Humidity and Your Concentrates: What You Need to Know',
        'The Art of Cold Start Dabbing',
        'Maintaining Your Dab Pad: Tips and Tricks',
        'Concentrate Types Explained: Wax, Shatter, Budder, and More',
        'Why Your Dabs Taste Bad and How to Fix It',
        'The Benefits of Silicone Dab Mats',
        'Organizing Your Concentrate Collection',
        'Nonstick Containers: Glass vs Silicone for Concentrates',
        'How to Store Live Resin and Live Rosin Properly',
        'What Makes Medical-Grade Silicone Safe for Concentrates',
        'Reclaim Collection: Stop Wasting Your Concentrates',
        'Child-Resistant Concentrate Storage Explained'
      ],
      keywords: ['storage', 'dabbing', 'dab pad', 'concentrate storage', 'dab mat', 'dab station', 'oil slick', 'silicone container', 'concentrate jar']
    },

    // Category 2: Glass pieces - bongs, rigs, bubblers, water pipes
    glass_and_rigs: {
      name: 'Glass Pieces & Rigs',
      vendor: 'What You Need',
      topicPool: [
        'Choosing Your First Bong: A Complete Guide',
        'Dab Rigs vs Bongs: Understanding the Difference',
        'The Best Glass Rigs for Flavor Chasers',
        'Mini Rigs: Why Smaller Can Be Better',
        'Recycler Rigs Explained: How They Work',
        'Percolator Types: Which is Right for You?',
        'How to Season a New Glass Piece',
        'E-Rigs vs Traditional Rigs: Pros and Cons',
        'The Best Rig Sizes for Home Use',
        'Understanding Glass Thickness in Bongs',
        'Scientific Glass vs Heady Glass: What\'s the Difference?',
        'Maintaining Your Glass Collection',
        'Budget Rigs That Don\'t Compromise on Quality',
        'Bubblers: The Best of Both Worlds',
        'Why Ash Catchers Change the Game',
        'Hand Pipes: From Spoons to Sherlocks',
        'Nectar Collectors: How They Work and Why You Need One',
        'Made in USA Glass: Why It Matters',
        'Heady Glass: Art You Can Smoke From',
        'Novelty Pipes That Actually Hit Well',
        'Glass Water Pipe Maintenance: Make Your Pieces Last',
        'Incycler vs Recycler: Which Rig Style is Better?',
        'How to Choose the Right Downstem',
        'One Hitters and Chillums: The Minimalist Guide'
      ],
      keywords: ['bong', 'dab rig', 'glass rig', 'water pipe', 'bubbler', 'hand pipe', 'recycler', 'nectar collector', 'ash catcher']
    },

    // Category 3: Rosin pressing and extraction
    rosin_extraction: {
      name: 'Rosin & Extraction',
      vendor: null,
      topicPool: [
        'Rosin Pressing 101: Getting Started Without the Guesswork',
        'PTFE vs Parchment Paper for Rosin: Which Should You Use?',
        'FEP Sheets Explained: The Clear Nonstick Game Changer',
        'How Temperature Affects Your Rosin Yield',
        'The Best Nonstick Surfaces for Concentrate Extraction',
        'Choosing the Right Pressing Paper: A Material Guide',
        'How to Get the Most Yield from Your Rosin Press',
        'PTFE Sheets for Purging: Why Professionals Use Them',
        'Solventless Extraction at Home: A Practical Guide',
        'Foil-Backed Parchment Paper: When and Why to Use It',
        'The Science of Nonstick Materials in Extraction',
        'Rosin vs BHO: Why Solventless is Growing',
        'Bulk PTFE and FEP: Lab-Grade Materials for Serious Extractors',
        'How to Collect and Store Your Rosin After Pressing',
        'Ice Water Hash to Rosin: The Full Process',
        'Common Rosin Pressing Mistakes and How to Avoid Them',
        'What is Virgin PTFE and Why Does Purity Matter?',
        'Extraction Supplies Checklist: Everything You Need',
        'How to Choose the Right Micron Bag for Pressing',
        'From Flower to Concentrate: Understanding the Extraction Workflow'
      ],
      keywords: ['rosin', 'PTFE', 'FEP', 'parchment paper', 'extraction', 'pressing', 'solventless', 'nonstick sheet', 'rosin press', 'purging']
    },

    // Category 4: Rolling papers, cones, wraps, rolling culture
    rolling_culture: {
      name: 'Rolling Papers & Culture',
      vendor: null,
      topicPool: [
        'Rolling Paper Brands Compared: RAW vs Zig Zag vs Vibes vs Elements',
        'Pre-Rolled Cones: Why They Changed the Game',
        'Hemp Wraps vs Traditional Blunt Wraps: A Healthier Choice?',
        'How to Roll the Perfect Joint: Step by Step',
        'King Size vs 1 1/4: Choosing the Right Paper Size',
        'The Rise of Pink Papers: Blazy Susan and the New Wave',
        'OCB Bamboo Papers: Sustainability Meets Smoking',
        'Rolling Trays: Why a Good Surface Matters',
        'Cone Fillers and Packing Tools: Worth the Investment?',
        'Unbleached vs Bleached Rolling Papers: Does It Matter?',
        'Hemp Wick: Why Some Smokers Swear By It',
        'Filter Tips and Crutches: Getting the Perfect Draw',
        'The History of Rolling Papers: From Rice to Hemp',
        'Travel Rolling Kits: Everything You Need on the Go',
        'Organic vs Regular Rolling Papers: Taste the Difference',
        'How Rolling Paper Material Affects Your Smoke',
        'Vibes Papers: Ultra-Thin Smoking at Its Finest',
        'RAW Rolling Papers: Why They Dominate the Market',
        'Zig Zag: The Classic That Never Goes Out of Style',
        'How to Choose the Right Pre-Rolled Cone Size'
      ],
      keywords: ['rolling papers', 'cones', 'pre-rolled', 'RAW papers', 'hemp wrap', 'rolling tray', 'Zig Zag', 'Vibes', 'Blazy Susan', 'joint']
    },

    // Category 5: Cannabis packaging and dispensary supply (B2B and consumer)
    packaging_supply: {
      name: 'Packaging & Dispensary Supply',
      vendor: null,
      topicPool: [
        'Child-Resistant Packaging: What Cannabis Businesses Need to Know',
        'Glass Jars for Cannabis: Sizes, Styles, and Best Practices',
        'Mylar Bags for Cannabis: Smell-Proof Storage That Works',
        'Joint Tubes: The Simple Solution for Pre-Roll Packaging',
        'Custom Cannabis Packaging: Building Your Brand',
        'Compliance Packaging Requirements by State',
        'Choosing the Right Glass Jar Size for Your Products',
        'Why Smell-Proof Packaging Matters for Quality',
        'Dispensary Supply Essentials: A Startup Checklist',
        'Bulk Packaging Solutions for Cannabis Processors',
        'How Proper Packaging Preserves Terpenes and Potency',
        'Branded vs Blank Packaging: Making the Right Choice',
        'Exit Bags and Odor-Proof Solutions for Dispensaries',
        'Glass vs Plastic Concentrate Containers: The Quality Debate',
        'Setting Up Your Extraction Lab: Packaging Workflow',
        'Child-Resistant Glass Jars: Features That Matter',
        'How to Store Cannabis for Maximum Freshness',
        'Packaging Sustainability in the Cannabis Industry',
        'Pop-Top vs Screw-Top Containers: Pros and Cons',
        'Building a Cannabis Brand Through Packaging Design'
      ],
      keywords: ['glass jar', 'mylar bag', 'joint tube', 'cannabis packaging', 'child resistant', 'dispensary supply', 'smell proof', 'bulk packaging']
    },

    // Category 6: Silicone products and travel-friendly gear
    silicone_travel: {
      name: 'Silicone & Travel Gear',
      vendor: null,
      topicPool: [
        'Silicone Bongs: Unbreakable Doesn\'t Mean Low Quality',
        'Why Silicone Pipes are Perfect for Travel',
        'Silicone vs Glass: When Durability Beats Tradition',
        'The Best Travel-Friendly Smoking Accessories',
        'Silicone Bubblers: Water Filtration on the Go',
        'Festival and Camping Smoking Gear That Survives',
        'Silicone Nectar Collectors: Portable Dabbing Made Easy',
        'How to Clean Silicone Smoking Devices',
        'Medical-Grade Silicone: What It Means for Your Health',
        'Silicone Rigs: Concentrate on the Go',
        'Building the Perfect Travel Smoking Kit',
        'Beach-Proof Pipes: Why Glass Isn\'t Always the Answer',
        'Silicone Ashtrays: The Unbreakable Home Essential',
        'Pocket Pipes and One Hitters for Discreet Smoking',
        'Outdoor Adventures and Smoking: Gear That Keeps Up',
        'Silicone Downstems and Accessories: Mix and Match',
        'Why Silicone Spoon Pipes Are Making a Comeback',
        'The Science of Food-Grade Silicone in Smoking Devices',
        'Collapsible and Foldable Pipes: Space-Saving Innovation',
        'Indestructible Pipes That Actually Taste Good'
      ],
      keywords: ['silicone pipe', 'silicone bong', 'travel pipe', 'unbreakable', 'silicone bubbler', 'portable', 'silicone rig', 'outdoor smoking']
    },

    // Category 7: Accessories, tools, and everyday essentials
    accessories_tools: {
      name: 'Accessories & Tools',
      vendor: 'What You Need',
      topicPool: [
        'Quartz Bangers: The Ultimate Guide to Better Dabs',
        'Carb Caps Explained: Types, Materials, and Best Picks',
        'Terp Slurpers: Are They Worth the Hype?',
        'How to Choose the Right Dab Torch',
        'The Best Grinders for Every Budget',
        'Dab Tools and Dabbers: Materials and Shapes That Matter',
        'E-Nails and E-Rigs: The Electronic Dabbing Revolution',
        'Flower Bowls and Slides: Getting the Right Fit',
        'Screens, Stems, and Small Parts That Make a Big Difference',
        'How to Pick the Perfect Carb Cap for Your Banger',
        'Torch Safety: What Every Dabber Needs to Know',
        'The Best Quartz Inserts for Temperature Control',
        'Cleaning Your Quartz Banger: Keeping Flavor Pure',
        'Reclaim Catchers: Stop Wasting Concentrate',
        'Biodegradable Grinders: Eco-Friendly Meets Functional',
        'Electric Grinders: Are They Worth the Upgrade?',
        'Vaporizers and E-Rigs: Puffco, G Pen, and Lookah Compared',
        'Dab Swabs and Cleaning Accessories You Didn\'t Know You Needed',
        'Glass Pendants: Functional Art for Enthusiasts',
        'Sticker and Decal Release Paper: The Craft Supply You\'re Missing'
      ],
      keywords: ['quartz banger', 'carb cap', 'dab tool', 'torch', 'grinder', 'terp slurper', 'e-rig', 'vaporizer', 'flower bowl']
    }
  },

  // Category rotation schedule - maps day of week to categories
  // Each day runs multiple categories for variety
  // 0=Sunday, 1=Monday, ..., 6=Saturday
  categoryRotation: [
    ['dabbing_storage', 'rosin_extraction', 'rolling_culture'],      // Sunday
    ['glass_and_rigs', 'packaging_supply', 'accessories_tools'],     // Monday
    ['rosin_extraction', 'silicone_travel', 'dabbing_storage'],      // Tuesday
    ['rolling_culture', 'glass_and_rigs', 'packaging_supply'],       // Wednesday
    ['accessories_tools', 'dabbing_storage', 'silicone_travel'],     // Thursday
    ['packaging_supply', 'rosin_extraction', 'glass_and_rigs'],      // Friday
    ['silicone_travel', 'accessories_tools', 'rolling_culture']      // Saturday
  ],

  // Your website and niche
  website: {
    url: 'https://oilslickpad.com',
    blogPath: '/blogs/news',
    niche: 'cannabis accessories, smoke shop, extraction supplies, dab pads, glass rigs, rolling papers, cannabis packaging'
  },

  // Competitor websites to analyze for trends
  competitors: [
    'https://www.grasscity.com/blog',
    'https://dankgeek.com/blogs/news',
    'https://www.smokecartel.com/blogs/news',
    'https://www.hemper.co/blogs/hemper-blog',
    'https://www.dailyhighclub.com/blogs/news'
  ],

  // SEO settings - broad keywords covering all product niches
  seo: {
    focusKeywords: [
      'dab pad',
      'oil slick pad',
      'silicone dab mat',
      'cannabis accessories',
      'dab rig',
      'rosin press supplies',
      'PTFE sheets',
      'rolling papers',
      'glass jars cannabis',
      'smoke shop online',
      'concentrate storage',
      'quartz banger',
      'silicone pipe',
      'cannabis packaging',
      'extraction supplies'
    ],
    targetAudience: 'cannabis enthusiasts, dabbing community, concentrate extractors, smoke shop owners, dispensary operators, rolling culture fans'
  }
};

export default config;
