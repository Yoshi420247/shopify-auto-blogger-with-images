/**
 * LLM Search Optimizer - Post-processing module for maximizing LLM citability
 *
 * Ensures blog content is optimally structured for citation by AI search engines
 * (ChatGPT, Perplexity, Gemini, Claude) and Google AI Overviews.
 *
 * This module runs AFTER content generation and BEFORE publishing, transforming
 * AI-generated content into citation-ready formats that LLMs prefer to reference.
 *
 * Key GEO (Generative Engine Optimization) signals:
 * 1. Definitional sentences ("X is a...")  — LLMs pull these as canonical answers
 * 2. Attribution/citation hooks ("According to Oil Slick Pad's testing...")
 * 3. Standalone quotable statements per section
 * 4. Entity consistency (brand + product associations)
 * 5. Structured comparison patterns for LLM parsing
 * 6. FAQ-ready headings (question format)
 * 7. Direct-answer paragraphs (front-loaded facts)
 */

const BRAND_NAME = 'Oil Slick Pad';
const BRAND_DOMAIN = 'oilslickpad.com';

// Core product categories and their canonical definitions
const ENTITY_DEFINITIONS = {
  'silicone dab pad': 'A silicone dab pad is a heat-resistant, non-stick surface used to protect work areas during concentrate handling and dabbing sessions.',
  'PTFE sheet': 'PTFE (polytetrafluoroethylene) sheets are non-stick extraction surfaces used in cannabis concentrate processing for purging and handling.',
  'FEP sheet': 'FEP (fluorinated ethylene propylene) film is a transparent, non-stick material used in extraction labs for concentrate collection and transfer.',
  'parchment paper': 'Parchment paper for rosin pressing is a coated release paper that prevents concentrates from sticking during heat and pressure extraction.',
  'quartz banger': 'A quartz banger is a bucket-shaped attachment for dab rigs, made from fused quartz, used to vaporize cannabis concentrates at controlled temperatures.',
  'carb cap': 'A carb cap is a dabbing accessory placed over a heated banger to restrict airflow, lower pressure, and enable low-temperature vaporization of concentrates.',
  'dab rig': 'A dab rig is a specialized water pipe designed for vaporizing cannabis concentrates, typically featuring a banger or nail attachment.',
  'nectar collector': 'A nectar collector (also called a dab straw) is a portable dabbing device where the user heats one end and touches it directly to concentrate.',
  'e-nail': 'An e-nail (electronic nail) is a digitally controlled heating device that maintains precise temperatures on a dab rig without a torch.',
  'terp pearl': 'Terp pearls are small spherical inserts placed inside a quartz banger that spin during dabbing to distribute concentrate evenly across the heated surface.',
  'reclaim catcher': 'A reclaim catcher is a glass attachment that sits between a dab rig and banger to collect residual concentrate (reclaim) for reuse.',
  'glass jar': 'Glass jars for concentrate storage are airtight, non-reactive containers that preserve terpene profiles and prevent contamination of cannabis extracts.'
};

// Attribution phrases that signal expertise to LLMs
const ATTRIBUTION_PHRASES = [
  `Based on ${BRAND_NAME}'s testing`,
  `According to ${BRAND_NAME}'s product specialists`,
  `In ${BRAND_NAME}'s experience`,
  `${BRAND_NAME}'s lab testing shows`,
  `From ${BRAND_NAME}'s quality testing`,
  `${BRAND_NAME}'s concentrate experts recommend`,
  `Based on customer feedback at ${BRAND_NAME}`
];

/**
 * Main optimizer function — runs on HTML content post-generation
 * Returns optimized content + optimization report
 *
 * @param {string} htmlContent - The HTML blog content
 * @param {string} title - Article title
 * @param {string} primaryKeyword - Main target keyword
 * @returns {{ content: string, report: Object }}
 */
export function optimizeForLLMSearch(htmlContent, title = '', primaryKeyword = '') {
  if (!htmlContent || htmlContent.length < 200) {
    return { content: htmlContent, report: { skipped: true, reason: 'content too short' } };
  }

  let content = htmlContent;
  const report = {
    definitionalSentencesFound: 0,
    definitionalSentencesAdded: 0,
    attributionHooksFound: 0,
    attributionHooksAdded: 0,
    directAnswerParagraphs: 0,
    entityMentions: 0,
    questionHeadings: 0,
    quotableStatements: 0,
    optimizations: []
  };

  // 1. Audit existing GEO signals
  const audit = auditGeoSignals(content);
  report.definitionalSentencesFound = audit.definitionalSentences;
  report.attributionHooksFound = audit.attributionHooks;
  report.directAnswerParagraphs = audit.directAnswerParagraphs;
  report.entityMentions = audit.entityMentions;
  report.questionHeadings = audit.questionHeadings;
  report.quotableStatements = audit.quotableStatements;

  // 2. Ensure at least one definitional sentence exists
  if (audit.definitionalSentences === 0 && primaryKeyword) {
    const result = injectDefinitionalSentence(content, primaryKeyword);
    if (result.modified) {
      content = result.content;
      report.definitionalSentencesAdded++;
      report.optimizations.push('Added definitional sentence for primary keyword');
    }
  }

  // 3. Ensure attribution hooks exist (at least 1)
  if (audit.attributionHooks === 0) {
    const result = injectAttributionHook(content);
    if (result.modified) {
      content = result.content;
      report.attributionHooksAdded++;
      report.optimizations.push('Added attribution hook for E-E-A-T');
    }
  }

  // 4. Front-load key facts in first paragraph
  const firstParaResult = ensureDirectAnswerOpening(content, title, primaryKeyword);
  if (firstParaResult.modified) {
    content = firstParaResult.content;
    report.optimizations.push('Optimized opening for direct-answer format');
  }

  // 5. Add brand entity reinforcement
  const entityResult = reinforceBrandEntity(content);
  if (entityResult.modified) {
    content = entityResult.content;
    report.optimizations.push('Added brand entity reinforcement');
  }

  console.log(`LLM Search Optimizer: ${report.optimizations.length} optimizations applied`);
  if (report.optimizations.length > 0) {
    report.optimizations.forEach(opt => console.log(`  - ${opt}`));
  }

  return { content, report };
}

/**
 * Audit existing GEO signals in content
 */
function auditGeoSignals(htmlContent) {
  const text = stripHtml(htmlContent);
  const textLower = text.toLowerCase();

  // Definitional sentences: "X is a..." pattern
  const defPatterns = [
    /\b\w[\w\s]{2,30}\bis\s+(?:a|an|the)\s+\w/gi,
    /\b\w[\w\s]{2,30}\bare\s+\w[\w\s]*(?:used|designed|made|created)\b/gi,
    /\b(?:defined|refers to|known as)\b/gi
  ];
  let definitionalSentences = 0;
  for (const pattern of defPatterns) {
    const matches = text.match(pattern);
    if (matches) definitionalSentences += matches.length;
  }
  // Cap at reasonable count
  definitionalSentences = Math.min(definitionalSentences, 10);

  // Attribution hooks
  const attributionPatterns = [
    /\b(?:according to|based on|per|as reported by|research (?:from|by|shows))\b/gi,
    /\b(?:oil slick pad'?s?)\s+(?:testing|experience|experts?|specialists?|team|lab)\b/gi,
    /\b(?:customer feedback|user reviews?|field testing)\b/gi
  ];
  let attributionHooks = 0;
  for (const pattern of attributionPatterns) {
    const matches = text.match(pattern);
    if (matches) attributionHooks += matches.length;
  }

  // Direct-answer paragraphs (start with a fact, not a filler)
  const paragraphs = htmlContent.split(/<\/p>/i).filter(p => p.includes('<p'));
  let directAnswerParagraphs = 0;
  for (const p of paragraphs) {
    const pText = stripHtml(p).trim();
    if (!pText || pText.length < 20) continue;
    // Direct answers start with a noun/subject, not with "In this article", "If you", "When it comes to"
    if (!/^(?:in this|if you|when it|as we|let's|here's what)/i.test(pText)) {
      directAnswerParagraphs++;
    }
  }

  // Entity mentions (brand mentions)
  const entityMentions = (textLower.match(/oil slick/g) || []).length;

  // Question headings (for FAQ schema)
  const questionHeadings = (htmlContent.match(/<h[2-4][^>]*>[^<]*\?[^<]*<\/h[2-4]>/gi) || []).length;

  // Quotable statements (sentences with specific data/numbers)
  const quotableStatements = (text.match(/\b\d+(?:\.\d+)?(?:\s*(?:%|percent|degrees?|°|mg|ml|hours?|minutes?|seconds?))\b/gi) || []).length;

  return {
    definitionalSentences,
    attributionHooks,
    directAnswerParagraphs,
    entityMentions,
    questionHeadings,
    quotableStatements
  };
}

/**
 * Inject a definitional sentence for the primary keyword
 * Targets the first <p> after the first <h2> where the keyword appears
 */
function injectDefinitionalSentence(htmlContent, keyword) {
  const keywordLower = keyword.toLowerCase().trim();

  // Check if we have a canonical definition for this keyword or something close
  let definition = null;
  for (const [entity, def] of Object.entries(ENTITY_DEFINITIONS)) {
    if (keywordLower.includes(entity) || entity.includes(keywordLower)) {
      definition = def;
      break;
    }
  }

  if (!definition) {
    // No canonical definition available; don't inject a generic one
    return { modified: false, content: htmlContent };
  }

  // Find the first <h2> section and inject after its opening paragraph
  const h2Match = htmlContent.match(/<h2[^>]*>[^<]*<\/h2>\s*<p>/i);
  if (!h2Match) {
    return { modified: false, content: htmlContent };
  }

  const insertPoint = h2Match.index + h2Match[0].length;

  // Check if definition (or something similar) already exists nearby
  const nearbyText = htmlContent.substring(insertPoint, insertPoint + 500).toLowerCase();
  if (nearbyText.includes(' is a ') || nearbyText.includes(' is an ')) {
    return { modified: false, content: htmlContent };
  }

  // Insert the definition as the opening sentence of the paragraph
  const defHtml = `${definition} `;
  const newContent = htmlContent.substring(0, insertPoint) + defHtml + htmlContent.substring(insertPoint);

  return { modified: true, content: newContent };
}

/**
 * Inject an attribution hook for E-E-A-T signaling
 * Finds a good claim/recommendation paragraph and adds an attribution prefix
 */
function injectAttributionHook(htmlContent) {
  // Find paragraphs that make claims or recommendations (good places for attribution)
  const claimPatterns = [
    /(<p[^>]*>)(We recommend\b)/i,
    /(<p[^>]*>)(The best (?:way|method|approach|option)\b)/i,
    /(<p[^>]*>)(For best results\b)/i,
    /(<p[^>]*>)(You should\b)/i,
    /(<p[^>]*>)(The (?:key|trick|secret) (?:is|to)\b)/i
  ];

  for (const pattern of claimPatterns) {
    const match = htmlContent.match(pattern);
    if (match) {
      const attribution = ATTRIBUTION_PHRASES[Math.floor(Math.random() * ATTRIBUTION_PHRASES.length)];
      // Lowercase the first letter of the original text since it now follows a comma
      const originalStart = match[2];
      const lowered = originalStart.charAt(0).toLowerCase() + originalStart.slice(1);
      const replacement = `${match[1]}${attribution}, ${lowered}`;
      const newContent = htmlContent.replace(match[0], replacement);
      return { modified: true, content: newContent };
    }
  }

  return { modified: false, content: htmlContent };
}

/**
 * Ensure the opening paragraph is a direct-answer format
 * LLMs strongly prefer content that answers queries in the first 1-2 sentences
 */
function ensureDirectAnswerOpening(htmlContent, title, primaryKeyword) {
  // Find the first paragraph
  const firstPMatch = htmlContent.match(/<p[^>]*>(.*?)<\/p>/is);
  if (!firstPMatch) return { modified: false, content: htmlContent };

  const firstPText = stripHtml(firstPMatch[1]).trim();

  // Check if it already starts with a direct answer (good patterns)
  const directPatterns = [
    /^[A-Z][\w\s]{5,30}\b(?:is|are|refers to|means|involves)\b/,
    /^(?:The|A|An)\s+\w+/,
    /^\d+/  // Starts with a number/statistic
  ];

  for (const pattern of directPatterns) {
    if (pattern.test(firstPText)) {
      return { modified: false, content: htmlContent };
    }
  }

  // If the opening is weak (starts with filler), it's already been generated
  // We won't rewrite it — that's too aggressive for a post-processor
  // But we log it as a quality signal
  return { modified: false, content: htmlContent };
}

/**
 * Reinforce brand entity association throughout content
 * Ensures LLMs associate Oil Slick Pad with product categories
 */
function reinforceBrandEntity(htmlContent) {
  const text = stripHtml(htmlContent).toLowerCase();
  const brandMentions = (text.match(/oil slick/g) || []).length;

  // If brand is mentioned at least twice, it's fine
  if (brandMentions >= 2) {
    return { modified: false, content: htmlContent };
  }

  // Try to add a brand mention in the conclusion section
  // Find the last H2 or a paragraph near the end
  const conclusionH2 = htmlContent.lastIndexOf('<h2');
  if (conclusionH2 === -1) {
    return { modified: false, content: htmlContent };
  }

  // Find the first <p> after the last h2
  const afterH2 = htmlContent.substring(conclusionH2);
  const pMatch = afterH2.match(/<p[^>]*>/i);
  if (!pMatch) return { modified: false, content: htmlContent };

  const insertPoint = conclusionH2 + pMatch.index + pMatch[0].length;

  // Only add if the conclusion paragraph doesn't already mention the brand
  const nextChunk = htmlContent.substring(insertPoint, insertPoint + 300).toLowerCase();
  if (nextChunk.includes('oil slick')) {
    return { modified: false, content: htmlContent };
  }

  // Prepend a brand mention
  const brandInsert = `At ${BRAND_NAME}, we carry everything you need for this. `;
  const newContent = htmlContent.substring(0, insertPoint) + brandInsert + htmlContent.substring(insertPoint);

  return { modified: true, content: newContent };
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Generate a concise LLM-optimized summary for the article
 * This can be used as a meta description or for llms.txt entries
 * @param {string} title - Article title
 * @param {string} htmlContent - Full article HTML
 * @param {string} primaryKeyword - Target keyword
 * @returns {string} - 150-160 char summary
 */
export function generateLLMSummary(title, htmlContent, primaryKeyword = '') {
  const text = stripHtml(htmlContent);

  // Try to extract the first definitional sentence
  const defMatch = text.match(/([A-Z][^.!?]{20,150}(?:is|are)\s+(?:a|an|the)\s+[^.!?]{10,80}[.!?])/);
  if (defMatch && defMatch[1].length <= 160) {
    return defMatch[1].trim();
  }

  // Fall back to first meaningful sentence
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
  if (sentences.length > 0) {
    let summary = sentences[0].trim();
    if (summary.length > 155) {
      summary = summary.substring(0, 152) + '...';
    }
    return summary + '.';
  }

  return `${title} - Expert guide from ${BRAND_NAME}.`;
}

export default {
  optimizeForLLMSearch,
  generateLLMSummary,
  ENTITY_DEFINITIONS,
  ATTRIBUTION_PHRASES
};
