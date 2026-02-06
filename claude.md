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

### Seven Content Categories (Full Product Scope)
All categories rotate automatically by day of week (3 categories per day, each day different):
1. **dabbing_storage**: Dabbing techniques, concentrate storage, dab station setups
2. **glass_and_rigs**: Bongs, dab rigs, bubblers, water pipes, hand pipes, nectar collectors
3. **rosin_extraction**: Rosin pressing, PTFE/FEP/parchment, solventless extraction
4. **rolling_culture**: Rolling papers, cones, wraps, trays, RAW/Zig Zag/Vibes/Blazy Susan
5. **packaging_supply**: Glass jars, mylar bags, joint tubes, dispensary/B2B supply
6. **silicone_travel**: Silicone pipes/bongs/bubblers, travel-friendly, unbreakable gear
7. **accessories_tools**: Quartz bangers, carb caps, torches, grinders, e-rigs, vaporizers

### Category Rotation Schedule
Each day of the week maps to 3 categories. Hour-based segments (8h each) pick which one:
- Sunday: dabbing_storage -> rosin_extraction -> rolling_culture
- Monday: glass_and_rigs -> packaging_supply -> accessories_tools
- Tuesday: rosin_extraction -> silicone_travel -> dabbing_storage
- Wednesday: rolling_culture -> glass_and_rigs -> packaging_supply
- Thursday: accessories_tools -> dabbing_storage -> silicone_travel
- Friday: packaging_supply -> rosin_extraction -> glass_and_rigs
- Saturday: silicone_travel -> accessories_tools -> rolling_culture

Every category appears 3x per week. Full rotation covers all 7 niches every week.

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
| `src/config.js` | ~345 | Central config - 7 content categories, rotation schedule, SEO keywords |
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

## Full Product Scope Expansion (Feb 2026)

### Problem
Store has 1,300+ products across 90+ collections in 10+ niches, but blog system only covered 2 categories (dabbing_storage with 20 topics, what_you_need with 20 topics). Missing entirely: rosin/extraction, rolling papers, cannabis packaging, silicone/travel, and accessories.

### Changes Made

**config.js - 7 content categories (was 2)**
Expanded from 2 categories (40 topics) to 7 categories (148 topics total):
- `dabbing_storage` (24 topics) - kept and expanded
- `glass_and_rigs` (24 topics) - replaces `what_you_need`, broader scope
- `rosin_extraction` (20 topics) - NEW: PTFE, FEP, parchment, rosin pressing
- `rolling_culture` (20 topics) - NEW: papers, cones, wraps, RAW, Zig Zag, Vibes
- `packaging_supply` (20 topics) - NEW: glass jars, mylar bags, dispensary B2B
- `silicone_travel` (20 topics) - NEW: silicone pipes/bongs, travel, outdoor
- `accessories_tools` (20 topics) - NEW: bangers, caps, torches, grinders, vapes

Added `categoryRotation` array: 7-day rotation schedule, 3 categories per day, every niche gets covered 3x/week.

**hyperlinkInjector.js - 38 collections (was 20)**
- Priority: Added mylar bags, joint tubes (high-margin Oil Slick brand products)
- Secondary: Added ash catchers, bowls/downstems, one hitters, heady glass, silicone pipes/bongs/bubblers/nectar collectors, rolling supplies, vapes/electronics, bulk PTFE/FEP, custom packaging, heat press supplies, craft supplies, travel friendly, made in USA
- External sources: Added extraction (High Times) and culture categories
- External link patterns: Added solventless, cannabis law, dispensary, cannabis culture

**index.js - Smart rotation + category-aware keywords/tags**
- `planMultipleBlogs()` now resolves 'auto' category using day-of-week + hour-of-day rotation
- `doResearch()` pre-fetches vendor products for all vendor-linked categories
- `getKeywordsForTopic()` rewritten with 7 niche-aware keyword groups
- `getTagsForTopic()` rewritten with 11 niche patterns instead of 5 generic ones

**auto-blogger.yml - Updated workflow**
- Simplified: category selection is now handled by the Node.js rotation logic
- Manual trigger includes all 7 categories as options
- Comments document the full rotation schedule

## Known Limitations & Future Considerations

### Things That Work But Could Be Better
- **Synchronous file I/O in cache**: `researchCache.js` uses `fs.readFileSync`/`fs.writeFileSync`. Fine for a batch job but would block the event loop in a server context.
- **No retry logic in workflow**: The GitHub Actions workflow runs `npm start` with no retry. Transient API failures cause the whole run to fail.
- **Year replacement in contentGenerator.js**: The aggressive year replacement could change years in historical contexts like "Founded in 2019". The negative lookbehind only checks for month names, not words like "founded" or "established".
- **Shopify API version 2024-10**: May need updating as newer API versions become available.

### Edge Cases
- If all topics in a category have been covered, deduplication adds a year suffix (e.g., "Topic Name 2026") which is a workaround, not a long-term solution.
- The `markdownToHtml` converter doesn't handle nested lists.
- External link injection now covers 8 topic patterns (up from 4) but still won't match every topic.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_ADMIN_API_TOKEN` | Yes | Shopify Admin API token (shpat_xxx) |
| `SHOPIFY_STORE_DOMAIN` | Yes | Store domain (oilslickpad.com) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `BLOGS_PER_RUN` | No | Number of blogs per execution (1-10, default 1) |
| `BLOG_MODE` | No | new, update, mixed, or auto (default auto) |
| `CONTENT_CATEGORY` | No | Any of the 7 categories, or auto for rotation (default auto) |
| `UPDATE_THRESHOLD_DAYS` | No | Days before post is considered outdated (default 180) |
| `DRY_RUN` | No | true to skip publishing (default false) |
| `CUSTOM_TOPIC` | No | Override topic selection with specific topic |
