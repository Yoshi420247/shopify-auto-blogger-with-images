# Shopify Auto-Blogger with AI Images

Automated blog content generator for Shopify stores. Creates SEO-optimized, human-sounding blog posts with AI-generated images, then publishes directly to your Shopify blog.

## Features

- **Smart Content Analysis**: Scrapes your existing blogs and competitor sites to identify content opportunities
- **Human-Like Writing**: Uses **OpenAI GPT-5.2** with custom author style profiles to generate content that sounds genuinely human (no AI tells, no em-dashes)
- **AI Image Generation**: Creates relevant images using **Google's Nano Banana Pro 3.0** (Gemini 3 Pro Image) with 1K/2K/4K resolution support
- **SEO Optimization**: Built-in optimization for traditional search, Google AI Overviews, and LLM-based search engines
- **Automatic SEO Hyperlinking**: Injects internal links to product collections and external links to authoritative sources
- **Content Deduplication**: AI-powered topic uniqueness checking prevents duplicate content
- **Research Caching**: Reduces API calls with time-based caching for competitor and blog data
- **Shopify Integration**: Publishes directly to your Shopify blog using the GraphQL Admin API
- **Scheduled Automation**: Runs automatically 5x per day via GitHub Actions across two content categories

## AI Models Used

| Purpose | Model | Details |
|---------|-------|---------|
| Content Generation | **GPT-5.2** | OpenAI's latest model with adaptive reasoning |
| Content Review | **GPT-5.2** (low effort) | Final quality check before publishing |
| Image Generation | **Nano Banana Pro 3.0** | Gemini 3 Pro Image (`gemini-3-pro-image-preview`) |
| Fallback Images | Nano Banana / Imagen 4 | Automatic fallback for reliability |

## How It Works

1. **Research Phase**
   - Scrapes existing blog posts from your Shopify store (cached 6 hours)
   - Analyzes 5 competitor blogs for trending topics (cached 12 hours)
   - Identifies content gaps and outdated posts
   - Generates AI-powered content ideas (cached 24 hours)
   - Fetches vendor products for product-focused categories

2. **Content Generation**
   - Selects from 10 author style profiles for variety
   - GPT-5.2 generates 1200-2000 word blog posts with adaptive reasoning
   - Aggressive AI tell removal (em dashes, overused phrases, meta-commentary)
   - Automatic year correction to prevent outdated references
   - SEO audit on generated content

3. **Image Creation**
   - Parses content for `[IMAGE: description]` markers
   - Generates images using Nano Banana Pro 3.0 (falls back to Nano Banana, then Imagen 4)
   - Uploads images to Shopify Files for permanent CDN URLs
   - Creates SEO-friendly alt text

4. **Quality Assurance**
   - AI content review fixes broken HTML and formatting issues
   - SEO hyperlink injection (internal product links + external authority links)
   - Topic deduplication prevents writing about the same subject twice

5. **Publishing**
   - Connects to Shopify Admin API (GraphQL with REST fallback)
   - Publishes article with featured image, tags, and meta description
   - Schema.org JSON-LD structured data for rich snippets
   - Random author pseudonyms for byline variety

## Setup

### 1. Configure GitHub Secrets

Go to your repository Settings > Secrets and variables > Actions, then add:

| Secret | Description |
|--------|-------------|
| `SHOPIFY_ADMIN_API_TOKEN` | Your Shopify Admin API access token |
| `SHOPIFY_STORE_DOMAIN` | Your store domain (e.g., `oilslickpad.com`) |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `GEMINI_API_KEY` | Your Google Gemini API key |

### 2. Get Your API Keys

**Shopify Admin API Token:**
1. Go to Shopify Admin > Settings > Apps and sales channels
2. Click "Develop apps" > "Create an app"
3. Configure Admin API scopes: `write_content`, `read_content`, `read_products`
4. Install the app and copy the Admin API access token

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key

**Gemini API Key:**
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key

### 3. Customize Configuration

Edit `src/config.js` to customize:
- Your website URL and blog path
- Competitor websites to analyze
- SEO focus keywords
- Blog generation settings (words, images, mode)
- Content categories and topic pools

## Usage

### Automatic (Scheduled)

The workflow runs automatically **5 times per day**:

| Time (UTC) | Category | Description |
|------------|----------|-------------|
| 6:00 AM | Dabbing & Storage | Storage, cleaning, dabbing guides |
| 10:00 AM | Dabbing & Storage | Storage, cleaning, dabbing guides |
| 2:00 PM | Bongs, Rigs & Accessories | Product-focused content |
| 6:00 PM | Bongs, Rigs & Accessories | Product-focused content |
| 10:00 PM | Bongs, Rigs & Accessories | Product-focused content |

To change the schedule, edit `.github/workflows/auto-blogger.yml`.

### Manual Trigger

1. Go to Actions tab in your GitHub repository
2. Select "Auto-Blogger with AI Images"
3. Click "Run workflow"
4. Configure options:
   - **blogs_count**: 1-10 blogs per run
   - **mode**: auto, new, update, or mixed
   - **content_category**: auto, dabbing_storage, or what_you_need
   - **topic**: Override with a specific topic
   - **dry_run**: Test without publishing

### Local Development

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env with your API keys

# Run the auto-blogger
npm start

# Dry run (no publishing)
DRY_RUN=true npm start

# Custom topic
CUSTOM_TOPIC="Best Dab Pads for Beginners" npm start
```

## Architecture

```
src/
├── index.js                    # Main orchestrator (research, plan, generate, publish)
├── config.js                   # Central configuration (env vars, categories, SEO)
├── scrapers/
│   ├── blogScraper.js         # Scrapes your existing Shopify blogs
│   └── competitorScraper.js   # Analyzes 5 competitor sites for trends
├── generators/
│   ├── contentGenerator.js    # GPT-5.2 content generation with style profiles
│   ├── imageGenerator.js      # Gemini image generation with fallbacks
│   └── contentReviewer.js     # AI content review and topic deduplication
├── publishers/
│   └── shopifyPublisher.js    # Shopify API (GraphQL + REST), markdown-to-HTML
└── utils/
    ├── authorStyles.js        # 10 author style profiles + pseudonyms
    ├── seoOptimizer.js        # SEO optimization and content auditing
    ├── hyperlinkInjector.js   # Automatic internal/external link injection
    └── researchCache.js       # Time-based caching for research data
```

## Content Quality Features

### Human-Like Writing
- 10 distinct author style profiles (Passionate Expert, Friendly Educator, Witty Observer, etc.)
- 30 random author pseudonyms for byline variety
- Automatic removal of 100+ AI tell phrases and patterns
- No em-dashes, no corporate speak, no meta-commentary
- Natural transitions and varied sentence structure

### SEO Optimization
- Traditional on-page SEO (keyword placement, meta descriptions)
- Google AI Overview optimization (structured answers, question headings)
- LLM/ChatGPT search optimization (comprehensive, authoritative content)
- E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness)
- Schema.org JSON-LD structured data
- Automatic internal linking to product collections (priority: highest margin first)
- External links to authoritative sources (Leafly, NORML, MJBizDaily)

### Content Intelligence
- Competitor analysis across 5 sites for trending topics
- Content gap identification against industry topics
- Outdated content detection (>6 months old)
- AI-powered topic deduplication (within 90 days + within same run)
- Research caching to reduce API costs (6-24 hour freshness)

## Content Modes

| Mode | Behavior |
|------|----------|
| `auto` | AI decides based on content analysis (default) |
| `new` | Creates only new blog posts |
| `update` | Rewrites only outdated existing posts |
| `mixed` | Alternates between updates and new posts |

## Customization

### Adding Competitors

Edit the `competitors` array in `src/config.js`:

```javascript
competitors: [
  'https://competitor1.com/blog',
  'https://competitor2.com/blog',
  // Add more...
]
```

### Changing Author Styles

Edit `src/utils/authorStyles.js` to add or modify author profiles.

### Adjusting SEO Keywords

Edit the `seo.focusKeywords` array in `src/config.js`.

### Adding Product Collections for Linking

Edit `PRIORITY_COLLECTIONS` and `SECONDARY_COLLECTIONS` in `src/utils/hyperlinkInjector.js`.

## Troubleshooting

### Common Issues

1. **Shopify API errors**: Ensure your Admin API token has the required scopes (`write_content`, `read_content`, `read_products`)

2. **OpenAI rate limits**: GPT-5.2 has rate limits. If you hit them, the action will fail and retry on the next scheduled run.

3. **Image generation failures**: Nano Banana Pro 3.0 may occasionally fail. The system automatically falls back to Nano Banana or Imagen 4, and uses placeholders as a last resort.

4. **Scraping errors**: Some competitor sites may block scraping. The system gracefully handles errors and continues with available data.

5. **Duplicate topics**: The deduplication system checks against existing blog posts and topics used in the current run. If all topics seem covered, it adds a year suffix for freshness.

### Checking Logs

Go to Actions tab > Select a workflow run > Click on the job to see detailed logs.

## Cost Considerations

- **OpenAI GPT-5.2**: ~$0.02-0.10 per blog post (with adaptive reasoning)
- **Nano Banana Pro 3.0**: ~$0.05 per image
- **Images per post**: 2 (reduced from 3 for cost optimization)
- **Images skipped in dry-run**: Saves API costs during testing
- **Research caching**: Reduces redundant scraping and API calls
- **Estimated total**: ~$0.15-0.25 per blog post with 2 images

## License

MIT
