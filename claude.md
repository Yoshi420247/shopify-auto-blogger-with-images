# Shopify Auto-Blogger - Claude Development Notes

## Project Overview

Automated blog content generation and publishing system for [oilslickpad.com](https://oilslickpad.com), a Shopify store selling cannabis accessories (dab pads, glass jars, PTFE/FEP sheets, bongs, rigs, etc.). Generates SEO-optimized, human-sounding blog posts with AI images and publishes them directly to Shopify on a 5x/day schedule via GitHub Actions.

## Tech Stack

- **Runtime**: Node.js >= 20.0.0 (ES modules)
- **Content AI**: OpenAI GPT-5.2 with adaptive reasoning
- **Image AI**: Google Gemini 3 Pro Image (Nano Banana Pro 3.0) with fallbacks
- **Publishing**: Shopify Admin API (GraphQL 2024-10 + REST fallback)
- **Scraping**: Cheerio + Axios
- **Automation**: GitHub Actions (5 cron schedules per day)
- **Caching**: File-based JSON cache in `.cache/` directory

## Key Architecture Decisions

### Content Pipeline (index.js)
The main orchestrator runs 7 sequential steps:
1. Shopify connection test
2. Research phase (scrape blogs + competitors, with caching)
3. Content planning (determine topics based on mode/category)
4. Content generation (GPT-5.2 with style profiles)
5. Image generation + embedding (Gemini with Shopify Files upload)
6. Quality assurance (AI review + hyperlink injection)
7. Publishing (GraphQL first, REST fallback)

### Two Content Categories
- **dabbing_storage**: Storage, cleaning, dabbing technique guides (6 AM, 10 AM UTC)
- **what_you_need**: Product-focused content for bongs, rigs, accessories (2 PM, 6 PM, 10 PM UTC)

### Image Generation Fallback Chain
1. Gemini 3 Pro Image (gemini-3-pro-image-preview) - primary
2. Gemini 2.5 Flash Image - faster fallback
3. Imagen 4.0 - final fallback
4. Placeholder text - last resort

### Shopify API Strategy
- GraphQL preferred for all operations (2024-10 API version)
- REST API as automatic fallback when GraphQL fails
- Staged uploads for image handling (base64 -> staged URL -> Shopify Files)
- REST required for featured image attachment on articles

## File Guide

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.js` | ~820 | Main orchestrator - runs the full pipeline |
| `src/config.js` | ~170 | Central config from env vars (API keys, categories, settings) |
| `src/generators/contentGenerator.js` | ~900 | GPT-5.2 content generation, AI tell removal, year fixing |
| `src/generators/imageGenerator.js` | ~340 | Gemini image gen with fallback chain |
| `src/generators/contentReviewer.js` | ~360 | AI content review, topic deduplication |
| `src/scrapers/blogScraper.js` | ~280 | Scrapes existing Shopify blog posts |
| `src/scrapers/competitorScraper.js` | ~250 | Scrapes 5 competitor blogs for trends |
| `src/publishers/shopifyPublisher.js` | ~1100 | Shopify API, markdown-to-HTML, schema markup |
| `src/utils/authorStyles.js` | ~500 | 10 author styles, 30 pseudonyms, AI tells list |
| `src/utils/seoOptimizer.js` | ~235 | SEO guidelines, title gen, content audit |
| `src/utils/hyperlinkInjector.js` | ~335 | Internal/external link injection |
| `src/utils/researchCache.js` | ~210 | File-based cache with TTL (6-24 hours) |

## Common Development Tasks

### Running locally
```bash
npm install
cp .env.example .env  # Fill in API keys
npm start             # Full run
DRY_RUN=true npm start # Test without publishing
```

### Adding a new content category
1. Add category config in `src/config.js` under `contentCategories`
2. Add schedule in `.github/workflows/auto-blogger.yml`
3. Update hour-based category detection in the workflow

### Adding new product collections for linking
Edit `PRIORITY_COLLECTIONS` or `SECONDARY_COLLECTIONS` in `src/utils/hyperlinkInjector.js`

### Adding a new author style
Add a new object to `authorStyles` in `src/utils/authorStyles.js`

## Issues Fixed (Codebase Review - Feb 2026)

### Critical Bugs Fixed

1. **contentReviewer.js - Variable shadowing bug**: Inner `fixedHtml` variable shadowed the outer programmatically-fixed version, causing the AI review fallback to return raw input instead of the already-fixed content. When the AI review failed or returned invalid HTML, the programmatic fixes (empty paragraph removal, broken tag cleanup, meta-commentary stripping) were thrown away.

2. **shopifyPublisher.js - Missing ordered list support**: The `markdownToHtml()` function only handled unordered lists (`-` and `*` markers) but the content generation prompt asks GPT to use numbered lists (`1.`, `2.`, `3.`) for step-by-step instructions. These rendered as plain text paragraphs instead of `<ol>` elements.

3. **Hardcoded year references**: Multiple files had hardcoded "2024" or "2025" that would become outdated:
   - `index.js:387` - "Best ${type} for Beginners in 2025"
   - `competitorScraper.js:150` - Regex pattern `/2024|2025|new/i`
   - `seoOptimizer.js:127` - "Reference current year (2024/2025)"
   All replaced with `new Date().getFullYear()` for automatic updates.

### Important Fixes

4. **authorStyles.js - Celebrity name in pseudonyms**: "Cameron Diaz" was listed as a pseudonym with comment "Common enough name" - this is a famous actress. Changed to "Cameron Blake" to avoid confusion.

5. **index.js - Unused import**: `imageToDataUrl` was imported from imageGenerator but never used. Removed.

6. **index.js - Duplicate step numbering**: Two steps both labeled "STEP 6" (hyperlink injection and publishing). Publishing renumbered to STEP 7.

7. **contentGenerator.js - Title length bypass**: `createTitleFromTopic()` could create titles far exceeding the 50-60 character SEO target (e.g., "Everything You Need to Know About Dab Pads" = 45 chars before cleanup). Now runs through `cleanupTitle()` to enforce length limits.

8. **shopifyPublisher.js - updateArticle double-converts HTML**: `updateArticle()` always ran `markdownToHtml()` on the body, even if it was already HTML from `prepareContentWithImages()`. Added the same HTML detection check used in `createArticle()`.

9. **seoOptimizer.js - Dead code**: `generateTitleVariations()` used template literals (backticks) that already resolve `${topic}`, then called `.replace('${topic}', topic)` which is a no-op since the literal string `${topic}` no longer exists. Removed the dead `.replace()` call.

10. **shopifyPublisher.js - Step numbering in comments**: Duplicate "STEP 7" (links and paragraph conversion). Renumbered to STEP 7, 8, 9 for clarity.

### README.md Overhaul
- Updated all GPT-5.1 references to GPT-5.2
- Fixed schedule description (was "twice per week", actually 5x per day)
- Added missing files to architecture tree (contentReviewer.js, hyperlinkInjector.js, researchCache.js)
- Updated author styles description (was "Hunter S. Thompson, Anthony Bourdain", now 10 distinct non-celebrity profiles)
- Added documentation for manual trigger options, content modes, cost optimization
- Added `read_products` to required Shopify API scopes

## Known Limitations & Future Considerations

### Things That Work But Could Be Better
- **Synchronous file I/O in cache**: `researchCache.js` uses `fs.readFileSync`/`fs.writeFileSync`. Fine for a batch job but would block the event loop in a server context.
- **No retry logic in workflow**: The GitHub Actions workflow runs `npm start` with no retry. Transient API failures cause the whole run to fail.
- **Year replacement in contentGenerator.js**: The aggressive year replacement could change years in historical contexts like "Founded in 2019". The negative lookbehind only checks for month names, not words like "founded" or "established".
- **Shopify API version 2024-10**: May need updating as newer API versions become available.

### Edge Cases
- If all topics in a category have been covered, deduplication adds a year suffix (e.g., "Topic Name 2026") which is a workaround, not a long-term solution.
- The `markdownToHtml` converter doesn't handle nested lists.
- External link injection is limited to 4 topic patterns (terpenes, cannabinoids, cannabis industry, health). Content about other topics won't get external links.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_ADMIN_API_TOKEN` | Yes | Shopify Admin API token (shpat_xxx) |
| `SHOPIFY_STORE_DOMAIN` | Yes | Store domain (oilslickpad.com) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `BLOGS_PER_RUN` | No | Number of blogs per execution (1-10, default 1) |
| `BLOG_MODE` | No | new, update, mixed, or auto (default auto) |
| `CONTENT_CATEGORY` | No | dabbing_storage, what_you_need, or auto |
| `UPDATE_THRESHOLD_DAYS` | No | Days before post is considered outdated (default 180) |
| `DRY_RUN` | No | true to skip publishing (default false) |
| `CUSTOM_TOPIC` | No | Override topic selection with specific topic |
