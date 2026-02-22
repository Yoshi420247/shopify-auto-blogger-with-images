/**
 * SEO Optimizer for AI and Traditional Search
 *
 * Implements latest SEO best practices including:
 * - Traditional Google SEO
 * - AI Overview optimization (Google SGE / AI Overviews)
 * - LLM/ChatGPT/Perplexity search optimization (GEO)
 * - Voice search and conversational query optimization
 * - Structured data for rich snippets and LLM citation
 * - Content quality scoring and readability analysis
 */

import config from '../config.js';

/**
 * SEO optimization guidelines for content generation
 */
export const seoGuidelines = {
  // Structure for AI Overview/SGE optimization
  aiOverview: {
    description: 'Optimize for Google AI Overviews (formerly SGE)',
    guidelines: [
      'Answer questions directly in the first paragraph',
      'Use clear, factual statements that can be quoted',
      'Include structured data and lists where appropriate',
      'Provide specific numbers, dates, and facts',
      'Use question-based subheadings (H2/H3)',
      'Keep paragraphs under 150 words for snippet extraction',
      'Include expert quotes or attributions',
      'Cite sources and provide evidence-based claims'
    ]
  },

  // LLM Search optimization (ChatGPT, Perplexity, etc.) - GEO
  llmSearch: {
    description: 'Generative Engine Optimization (GEO) for LLM-based search',
    guidelines: [
      'Write comprehensive, authoritative content that LLMs will cite',
      'Include clear definitional sentences ("A dab pad is...")',
      'Use natural language that matches conversational queries',
      'Provide complete, self-contained answers in each section',
      'Include specific data points (temperatures, prices, dimensions)',
      'Structure content with clear hierarchy and semantic HTML',
      'Add context and explanations that help LLMs understand relationships',
      'Use "according to" patterns for citation hooks',
      'Include comparison data in structured list format',
      'Answer the "People Also Ask" questions within your content',
      'Make factual claims that can be extracted as standalone statements',
      'Include entity-relationship language (brand + product category associations)'
    ]
  },

  // Traditional SEO
  traditional: {
    description: 'Classic on-page SEO optimization',
    guidelines: [
      'Target keyword in title, first 100 words, and naturally throughout',
      'Use semantic keywords and related terms (LSI)',
      'Optimize meta description (150-160 characters)',
      'Use descriptive, keyword-rich image alt text',
      'Internal linking to related content',
      'External links to authoritative sources',
      'Mobile-friendly formatting',
      'Fast-loading images (optimized)',
      'Clear URL structure'
    ]
  },

  // E-E-A-T signals
  eeat: {
    description: 'Experience, Expertise, Authoritativeness, Trustworthiness',
    guidelines: [
      'Share first-hand experience with products',
      'Include specific details only an expert would know',
      'Reference industry knowledge and context',
      'Be transparent about any limitations or downsides',
      'Include author credentials/expertise signals',
      'Update content regularly with fresh information',
      'Cite reputable sources',
      'Address common misconceptions'
    ]
  }
};

/**
 * Generate SEO-optimized title variations
 */
export function generateTitleVariations(topic, keyword) {
  const templates = [
    `${topic}: What Every Enthusiast Needs to Know`,
    `The Real Truth About ${topic}`,
    `${topic} Guide: Tested and Reviewed`,
    `Why ${topic} Matters More Than You Think`,
    `${topic} Explained: A No-BS Guide`,
    `${topic}: Separating Hype from Reality`,
    `Everything Wrong (and Right) About ${topic}`,
    `${topic}: An Honest Look`,
    `The Complete ${topic} Breakdown`,
    `${topic}: What Nobody Tells You`
  ];

  return templates.map(t => t.replace('${topic}', topic));
}

/**
 * Generate SEO prompt instructions for content generation
 * Enhanced for GEO (Generative Engine Optimization) in 2026
 */
export function getSeoPromptInstructions(targetKeywords) {
  const currentYear = new Date().getFullYear();

  return `
SEO REQUIREMENTS (Follow these naturally without making content feel keyword-stuffed):

1. PRIMARY KEYWORD PLACEMENT:
   - Include primary keyword "${targetKeywords[0]}" in: first paragraph, one H2 heading, conclusion
   - Use it naturally 3-5 times total throughout the article
   - Never force it where it doesn't fit

2. SEMANTIC KEYWORDS to weave in naturally:
   ${targetKeywords.slice(1).map(k => `- ${k}`).join('\n   ')}

3. LLM/AI SEARCH OPTIMIZATION (CRITICAL FOR ${currentYear}):
   - Start each section with a DIRECT, QUOTABLE answer (1-2 sentences max)
   - Use definitional sentences: "[Term] is [clear definition]" - these get cited by AI search
   - Include specific data: temperatures (e.g., "between 350-450°F"), prices ("$15-60 range"), dimensions
   - Use comparison structures that LLMs can parse: "X vs Y: X offers [benefit] while Y provides [benefit]"
   - Answer implicit questions: "How long does X last?", "What's the best X for beginners?"
   - Include "according to" or "based on our testing" attribution phrases - gives LLMs citation hooks
   - Each H2 section should work as a standalone answer if extracted by an AI search engine

4. FAQ-STYLE CONTENT (MANDATORY for FAQ schema + featured snippets):
   - You MUST include at least 3 question-based H2 or H3 headings (this is NOT optional)
   - Format as: "## What is the best [topic]?" or "## How do you [action]?"
   - Answer the question DIRECTLY in the first 1-2 sentences (Google extracts these for featured snippets)
   - Then elaborate with supporting details in the following paragraph
   - These get extracted into FAQ rich snippets AND cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews)
   - Without 3+ question headings, the article will NOT get FAQ rich results in Google

5. E-E-A-T SIGNALS:
   - Share specific personal experience or testing details
   - Mention how long you've been using/testing these products
   - Reference industry context (how things have changed, why certain features matter)
   - Be honest about limitations or situations where something isn't ideal
   - Include specific brand/product names you've actually tested

6. CONTENT FRESHNESS:
   - Reference current year (${currentYear})
   - Mention recent developments or trends in the space
   - Include current pricing or availability context

7. ENTITY OPTIMIZATION:
   - Consistently associate "Oil Slick Pad" with "dab pads", "silicone mats", "concentrate accessories"
   - Use consistent product category terminology across articles
   - Reference the brand naturally 2-3 times in context of expertise

Remember: SEO should be invisible to readers. The content must be genuinely useful first.
`;
}

/**
 * Generate meta description
 */
export function generateMetaDescription(title, content, keyword) {
  return {
    instruction: `Generate a 150-160 character meta description for this blog post that:
    - Includes the keyword "${keyword}" naturally
    - Creates curiosity or promises value
    - Sounds like a real person wrote it
    - Avoids clickbait but encourages clicks
    Title: ${title}
    Content preview: ${content.substring(0, 500)}`
  };
}

/**
 * Image SEO guidelines
 */
export const imageSeoGuidelines = {
  altText: [
    'Describe the image accurately and specifically',
    'Include relevant keyword if natural',
    'Keep under 125 characters',
    'Don\'t start with "Image of" or "Picture of"',
    'Include context relevant to the article'
  ],
  fileName: [
    'Use descriptive, hyphenated file names',
    'Include relevant keywords',
    'Keep short but meaningful',
    'Example: professional-silicone-dab-pad-setup.jpg'
  ]
};

/**
 * Generate descriptive, SEO-friendly image filename from description
 */
export function generateImageFilename(description, index) {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);

  return `${slug}-${index + 1}.png`;
}

/**
 * Generate FAQ schema from content
 * Extracts question-based headings and their answers
 */
export function generateFAQSchema(htmlContent) {
  const faqs = [];

  // Match question headings (H2/H3 that end with ?)
  // Also match common question patterns without ?
  const questionPatterns = [
    /<h[23][^>]*>([^<]*\?)<\/h[23]>/gi,
    /<h[23][^>]*>((?:What|How|Why|When|Where|Which|Can|Should|Is|Are|Do|Does)[^<]*)<\/h[23]>/gi
  ];

  for (const pattern of questionPatterns) {
    let match;
    while ((match = pattern.exec(htmlContent)) !== null) {
      const question = match[1].trim();

      // Find the answer: text between this heading and the next heading
      const headingEnd = match.index + match[0].length;
      const nextHeadingMatch = htmlContent.substring(headingEnd).match(/<h[1-6]/i);
      const answerEnd = nextHeadingMatch
        ? headingEnd + nextHeadingMatch.index
        : headingEnd + 500;

      const answerHtml = htmlContent.substring(headingEnd, answerEnd);

      // Strip HTML tags to get plain text answer
      const answerText = answerHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 300);

      if (answerText.length > 30 && !faqs.find(f => f.question === question)) {
        faqs.push({ question, answer: answerText });
      }
    }
  }

  if (faqs.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.slice(0, 8).map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  };
}

/**
 * Generate HowTo schema from content with numbered steps
 */
export function generateHowToSchema(title, htmlContent) {
  // Only generate for guide/how-to content (expanded patterns)
  const isHowTo = /how to|guide|steps?|tutorial|instructions?|walkthrough|complete|ultimate|master|tips for|method|technique|process|clean|setup|maintain/i.test(title);
  if (!isHowTo) return null;

  const steps = [];

  // Find ordered lists (numbered steps)
  const olMatch = htmlContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  if (olMatch) {
    const listItems = olMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    if (listItems) {
      listItems.forEach((item, i) => {
        const text = item.replace(/<[^>]+>/g, '').trim();
        if (text.length > 10) {
          steps.push({
            '@type': 'HowToStep',
            'position': i + 1,
            'name': text.substring(0, 100),
            'text': text
          });
        }
      });
    }
  }

  // Also try to find numbered patterns in text (1. Step, 2. Step)
  if (steps.length === 0) {
    const numberedPattern = /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\n\n|$)/g;
    const plainText = htmlContent.replace(/<[^>]+>/g, '\n');
    let stepMatch;
    while ((stepMatch = numberedPattern.exec(plainText)) !== null) {
      const text = stepMatch[2].trim();
      if (text.length > 10) {
        steps.push({
          '@type': 'HowToStep',
          'position': parseInt(stepMatch[1]),
          'name': text.substring(0, 100),
          'text': text
        });
      }
    }
  }

  if (steps.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': title,
    'step': steps.slice(0, 15)
  };
}

/**
 * Generate BreadcrumbList schema
 */
export function generateBreadcrumbSchema(title) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://oilslickpad.com'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Blog',
        'item': 'https://oilslickpad.com/blogs/news'
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': title
      }
    ]
  };
}

/**
 * Generate enhanced Article schema with author details
 */
export function generateArticleSchema(article) {
  const currentYear = new Date().getFullYear();

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.title,
    'description': article.metaDescription,
    'image': article.images?.[0]?.url,
    'author': {
      '@type': 'Person',
      'name': article.author || 'Oil Slick Pad Team',
      'url': 'https://oilslickpad.com/pages/about',
      'worksFor': {
        '@type': 'Organization',
        'name': 'Oil Slick Pad'
      }
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Oil Slick Pad',
      'url': 'https://oilslickpad.com',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://oilslickpad.com/logo.png'
      }
    },
    'datePublished': article.publishDate || new Date().toISOString(),
    'dateModified': article.modifiedDate || new Date().toISOString(),
    'wordCount': article.wordCount || 1200,
    'articleSection': 'Cannabis Accessories',
    'keywords': article.keywords || ['dab pad', 'dabbing', 'concentrate tools', 'cannabis accessories'],
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `https://oilslickpad.com/blogs/news/${article.handle || ''}`
    }
  };
}

/**
 * Generate all applicable structured data for a blog post
 * Returns combined JSON-LD script tags
 */
export function generateAllStructuredData(article, htmlContent) {
  const schemas = [];

  // Article schema (always)
  schemas.push(generateArticleSchema(article));

  // Breadcrumb schema (always)
  schemas.push(generateBreadcrumbSchema(article.title));

  // FAQ schema (if content has question headings)
  const faqSchema = generateFAQSchema(htmlContent);
  if (faqSchema) {
    schemas.push(faqSchema);
  }

  // HowTo schema (if content is a guide/tutorial)
  const howToSchema = generateHowToSchema(article.title, htmlContent);
  if (howToSchema) {
    schemas.push(howToSchema);
  }

  // Combine into script tags
  return schemas.map(schema =>
    `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
  ).join('\n');
}

/**
 * Content quality scoring
 * Returns a score 0-100 and specific issues found
 */
export function scoreContent(content, targetKeyword, title) {
  const issues = [];
  let score = 100;

  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const keywordLower = targetKeyword.toLowerCase();
  const keywordCount = (plainText.toLowerCase().match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  // Word count check
  if (wordCount < 800) {
    score -= 25;
    issues.push(`Very short content (${wordCount} words). Target 1200+.`);
  } else if (wordCount < 1200) {
    score -= 10;
    issues.push(`Content below target (${wordCount} words). Target 1200+.`);
  }

  // Keyword presence
  if (keywordCount === 0) {
    score -= 20;
    issues.push(`Primary keyword "${targetKeyword}" not found in content.`);
  } else if (keywordCount < 2) {
    score -= 10;
    issues.push(`Primary keyword used only ${keywordCount} time(s). Target 3-5.`);
  } else if (keywordCount > 15) {
    score -= 15;
    issues.push(`Keyword stuffing detected (${keywordCount} uses). Reduce to 3-8.`);
  }

  // Keyword in first 100 words
  const first100Words = plainText.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  if (!first100Words.includes(keywordLower)) {
    score -= 5;
    issues.push('Primary keyword not in first 100 words.');
  }

  // Heading count
  const headings = (content.match(/<h[23][^>]*>/gi) || []).length;
  if (headings < 3) {
    score -= 10;
    issues.push(`Only ${headings} subheadings. Add more for structure (target 5+).`);
  }

  // Question headings (critical for FAQ schema + featured snippets + GEO)
  const questionHeadings = (content.match(/<h[23][^>]*>[^<]*\?/gi) || []).length;
  const questionPatternHeadings = (content.match(/<h[23][^>]*>(?:What|How|Why|When|Where|Which|Can|Should|Is|Are|Do|Does)[^<]*/gi) || []).length;
  const totalQuestionHeadings = Math.max(questionHeadings, questionPatternHeadings);
  if (totalQuestionHeadings === 0) {
    score -= 15;
    issues.push('CRITICAL: No question-based headings. Need 3+ for FAQ schema, featured snippets, and LLM search.');
  } else if (totalQuestionHeadings < 3) {
    score -= 8;
    issues.push(`Only ${totalQuestionHeadings} question heading(s). Need 3+ for FAQ rich snippets.`);
  }

  // Readability: average sentence length
  if (sentences.length > 0) {
    const avgSentenceLength = wordCount / sentences.length;
    if (avgSentenceLength > 30) {
      score -= 10;
      issues.push(`Sentences too long (avg ${Math.round(avgSentenceLength)} words). Target under 25.`);
    }
  }

  // Check for AI tell patterns
  const aiTells = ['in conclusion', 'it\'s worth noting', 'needless to say', 'at the end of the day',
    'delve', 'tapestry', 'testament', 'landscape', 'pivotal', 'crucial'];
  const aiTellCount = aiTells.filter(tell =>
    plainText.toLowerCase().includes(tell)
  ).length;
  if (aiTellCount > 2) {
    score -= aiTellCount * 3;
    issues.push(`${aiTellCount} AI writing patterns detected. Content may sound artificial.`);
  }

  // Internal link check (in HTML content)
  const internalLinks = (content.match(/href="https:\/\/oilslickpad\.com/g) || []).length;
  if (internalLinks === 0) {
    score -= 5;
    issues.push('No internal links found. Add 2-5 for SEO.');
  }

  // GEO/LLM optimization check
  const hasDefinitionalSentence = /\b(?:is a|are a|refers to|means|defined as)\b/i.test(plainText);
  const hasAttribution = /\b(?:based on|according to|after testing|after comparing|in our experience|we tested|we found)\b/i.test(plainText);
  const hasSpecificData = /\b\d+°F|\$\d+|\d+\s*(?:inches|mm|cm|grams|mg|hours|minutes|seconds|days|weeks)\b/i.test(plainText);
  const hasExperienceSignal = /\b(?:I tested|I found|I've been|in my experience|after \d+ (?:years|months)|hands-on|first-hand)\b/i.test(plainText);

  if (!hasDefinitionalSentence) {
    score -= 5;
    issues.push('No definitional sentences found. Add "[Term] is a..." for LLM citation and featured snippets.');
  }
  if (!hasAttribution) {
    score -= 5;
    issues.push('No attribution phrases. Add "based on our testing..." for LLM citation hooks.');
  }
  if (!hasSpecificData) {
    score -= 5;
    issues.push('No specific data points. Include temperatures, prices, or measurements for LLM search.');
  }
  if (!hasExperienceSignal) {
    score -= 3;
    issues.push('No first-hand experience signals (E-E-A-T). Add "I tested", "in my experience", etc.');
  }

  // Featured snippet readiness check
  const firstParagraph = plainText.substring(0, 300);
  const hasDirectAnswer = firstParagraph.length >= 40 && /[.!]/.test(firstParagraph.substring(0, 200));
  if (!hasDirectAnswer) {
    score -= 3;
    issues.push('First paragraph too short or missing direct answer. Needs 40-60 word opening for featured snippet.');
  }

  // Numbered/bulleted list check (Google loves lists of 5-9 items)
  const listItems = (content.match(/<li[^>]*>/gi) || []).length;
  if (listItems === 0) {
    score -= 3;
    issues.push('No lists found. Add numbered/bulleted lists (5-9 items) for featured snippet eligibility.');
  }

  return {
    score: Math.max(0, score),
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    wordCount,
    keywordDensity: ((keywordCount / wordCount) * 100).toFixed(2) + '%',
    headings,
    questionHeadings: totalQuestionHeadings,
    listItems,
    hasDefinitionalSentence,
    hasAttribution,
    hasSpecificData,
    hasExperienceSignal,
    issues,
    passesQualityGate: score >= 50
  };
}

/**
 * Generate dynamic long-tail keywords for a topic
 * Expands the static keyword list with topic-specific variations
 */
export function expandKeywords(topic, baseKeywords) {
  const topicLower = topic.toLowerCase();
  const expanded = [...baseKeywords];
  const currentYear = new Date().getFullYear();

  // Topic-specific keyword modifiers
  const modifiers = {
    guide: ['beginner guide', 'complete guide', 'step by step'],
    review: ['honest review', 'tested', 'hands on review'],
    comparison: ['vs', 'compared', 'which is better'],
    best: [`best ${currentYear}`, 'top picks', 'top rated'],
    how: ['how to', 'tips for', 'easy way to'],
    clean: ['how to clean', 'cleaning guide', 'maintenance tips'],
    temperature: ['best temperature for', 'temp guide', 'heat settings'],
    storage: ['how to store', 'storage tips', 'keep fresh'],
    beginner: ['for beginners', 'starter guide', `getting started ${currentYear}`]
  };

  // Add relevant modifiers based on topic content
  for (const [key, keywords] of Object.entries(modifiers)) {
    if (topicLower.includes(key)) {
      expanded.push(...keywords.map(k =>
        k.includes(topicLower.split(' ')[0]) ? k : `${k} ${baseKeywords[0] || ''}`
      ));
    }
  }

  // Add question-form keywords (important for voice/LLM search)
  const baseKeyword = baseKeywords[0] || topicLower.split(' ').slice(0, 3).join(' ');
  expanded.push(`what is the best ${baseKeyword}`);
  expanded.push(`how to choose ${baseKeyword}`);
  expanded.push(`${baseKeyword} worth it`);

  // Deduplicate and limit
  return [...new Set(expanded)].slice(0, 15);
}

/**
 * Legacy schema markup function (kept for backward compatibility)
 */
export function getSchemaMarkup(article) {
  return generateArticleSchema(article);
}

/**
 * Content audit suggestions
 */
export function auditContent(content, targetKeyword) {
  const wordCount = content.split(/\s+/).length;
  const keywordCount = (content.toLowerCase().match(new RegExp(targetKeyword.toLowerCase(), 'g')) || []).length;
  const paragraphs = content.split(/\n\n+/).length;
  const headings = (content.match(/^#{2,3}\s/gm) || []).length;

  return {
    wordCount,
    keywordDensity: ((keywordCount / wordCount) * 100).toFixed(2) + '%',
    paragraphs,
    headings,
    suggestions: [
      wordCount < 1200 ? 'Content is under 1200 words - consider expanding' : null,
      keywordCount < 3 ? 'Keyword appears less than 3 times - add more naturally' : null,
      keywordCount > 10 ? 'Keyword may be over-used - reduce to avoid stuffing' : null,
      headings < 4 ? 'Add more subheadings for better structure' : null,
      paragraphs < 8 ? 'Break up content into more paragraphs' : null
    ].filter(Boolean)
  };
}

export default {
  seoGuidelines,
  generateTitleVariations,
  getSeoPromptInstructions,
  generateMetaDescription,
  imageSeoGuidelines,
  generateImageFilename,
  generateFAQSchema,
  generateHowToSchema,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateAllStructuredData,
  scoreContent,
  expandKeywords,
  getSchemaMarkup,
  auditContent
};
