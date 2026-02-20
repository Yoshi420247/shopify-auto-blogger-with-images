/**
 * Content Generator Module
 *
 * Uses OpenAI GPT-5.2 (current best model) to generate human-like blog content
 * with emphasis on avoiding AI tells and mimicking author styles.
 *
 * GPT-5.2 features:
 * - Adaptive reasoning with configurable effort levels
 * - Extended prompt caching
 * - Improved content generation and reasoning
 */

import OpenAI from 'openai';
import config from '../config.js';
import { selectAuthorStyle, aiTellsToAvoid, naturalTransitions } from '../utils/authorStyles.js';
import { getSeoPromptInstructions, auditContent, expandKeywords } from '../utils/seoOptimizer.js';
import { withRetry } from '../utils/apiRetry.js';

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

    // GPT-5.2 API call with adaptive reasoning and retry logic
    const response = await withRetry(
      () => client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: config.openai.maxOutputTokens,
        reasoning_effort: config.openai.reasoningEffort || 'medium'
      }),
      { maxRetries: 3, operationName: 'Content generation' }
    );

    const rawContent = response.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('No content generated');
    }

    // Post-process to remove any AI tells
    const cleanedContent = removeAiTells(rawContent);

    // Parse the response into structured format
    const parsedPost = parseGeneratedContent(cleanedContent);

    // Fix any incorrect years in the title specifically
    if (parsedPost.title) {
      parsedPost.title = fixTitleYear(parsedPost.title);
    }

    // Ensure we have a valid title - fallback to topic if parsing failed
    if (!parsedPost.title || parsedPost.title.trim() === '') {
      console.log('Warning: Title extraction failed, using topic as fallback');
      parsedPost.title = createTitleFromTopic(topic);
    }

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
 * Get current date info for content generation
 */
function getCurrentDateInfo() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.toLocaleString('en-US', { month: 'long' }),
    monthShort: now.toLocaleString('en-US', { month: 'short' }),
    day: now.getDate(),
    fullDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  };
}

/**
 * Build the system prompt for human-like content generation
 */
function buildSystemPrompt(authorStyle) {
  const dateInfo = getCurrentDateInfo();

  return `You are a professional blog writer for a cannabis accessories company called Oil Slick Pad. You specialize in writing about dab pads, concentrate tools, and the dabbing community.

CURRENT DATE INFORMATION (VERY IMPORTANT):
- Today's date: ${dateInfo.fullDate}
- Current year: ${dateInfo.year}
- Current month: ${dateInfo.month}
- ALWAYS use ${dateInfo.year} when referring to "this year", "best of [year]", "guide for [year]", etc.
- NEVER use outdated years like 2024, 2023, etc. unless specifically discussing historical data
- If writing "Best X of [year]" or "[year] Guide", ALWAYS use ${dateInfo.year}

YOUR WRITING IDENTITY:
You write in the style of ${authorStyle.author}.
${authorStyle.description}

STYLE GUIDELINES:
${authorStyle.styleNotes}

CRITICAL RULES - YOUR CONTENT MUST:
1. Sound like a real human wrote it, not AI
2. NEVER use em dashes (—) or en dashes (–). Use commas, periods, or rewrite sentences instead
3. NEVER use these AI-tell phrases: ${aiTellsToAvoid.slice(0, 15).join(', ')}
4. Use contractions naturally (don't, won't, can't, it's)
5. Include occasional sentence fragments. Like this.
6. Vary sentence length dramatically
7. Start some sentences with "And" or "But"
8. Use first-person perspective when sharing experiences
9. Include specific, concrete details (brand names, measurements, prices when relevant)
10. Express genuine opinions - don't hedge everything
11. Be occasionally irreverent or use mild humor

VENDOR/SUPPLIER BRAND RULES (VERY IMPORTANT):
- NEVER mention vendor or supplier brand names like "What You Need" in articles
- Focus on the PRODUCTS (bongs, rigs, bangers, etc.) not the supplier
- Write about the product category and features, not where they come from
- Only mention Oil Slick Pad as the store/brand, never our suppliers

HUMANIZATION RULES - AVOID AI WRITING PATTERNS:
These patterns scream "AI-generated" and must be avoided:

1. NEVER use inflated significance language:
   - BAD: "stands as a testament to", "pivotal moment", "marks a shift", "evolving landscape"
   - GOOD: Just state the facts directly

2. NEVER use superficial -ing analyses:
   - BAD: "highlighting the importance", "showcasing the benefits", "emphasizing the need"
   - GOOD: Just make your point

3. NEVER use promotional/advertisement language:
   - BAD: "boasts", "nestled", "vibrant", "breathtaking", "stunning", "renowned"
   - GOOD: Use specific, concrete descriptions

4. NEVER use vague attributions:
   - BAD: "Experts say", "Industry reports suggest", "Some argue"
   - GOOD: Either cite a specific source or state it as your opinion

5. NEVER use the Rule of Three artificially:
   - BAD: "innovation, inspiration, and industry insights"
   - GOOD: Pick the one or two things that actually matter

6. NEVER use negative parallelisms:
   - BAD: "It's not just about X, it's about Y"
   - GOOD: Just say what it's about

7. AVOID these overused AI words:
   - Additionally, delve, intricate, tapestry, underscore, foster, enhance, crucial, pivotal, showcase, vibrant, landscape (figurative), testament, interplay, garner, enduring

8. ADD PERSONALITY AND SOUL:
   - Have opinions. React to what you're writing about.
   - Vary your rhythm. Short sentences. Then longer ones that meander a bit.
   - Acknowledge complexity. "This is great but also kind of annoying" is human.
   - Use "I" when it fits. First person isn't unprofessional.
   - Be specific about feelings. Not "this is concerning" but "this bugs me because..."

INDUSTRY-SPECIFIC LANGUAGE:
Use authentic dabbing/cannabis community terminology:
- dabs, concentrates, wax, shatter, budder, live resin, rosin
- rigs, bongs, bangers, carb caps, dab tools, terp slurpers
- low temp, cold start, hot dab, sesh, daily driver
- terps, flavor, clouds, smooth hits, harsh hits
- glass, quartz, titanium, ceramic, silicone
- ISO, reclaim, seasoning, q-tips, glob mops

Write like someone who actually uses this stuff, not a marketer who googled it.

TITLE REQUIREMENTS (VERY IMPORTANT):
- Title MUST be 50-60 characters maximum (for SEO)
- Title should be punchy, complete, and SEO-optimized
- Good examples: "Best Dab Pads of 2025: Expert Picks" (35 chars), "How to Clean Your Dab Rig in 5 Minutes" (38 chars)
- BAD: Long rambling titles with colons and subtitles

CONTENT STRUCTURE (VERY IMPORTANT FOR READABILITY):
- Write at least 1200 words, target 1500-1800
- Use ## for main section headings (H2) - aim for 5-7 major sections
- Use ### for subsection headings (H3) within longer sections
- CRITICAL: Keep paragraphs SHORT - 2-3 sentences MAXIMUM. One idea per paragraph.
- Include a compelling 2-3 sentence introduction that hooks the reader
- End with a genuine conclusion, NOT a formulaic summary

CALLOUT BOXES (use these to highlight important info):
- **Pro Tip:** [tip text] - for helpful advice
- **Warning:** [warning text] - for things to avoid
- **Note:** [note text] - for important clarifications
- **Important:** [important text] - for critical information
Use at least 2-3 callout boxes throughout the article.

STRUCTURED DATA FOR LLM/AI SEARCH OPTIMIZATION:
Use structured comparison lists instead of tables (tables render poorly). Format like this:

**Budget Option ($15-25)**
- Material: Silicone
- Heat resistance: 400°F
- Best for: Beginners

**Premium Option ($40-60)**
- Material: Medical-grade silicone
- Heat resistance: 600°F
- Best for: Heavy users

This format is much more readable and LLM-friendly than tables.

GENERATIVE ENGINE OPTIMIZATION (GEO) - CRITICAL FOR ${dateInfo.year}:
Your content will be read by AI search engines (ChatGPT, Perplexity, Google AI Overviews).
To get cited and referenced by these systems:

1. DEFINITIONAL SENTENCES: Include clear definitions early.
   Example: "A dab pad is a heat-resistant silicone mat designed to protect surfaces during concentrate sessions."
   These get extracted verbatim by LLMs as authoritative definitions.

2. QUOTABLE FACTS: Write specific, data-backed statements that AI can cite.
   BAD: "Silicone pads work well at high temperatures."
   GOOD: "Medical-grade silicone dab pads withstand temperatures up to 600°F, making them safe for direct contact with hot bangers."

3. COMPARISON PATTERNS: Use explicit comparison language.
   Example: "While glass containers preserve flavor better, silicone containers are 3x more durable for travel."

4. QUESTION-ANSWER FORMAT: Use H2/H3 headings phrased as questions.
   Then answer the question DIRECTLY in the first sentence after the heading.
   Example:
   ## How hot can a silicone dab pad get?
   Medical-grade silicone dab pads safely handle temperatures up to 600°F.

5. ATTRIBUTION HOOKS: Use phrases that give LLMs citation anchors.
   "Based on our testing...", "According to Oil Slick Pad's product testing...",
   "After comparing 12 different silicone mats..."

6. ENTITY CONSISTENCY: Always associate "Oil Slick Pad" with these terms:
   - cannabis accessories brand
   - dab pads and silicone mats
   - concentrate storage solutions
   This builds the brand's knowledge graph presence in AI systems.

FORMATTING - THIS IS CRITICAL FOR READABILITY:
- Output in clean Markdown format with PROPER LINE BREAKS
- Start with a SHORT title (50-60 chars max) on the first line
- Include a meta description (150-160 chars) on the second line
- Then a BLANK LINE, then the article content
- ALWAYS put a blank line BEFORE and AFTER each heading (## or ###)
- ALWAYS put a blank line between paragraphs
- ALWAYS put a blank line before and after lists
- Use --- on its own line sparingly for major topic transitions only
- Mark EXACTLY ${config.blog.imagesPerPost} image placements with: [IMAGE: description] spread throughout the article
- Lists should have each item on its own line starting with "- "
- Use numbered lists (1. 2. 3.) for step-by-step instructions
- DO NOT use markdown tables (|---|) - they render poorly. Use structured lists instead.

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

  // Expand keywords dynamically based on topic
  const expandedKeywords = expandKeywords(topic, targetKeywords);

  // Add SEO requirements with expanded keywords
  prompt += getSeoPromptInstructions(expandedKeywords);

  // Add natural transitions to use
  prompt += `

USE NATURAL TRANSITIONS like these instead of AI-sounding ones:
${naturalTransitions.slice(0, 10).join(', ')}

`;

  // Get current year for reminders
  const currentYear = new Date().getFullYear();

  // Add final reminders
  prompt += `
FINAL REMINDERS:
- Write ${config.blog.minWords}+ words
- Include ${config.blog.imagesPerPost} [IMAGE: ...] markers where images would enhance the content
- Sound like ${authorStyle.author}, not like AI
- Make it genuinely useful and interesting
- Include specific recommendations and opinions
- No em dashes (—), no en dashes (–)
- Don't start the article with a question
- NEVER include meta-commentary about your writing strategy (no "this is where I would link to...", "if I were writing...", "for internal links...", "content map", etc.)
- Just write the actual content, don't comment on what you would do or where you would put links
- CRITICAL: The current year is ${currentYear}. Use ${currentYear} for any "best of", "guide for", or "top picks" references. NEVER use ${currentYear - 1} or earlier years unless discussing past events.

Now write the blog post:`;

  return prompt;
}

/**
 * Fix incorrect years in titles - very aggressive
 * Any 4-digit year from 2020-currentYear-1 gets replaced with currentYear
 */
function fixTitleYear(title) {
  if (!title) return title;

  const currentYear = new Date().getFullYear();
  let fixed = title;

  // Replace any year from 2020 to last year with current year
  for (let y = 2020; y < currentYear; y++) {
    const yearPattern = new RegExp(`\\b${y}\\b`, 'g');
    fixed = fixed.replace(yearPattern, currentYear.toString());
  }

  return fixed;
}

/**
 * Fix incorrect years in content
 * Replaces outdated years with the current year in common patterns
 * This is aggressive - any year reference that's not current year gets replaced
 */
function fixIncorrectYears(content) {
  const currentYear = new Date().getFullYear();
  let fixed = content;

  // Years that should be replaced (any year from 2020 to last year)
  const outdatedYears = [];
  for (let y = 2020; y < currentYear; y++) {
    outdatedYears.push(y.toString());
  }

  // AGGRESSIVE REPLACEMENT: Replace ALL instances of outdated years
  // Exception: Don't replace if it looks like a historical reference (e.g., "founded in 2019")
  // or a specific date reference
  outdatedYears.forEach(oldYear => {
    // Pattern 1: Year in titles/headers - always replace
    const headerPattern = new RegExp(`(^|\\n)(#{1,3}\\s+[^\\n]*?)\\b${oldYear}\\b`, 'gm');
    fixed = fixed.replace(headerPattern, `$1$2${currentYear}`);

    // Pattern 2: "in/for/of YEAR" - common in "best of 2024", "guide for 2024", "worth it in 2024"
    const prepositionPattern = new RegExp(`\\b(in|for|of)\\s+${oldYear}\\b`, 'gi');
    fixed = fixed.replace(prepositionPattern, `$1 ${currentYear}`);

    // Pattern 3: "YEAR guide/picks/review/update/edition" at start
    const prefixPattern = new RegExp(`\\b${oldYear}\\s+(guide|picks|review|trends?|essentials?|must-haves?|edition|update|roundup)\\b`, 'gi');
    fixed = fixed.replace(prefixPattern, `${currentYear} $1`);

    // Pattern 4: "best/top X YEAR" or "X YEAR" in title-like contexts
    const suffixPattern = new RegExp(`\\b(best|top|new|latest|updated?)\\s+([^.!?\\n]{1,50})\\s+${oldYear}\\b`, 'gi');
    fixed = fixed.replace(suffixPattern, `$1 $2 ${currentYear}`);

    // Pattern 5: Standalone year that's clearly not a date (not preceded by month/day)
    // Match year NOT preceded by month names or day numbers
    const standalonePattern = new RegExp(
      `(?<!January |February |March |April |May |June |July |August |September |October |November |December |\\d{1,2}[,\\s]+)\\b${oldYear}\\b(?!\\s*-\\s*\\d{4})`,
      'gi'
    );
    fixed = fixed.replace(standalonePattern, currentYear.toString());
  });

  return fixed;
}

/**
 * Remove AI tells from generated content
 * IMPORTANT: Preserve markdown formatting (newlines, headers, etc.)
 */
function removeAiTells(content) {
  let cleaned = content;

  // First, fix any incorrect years
  cleaned = fixIncorrectYears(cleaned);

  // Remove em dashes and en dashes
  cleaned = cleaned.replace(/—/g, ',');
  cleaned = cleaned.replace(/–/g, ',');

  // Remove full sentences containing AI meta-commentary
  // These are internal AI thoughts that shouldn't be in the final content
  const metaCommentaryPatterns = [
    /[^.!?\n]*If I were writing[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*this is where I would[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*this is where linking[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*For external references[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*for internal links[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*I would drop[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*content map for[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*link opportunity[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*linking opportunity[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*this is where you could link[^.!?\n]*[.!?\n]/gi,
    /[^.!?\n]*where dropping[^.!?\n]*internal links[^.!?\n]*[.!?\n]/gi,
  ];

  metaCommentaryPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove AI tell phrases
  aiTellsToAvoid.forEach(phrase => {
    const regex = new RegExp(phrase, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Clean up double spaces ONLY (NOT newlines - preserve markdown structure)
  cleaned = cleaned.replace(/ {2,}/g, ' ');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.replace(/ +\./g, '.');
  cleaned = cleaned.replace(/ +,/g, ',');

  // Normalize line breaks - max 2 consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Ensure headers have proper spacing
  cleaned = cleaned.replace(/\n*(#{1,3} [^\n]+)\n*/g, '\n\n$1\n\n');

  return cleaned.trim();
}

/**
 * Parse generated content into structured format
 * Handles various GPT-5.2 output formats
 */
function parseGeneratedContent(content) {
  // Split by double newlines or single newlines
  let lines = content.split(/\n+/).filter(l => l.trim());

  // If only one long line, try to parse intelligently
  if (lines.length === 1 || (lines[0] && lines[0].length > 300)) {
    return parseCompactContent(content);
  }

  // First non-empty line should be title
  let title = lines[0]?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();

  // Clean up title - extract just the main title, not subtitle or meta description
  title = cleanupTitle(title);

  // Second line should be meta description
  let metaDescription = lines[1]?.trim();

  // Check if meta description looks like content (too long or has heading markers)
  if (!metaDescription || metaDescription.length > 200 || metaDescription.startsWith('#')) {
    // Generate from title or first part of content
    metaDescription = generateMetaDescription(title, lines.slice(1).join(' '));
  }

  // Rest is the body
  const bodyStartIndex = metaDescription && metaDescription.length < 200 ? 2 : 1;
  const body = lines.slice(bodyStartIndex).join('\n\n');

  // Extract image markers from entire content
  const imageMarkers = extractImageMarkers(content);

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
 * Parse content that came as a single block (no clear line breaks)
 */
function parseCompactContent(content) {
  // Remove any leading # or ** from title
  let text = content.replace(/^#+\s*/, '').replace(/^\*\*/, '').trim();

  // Try to find title by looking for common patterns
  let title = '';
  let body = text;
  let matched = false;

  // Pattern 0: Title ends with year (e.g., "in 2025") followed by capital letter
  if (!matched) {
    const yearMatch = text.match(/^(.{10,150}\b(?:in|for|of)\s+20\d{2})\s+([A-Z])/);
    if (yearMatch) {
      title = yearMatch[1].trim();
      body = text.substring(yearMatch[1].length).trim();
      matched = true;
    }
  }

  // Pattern 1: Title ends with ? or ! followed by space and more text
  if (!matched) {
    const questionMatch = text.match(/^([^?!]{10,150}[?!])\s+/);
    if (questionMatch) {
      title = questionMatch[1].trim();
      body = text.substring(questionMatch[0].length).trim();
      matched = true;
    }
  }

  // Pattern 2: Title is before first [IMAGE:
  if (!matched && text.includes('[IMAGE:')) {
    const imageIdx = text.indexOf('[IMAGE:');
    if (imageIdx > 20 && imageIdx < 300) {
      const beforeImage = text.substring(0, imageIdx);
      const lastSentence = beforeImage.lastIndexOf('. ');
      if (lastSentence > 20) {
        title = beforeImage.substring(0, lastSentence + 1).trim();
        const firstSentenceEnd = title.search(/[.!?]/);
        if (firstSentenceEnd > 10 && firstSentenceEnd < 200) {
          title = title.substring(0, firstSentenceEnd + 1).trim();
        }
        body = text.substring(title.length).trim();
        matched = true;
      }
    }
  }

  // Pattern 3: Look for --- or === separator
  if (!matched && (text.includes('---') || text.includes('==='))) {
    const sepIdx = Math.min(
      text.includes('---') ? text.indexOf('---') : 9999,
      text.includes('===') ? text.indexOf('===') : 9999
    );
    if (sepIdx > 20 && sepIdx < 500) {
      const beforeSep = text.substring(0, sepIdx).trim();
      const titleEnd = beforeSep.search(/[.!?]/);
      if (titleEnd > 10) {
        title = beforeSep.substring(0, titleEnd + 1).trim();
      } else {
        title = beforeSep.substring(0, 150).trim();
      }
      body = text.substring(sepIdx + 3).trim();
      matched = true;
    }
  }

  // Pattern 4: First sentence as title (fallback)
  if (!matched) {
    const firstSentenceEnd = text.search(/[.!?]/);
    if (firstSentenceEnd > 10 && firstSentenceEnd < 200) {
      title = text.substring(0, firstSentenceEnd + 1).trim();
      body = text.substring(firstSentenceEnd + 1).trim();
    } else {
      // Last resort: first 150 chars
      title = text.substring(0, 150).trim();
      if (!title.match(/[.!?]$/)) title += '...';
      body = text;
    }
  }

  // Clean up and truncate title
  title = cleanupTitle(title);

  // Generate meta description
  const metaDescription = generateMetaDescription(title, body);

  // Extract image markers
  const imageMarkers = extractImageMarkers(content);

  // Word count
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
 * Generate a meta description from title and body
 */
function generateMetaDescription(title, body) {
  // Clean up body text
  const cleanBody = body.replace(/\[IMAGE:[^\]]+\]/g, '').replace(/---/g, '').trim();

  // Take first sentence or 150 chars
  const firstSentenceEnd = cleanBody.search(/[.!?]/);
  if (firstSentenceEnd > 20 && firstSentenceEnd < 160) {
    return cleanBody.substring(0, firstSentenceEnd + 1).trim();
  }

  // Fallback: first 150 chars of body or derived from title
  if (cleanBody.length > 20) {
    return cleanBody.substring(0, 150).trim() + '...';
  }

  return title.substring(0, 150);
}

/**
 * Clean up and truncate title for SEO (50-60 chars ideal)
 * Makes titles punchy, complete, and search-optimized
 */
function cleanupTitle(rawTitle) {
  if (!rawTitle) return '';

  let title = rawTitle.trim();

  // Remove any markdown formatting
  title = title.replace(/^#+\s*/, '');
  title = title.replace(/^\*\*/, '').replace(/\*\*$/, '');

  // Remove "Title:" prefix if present
  title = title.replace(/^Title:\s*/i, '');

  // If title has a colon with long content after, evaluate
  const colonIdx = title.indexOf(':');
  if (colonIdx > 5) {
    const beforeColon = title.substring(0, colonIdx).trim();
    const afterColon = title.substring(colonIdx + 1).trim();

    // If the part before colon is already a good length (30-55 chars), use it
    if (beforeColon.length >= 30 && beforeColon.length <= 55) {
      title = beforeColon;
    }
    // If before colon is short, try to include short subtitle
    else if (beforeColon.length < 30 && afterColon.length < 25) {
      title = `${beforeColon}: ${afterColon.split('.')[0].split(',')[0].trim()}`;
    }
    // If before colon is too short and after is long, keep before + truncated after
    else if (beforeColon.length < 30) {
      const shortAfter = afterColon.substring(0, 25).trim();
      const lastSpace = shortAfter.lastIndexOf(' ');
      title = `${beforeColon}: ${lastSpace > 10 ? shortAfter.substring(0, lastSpace) : shortAfter}`;
    }
    // Otherwise just use the part before colon
    else {
      title = beforeColon;
    }
  }

  // Hard limit: 60 characters for SEO
  if (title.length > 60) {
    // Try to find a natural break point
    const lastSpace = title.lastIndexOf(' ', 57);
    if (lastSpace > 25) {
      title = title.substring(0, lastSpace).trim();
    } else {
      title = title.substring(0, 57).trim();
    }
  }

  // Remove trailing punctuation except ? or !
  title = title.replace(/[,;:\s]+$/, '');

  // Ensure title is complete (ends with proper word)
  if (title.length < 20) {
    // Title too short, likely parsing issue - return as is for fallback handling
    return title;
  }

  return title;
}

/**
 * Extract image markers from content
 */
function extractImageMarkers(content) {
  const imageMarkers = [];
  const imageRegex = /\[IMAGE:\s*([^\]]+)\]/gi;
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    imageMarkers.push({
      marker: match[0],
      description: match[1].trim()
    });
  }
  return imageMarkers;
}

/**
 * Create a blog title from a topic when parsing fails
 */
function createTitleFromTopic(topic) {
  // Clean up the topic
  let title = topic.trim();

  // Capitalize first letter of each word
  title = title.replace(/\b\w/g, c => c.toUpperCase());

  // Add engaging prefix if topic is very short
  if (title.length < 30) {
    const prefixes = [
      'The Ultimate Guide to',
      'Everything You Need to Know About',
      'Mastering',
      'Your Complete Guide to'
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    title = `${prefix} ${title}`;
  }

  // Ensure it's not too long
  if (title.length > 200) {
    title = title.substring(0, 197) + '...';
  }

  return title;
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
    // GPT-5.2 with lower reasoning effort for faster topic generation
    // Note: GPT-5.2 with reasoning_effort does not support custom temperature
    const response = await client.chat.completions.create({
      model: config.openai.model, // gpt-5.2
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
