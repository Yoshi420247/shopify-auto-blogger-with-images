/**
 * Competitor Scraper Module
 *
 * Analyzes competitor blogs and headshops to:
 * - Identify trending topics
 * - Understand market positioning
 * - Find content opportunities
 * - Learn industry language and terms
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import config from '../config.js';

/**
 * Fetch and analyze a competitor's blog
 */
export async function analyzeCompetitorBlog(blogUrl) {
  try {
    console.log(`Analyzing competitor: ${blogUrl}`);

    const response = await axios.get(blogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const articles = [];

    // Common blog article selectors
    $('article, .blog-post, .article-card, [class*="blog"], [class*="article"], .post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, [class*="title"]').first().text().trim();
      let link = $el.find('a').first().attr('href') || '';

      if (title && title.length > 10) {
        // Normalize URL
        if (link && !link.startsWith('http')) {
          const baseUrl = new URL(blogUrl).origin;
          link = `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
        }

        articles.push({
          title,
          url: link,
          source: new URL(blogUrl).hostname
        });
      }
    });

    return {
      url: blogUrl,
      articlesFound: articles.length,
      articles: articles.slice(0, 15),
      analyzedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error analyzing ${blogUrl}:`, error.message);
    return {
      url: blogUrl,
      articlesFound: 0,
      articles: [],
      error: error.message
    };
  }
}

/**
 * Analyze all configured competitors
 */
export async function analyzeAllCompetitors() {
  const results = [];

  for (const competitor of config.competitors) {
    const analysis = await analyzeCompetitorBlog(competitor);
    results.push(analysis);
    // Respectful delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Extract trending topics from competitor content
 */
export function extractTrendingTopics(competitorResults) {
  const topicFrequency = {};
  const allTitles = [];

  competitorResults.forEach(result => {
    result.articles?.forEach(article => {
      allTitles.push(article.title);

      // Extract meaningful phrases (2-3 word combinations)
      const words = article.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !commonStopWords.includes(w));

      words.forEach(word => {
        topicFrequency[word] = (topicFrequency[word] || 0) + 1;
      });
    });
  });

  // Sort by frequency
  const sortedTopics = Object.entries(topicFrequency)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([topic, count]) => ({ topic, count }));

  return {
    trendingTopics: sortedTopics,
    allTitles,
    totalArticlesAnalyzed: allTitles.length
  };
}

/**
 * Generate content ideas based on competitor analysis
 */
export function generateContentIdeas(competitorData, existingBlogAnalysis) {
  const ideas = [];
  const existingTopics = existingBlogAnalysis?.topics?.map(t => t.keyword) || [];

  // Find topics competitors cover that we don't
  competitorData.trendingTopics?.forEach(topic => {
    if (!existingTopics.includes(topic.topic)) {
      ideas.push({
        type: 'competitor_gap',
        topic: topic.topic,
        reason: `Covered by ${topic.count} competitors but not on your blog`,
        priority: topic.count >= 3 ? 'high' : 'medium'
      });
    }
  });

  // Identify update opportunities from competitor recent posts
  const recentCompetitorTitles = competitorData.allTitles?.slice(0, 20) || [];
  const updateOpportunities = [
    { pattern: /guide|how to/i, suggestion: 'Create/update comprehensive guide' },
    { pattern: /review/i, suggestion: 'Write product review content' },
    { pattern: /best|top/i, suggestion: 'Create listicle/comparison content' },
    { pattern: /2024|2025|new/i, suggestion: 'Create fresh, timely content' },
    { pattern: /vs|versus|compare/i, suggestion: 'Write comparison article' }
  ];

  recentCompetitorTitles.forEach(title => {
    updateOpportunities.forEach(opp => {
      if (opp.pattern.test(title)) {
        ideas.push({
          type: 'content_format',
          topic: title,
          suggestion: opp.suggestion,
          priority: 'medium',
          inspiration: title
        });
      }
    });
  });

  // Remove duplicates and limit
  const uniqueIdeas = ideas.reduce((acc, idea) => {
    const key = idea.topic?.toLowerCase();
    if (!acc.find(i => i.topic?.toLowerCase() === key)) {
      acc.push(idea);
    }
    return acc;
  }, []);

  return uniqueIdeas.slice(0, 20);
}

/**
 * Build industry context for content generation
 */
export function buildIndustryContext(competitorData) {
  // Extract common themes and language
  const themes = [];
  const productTypes = [];
  const brandMentions = [];

  competitorData.allTitles?.forEach(title => {
    const lower = title.toLowerCase();

    // Product categories
    const products = [
      'dab rig', 'bong', 'pipe', 'vaporizer', 'grinder', 'rolling',
      'concentrate', 'wax', 'shatter', 'rosin', 'live resin',
      'carb cap', 'banger', 'nail', 'torch', 'e-nail', 'dabber',
      'silicone', 'glass', 'titanium', 'quartz', 'ceramic'
    ];

    products.forEach(product => {
      if (lower.includes(product)) {
        productTypes.push(product);
      }
    });
  });

  // Count product mentions
  const productCounts = {};
  productTypes.forEach(p => {
    productCounts[p] = (productCounts[p] || 0) + 1;
  });

  return {
    hotProducts: Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([product, count]) => ({ product, mentions: count })),
    marketInsights: [
      'Focus on quality and durability messaging',
      'Educational content performs well',
      'Comparison content drives engagement',
      'Product care/maintenance guides are valuable'
    ]
  };
}

// Common stop words to filter out
const commonStopWords = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
  'her', 'was', 'one', 'our', 'out', 'day', 'had', 'has', 'his',
  'how', 'its', 'may', 'new', 'now', 'own', 'say', 'she', 'too',
  'use', 'way', 'who', 'oil', 'get', 'been', 'call', 'come',
  'did', 'each', 'find', 'from', 'have', 'here', 'just', 'know',
  'like', 'look', 'make', 'more', 'most', 'much', 'must', 'name',
  'need', 'only', 'other', 'over', 'part', 'some', 'than', 'them',
  'then', 'this', 'time', 'very', 'want', 'well', 'were', 'what',
  'when', 'will', 'with', 'work', 'would', 'year', 'your', 'about'
];

export default {
  analyzeCompetitorBlog,
  analyzeAllCompetitors,
  extractTrendingTopics,
  generateContentIdeas,
  buildIndustryContext
};
