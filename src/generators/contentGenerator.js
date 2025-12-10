/**
 * Content Generator Module
 *
 * Uses OpenAI GPT-5.1 (November 2025) to generate human-like blog content
 * with emphasis on avoiding AI tells and mimicking author styles.
 *
 * GPT-5.1 features:
 * - Adaptive reasoning with configurable effort levels
 * - Extended 24-hour prompt caching
 * - Improved agentic and coding capabilities
 */

import OpenAI from 'openai';
import config from '../config.js';
import { selectAuthorStyle, aiTellsToAvoid, naturalTransitions } from '../utils/authorStyles.js';
import { getSeoPromptInstructions, auditContent } from '../utils/seoOptimizer.js';

// Initialize OpenAI client
let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  return openai;
}

/**
 * Generate a complete blog post
 */
export async function generateBlogPost(options) {
  const {
    topic,
    targetKeywords = config.seo.focusKeywords,
    existingContent = null,
    competitorInsights = null,
    industryContext = null
  } = options;

  console.log(`Generating blog post for topic: ${topic}`);

  // Select appropriate author style
  const authorStyle = selectAuthorStyle(topic);
  console.log(`Using author style: ${authorStyle.author}`);

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(authorStyle);

  // Build the user prompt
  const userPrompt = buildUserPrompt({
    topic,
    targetKeywords,
    existingContent,
    competitorInsights,
    industryContext,
    authorStyle
  });

  try {
    const client = getOpenAI();

    // GPT-5.1 API call with adaptive reasoning
    // Note: GPT-5.1 with reasoning_effort does not support custom temperature
    const response = await client.chat.completions.create({
      model: config.openai.model, // gpt-5.1
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: config.openai.maxOutputTokens,
      // GPT-5.1 specific: reasoning effort controls how much "thinking" the model does
      // 'none' = fast responses, 'low'/'medium'/'high' = more reasoning
      reasoning_effort: config.openai.reasoningEffort || 'medium'
    });

    const rawContent = response.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('No content generated');
    }

    // Post-process to remove any AI tells
    const cleanedContent = removeAiTells(rawContent);

    // Parse the response into structured format
    const parsedPost = parseGeneratedContent(cleanedContent);

    // Audit for SEO
    const seoAudit = auditContent(parsedPost.body, targetKeywords[0]);

    return {
      ...parsedPost,
      authorStyle: authorStyle.author,
      seoAudit,
      generatedAt: new Date().toISOString(),
      model: config.openai.model
    };

  } catch (error) {
    console.error('Error generating content:', error.message);
    throw error;
  }
}

/**
 * Build the system prompt for human-like content generation
 */
function buildSystemPrompt(authorStyle) {
  return `You are a professional blog writer for a cannabis accessories company called Oil Slick Pad. You specialize in writing about dab pads, concentrate tools, and the dabbing community.

YOUR WRITING IDENTITY:
You write in the style of ${authorStyle.author}.
${authorStyle.description}

STYLE GUIDELINES:
${authorStyle.styleNotes}

CRITICAL RULES - YOUR CONTENT MUST:
1. Sound like a real human wrote it, not AI
2. NEVER use em dashes (—) or en dashes (–). Use commas, periods, or rewrite sentences instead
3. NEVER use these AI-tell phrases: ${authorStyle.avoidPatterns.slice(0, 10).join(', ')}
4. Use contractions naturally (don't, won't, can't, it's)
5. Include occasional sentence fragments. Like this.
6. Vary sentence length dramatically
7. Start some sentences with "And" or "But"
8. Use first-person perspective when sharing experiences
9. Include specific, concrete details (brand names, measurements, prices when relevant)
10. Express genuine opinions - don't hedge everything
11. Be occasionally irreverent or use mild humor

CONTENT STRUCTURE:
- Write at least 1200 words, target 1500-1800
- Use H2 (##) and H3 (###) headings to break up content
- Keep paragraphs short (2-4 sentences max for readability)
- Include a compelling introduction that hooks the reader
- End with a genuine conclusion, NOT a formulaic summary

FORMATTING:
- Output in clean Markdown format
- Start with a suggested title on the first line (just the title, no "Title:" prefix)
- Include a suggested meta description on the second line (just the description, no prefix)
- Then blank line, then the article content
- Mark suggested image placements with: [IMAGE: description of what image should show]

You are writing for real people who know their stuff. Don't talk down to them, but do explain technical concepts when needed.`;
}

/**
 * Build the user prompt with context
 */
function buildUserPrompt(options) {
  const {
    topic,
    targetKeywords,
    existingContent,
    competitorInsights,
    industryContext,
    authorStyle
  } = options;

  let prompt = `Write a comprehensive, engaging blog post about: "${topic}"

TARGET AUDIENCE: Cannabis enthusiasts, concentrate users, and dabbing community members who shop at oilslickpad.com

PRIMARY FOCUS: This should feel like advice from a knowledgeable friend, not a corporate blog post.

`;

  // Add existing content context if updating
  if (existingContent) {
    prompt += `
EXISTING CONTENT TO UPDATE/IMPROVE:
This is a refresh of an existing blog post. Here's what the old post covered:
"${existingContent.substring(0, 1500)}..."

Your job is to write a COMPLETELY NEW VERSION that:
- Updates any outdated information
- Adds fresh perspectives and insights
- Improves on the original while keeping what worked
- Makes it more engaging and useful

`;
  }

  // Add competitor insights
  if (competitorInsights) {
    prompt += `
COMPETITOR LANDSCAPE:
Competitors are writing about these related topics:
${competitorInsights.slice(0, 5).map(i => `- ${i.title || i.topic}`).join('\n')}

Differentiate by offering unique perspectives or deeper insights.

`;
  }

  // Add industry context
  if (industryContext?.hotProducts) {
    prompt += `
TRENDING PRODUCTS/TOPICS IN THE INDUSTRY:
${industryContext.hotProducts.slice(0, 8).map(p => `- ${p.product}`).join('\n')}

Reference these naturally where relevant to stay current.

`;
  }

  // Add SEO requirements
  prompt += getSeoPromptInstructions(targetKeywords);

  // Add natural transitions to use
  prompt += `

USE NATURAL TRANSITIONS like these instead of AI-sounding ones:
${naturalTransitions.slice(0, 10).join(', ')}

`;

  // Add final reminders
  prompt += `
FINAL REMINDERS:
- Write ${config.blog.minWords}+ words
- Include 3 [IMAGE: ...] markers where images would enhance the content
- Sound like ${authorStyle.author}, not like AI
- Make it genuinely useful and interesting
- Include specific recommendations and opinions
- No em dashes (—), no en dashes (–)
- Don't start the article with a question

Now write the blog post:`;

  return prompt;
}

/**
 * Remove AI tells from generated content
 */
function removeAiTells(content) {
  let cleaned = content;

  // Remove em dashes and en dashes
  cleaned = cleaned.replace(/—/g, ',');
  cleaned = cleaned.replace(/–/g, ',');

  // Remove AI tell phrases
  aiTellsToAvoid.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Clean up any double spaces or punctuation issues
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.replace(/\s+\./g, '.');
  cleaned = cleaned.replace(/\s+,/g, ',');

  // Fix paragraph spacing
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Parse generated content into structured format
 */
function parseGeneratedContent(content) {
  const lines = content.split('\n').filter(l => l.trim());

  // First non-empty line should be title
  let title = lines[0]?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();

  // Second line should be meta description
  let metaDescription = lines[1]?.trim();

  // Check if meta description looks like content (too long or has heading markers)
  if (metaDescription?.length > 200 || metaDescription?.startsWith('#')) {
    metaDescription = title.substring(0, 150) + '...';
  }

  // Rest is the body
  const bodyStartIndex = metaDescription && metaDescription.length < 200 ? 2 : 1;
  const body = lines.slice(bodyStartIndex).join('\n\n');

  // Extract image markers
  const imageMarkers = [];
  const imageRegex = /\[IMAGE:\s*([^\]]+)\]/gi;
  let match;
  while ((match = imageRegex.exec(body)) !== null) {
    imageMarkers.push({
      marker: match[0],
      description: match[1].trim()
    });
  }

  // Calculate word count
  const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;

  return {
    title,
    metaDescription,
    body,
    imageMarkers,
    wordCount
  };
}

/**
 * Generate blog topic ideas based on analysis
 */
export async function generateTopicIdeas(analysisData) {
  const {
    existingBlogAnalysis,
    competitorInsights,
    contentGaps
  } = analysisData;

  const client = getOpenAI();

  const prompt = `Based on this market analysis for a cannabis accessories blog (oilslickpad.com, specializing in dab pads and concentrate tools), generate 10 unique blog post ideas.

EXISTING BLOG TOPICS COVERED:
${existingBlogAnalysis?.topics?.slice(0, 10).map(t => t.keyword).join(', ') || 'Limited existing content'}

COMPETITOR TRENDING TOPICS:
${competitorInsights?.trendingTopics?.slice(0, 15).map(t => t.topic).join(', ') || 'General cannabis accessories content'}

CONTENT GAPS IDENTIFIED:
${contentGaps?.join(', ') || 'Multiple areas need coverage'}

Generate 10 blog post ideas that would:
1. Fill content gaps
2. Compete with trending competitor topics
3. Appeal to the dabbing/concentrate community
4. Be SEO-friendly
5. Provide genuine value

For each idea, provide:
- Title (compelling, not clickbait)
- Primary keyword target
- Brief description (1-2 sentences)
- Content type (guide, review, comparison, culture piece, etc.)

Format as JSON array.`;

  try {
    // GPT-5.1 with lower reasoning effort for faster topic generation
    // Note: GPT-5.1 with reasoning_effort does not support custom temperature
    const response = await client.chat.completions.create({
      model: config.openai.model, // gpt-5.1
      messages: [
        {
          role: 'system',
          content: 'You are a content strategist specializing in cannabis accessories marketing. Return only valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
      reasoning_effort: 'low' // Fast mode for simple task
    });

    const responseText = response.choices[0]?.message?.content;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback parsing
    return JSON.parse(responseText);

  } catch (error) {
    console.error('Error generating topic ideas:', error.message);

    // Return default ideas on error
    return getDefaultTopicIdeas();
  }
}

/**
 * Default topic ideas fallback
 */
function getDefaultTopicIdeas() {
  return [
    {
      title: 'The Ultimate Guide to Choosing Your First Dab Pad',
      keyword: 'dab pad guide',
      description: 'Comprehensive beginner guide covering materials, sizes, and what to look for.',
      type: 'guide'
    },
    {
      title: 'Silicone vs. Glass Dab Mats: The Real Differences',
      keyword: 'silicone dab mat',
      description: 'Honest comparison of materials with pros and cons for different use cases.',
      type: 'comparison'
    },
    {
      title: 'How to Set Up the Perfect Dab Station',
      keyword: 'dab station setup',
      description: 'Step-by-step guide to organizing an efficient and safe dabbing workspace.',
      type: 'guide'
    },
    {
      title: 'Cleaning and Maintaining Your Dab Accessories',
      keyword: 'clean dab tools',
      description: 'Practical guide to keeping concentrate tools in top condition.',
      type: 'guide'
    },
    {
      title: 'Low Temp vs High Temp Dabbing: Finding Your Sweet Spot',
      keyword: 'dab temperature guide',
      description: 'Science and practical advice on temperature and its effects.',
      type: 'guide'
    }
  ];
}

/**
 * Rewrite/update an existing blog post
 */
export async function rewriteExistingPost(existingPost, competitorContext = null) {
  return generateBlogPost({
    topic: existingPost.title,
    existingContent: existingPost.content,
    competitorInsights: competitorContext,
    targetKeywords: config.seo.focusKeywords
  });
}

export default {
  generateBlogPost,
  generateTopicIdeas,
  rewriteExistingPost
};
