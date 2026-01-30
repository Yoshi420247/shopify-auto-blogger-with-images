/**
 * Content Reviewer Module
 *
 * Uses AI to review and fix formatting issues in generated content
 * before publishing. Acts as a final quality check.
 */

import OpenAI from 'openai';
import config from '../config.js';

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
 * Programmatic fixes for common HTML issues
 * Runs before AI review to handle predictable problems
 */
function programmaticFixes(html) {
  let fixed = html;

  // Remove empty paragraphs
  fixed = fixed.replace(/<p[^>]*>\s*<\/p>/g, '');

  // ============ FIX BROKEN IMAGE ARTIFACTS ============
  // IMPORTANT: Only remove BROKEN fragments, NOT valid <img> tags

  // Remove fragments like: 1);" loading="lazy"> (broken CSS values)
  fixed = fixed.replace(/\d+\);\s*"\s*loading="lazy"\s*>/gi, '');
  fixed = fixed.replace(/[0-9.]+\);\s*"\s*>/gi, '');

  // Remove fragments that START with a file extension (broken img tag where src got stripped)
  // Only match if NOT preceded by a quote (which would indicate a valid src="...png")
  fixed = fixed.replace(/(?<!")(?:png|jpg|jpeg|gif|webp|svg)"\s*alt="[^"]*"[^>]*>/gi, '');

  // Remove lines that are ONLY broken image attributes (no actual content)
  // These start the line with alt=" which is never valid
  fixed = fixed.replace(/^\s*alt="[^"]*"[^>]*>\s*$/gm, '');

  // Remove broken img tag endings like: dab mat" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">
  // Pattern: text followed by " style= ... loading="lazy">
  fixed = fixed.replace(/[a-zA-Z\s]+"\s*style="[^"]*"\s*loading="lazy"\s*>/gi, '');

  // More aggressive: catch any orphaned style/loading attributes ending with >
  // Pattern: anything" style="..." loading="...">  (without a proper <img opening)
  fixed = fixed.replace(/(?<!<img[^>]*)"\s*style="max-width:\s*100%[^"]*"\s*loading="lazy"\s*>/gi, '');

  // Catch fragments that look like: [text]" style="[anything]">
  fixed = fixed.replace(/[^<>"]+"\s*style="[^"]+"\s*>/gi, (match, offset, string) => {
    // Only remove if NOT part of a valid tag (no < before it within reasonable distance)
    const preceding = string.substring(Math.max(0, offset - 100), offset);
    if (!preceding.includes('<img') && !preceding.includes('<figure')) {
      return '';
    }
    return match;
  });

  // Catch: [text]" loading="lazy"> without proper img tag
  fixed = fixed.replace(/[a-zA-Z0-9\s]+"\s*loading="lazy"\s*>/gi, (match, offset, string) => {
    const preceding = string.substring(Math.max(0, offset - 100), offset);
    if (!preceding.includes('<img') && !preceding.includes('<figure')) {
      return '';
    }
    return match;
  });

  // Remove orphaned closing fragments: height: auto; border-radius: 12px;" loading="lazy">
  fixed = fixed.replace(/(?:height|width|border-radius|margin|padding)[^>]*loading="lazy"\s*>/gi, '');

  // Remove any line that's ONLY image styling attributes (no real content)
  fixed = fixed.replace(/^\s*(?:style|loading|alt|src|class)="[^"]*"[^>]*>\s*$/gm, '');

  // Remove leftover [IMAGE: ...] markers
  fixed = fixed.replace(/\[IMAGE:[^\]]*\]/g, '');

  // ============ FIX BROKEN TABLE ARTIFACTS ============
  // Remove lines that are just pipes, dashes, colons, and spaces (broken tables)
  fixed = fixed.replace(/^[\|\-:\s]+$/gm, '');

  // Remove table separator rows that got orphaned
  fixed = fixed.replace(/^\|[-:|\s]+\|$/gm, '');

  // Remove partial table rows (start with | but don't have content)
  fixed = fixed.replace(/^\|\s*\|$/gm, '');

  // Remove lines that are just dashes
  fixed = fixed.replace(/^-{2,}$/gm, '');

  // ============ FIX MARKDOWN LEFTOVERS ============
  // Remove leftover markdown headers that weren't converted
  fixed = fixed.replace(/^#{1,6}\s+/gm, '');

  // Convert leftover bold/italic markdown
  fixed = fixed.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  fixed = fixed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  fixed = fixed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // ============ REMOVE AI META-COMMENTARY ============
  // Remove sentences/paragraphs that are AI thinking out loud about linking strategy
  const metaPatterns = [
    /[^<]*If I were writing[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*this is where I would[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*this is where linking[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*For external references[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*for internal links[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*content map for[^<]*(?:<\/p>|<br|$)/gi,
    /[^<]*where I would drop[^<]*(?:<\/p>|<br|$)/gi,
    /<p[^>]*>[^<]*If I were writing[^<]*<\/p>/gi,
    /<p[^>]*>[^<]*this is where[^<]*internal links[^<]*<\/p>/gi,
    /<p[^>]*>[^<]*For external references[^<]*<\/p>/gi,
  ];
  metaPatterns.forEach(pattern => {
    fixed = fixed.replace(pattern, '');
  });

  // ============ FIX WHITESPACE ISSUES ============
  // Fix excessive newlines (more than 2)
  fixed = fixed.replace(/\n{3,}/g, '\n\n');

  // Remove lines that are just whitespace
  fixed = fixed.replace(/^\s+$/gm, '');

  // Clean up multiple consecutive empty lines
  fixed = fixed.replace(/(\n\s*){3,}/g, '\n\n');

  // Remove excessive <br> tags
  fixed = fixed.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

  // ============ FIX SCRIPT TAGS ============
  fixed = fixed.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    // Keep valid JSON-LD scripts
    if (match.includes('application/ld+json')) {
      return match;
    }
    return '';
  });

  return fixed.trim();
}

/**
 * Review and fix HTML content before publishing
 * Checks for: empty spaces, formatting issues, broken HTML, readability
 */
export async function reviewAndFixContent(htmlContent, title) {
  console.log('AI reviewing content for formatting issues...');

  // First, do programmatic fixes for common issues
  let fixedHtml = programmaticFixes(htmlContent);

  // Then use AI for remaining issues
  const client = getOpenAI();

  const prompt = `You are a content editor reviewing HTML for a Shopify blog post.
Review this HTML and fix any issues you find. Return ONLY the corrected HTML, no explanations.

CRITICAL ISSUES TO FIX:
1. Remove any empty paragraphs (<p></p> or <p> </p> or <p style="..."></p>)
2. Remove excessive blank lines (more than one empty line between elements)
3. Fix any broken HTML tags (unclosed tags, malformed tags like 'png" alt="...')
4. Fix any broken image tags - if you see fragments like 'png" alt="...' or orphaned img attributes, remove them entirely
5. Remove any leftover markdown: **, ##, |---|, [IMAGE: ...], etc.
6. Remove any pipe characters | that look like broken table remnants
7. Fix weird spacing around punctuation
8. Ensure proper paragraph separation
9. Remove any duplicate sentences or repeated content
10. Clean up any random line breaks in the middle of sentences

SPECIFIC PATTERNS TO REMOVE:
- Lines that are just "---" or "-" repeated
- Lines starting with "|" that aren't in a table
- Text fragments like "png" or "jpg" appearing alone
- Any "<img" tags that don't have proper src attributes

IMPORTANT:
- Keep all properly formatted HTML elements with their inline styles
- Keep all properly formed <figure> and <img> tags
- Keep all <table> elements that are properly formatted
- Don't change the content meaning
- Return clean, valid HTML only

TITLE: ${title}

HTML TO REVIEW:
${fixedHtml}

Return the fixed HTML:`;

  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: 'You are an HTML editor. Return only valid, clean HTML. No explanations.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 8192,
      reasoning_effort: 'low'
    });

    const fixedHtml = response.choices[0]?.message?.content;

    if (!fixedHtml) {
      console.log('AI review returned empty, using original content');
      return htmlContent;
    }

    // Basic validation - make sure we got HTML back
    if (!fixedHtml.includes('<') || fixedHtml.length < 100) {
      console.log('AI review returned invalid content, using original');
      return htmlContent;
    }

    console.log('AI review complete - formatting issues fixed');
    return fixedHtml.trim();

  } catch (error) {
    console.error('AI review failed:', error.message);
    // Return original content if review fails
    return htmlContent;
  }
}

/**
 * Check if a topic has been recently covered
 * Returns true if topic is too similar to recent posts
 */
export async function isTopicRecentlyCovered(proposedTopic, recentArticles, daysThreshold = 90) {
  if (!recentArticles || recentArticles.length === 0) {
    return { covered: false };
  }

  // Filter to articles within the threshold
  // IMPORTANT: If article has no date, assume it's recent and INCLUDE it
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  const recentTitles = recentArticles
    .filter(article => {
      // If no date, assume it's recent (include it)
      if (!article.publishedAt && !article.createdAt) {
        return true;
      }
      const articleDate = new Date(article.publishedAt || article.createdAt);
      // Check if date is valid
      if (isNaN(articleDate.getTime())) {
        return true; // Invalid date, assume recent
      }
      return articleDate >= cutoffDate;
    })
    .map(a => a.title || a.topic) // Also check 'topic' field for this-run tracking
    .filter(t => t) // Remove nulls
    .slice(0, 30); // Check last 30 articles

  if (recentTitles.length === 0) {
    return { covered: false };
  }

  console.log(`Checking if "${proposedTopic}" overlaps with ${recentTitles.length} recent articles...`);

  const client = getOpenAI();

  const prompt = `You are a STRICT content deduplication checker. Your job is to PREVENT duplicate blog posts.

PROPOSED TOPIC: "${proposedTopic}"

EXISTING ARTICLES TO CHECK AGAINST:
${recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

BE VERY STRICT - Mark as "too similar" if:
- The core subject is the same (e.g., "cleaning dab tools" and "how to clean dab tools" are THE SAME topic)
- The articles would cover substantially overlapping information
- A reader would think "I already read about this"
- The topic is just rephrased or has a different angle on the SAME subject
- Examples of TOO SIMILAR:
  * "cleaning dab tools" vs "how to clean your dab tools" = TOO SIMILAR
  * "best dab pads 2025" vs "top dab pads reviewed" = TOO SIMILAR
  * "concentrate storage guide" vs "how to store concentrates" = TOO SIMILAR

Mark as "unique" ONLY if the topic is genuinely DIFFERENT subject matter.

Respond in JSON format only:
{
  "isTooSimilar": true/false,
  "similarTo": "title of similar article if found, or null",
  "reason": "brief explanation",
  "suggestedAlternative": "if too similar, suggest a COMPLETELY DIFFERENT topic in the cannabis accessories space that hasn't been covered"
}`;

  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: 'You are a content strategist. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 500,
      reasoning_effort: 'low'
    });

    const result = response.choices[0]?.message?.content;

    // Parse JSON response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        covered: parsed.isTooSimilar,
        similarTo: parsed.similarTo,
        reason: parsed.reason,
        alternative: parsed.suggestedAlternative
      };
    }

    return { covered: false };

  } catch (error) {
    console.error('Topic check failed:', error.message);
    return { covered: false };
  }
}

/**
 * Get a unique topic that hasn't been recently covered
 * Will try alternatives if original topic was covered
 */
export async function getUniqueTopic(originalTopic, recentArticles, contentIdeas = []) {
  // First check if original topic is okay
  const check = await isTopicRecentlyCovered(originalTopic, recentArticles);

  if (!check.covered) {
    console.log(`Topic "${originalTopic}" is unique - proceeding`);
    return { topic: originalTopic, wasChanged: false };
  }

  console.log(`Topic "${originalTopic}" was recently covered (similar to: ${check.similarTo})`);
  console.log(`Reason: ${check.reason}`);

  // Try the suggested alternative first
  if (check.alternative) {
    const altCheck = await isTopicRecentlyCovered(check.alternative, recentArticles);
    if (!altCheck.covered) {
      console.log(`Using alternative topic: "${check.alternative}"`);
      return {
        topic: check.alternative,
        wasChanged: true,
        originalTopic,
        reason: check.reason
      };
    }
  }

  // Try content ideas
  for (const idea of contentIdeas) {
    const ideaTopic = idea.title || idea.topic;
    if (ideaTopic && ideaTopic !== originalTopic) {
      const ideaCheck = await isTopicRecentlyCovered(ideaTopic, recentArticles);
      if (!ideaCheck.covered) {
        console.log(`Using content idea: "${ideaTopic}"`);
        return {
          topic: ideaTopic,
          wasChanged: true,
          originalTopic,
          reason: 'Original topic recently covered, using content idea'
        };
      }
    }
  }

  // Last resort - add a fresh angle to original topic
  const freshTopic = `${originalTopic} - ${new Date().getFullYear()} Update`;
  console.log(`Adding fresh angle: "${freshTopic}"`);
  return {
    topic: freshTopic,
    wasChanged: true,
    originalTopic,
    reason: 'Added year for fresh perspective'
  };
}

export default {
  reviewAndFixContent,
  isTopicRecentlyCovered,
  getUniqueTopic
};
