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
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-5.1', // GPT-5.1 with adaptive reasoning (Nov 2025)
    maxOutputTokens: 8192,
    temperature: 0.8, // Higher for more creative, human-like output
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
    imageAspectRatio: '16:9'
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
