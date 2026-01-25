# Shopify Auto-Blogger Handoff Document

This document provides all technical details needed to adapt this auto-blogging system for a different Shopify store, product line, or content strategy.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [API Integrations](#api-integrations)
5. [Content Generation Pipeline](#content-generation-pipeline)
6. [Configuration System](#configuration-system)
7. [Scheduling System](#scheduling-system)
8. [SEO & Hyperlinking](#seo--hyperlinking)
9. [Humanization System](#humanization-system)
10. [Cost Optimization](#cost-optimization)
11. [Customization Guide](#customization-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (Scheduler)                    │
│              Triggers at configured times (cron)                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        src/index.js                              │
│                    Main Orchestrator                             │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   Research    │      │   Generate    │      │    Publish    │
│    Phase      │      │    Phase      │      │    Phase      │
├───────────────┤      ├───────────────┤      ├───────────────┤
│ • Scrape own  │      │ • OpenAI GPT  │      │ • Shopify API │
│   blog        │      │   content     │      │ • Image upload│
│ • Scrape      │      │ • Gemini      │      │ • Article     │
│   competitors │      │   images      │      │   creation    │
│ • Cache data  │      │ • AI review   │      │               │
│               │      │ • Hyperlinks  │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
```

### Data Flow

1. **Research**: Scrape existing blogs + competitors → cache results
2. **Planning**: Analyze gaps, select topics, check uniqueness
3. **Generation**: Create content with OpenAI, images with Gemini
4. **Processing**: AI review, year fixing, hyperlink injection
5. **Publishing**: Upload to Shopify via GraphQL/REST API

---

## Project Structure

```
shopify-auto-blogger/
├── .github/
│   └── workflows/
│       └── auto-blogger.yml      # GitHub Actions scheduler
├── src/
│   ├── index.js                  # Main orchestrator
│   ├── config.js                 # All configuration
│   ├── generators/
│   │   ├── contentGenerator.js   # OpenAI content generation
│   │   ├── contentReviewer.js    # AI content review/fixing
│   │   └── imageGenerator.js     # Gemini image generation
│   ├── publishers/
│   │   └── shopifyPublisher.js   # Shopify API integration
│   ├── scrapers/
│   │   ├── blogScraper.js        # Scrape own blog
│   │   └── competitorScraper.js  # Scrape competitor blogs
│   └── utils/
│       ├── authorStyles.js       # Writing styles & AI tells
│       ├── hyperlinkInjector.js  # SEO internal/external links
│       ├── researchCache.js      # File-based caching
│       └── seoOptimizer.js       # SEO utilities
├── .cache/                       # Auto-generated cache files
├── package.json
└── .env                          # Environment variables (not committed)
```

---

## Environment Setup

### Required Environment Variables

```bash
# Shopify API
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxxxxxxxxxx

# OpenAI API
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Google Gemini API
GEMINI_API_KEY=xxxxxxxxxxxxx

# Optional behavior controls
BLOGS_PER_RUN=1              # Number of blogs per execution (1-10)
BLOG_MODE=auto               # auto, new, update, mixed
CONTENT_CATEGORY=auto        # Category for topic selection
DRY_RUN=false                # true = generate but don't publish
CUSTOM_TOPIC=""              # Override topic selection
```

### GitHub Secrets Setup

In your repository settings → Secrets and variables → Actions:
- `SHOPIFY_ADMIN_API_TOKEN`
- `SHOPIFY_STORE_DOMAIN`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

---

## API Integrations

### 1. OpenAI API (Content Generation)

**File**: `src/generators/contentGenerator.js`

**Configuration** (`src/config.js`):
```javascript
openai: {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.2',           // Or gpt-4, gpt-4-turbo, etc.
  maxOutputTokens: 8192,
  reasoningEffort: 'medium'   // none, low, medium, high (for reasoning models)
}
```

**API Call Pattern**:
```javascript
const response = await client.chat.completions.create({
  model: config.openai.model,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  max_completion_tokens: config.openai.maxOutputTokens,
  reasoning_effort: 'medium'  // For GPT-5.x models
});
```

**Usage Points**:
- `generateBlogPost()` - Main content generation (medium reasoning)
- `generateTopicIdeas()` - Topic brainstorming (low reasoning)
- `reviewAndFixContent()` - HTML cleanup (low reasoning)
- `isTopicRecentlyCovered()` - Deduplication check (low reasoning)

### 2. Google Gemini API (Image Generation)

**File**: `src/generators/imageGenerator.js`

**Configuration**:
```javascript
gemini: {
  apiKey: process.env.GEMINI_API_KEY,
  imageModel: 'gemini-3-pro-image-preview',
  textModel: 'gemini-3-pro',
  imageSize: '1K',            // 1K, 2K, 4K
  aspectRatio: '16:9'
}
```

**API Call Pattern**:
```javascript
const response = await ai.models.generateContent({
  model: config.gemini.imageModel,
  contents: [{ parts: [{ text: imagePrompt }] }],
  generationConfig: {
    responseModalities: ['image', 'text'],
    imageSizes: [config.gemini.imageSize],
    aspectRatio: config.gemini.aspectRatio
  }
});
```

### 3. Shopify Admin API (Publishing)

**File**: `src/publishers/shopifyPublisher.js`

**Configuration**:
```javascript
shopify: {
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
  adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
  apiVersion: '2024-10'       // Update as needed
}
```

**Key GraphQL Operations**:

#### Get Blogs
```graphql
query GetBlogs {
  blogs(first: 10) {
    edges {
      node { id, title, handle }
    }
  }
}
```

#### Create Article
```graphql
mutation CreateArticle($article: ArticleCreateInput!) {
  articleCreate(article: $article) {
    article { id, title, handle, publishedAt }
    userErrors { field, message }
  }
}
```

#### Upload Image (3-step process)
1. `stagedUploadsCreate` - Get upload URL
2. HTTP POST to staged URL - Upload binary
3. `fileCreate` - Register file in Shopify

#### Get Products by Vendor
```graphql
query GetProductsByVendor($query: String!, $first: Int!) {
  products(first: $first, query: $query) {
    edges {
      node { id, title, handle, description, productType, vendor }
    }
  }
}
```

**REST API Fallback**:
The system falls back to REST API if GraphQL fails:
```javascript
await axios.post(`https://${domain}/admin/api/${version}/blogs/${blogId}/articles.json`, {
  article: { title, body_html, author, tags, published, image: { attachment: base64Data } }
}, { headers: { 'X-Shopify-Access-Token': token } });
```

---

## Content Generation Pipeline

### Pipeline Stages (in order)

```
1. Research Phase
   └── doResearch() in index.js
       ├── scrapeAllBlogs() - Own blog analysis
       ├── analyzeAllCompetitors() - Competitor analysis
       ├── generateTopicIdeas() - AI topic generation
       └── getProductsByVendor() - Shopify products (optional)

2. Planning Phase
   └── planMultipleBlogs() in index.js
       ├── Check content category
       ├── Filter used topics
       ├── Select from topic pool or generate

3. Topic Uniqueness Check
   └── getUniqueTopic() in contentReviewer.js
       └── isTopicRecentlyCovered() - AI deduplication

4. Content Generation
   └── generateBlogPost() in contentGenerator.js
       ├── buildSystemPrompt() - Author style, rules, date
       ├── buildUserPrompt() - Topic, keywords, context
       └── removeAiTells() - Post-processing cleanup

5. Image Generation
   └── generateBlogImages() in imageGenerator.js
       └── generateImage() - Per image marker

6. Content Preparation
   └── prepareContentWithImages() in index.js
       ├── uploadImageToFiles() - Upload to Shopify CDN
       └── markdownToHtml() - Convert and style

7. AI Content Review
   └── reviewAndFixContent() in contentReviewer.js
       ├── programmaticFixes() - Regex-based cleanup
       └── AI review - GPT cleanup pass

8. SEO Hyperlink Injection
   └── injectHyperlinks() in hyperlinkInjector.js
       ├── Internal links to collections
       └── External links to authority sites

9. Publishing
   └── createArticle() in shopifyPublisher.js
       └── GraphQL or REST API
```

### System Prompt Structure

The system prompt in `buildSystemPrompt()` includes:

1. **Date Information** - Current year, month, date
2. **Writing Identity** - Author style persona
3. **Critical Rules** - Human-like writing requirements
4. **Vendor Rules** - Brand mention restrictions
5. **Humanization Rules** - AI pattern avoidance
6. **Industry Language** - Niche-specific terminology
7. **Title Requirements** - SEO title guidelines
8. **Content Structure** - Formatting requirements
9. **Callout Boxes** - Pro Tip, Warning, Note formats
10. **Image Markers** - Placement instructions

---

## Configuration System

### Main Configuration File: `src/config.js`

```javascript
export const config = {
  // Store settings
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    apiVersion: '2024-10'
  },

  // AI model settings
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-5.2',
    maxOutputTokens: 8192,
    reasoningEffort: 'medium'
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    imageModel: 'gemini-3-pro-image-preview',
    imageSize: '1K',
    aspectRatio: '16:9'
  },

  // Blog behavior
  blog: {
    minWords: 1200,
    maxWords: 2000,
    imagesPerPost: 2,
    blogsPerRun: parseInt(process.env.BLOGS_PER_RUN) || 1,
    mode: process.env.BLOG_MODE || 'auto',
    contentCategory: process.env.CONTENT_CATEGORY || 'auto',
    updateThresholdDays: 180,
    dryRun: process.env.DRY_RUN === 'true'
  },

  // Content categories with topic pools
  contentCategories: {
    category_name: {
      name: 'Display Name',
      vendor: 'Shopify Vendor Tag' || null,
      topicPool: ['Topic 1', 'Topic 2', ...],
      keywords: ['keyword1', 'keyword2', ...]
    }
  },

  // Website info
  website: {
    url: 'https://yoursite.com',
    blogPath: '/blogs/news',
    niche: 'your niche description'
  },

  // Competitors to analyze
  competitors: [
    'https://competitor1.com/blog',
    'https://competitor2.com/blog'
  ],

  // SEO settings
  seo: {
    focusKeywords: ['keyword1', 'keyword2', ...],
    targetAudience: 'audience description'
  }
};
```

---

## Scheduling System

### GitHub Actions Workflow: `.github/workflows/auto-blogger.yml`

```yaml
name: Auto-Blogger

on:
  schedule:
    # Multiple cron schedules for different content categories
    - cron: '0 6 * * *'   # Category A - 6 AM UTC
    - cron: '0 10 * * *'  # Category A - 10 AM UTC
    - cron: '0 14 * * *'  # Category B - 2 PM UTC
    - cron: '0 18 * * *'  # Category B - 6 PM UTC

  workflow_dispatch:
    inputs:
      blogs_count:
        description: 'Number of blogs'
        default: '1'
        type: choice
        options: ['1', '2', '3', '5']
      content_category:
        description: 'Content category'
        default: 'auto'
        type: choice
        options: ['auto', 'category_a', 'category_b']
      dry_run:
        description: 'Dry run mode'
        default: false
        type: boolean

jobs:
  generate-blog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      - name: Determine category from schedule
        id: category
        run: |
          HOUR=$(date -u +%H)
          if [ "$HOUR" = "06" ] || [ "$HOUR" = "10" ]; then
            echo "category=category_a" >> $GITHUB_OUTPUT
          else
            echo "category=category_b" >> $GITHUB_OUTPUT
          fi

      - name: Run Auto-Blogger
        env:
          SHOPIFY_ADMIN_API_TOKEN: ${{ secrets.SHOPIFY_ADMIN_API_TOKEN }}
          SHOPIFY_STORE_DOMAIN: ${{ secrets.SHOPIFY_STORE_DOMAIN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          CONTENT_CATEGORY: ${{ steps.category.outputs.category }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
        run: npm start
```

### Cron Schedule Reference

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

Examples:
- `0 9 * * *` - Daily at 9 AM UTC
- `0 */8 * * *` - Every 8 hours
- `0 6,14,22 * * *` - Three times daily

---

## SEO & Hyperlinking

### Hyperlink Injector: `src/utils/hyperlinkInjector.js`

**Configuration Structure**:
```javascript
const PRIORITY_COLLECTIONS = [
  {
    name: 'Collection Name',
    url: '/collections/slug',
    keywords: ['trigger word 1', 'trigger word 2', ...]
  }
];

const SECONDARY_COLLECTIONS = [...];

const EXTERNAL_SOURCES = {
  category: [
    { name: 'Source Name', url: 'https://...', topics: ['topic1', 'topic2'] }
  ]
};

const CONFIG = {
  minSpacingChars: 200,
  internalLinksPerThousand: { min: 2, max: 5 },
  externalLinksPerArticle: { min: 1, max: 2 }
};
```

**Rules Enforced**:
- First-mention only (no repeat links)
- Minimum 200 character spacing between links
- No links inside headings (H1-H6)
- Same collection linked only once
- Priority collections linked first

**Usage**:
```javascript
import { injectHyperlinks, getLinkStats } from './utils/hyperlinkInjector.js';

const linkedContent = injectHyperlinks(htmlContent, articleTitle);
const stats = getLinkStats(linkedContent);
// { wordCount, internalLinks, externalLinks, internalLinkDensity }
```

---

## Humanization System

### Author Styles: `src/utils/authorStyles.js`

**Multiple Writing Personas**:
```javascript
export const authorStyles = {
  passionateExpert: {
    styleName: 'Passionate Expert',
    description: 'Direct, honest, passionate about craft',
    styleNotes: `- Write with unfiltered honesty...`,
    toneLevel: 'casual-professional'
  },
  friendlyEducator: { ... },
  insightfulStoryteller: { ... },
  // ... more styles
};
```

**AI Tells to Avoid** (patterns removed post-generation):
```javascript
export const aiTellsToAvoid = [
  // Dashes
  '—', '–',

  // Transitions
  'In conclusion', 'Moving forward', 'That being said',

  // AI vocabulary
  'delve', 'intricate', 'tapestry', 'testament', 'pivotal',
  'crucial', 'vibrant', 'landscape', 'foster', 'showcase',

  // Promotional
  'boasts', 'nestled', 'breathtaking', 'stunning',

  // Meta-commentary
  'If I were writing', 'this is where I would',

  // ... 100+ patterns
];
```

**Natural Transitions** (alternatives to use):
```javascript
export const naturalTransitions = [
  'Look,', 'Here\'s the thing:', 'Truth is,',
  'Real talk:', 'After years of', 'The secret is',
  // ... more
];
```

### Year Correction

**File**: `src/generators/contentGenerator.js`

Two functions ensure correct year:
1. `fixTitleYear(title)` - Aggressive title-only fix
2. `fixIncorrectYears(content)` - Content-wide patterns

```javascript
// Replaces any year from 2020 to (currentYear-1) with currentYear
// Patterns caught:
// - "in/for/of 2024" → "in/for/of 2026"
// - "2024 Guide" → "2026 Guide"
// - "best X 2024" → "best X 2026"
```

---

## Cost Optimization

### Implemented Optimizations

1. **Skip Images in Dry Run**
   ```javascript
   if (config.blog.dryRun) {
     console.log('[DRY RUN] Skipping image generation');
     // Create placeholder entries
   }
   ```

2. **Reduced Images Per Post**
   ```javascript
   imagesPerPost: 2  // Reduced from 3 (33% savings)
   ```

3. **Research Caching**
   ```javascript
   // Cache durations:
   existingBlogs: 6 hours
   competitorData: 12 hours
   trendingTopics: 12 hours
   contentIdeas: 24 hours
   ```

4. **Reasoning Effort Levels**
   ```javascript
   // Content generation: 'medium' (quality matters)
   // Topic ideas: 'low' (simple task)
   // Content review: 'low' (just cleanup)
   // Topic checking: 'low' (JSON response)
   ```

### Cache System: `src/utils/researchCache.js`

```javascript
import { getCachedOrFetch } from './utils/researchCache.js';

const data = await getCachedOrFetch('cacheKey', async () => {
  return await expensiveFetchOperation();
}, maxAgeHours);
```

### Estimated Costs (per 5-blog run)

| Component | Calls | Cost |
|-----------|-------|------|
| OpenAI (content) | 5 | $2-3 |
| OpenAI (review) | 5 | $0.50 |
| OpenAI (topics) | 1 | $0.20 |
| Gemini (images) | 10 | $0.50-1 |
| **Total** | | **$3-5** |

With caching warm: **$2-3** (research calls skipped)

---

## Customization Guide

### To Adapt for a New Store:

#### 1. Update `config.js`

```javascript
// Change store details
shopify: {
  storeDomain: 'newstore.myshopify.com',
  // ...
}

// Change website info
website: {
  url: 'https://newstore.com',
  blogPath: '/blogs/your-blog-handle',
  niche: 'your product niche'
}

// Update competitors
competitors: [
  'https://competitor1.com/blog',
  // ...
]

// Update SEO keywords
seo: {
  focusKeywords: ['your', 'keywords'],
  targetAudience: 'your audience'
}
```

#### 2. Update Content Categories

```javascript
contentCategories: {
  your_category: {
    name: 'Category Display Name',
    vendor: 'Shopify Vendor' || null,
    topicPool: [
      'Topic idea 1',
      'Topic idea 2',
      // 15-20 topics per category
    ],
    keywords: ['related', 'keywords']
  }
}
```

#### 3. Update System Prompt

In `contentGenerator.js`, modify `buildSystemPrompt()`:
- Change company name and description
- Update industry-specific terminology
- Adjust writing rules for your brand voice

#### 4. Update Hyperlink Collections

In `hyperlinkInjector.js`:
```javascript
const PRIORITY_COLLECTIONS = [
  {
    name: 'Your Top Collection',
    url: '/collections/your-collection',
    keywords: ['trigger', 'words']
  }
];
```

#### 5. Update Author Styles (Optional)

In `authorStyles.js`, customize personas for your brand voice.

#### 6. Update Workflow Schedule

In `.github/workflows/auto-blogger.yml`:
- Adjust cron schedules
- Update category detection logic

---

## Key Files Quick Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/index.js` | Main orchestrator | `main()`, `doResearch()`, `generateAndPublishBlog()` |
| `src/config.js` | All configuration | Export `config` object |
| `src/generators/contentGenerator.js` | Content creation | `generateBlogPost()`, `buildSystemPrompt()` |
| `src/generators/imageGenerator.js` | Image creation | `generateBlogImages()` |
| `src/generators/contentReviewer.js` | Content cleanup | `reviewAndFixContent()`, `getUniqueTopic()` |
| `src/publishers/shopifyPublisher.js` | Shopify API | `createArticle()`, `uploadImageToFiles()` |
| `src/utils/hyperlinkInjector.js` | SEO links | `injectHyperlinks()` |
| `src/utils/authorStyles.js` | Writing styles | `selectAuthorStyle()`, `aiTellsToAvoid` |
| `src/utils/researchCache.js` | Caching | `getCachedOrFetch()` |

---

## Troubleshooting

### Common Issues

1. **"Shopify connection failed"**
   - Check `SHOPIFY_ADMIN_API_TOKEN` and `SHOPIFY_STORE_DOMAIN`
   - Ensure API token has `write_content` scope

2. **"No content generated"**
   - Check `OPENAI_API_KEY`
   - Review OpenAI API quota

3. **Images not generating**
   - Check `GEMINI_API_KEY`
   - Verify Gemini API access

4. **Outdated years in titles**
   - Year fixing runs post-generation
   - Check `fixTitleYear()` and `fixIncorrectYears()`

5. **Cache not working**
   - Ensure `.cache/` directory is writable
   - Check cache age thresholds

### Debug Mode

Run with `DRY_RUN=true` to test without publishing:
```bash
DRY_RUN=true npm start
```

---

## Version History

- **v1.0** - Basic auto-blogger
- **v1.1** - Added image generation
- **v1.2** - Added content categories
- **v1.3** - Added humanization rules
- **v1.4** - Added cost optimizations (caching, dry-run skip)
- **v1.5** - Added SEO hyperlinking

---

*Document generated for handoff purposes. Adapt all product-specific content for your use case.*
