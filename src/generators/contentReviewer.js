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
 * Review and fix HTML content before publishing
 * Checks for: empty spaces, formatting issues, broken HTML, readability
 */
export async function reviewAndFixContent(htmlContent, title) {
  console.log('AI reviewing content for formatting issues...');

  const client = getOpenAI();

  const prompt = `You are a content editor reviewing HTML for a Shopify blog post.
Review this HTML and fix any issues you find. Return ONLY the corrected HTML, no explanations.

ISSUES TO FIX:
1. Remove any empty paragraphs (<p></p> or <p> </p>)
2. Remove excessive whitespace or empty lines
3. Fix any broken or unclosed HTML tags
4. Ensure paragraphs are properly separated (not run together)
5. Remove any leftover markdown that wasn't converted (**, ##, etc.)
6. Remove any [IMAGE: ...] markers that weren't replaced
7. Fix any weird spacing around punctuation
8. Ensure lists are properly formatted
9. Remove any duplicate content or repeated sections
10. Clean up any AI artifacts or placeholder text

IMPORTANT:
- Keep all the existing inline styles
- Don't change the content meaning, just fix formatting
- Don't add new content
- Return clean, valid HTML

TITLE: ${title}

HTML TO REVIEW:
${htmlContent}

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
export async function isTopicRecentlyCovered(proposedTopic, recentArticles, daysThreshold = 60) {
  if (!recentArticles || recentArticles.length === 0) {
    return { covered: false };
  }

  // Filter to articles within the threshold
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  const recentTitles = recentArticles
    .filter(article => {
      const articleDate = new Date(article.publishedAt || article.createdAt);
      return articleDate >= cutoffDate;
    })
    .map(a => a.title)
    .slice(0, 20); // Check last 20 recent articles

  if (recentTitles.length === 0) {
    return { covered: false };
  }

  console.log(`Checking if "${proposedTopic}" overlaps with ${recentTitles.length} recent articles...`);

  const client = getOpenAI();

  const prompt = `You are checking if a proposed blog topic has already been covered recently.

PROPOSED TOPIC: "${proposedTopic}"

RECENT ARTICLE TITLES (last ${daysThreshold} days):
${recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Is the proposed topic too similar to any of these recent articles? Consider:
- Same core subject matter
- Very similar angles or approaches
- Would create duplicate/redundant content

Respond in JSON format only:
{
  "isTooSimilar": true/false,
  "similarTo": "title of similar article if found, or null",
  "reason": "brief explanation",
  "suggestedAlternative": "if too similar, suggest a different angle or related topic that hasn't been covered"
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
