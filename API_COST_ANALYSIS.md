# API Cost Analysis: Shopify Auto-Blogger with Images

**Date:** February 2026
**Project:** Oil Slick Pad Auto-Blogger (`oilslickpad.com`)

---

## Table of Contents

1. [Current Architecture & API Usage](#1-current-architecture--api-usage)
2. [Per-Blog-Post Token Breakdown](#2-per-blog-post-token-breakdown)
3. [Current Daily/Monthly Cost Estimates](#3-current-dailymonthly-cost-estimates)
4. [Text Generation Model Comparison (Flagships)](#4-text-generation-model-comparison-flagships)
5. [Image Generation Model Comparison](#5-image-generation-model-comparison)
6. [Cost Scenarios: Swapping Models](#6-cost-scenarios-swapping-models)
7. [Recommendations](#7-recommendations)
8. [Sources](#8-sources)

---

## 1. Current Architecture & API Usage

### Models Currently Configured

| Role | Model | Provider |
|------|-------|----------|
| **Text generation (default)** | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Anthropic |
| **Text generation (alt)** | GPT-5.2 (`gpt-5.2`) | OpenAI |
| **Image generation (primary)** | Gemini 3 Pro Image (`gemini-3-pro-image-preview`) | Google |
| **Image generation (fallback 1)** | Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) | Google |
| **Image generation (fallback 2)** | Imagen 4 (`imagen-4.0-generate-001`) | Google |

### Daily Automated Schedule (4 runs/day)

| Time (UTC) | Strategy | Generates Blog? | Text API Calls | Image API Calls |
|------------|----------|-----------------|----------------|-----------------|
| 5:00 AM | `gsc-analyze` | No | 0-1 | 0 |
| 8:00 AM | `gsc-informed` | Yes (1 blog) | 3-5 | 2 |
| 2:00 PM | `category-rotate` | Yes (1 blog) | 3-5 | 2 |
| 8:00 PM | `strategic` | Yes (1 blog) | 3-5 | 2 |

### API Calls Per Blog Post

Each blog post generation involves these AI API calls:

1. **Topic deduplication check** (`contentReviewer.js`) - ~800 input / ~200 output tokens, `reasoningEffort: 'low'`
2. **Main content generation** (`contentGenerator.js`) - ~3,500 input / ~4,000-6,000 output tokens, `reasoningEffort: 'medium'`
3. **Content review/fix** (`contentReviewer.js`) - ~9,000 input / ~6,000 output tokens, `reasoningEffort: 'low'`
4. **Topic idea generation** (occasional) - ~1,500 input / ~1,500 output tokens, `reasoningEffort: 'low'`
5. **Product blog topic** (weekly, `productBlogWriter.js`) - ~800 input / ~300 output tokens, `reasoningEffort: 'low'`
6. **Image generation** - 2 images per post (Gemini/Imagen API, token-based)

---

## 2. Per-Blog-Post Token Breakdown

### Text Generation Tokens (per blog post)

| Step | Input Tokens | Output Tokens | Notes |
|------|-------------|---------------|-------|
| Topic dedup check | ~800 | ~200 | Short JSON response |
| Main content generation | ~3,500 | ~5,000 | 1,200-2,000 word blog post |
| Content HTML review | ~9,000 | ~6,000 | Full HTML review+fix |
| **Subtotal per blog** | **~13,300** | **~11,200** | |
| Topic ideas (amortized) | ~200 | ~200 | Shared across blogs |
| **Total per blog** | **~13,500** | **~11,400** | |

### Image Generation (per blog post)

- **2 images** per standard post (reduced from 3 to save costs)
- 1 image for `quick_guide` format, up to 4 for `deep_dive`
- Image resolution: 1K (configured for faster uploads)
- Aspect ratio: 16:9

---

## 3. Current Daily/Monthly Cost Estimates

### With Claude Sonnet 4.6 (Current Default)

**Claude Sonnet 4.6 pricing:** $3.00/1M input, $15.00/1M output

| Metric | Tokens | Cost |
|--------|--------|------|
| Per blog input | 13,500 | $0.041 |
| Per blog output | 11,400 | $0.171 |
| **Per blog text total** | **24,900** | **$0.212** |
| Per blog images (2x Gemini 3 Pro) | - | ~$0.08 |
| **Per blog all-in** | - | **~$0.29** |
| Daily (3 blogs) | 74,700 | $0.87 |
| Monthly (90 blogs) | 2,241,000 | **$26.10** |

### With GPT-5.2 (Configured Alternative)

**GPT-5.2 pricing:** $1.75/1M input, $14.00/1M output

> **Warning:** GPT-5.2 uses reasoning tokens billed as output tokens. With `reasoningEffort: 'medium'`, actual output token consumption can be 2-4x the visible output. The estimates below account for this.

| Metric | Tokens (visible) | Est. Total Tokens (w/ reasoning) | Cost |
|--------|------------------|----------------------------------|------|
| Per blog input | 13,500 | 13,500 | $0.024 |
| Per blog output | 11,400 | ~25,000 (reasoning overhead) | $0.350 |
| **Per blog text total** | - | ~38,500 | **$0.374** |
| Per blog images (2x Gemini 3 Pro) | - | - | ~$0.08 |
| **Per blog all-in** | - | - | **~$0.45** |
| Daily (3 blogs) | - | - | $1.35 |
| Monthly (90 blogs) | - | - | **$40.50** |

### Image Costs (Gemini, all scenarios)

| Model | Cost per image | Cost for 2 images | Monthly (180 images) |
|-------|---------------|-------------------|---------------------|
| Gemini 3 Pro Image | ~$0.039 | $0.078 | $7.02 |
| Gemini 2.5 Flash Image | ~$0.020 | $0.040 | $3.60 |
| Imagen 4 Standard | $0.04 | $0.08 | $7.20 |
| Imagen 4 Fast | $0.02 | $0.04 | $3.60 |

---

## 4. Text Generation Model Comparison (Flagships)

### Pricing Per 1M Tokens

| Model | Provider | Input | Output | Context Window | Batch Discount |
|-------|----------|-------|--------|----------------|----------------|
| **Claude Opus 4.6** | Anthropic | $5.00 | $25.00 | 200K (1M extended) | 50% |
| **Claude Sonnet 4.6** | Anthropic | $3.00 | $15.00 | 200K (1M extended) | 50% |
| **Claude Haiku 4.5** | Anthropic | $1.00 | $5.00 | 200K | 50% |
| **GPT-5.2** | OpenAI | $1.75 | $14.00 | 400K | ~50% |
| **GPT-5.2 Pro** | OpenAI | $21.00 | $168.00 | 400K | N/A |
| **GPT-4.1** | OpenAI | $2.00 | $8.00 | 1M | ~50% |
| **GPT-4o** | OpenAI | $2.50 | $10.00 | 128K | ~50% |
| **o3** | OpenAI | $2.00 | $8.00 | 200K | ~50% |
| **o4-mini** | OpenAI | $1.10 | $4.40 | 200K | 50% |
| **Gemini 2.5 Pro** | Google | $1.25 | $10.00 | 1M | 50% |
| **Gemini 2.5 Flash** | Google | $0.15 | $0.60 (no reasoning) / $3.50 (reasoning) | 1M | 50% |
| **Gemini 3 Pro** | Google | $2.00-4.00 | $12.00-18.00 | 1M+ | 50% |

### Per-Blog Text Cost by Model (13.5K input + 11.4K output)

| Model | Input Cost | Output Cost | **Total/Blog** | Monthly (90) | Notes |
|-------|-----------|-------------|----------------|-------------|-------|
| Claude Haiku 4.5 | $0.014 | $0.057 | **$0.071** | **$6.39** | Fast, good for structured tasks |
| Gemini 2.5 Flash (no reasoning) | $0.002 | $0.007 | **$0.009** | **$0.81** | Cheapest option, quality tradeoff |
| Gemini 2.5 Flash (w/ reasoning) | $0.002 | $0.040 | **$0.042** | **$3.78** | Better quality with thinking |
| o4-mini | $0.015 | $0.050 | **$0.065** | **$5.85** | Good reasoning, hidden token costs |
| GPT-4.1 | $0.027 | $0.091 | **$0.118** | **$10.62** | 1M context, cost-efficient |
| Gemini 2.5 Pro | $0.017 | $0.114 | **$0.131** | **$11.79** | Strong quality, 1M context |
| Claude Sonnet 4.6 | $0.041 | $0.171 | **$0.212** | **$19.08** | Current default, high quality |
| GPT-4o | $0.034 | $0.114 | **$0.148** | **$13.32** | Reliable, well-tested |
| GPT-5.2 | $0.024 | $0.350* | **$0.374** | **$33.66** | *Includes reasoning overhead |
| o3 | $0.027 | $0.091+ | **$0.118+** | **$10.62+** | Reasoning tokens add cost |
| Claude Opus 4.6 | $0.068 | $0.285 | **$0.353** | **$31.77** | Most capable, premium price |
| Gemini 3 Pro | $0.027-0.054 | $0.137-0.205 | **$0.164-0.259** | **$14.76-23.31** | Latest generation |

> *GPT-5.2 and o-series models consume hidden "reasoning tokens" billed as output. Actual costs can be 2-4x the visible token count.*

---

## 5. Image Generation Model Comparison

### Per-Image Pricing

| Model | Provider | Cost/Image | Resolution | Quality | Notes |
|-------|----------|-----------|------------|---------|-------|
| **Gemini 2.5 Flash Image** | Google | ~$0.020 | Up to 1K | Good | Fast, budget-friendly |
| **Imagen 4 Fast** | Google | $0.020 | Standard | Good | Fixed-rate, reliable |
| **Gemini 3 Pro Image** | Google | ~$0.039 | Up to 4K | Excellent | Current primary, text rendering |
| **Imagen 4 Standard** | Google | $0.040 | Standard | Very Good | Photorealistic |
| **Imagen 4 Ultra** | Google | $0.060 | High | Best | Highest quality Imagen |
| **DALL-E 3 Standard** | OpenAI | $0.040 | 1024x1024 | Very Good | Reliable, good text rendering |
| **DALL-E 3 HD** | OpenAI | $0.080 | 1024x1024 | Excellent | Higher detail |
| **gpt-image-1 Low** | OpenAI | $0.011 | 1024x1024 | Basic | Cheapest OpenAI option |
| **gpt-image-1 Medium** | OpenAI | $0.042 | 1024x1024 | Good | Best value OpenAI |
| **gpt-image-1 High** | OpenAI | $0.167 | 1024x1024 | Excellent | Premium quality |
| **Stable Diffusion XL** | Stability AI | $0.011 | 1024x1024 | Good | Open-source available |
| **Stable Diffusion 3** | Stability AI | $0.037 | 1024x1024 | Very Good | Latest SD |
| **Flux Dev** | Third-party | ~$0.01-0.03 | 1024x1024 | Excellent | Best text, slow (57s) |

### Monthly Image Cost Comparison (180 images/month = 90 blogs x 2 images)

| Model | Cost/Image | Monthly Cost | Quality Rating |
|-------|-----------|-------------|----------------|
| gpt-image-1 Low | $0.011 | **$1.98** | Basic |
| Stable Diffusion XL | $0.011 | **$1.98** | Good |
| Gemini 2.5 Flash Image | $0.020 | **$3.60** | Good |
| Imagen 4 Fast | $0.020 | **$3.60** | Good |
| Gemini 3 Pro Image (current) | $0.039 | **$7.02** | Excellent |
| DALL-E 3 Standard | $0.040 | **$7.20** | Very Good |
| Imagen 4 Standard | $0.040 | **$7.20** | Very Good |
| gpt-image-1 Medium | $0.042 | **$7.56** | Good |
| Imagen 4 Ultra | $0.060 | **$10.80** | Best |
| DALL-E 3 HD | $0.080 | **$14.40** | Excellent |
| gpt-image-1 High | $0.167 | **$30.06** | Excellent |

---

## 6. Cost Scenarios: Swapping Models

### Scenario A: Current Setup (Claude Sonnet 4.6 + Gemini 3 Pro Image)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $19.08 |
| Image generation | $7.02 |
| **Total** | **$26.10** |

### Scenario B: Budget Optimized (Gemini 2.5 Flash + Imagen 4 Fast)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $3.78 (w/ reasoning) |
| Image generation | $3.60 |
| **Total** | **$7.38** |
| Savings vs current | 72% |

### Scenario C: OpenAI Flagship (GPT-4.1 + DALL-E 3 Standard)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $10.62 |
| Image generation | $7.20 |
| **Total** | **$17.82** |
| Savings vs current | 32% |

### Scenario D: OpenAI Premium (GPT-5.2 + gpt-image-1 High)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $33.66 |
| Image generation | $30.06 |
| **Total** | **$63.72** |
| Increase vs current | +144% |

### Scenario E: All-Google (Gemini 2.5 Pro + Gemini 3 Pro Image)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $11.79 |
| Image generation | $7.02 |
| **Total** | **$18.81** |
| Savings vs current | 28% |

### Scenario F: Anthropic Premium (Claude Opus 4.6 + Gemini 3 Pro Image)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $31.77 |
| Image generation | $7.02 |
| **Total** | **$38.79** |
| Increase vs current | +49% |

### Scenario G: Best Quality, Cost Secondary (Claude Opus 4.6 + gpt-image-1 High)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $31.77 |
| Image generation | $30.06 |
| **Total** | **$61.83** |
| Increase vs current | +137% |

### Scenario H: Balanced Quality (GPT-4.1 + Gemini 3 Pro Image)

| Component | Monthly Cost |
|-----------|-------------|
| Text generation | $10.62 |
| Image generation | $7.02 |
| **Total** | **$17.64** |
| Savings vs current | 32% |

---

## Summary Table: All Scenarios

| Scenario | Text Model | Image Model | Monthly | vs. Current |
|----------|-----------|-------------|---------|-------------|
| **B. Budget** | Gemini 2.5 Flash | Imagen 4 Fast | **$7.38** | -72% |
| **H. Balanced** | GPT-4.1 | Gemini 3 Pro Image | **$17.64** | -32% |
| **C. OpenAI Flag.** | GPT-4.1 | DALL-E 3 Standard | **$17.82** | -32% |
| **E. All-Google** | Gemini 2.5 Pro | Gemini 3 Pro Image | **$18.81** | -28% |
| **A. Current** | Claude Sonnet 4.6 | Gemini 3 Pro Image | **$26.10** | baseline |
| **F. Anthropic+** | Claude Opus 4.6 | Gemini 3 Pro Image | **$38.79** | +49% |
| **G. Max Quality** | Claude Opus 4.6 | gpt-image-1 High | **$61.83** | +137% |
| **D. OpenAI Prem.** | GPT-5.2 | gpt-image-1 High | **$63.72** | +144% |

---

## 7. Recommendations

### For Image Generation (Primary Concern)

Since image generation is your primary concern, here's a quality-focused ranking:

1. **Gemini 3 Pro Image (current) - Best Value for Quality**
   - $0.039/image, excellent quality with text rendering
   - Already integrated, supports 1K/2K/4K resolution
   - Character consistency, SynthID watermarking
   - *Recommendation: Keep as primary*

2. **gpt-image-1 High - Premium Alternative**
   - $0.167/image, excellent quality
   - Strong text rendering, good prompt adherence
   - Requires code changes to integrate OpenAI image API
   - *Recommendation: Consider for posts needing exceptional images*

3. **DALL-E 3 HD - Reliable Premium**
   - $0.080/image, consistent high quality
   - Well-documented API, good text rendering
   - *Recommendation: Good fallback option*

4. **Imagen 4 Ultra - Google's Best**
   - $0.060/image, highest quality Imagen
   - Already on Google's platform (easy to add)
   - *Recommendation: Add as an option for premium posts*

### For Text Generation

Your current Claude Sonnet 4.6 setup is a reasonable middle ground. However:

- **If you want to save money:** Switch to **GPT-4.1** ($10.62/mo vs $19.08/mo, 44% savings) with comparable quality
- **If you want the best quality:** Switch to **Claude Opus 4.6** ($31.77/mo) for the most capable writing
- **If you want budget + quality:** Use **Gemini 2.5 Pro** ($11.79/mo) which offers strong quality at lower cost

### Cost Optimization Tips

1. **Prompt Caching:** Enable cache for the system prompts in `contentGenerator.js` - they're large (~3,000 tokens) and identical across calls. Anthropic offers 90% cache read discounts, OpenAI 90% for GPT-5.2.

2. **Batch API:** If latency isn't critical (automated nightly runs), use batch endpoints for 50% off on all providers.

3. **Model Routing:** Use a cheaper model (Haiku 4.5 or GPT-4.1 Nano) for the `reasoningEffort: 'low'` calls (dedup checks, topic generation) and reserve the flagship for main content generation. This could save ~30% on text costs.

4. **Reduce Image Resolution:** Already set to 1K (good). Don't increase unless needed for specific posts.

---

## 8. Sources

- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [OpenAI Platform Pricing Docs](https://platform.openai.com/docs/pricing)
- [Anthropic Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Stability AI Pricing](https://platform.stability.ai/pricing)
- [GPT-5.2 Pricing Details](https://pricepertoken.com/pricing-page/model/openai-gpt-5.2)
- [GPT-4.1 Pricing Details](https://pricepertoken.com/pricing-page/model/openai-gpt-4.1)
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [AI API Pricing Comparison 2026](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [Gemini Image API Pricing Guide](https://blog.laozhang.ai/en/posts/cheap-gemini-image-api)
