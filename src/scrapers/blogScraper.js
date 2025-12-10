/**
 * Blog Scraper Module
 *
 * Scrapes existing blog posts from oilslickpad.com to:
 * - Understand existing content
 * - Identify topics that need updates
 * - Learn the brand voice and style
 * - Avoid duplicate content
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import config from '../config.js';

/**
 * Fetch and parse the blog listing page
 */
export async function fetchBlogList() {
  try {
    const url = `${config.website.url}${config.website.blogPath}`;
    console.log(`Fetching blog list from: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const blogs = [];

    // Common Shopify blog selectors
    const selectors = [
      'article.article',
      '.blog-post',
      '.article-card',
      '.blog-article',
      '[class*="article"]',
      '[class*="blog-post"]',
      '.post-item',
      'article'
    ];

    let articles = $();
    for (const selector of selectors) {
      articles = $(selector);
      if (articles.length > 0) break;
    }

    articles.each((i, el) => {
      const $el = $(el);

      // Try multiple selectors for title
      const title = $el.find('h1, h2, h3, .article-title, .post-title, [class*="title"]').first().text().trim();

      // Try multiple selectors for link
      let link = $el.find('a').first().attr('href');
      if (link && !link.startsWith('http')) {
        link = `${config.website.url}${link}`;
      }

      // Try to get excerpt/summary
      const excerpt = $el.find('p, .excerpt, .summary, [class*="excerpt"]').first().text().trim();

      // Try to get date
      const dateText = $el.find('time, .date, [class*="date"]').first().text().trim() ||
        $el.find('time').attr('datetime');

      if (title && link) {
        blogs.push({
          title,
          url: link,
          excerpt: excerpt?.substring(0, 300),
          date: dateText,
          scrapedAt: new Date().toISOString()
        });
      }
    });

    console.log(`Found ${blogs.length} blog posts`);
    return blogs;

  } catch (error) {
    console.error('Error fetching blog list:', error.message);
    // Return empty array so the process can continue
    return [];
  }
}

/**
 * Fetch full content of a single blog post
 */
export async function fetchBlogContent(blogUrl) {
  try {
    console.log(`Fetching blog content from: ${blogUrl}`);

    const response = await axios.get(blogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);

    // Common content selectors
    const contentSelectors = [
      'article .article-content',
      '.blog-content',
      '.post-content',
      '.article-body',
      'article .content',
      '[class*="article-content"]',
      '[class*="blog-content"]',
      '.entry-content',
      'article'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const $content = $(selector);
      if ($content.length > 0) {
        content = $content.text().trim();
        if (content.length > 200) break;
      }
    }

    // Get title
    const title = $('h1').first().text().trim() ||
      $('[class*="title"]').first().text().trim();

    // Get meta description
    const metaDescription = $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') || '';

    // Get images
    const images = [];
    $('article img, .blog-content img, .article-content img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        images.push({ src, alt });
      }
    });

    // Get tags/categories
    const tags = [];
    $('[class*="tag"], [class*="category"], .blog-tags a').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag && tag.length < 50) {
        tags.push(tag);
      }
    });

    // Calculate word count
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    return {
      title,
      url: blogUrl,
      content,
      metaDescription,
      images,
      tags,
      wordCount,
      scrapedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error fetching blog content from ${blogUrl}:`, error.message);
    return null;
  }
}

/**
 * Analyze existing blogs to understand content patterns
 */
export function analyzeExistingBlogs(blogs) {
  const analysis = {
    totalPosts: blogs.length,
    topics: [],
    avgWordCount: 0,
    commonKeywords: {},
    contentGaps: [],
    outdatedPosts: []
  };

  if (blogs.length === 0) return analysis;

  // Extract topics and keywords
  let totalWords = 0;
  blogs.forEach(blog => {
    if (blog.wordCount) totalWords += blog.wordCount;

    // Extract potential keywords from title
    if (blog.title) {
      const words = blog.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      words.forEach(word => {
        analysis.commonKeywords[word] = (analysis.commonKeywords[word] || 0) + 1;
      });
    }

    // Check for outdated posts (posts older than 6 months)
    if (blog.date) {
      const postDate = new Date(blog.date);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (postDate < sixMonthsAgo) {
        analysis.outdatedPosts.push(blog);
      }
    }
  });

  analysis.avgWordCount = Math.round(totalWords / blogs.length) || 0;

  // Sort keywords by frequency
  analysis.topics = Object.entries(analysis.commonKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));

  // Identify content gaps based on common cannabis/dab industry topics
  const industryTopics = [
    'dab temperature',
    'cleaning dab tools',
    'silicone vs glass',
    'concentrate storage',
    'dab rig setup',
    'beginner guide',
    'terpene preservation',
    'carb cap guide',
    'e-nail vs torch',
    'travel dab kit'
  ];

  const existingContent = blogs.map(b => b.title?.toLowerCase() || '').join(' ');
  analysis.contentGaps = industryTopics.filter(
    topic => !existingContent.includes(topic.toLowerCase())
  );

  return analysis;
}

/**
 * Fetch all blog data including full content
 */
export async function scrapeAllBlogs(limit = 10) {
  const blogList = await fetchBlogList();
  const limitedList = blogList.slice(0, limit);

  const fullBlogs = [];
  for (const blog of limitedList) {
    const fullContent = await fetchBlogContent(blog.url);
    if (fullContent) {
      fullBlogs.push(fullContent);
    }
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    blogs: fullBlogs,
    analysis: analyzeExistingBlogs(fullBlogs)
  };
}

export default {
  fetchBlogList,
  fetchBlogContent,
  analyzeExistingBlogs,
  scrapeAllBlogs
};
