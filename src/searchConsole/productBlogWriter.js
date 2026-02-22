/**
 * Product Blog Writer
 *
 * Generates targeted blog posts for trending product and collection pages
 * identified by Google Search Console data.
 *
 * Strategy:
 * - Write 1 blog per week targeting trending product/collection pages
 * - Blog content is crafted to boost the SEO value of those pages
 * - Heavy internal linking to the trending product/collection URLs
 * - Uses the same content generation pipeline as the main auto-blogger
 *
 * The blog targets are determined by the trend analyzer, which identifies
 * product/collection pages with rising clicks, impressions, or improving position.
 */

import config from '../config.js';
import { createCompletion } from '../utils/aiClient.js';
import { withRetry } from '../utils/apiRetry.js';
import { extractHandle, extractPath } from './trendAnalyzer.js';
import { getCachedOrFetch } from '../utils/researchCache.js';

/**
 * Check if we should write a product blog this week
 * Only writes one blog per week for trending products
 *
 * @returns {boolean} - True if today is the designated day for product blogs
 */
export function shouldWriteProductBlog() {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const targetDay = parseInt(process.env.PRODUCT_BLOG_DAY) || 1; // Default: Monday
  return dayOfWeek === targetDay;
}

/**
 * Generate a blog topic targeting a specific trending product/collection page
 *
 * @param {Object} target - Target page info from identifyBlogTargets()
 * @param {Array} existingArticles - Existing blogs to avoid duplication
 * @returns {Object} - { topic, targetUrl, targetKeywords, angle }
 */
export async function generateTargetedTopic(target, existingArticles = []) {

  const humanName = target.humanName;
  const isCollection = target.type === 'collection';
  const pageType = isCollection ? 'collection' : 'product';

  const existingTitles = existingArticles
    .map(a => a.title || '')
    .filter(t => t.length > 0)
    .slice(0, 20)
    .join('\n- ');

  const prompt = `You are a content strategist for oilslickpad.com, a cannabis accessories store.

A ${pageType} page "${humanName}" is trending in Google Search Console:
- Page URL: ${target.page}
- Recent clicks: ${target.recentClicks}
- Click growth: ${(target.clicksGrowth * 100).toFixed(0)}%
- Search position: improving

I need a blog post topic that will:
1. Drive additional traffic and link equity to this ${pageType} page
2. Target long-tail keywords related to "${humanName}"
3. Provide genuine value to readers (not just an ad for the product)
4. Be different from our existing blogs

Existing blog titles to avoid overlap with:
- ${existingTitles || 'No existing blogs'}

Generate a single blog topic as JSON with this format:
{
  "topic": "The blog post title (50-60 chars, SEO-optimized)",
  "targetKeywords": ["primary keyword", "secondary keyword", "third keyword"],
  "angle": "Brief description of the content angle (1-2 sentences)",
  "linkPhrases": ["phrase 1 to link to product", "phrase 2 to link to product"],
  "contentType": "guide|review|comparison|how-to|listicle"
}

Return ONLY the JSON object, no other text.`;

  try {
    const text = await withRetry(
      () => createCompletion({
        messages: [
          { role: 'system', content: 'You are a cannabis accessories content strategist. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        maxTokens: 500,
        reasoningEffort: 'low'
      }),
      { maxRetries: 2, operationName: 'Topic generation' }
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('No valid JSON in response');

  } catch (error) {
    console.error('Error generating targeted topic:', error.message);

    // Fallback topic generation
    return {
      topic: `${humanName}: What You Need to Know`,
      targetKeywords: [humanName.toLowerCase(), `best ${humanName.toLowerCase()}`, `${humanName.toLowerCase()} guide`],
      angle: `A comprehensive guide to ${humanName.toLowerCase()} for cannabis enthusiasts`,
      linkPhrases: [humanName.toLowerCase()],
      contentType: 'guide'
    };
  }
}

/**
 * Build enhanced prompt instructions that emphasize linking to the target page
 *
 * @param {Object} target - Target page info
 * @param {Object} topicData - Generated topic data
 * @returns {string} - Additional prompt instructions
 */
export function buildTargetLinkingInstructions(target, topicData) {
  const targetUrl = target.page;
  const humanName = target.humanName;
  const linkPhrases = topicData.linkPhrases || [humanName.toLowerCase()];

  return `
CRITICAL LINKING INSTRUCTIONS:
This blog post is specifically designed to support our trending ${target.type} page: "${humanName}"
Target URL: ${targetUrl}

1. NATURALLY mention "${humanName}" 3-5 times throughout the article
2. Use these phrases to create link opportunities: ${linkPhrases.map(p => `"${p}"`).join(', ')}
3. The first mention in the body should be a contextual introduction
4. Include at least one recommendation/callout that specifically references this ${target.type}
5. In the conclusion, include a natural call-to-action pointing readers to check out the ${target.type}

DO NOT:
- Make it sound like a product advertisement
- Force mentions where they don't fit naturally
- Use "click here" or other spammy link text
- Write the link in the content (links will be injected automatically based on keyword matches)

The goal is authentic, helpful content that naturally references and supports "${humanName}" for SEO.
`;
}

/**
 * Check when the last product-targeted blog was written
 * Uses the research cache to track this
 *
 * @returns {Object|null} - Last write info or null if never written
 */
export async function getLastProductBlogDate() {
  try {
    const cached = await getCachedOrFetch('lastProductBlog', async () => {
      return { lastWritten: null };
    });
    return cached;
  } catch {
    return null;
  }
}

/**
 * Record that a product-targeted blog was written
 *
 * @param {Object} info - { topic, targetPage, publishedAt }
 */
export async function recordProductBlogWritten(info) {
  const fs = await import('fs');
  const path = await import('path');

  const cacheDir = '.cache';
  const cacheFile = path.join(cacheDir, 'lastProductBlog.json');

  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const record = {
      data: {
        lastWritten: info.publishedAt || new Date().toISOString(),
        topic: info.topic,
        targetPage: info.targetPage
      },
      timestamp: Date.now()
    };

    fs.writeFileSync(cacheFile, JSON.stringify(record, null, 2));
    console.log(`Recorded product blog write: ${info.topic}`);
  } catch (error) {
    console.warn('Could not record product blog write:', error.message);
  }
}

/**
 * Check if enough time has passed since the last product blog (weekly cadence)
 *
 * @returns {boolean} - True if it's been at least 6 days since last product blog
 */
export async function isProductBlogDue() {
  const fs = await import('fs');
  const path = await import('path');

  const cacheFile = path.join('.cache', 'lastProductBlog.json');

  try {
    if (!fs.existsSync(cacheFile)) {
      return true; // Never written, so it's due
    }

    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const lastWritten = new Date(cached.data?.lastWritten || 0);
    const daysSince = (Date.now() - lastWritten.getTime()) / (1000 * 60 * 60 * 24);

    console.log(`Last product blog: ${lastWritten.toISOString()} (${daysSince.toFixed(1)} days ago)`);

    return daysSince >= 6; // At least 6 days between product blogs
  } catch {
    return true; // If we can't read the cache, assume it's due
  }
}

export default {
  shouldWriteProductBlog,
  generateTargetedTopic,
  buildTargetLinkingInstructions,
  getLastProductBlogDate,
  recordProductBlogWritten,
  isProductBlogDue
};
