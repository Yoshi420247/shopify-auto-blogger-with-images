/**
 * SEO Optimizer for AI and Traditional Search
 *
 * Implements latest SEO best practices including:
 * - Traditional Google SEO
 * - AI Overview optimization (Google SGE)
 * - LLM/ChatGPT search optimization
 * - Voice search optimization
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

  // LLM Search optimization (ChatGPT, Perplexity, etc.)
  llmSearch: {
    description: 'Optimize for LLM-based search engines',
    guidelines: [
      'Write comprehensive, authoritative content',
      'Include clear definitions of key terms',
      'Use natural language that matches how people ask questions',
      'Provide complete answers within the content',
      'Include related topics and semantic variations',
      'Structure content with clear hierarchy',
      'Add context and explanations for technical terms',
      'Use conversational but informative tone'
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

  return templates;
}

/**
 * Generate SEO prompt instructions for content generation
 */
export function getSeoPromptInstructions(targetKeywords) {
  return `
SEO REQUIREMENTS (Follow these naturally without making content feel keyword-stuffed):

1. PRIMARY KEYWORD PLACEMENT:
   - Include primary keyword "${targetKeywords[0]}" in: first paragraph, one H2 heading, conclusion
   - Use it naturally 3-5 times total throughout the article
   - Never force it where it doesn't fit

2. SEMANTIC KEYWORDS to weave in naturally:
   ${targetKeywords.slice(1).map(k => `- ${k}`).join('\n   ')}

3. STRUCTURE FOR AI/LLM SEARCH:
   - Start with a direct, quotable answer to the main question
   - Use question-based H2 headings (e.g., "What makes a quality dab pad?")
   - Each section should be able to stand alone as a complete answer
   - Include specific details: materials, dimensions, price ranges, etc.

4. E-E-A-T SIGNALS:
   - Share specific personal experience or testing details
   - Mention how long you've been using/testing these products
   - Reference industry context (how things have changed, why certain features matter)
   - Be honest about limitations or situations where something isn't ideal

5. CONTENT FRESHNESS:
   - Reference the current year (${new Date().getFullYear()})
   - Mention recent developments or trends in the space
   - Include current pricing or availability context

6. INTERNAL/EXTERNAL LINKING OPPORTUNITIES:
   - Suggest 2-3 places for internal links to related content
   - Identify 1-2 places where external authority citations would help

Remember: SEO should be invisible to readers. The content must be genuinely useful first.
`;
}

/**
 * Generate meta description
 */
export function generateMetaDescription(title, content, keyword) {
  // This will be called with AI assistance in the main generator
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
 * Schema markup suggestions for blog posts
 */
export function getSchemaMarkup(article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.title,
    'description': article.metaDescription,
    'image': article.images?.[0]?.url,
    'author': {
      '@type': 'Organization',
      'name': 'Oil Slick Pad',
      'url': 'https://oilslickpad.com'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Oil Slick Pad',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://oilslickpad.com/logo.png'
      }
    },
    'datePublished': article.publishDate,
    'dateModified': article.modifiedDate || article.publishDate
  };
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
  getSchemaMarkup,
  auditContent
};
