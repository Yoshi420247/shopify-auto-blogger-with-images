# Shopify Auto-Blogger with AI Images

Automated blog content generator for Shopify stores. Creates SEO-optimized, human-sounding blog posts with AI-generated images, then publishes directly to your Shopify blog.

## Features

- **Smart Content Analysis**: Scrapes your existing blogs and competitor sites to identify content opportunities
- **Human-Like Writing**: Uses **OpenAI GPT-5.1** (November 2025) with custom author style profiles to generate content that sounds genuinely human (no AI tells, no em-dashes)
- **AI Image Generation**: Creates relevant images using **Google's Nano Banana Pro 3.0** (Gemini 3 Pro Image) with 2K/4K resolution support
- **SEO Optimization**: Built-in optimization for traditional search, Google AI Overviews, and LLM-based search engines
- **Shopify Integration**: Publishes directly to your Shopify blog using the GraphQL Admin API
- **Scheduled Automation**: Runs automatically via GitHub Actions on a configurable schedule

## AI Models Used

| Purpose | Model | Details |
|---------|-------|---------|
| Content Generation | **GPT-5.1** | OpenAI's November 2025 release with adaptive reasoning |
| Image Generation | **Nano Banana Pro 3.0** | Gemini 3 Pro Image (`gemini-3-pro-image-preview`) |
| Fallback Images | Nano Banana / Imagen 4 | Automatic fallback for reliability |

## How It Works

1. **Research Phase**
   - Scrapes existing blog posts from your Shopify store
   - Analyzes competitor blogs and headshop websites
   - Identifies trending topics and content gaps

2. **Content Generation**
   - Selects appropriate author style (Hunter S. Thompson, Anthony Bourdain, etc.)
   - GPT-5.1 generates 1200+ word blog posts with adaptive reasoning
   - Removes AI tells and creates natural-sounding content
   - Includes SEO optimization for 2025 best practices

3. **Image Creation**
   - Parses content for image markers
   - Generates 2K/4K images using Nano Banana Pro 3.0
   - Creates SEO-friendly alt text

4. **Publishing**
   - Connects to Shopify Admin API
   - Publishes the article with images
   - Sets meta description and tags

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
3. Configure Admin API scopes: `write_content`, `read_content`
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
- Blog generation settings

## Usage

### Automatic (Scheduled)

The workflow runs automatically twice per week (Mondays and Thursdays at 9 AM UTC).

To change the schedule, edit `.github/workflows/auto-blogger.yml`:

```yaml
schedule:
  - cron: '0 9 * * 1,4'  # Mondays and Thursdays at 9 AM UTC
```

### Manual Trigger

1. Go to Actions tab in your GitHub repository
2. Select "Auto-Blogger with AI Images"
3. Click "Run workflow"
4. Optionally enter a specific topic

### Local Development

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env with your API keys

# Run the auto-blogger
npm start
```

## Architecture

```
src/
├── index.js                    # Main orchestrator
├── config.js                   # Configuration
├── scrapers/
│   ├── blogScraper.js         # Scrapes your existing blogs
│   └── competitorScraper.js   # Analyzes competitor content
├── generators/
│   ├── contentGenerator.js    # GPT-5.1 content generation
│   └── imageGenerator.js      # Nano Banana Pro 3.0 image generation
├── publishers/
│   └── shopifyPublisher.js    # Shopify API integration
└── utils/
    ├── authorStyles.js        # Author style profiles
    └── seoOptimizer.js        # SEO optimization utilities
```

## Content Quality Features

### Human-Like Writing
- Author style profiles based on real writers (Hunter S. Thompson, Anthony Bourdain, etc.)
- Automatic removal of AI tells and patterns
- No em-dashes, no corporate speak
- Natural transitions and sentence variation

### SEO Optimization
- Traditional on-page SEO
- Google AI Overview optimization
- LLM/ChatGPT search optimization
- E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness)

### Content Intelligence
- Competitor analysis for trending topics
- Content gap identification
- Outdated content refresh
- Keyword optimization

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

## Troubleshooting

### Common Issues

1. **Shopify API errors**: Ensure your Admin API token has the required scopes (`write_content`, `read_content`)

2. **OpenAI rate limits**: GPT-5.1 has rate limits. If you hit them, the action will fail and retry on the next scheduled run.

3. **Image generation failures**: Nano Banana Pro 3.0 may occasionally fail. The system automatically falls back to Nano Banana or Imagen 4, and uses placeholders as a last resort.

4. **Scraping errors**: Some competitor sites may block scraping. The system gracefully handles errors and continues with available data.

### Checking Logs

Go to Actions tab > Select a workflow run > Click on the job to see detailed logs.

## Cost Considerations

- **OpenAI GPT-5.1**: ~$0.02-0.10 per blog post (with adaptive reasoning)
- **Nano Banana Pro 3.0**: ~$0.05 per 2K image
- **Estimated total**: ~$0.20-0.35 per blog post with 3 images

## License

MIT
