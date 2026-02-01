# Claude Memory - Shopify Auto-Blogger

> **IMPORTANT**: This document contains critical context for this codebase. Read it fully before making changes.

---

## Project Overview

**Name**: Shopify Auto-Blogger with AI Images
**Website**: https://oilslickpad.com
**Niche**: Cannabis accessories (dab pads, concentrate tools, bongs, rigs, storage)
**Purpose**: Automatically generate and publish SEO-optimized blog posts with AI-generated images

---

## Current Schedule

**2 blogs per day** (reduced from 5 to manage quality and costs):

| Time (UTC) | Category | Focus |
|------------|----------|-------|
| 9 AM | `dabbing_storage` | Dabbing techniques, concentrate storage, dab pads |
| 3 PM | `what_you_need` | Bongs, rigs, accessories (vendor tag products) |

Workflow file: `.github/workflows/auto-blogger.yml`

---

## Key Configuration

### Models Used

| Purpose | Model | File |
|---------|-------|------|
| Content Generation | `gpt-5.2` | `src/config.js` |
| Content Review | `gpt-5.2` (low reasoning) | `src/generators/contentReviewer.js` |
| Image Generation | `gemini-3-pro-image-preview` | `src/config.js` |

### Important Settings

```javascript
// src/config.js
blog: {
  minWords: 1200,
  maxWords: 2000,
  imagesPerPost: 2,        // Reduced from 3 for cost savings
  blogsPerRun: 1,
  dryRun: false            // Set true to test without publishing
}
```

---

## Title Diversity System

**Problem Solved**: User complained about too many "Best X of 2026" style titles.

**Solution** (in `src/generators/contentGenerator.js`):

1. `shouldUseYearInTitle()` - Returns true only ~15% of the time (roughly 1 in 7 runs)
2. When false: Prompts tell AI to write **evergreen titles** without years
3. `stripYearFromTitle()` - Removes years that slip through post-generation

**Patterns removed**:
- "Best X of 2026" → "Best X"
- "Best X for 2026" → "Best X"
- "2026 Guide to X" → "Guide to X"
- "X (2026)" → "X"

**Good evergreen titles**:
- "Best Dab Pads for Daily Use"
- "How to Clean Your Dab Rig Fast"
- "Choosing the Right Quartz Banger"

---

## Broken HTML Artifact Fixes

**Problem**: Published posts showed broken img tag fragments like:
```
dab mat" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">
```

**Solution** (in `src/generators/contentReviewer.js` → `programmaticFixes()`):

Multiple regex patterns catch orphaned HTML fragments:
- Text followed by `" style="max-width:...`
- Orphaned `loading="lazy">` without proper img tag
- Context-aware removal (checks if part of valid tag first)

---

## Hyperlinking System

**File**: `src/utils/hyperlinkInjector.js`

### Priority Collections (Link First - Highest Margin)
1. Glass Jars `/collections/glass-jars`
2. PTFE Sheets `/collections/ptfe-sheets`
3. FEP Sheets `/collections/fep-sheets`
4. Parchment Paper `/collections/parchment-paper`
5. Silicone Pads `/collections/silicone-pads`
6. Extraction & Packaging `/collections/extraction-packaging`
7. Rosin Extraction `/collections/rosin-extraction`
8. Bulk PTFE & FEP `/collections/bulk-ptfe-fep`
9. Custom Packaging `/collections/custom-packaging-options`

### Secondary Collections
- **Dabbing Glass**: Dab Rigs, Quartz Bangers, Carb Caps, Dab Tools, Nectar Collectors, Torches
- **Smoking Glass**: Bongs & Water Pipes, Hand Pipes, Bubblers, One Hitters & Chillums, Novelty Pipes
- **Silicone Products**: Silicone Pipes, Silicone Bubblers, Silicone Hand Pipes, Silicone Nectar Collectors, Silicone Rigs & Bongs
- **Accessories**: Flower Bowls, Ash Catchers, Downstems, Ashtrays, Grinders
- **Storage**: Concentrate Containers, Storage Containers
- **Rolling**: Rolling Papers, Cones

### Brand Collections
- 710 Sci, Zig Zag, Vibes, Cookies, Maven, Monark, Made in USA

### Link Rules
- 2-5 internal links per 1000 words
- 1-2 external links per article
- Minimum 200 characters between links
- No links inside headings (H1-H6)
- First mention only (no repeat links)
- Priority collections linked first

---

## Content Categories

### `dabbing_storage` (1 article/day at 9 AM UTC)
**Focus**: Dabbing techniques, storage solutions, dab pads
**Topic Pool Examples**:
- The Ultimate Guide to Storing Concentrates
- How to Keep Your Dabs Fresh Longer
- Low Temp Dabs vs High Temp
- The Art of Cold Start Dabbing
- Maintaining Your Dab Pad

### `what_you_need` (1 article/day at 3 PM UTC)
**Focus**: Products with vendor tag "What You Need" (bongs, rigs, bangers)
**Topic Pool Examples**:
- Choosing Your First Bong
- Dab Rigs vs Bongs: Understanding the Difference
- Quartz Bangers: The Ultimate Guide
- Percolator Types: Which is Right for You?

**IMPORTANT**: Never mention "What You Need" brand in articles - focus on products, not supplier.

---

## Humanization Rules

### AI Tells to Avoid (in `src/utils/authorStyles.js`)
- Em dashes (—) and en dashes (–)
- "In conclusion", "Moving forward", "That being said"
- "delve", "intricate", "tapestry", "testament", "pivotal", "crucial", "vibrant"
- "boasts", "nestled", "breathtaking", "stunning"
- "It's not just about X, it's about Y"
- "Experts say", "Industry reports suggest"

### Patterns to Use Instead
- Contractions (don't, won't, can't)
- Sentence fragments. Like this.
- Start sentences with "And" or "But"
- First-person perspective
- Express genuine opinions

### Industry Terminology
- dabs, concentrates, wax, shatter, budder, live resin, rosin
- rigs, bongs, bangers, carb caps, dab tools, terp slurpers
- low temp, cold start, hot dab, sesh, daily driver
- ISO, reclaim, seasoning, q-tips, glob mops

---

## Cost Optimizations

1. **Skip images in dry-run mode** - `DRY_RUN=true` generates placeholders
2. **Reduced images**: 2 per post (was 3) = 33% savings
3. **Research caching** (`src/utils/researchCache.js`):
   - existingBlogs: 6 hours
   - competitorData: 12 hours
   - trendingTopics: 12 hours
   - contentIdeas: 24 hours
4. **Reasoning effort levels**:
   - Content generation: `medium`
   - Topic ideas: `low`
   - Content review: `low`

**Estimated cost**: ~$1.50-2.50 per blog post

---

## Pipeline Flow

```
1. Research (cached)
   └── Scrape own blog + competitors
   └── Generate topic ideas
   └── Get products by vendor (if applicable)

2. Planning
   └── Select category based on schedule
   └── Pick topic from pool or generate
   └── Check uniqueness vs existing articles

3. Content Generation
   └── Build system prompt (with date, author style, rules)
   └── Generate with GPT-5.2
   └── Remove AI tells
   └── Fix years (strip from title if not a "year day")

4. Image Generation
   └── Generate 2 images with Gemini
   └── Upload to Shopify CDN

5. Content Processing
   └── Convert Markdown to styled HTML
   └── AI review for formatting issues
   └── Programmatic fixes for artifacts
   └── Inject SEO hyperlinks

6. Publishing
   └── Create article via Shopify GraphQL API
   └── Fallback to REST API if needed
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.js` | Main orchestrator |
| `src/config.js` | All configuration |
| `src/generators/contentGenerator.js` | GPT content generation, title fixing, year handling |
| `src/generators/contentReviewer.js` | HTML cleanup, artifact removal, topic deduplication |
| `src/generators/imageGenerator.js` | Gemini image generation |
| `src/publishers/shopifyPublisher.js` | Shopify API (GraphQL + REST) |
| `src/utils/hyperlinkInjector.js` | SEO internal/external links |
| `src/utils/authorStyles.js` | Writing styles, AI tells to avoid |
| `src/utils/researchCache.js` | File-based caching |
| `.github/workflows/auto-blogger.yml` | GitHub Actions scheduler |

---

## Environment Variables Required

```bash
SHOPIFY_STORE_DOMAIN=oilslickpad.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxx
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=xxx

# Optional
BLOGS_PER_RUN=1
BLOG_MODE=auto
CONTENT_CATEGORY=auto
DRY_RUN=false
```

---

## Common Issues & Fixes

### "Outdated years in titles"
- Already fixed with `shouldUseYearInTitle()` and `stripYearFromTitle()`
- Only ~15% of blogs get year-based titles now

### "Broken HTML artifacts in published posts"
- Fixed with aggressive regex patterns in `programmaticFixes()`
- Catches orphaned img tag fragments

### "Too many blogs per day"
- Reduced to 2/day (9 AM and 3 PM UTC)
- Adjust in `.github/workflows/auto-blogger.yml`

### "Repetitive topics"
- `isTopicRecentlyCovered()` checks against last 30 articles
- `getUniqueTopic()` finds alternatives if topic was covered

### "Brand mentions in articles"
- System prompt explicitly forbids mentioning vendor brands like "What You Need"
- Focus on products, not suppliers

---

## Recent Changes History

1. **Title diversity**: Reduced year-based titles from ~100% to ~15%
2. **Schedule reduction**: 5 blogs/day → 2 blogs/day
3. **Hyperlink expansion**: Added all website collections including silicone products, accessories, brands
4. **HTML artifact fixes**: Aggressive patterns for broken img tags
5. **Cost optimizations**: Caching, reduced images, dry-run image skip
6. **Humanization**: Expanded AI tells list, added industry terminology

---

## Testing

Run in dry-run mode to test without publishing:
```bash
DRY_RUN=true npm start
```

Manual trigger via GitHub Actions:
- Go to Actions → Auto-Blogger → Run workflow
- Select category, blog count, dry-run option

---

## HANDOFF.md

A comprehensive handoff document exists at `/HANDOFF.md` for adapting this system to other stores. It covers:
- Full architecture diagram
- API integration details
- Configuration customization
- All code patterns and functions

---

*Last updated: After implementing title diversity and 2-blog schedule*
