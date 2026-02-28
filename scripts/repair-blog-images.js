/**
 * Repair Script: Fix broken inline images in published blog articles.
 *
 * The "FINAL SAFETY" regex (now removed) was stripping all <img> tags from
 * <figure> elements, leaving only `<` (rendered as &lt;) and the <figcaption>.
 *
 * This script:
 *  1. Fetches all articles from the News blog via REST API
 *  2. Identifies articles with broken <figure>&lt;<figcaption> patterns
 *  3. Searches Shopify Files for images matching each figcaption description
 *  4. Reconstructs the <img> tags with permanent CDN URLs
 *  5. Updates each article's body_html via REST API
 *
 * Usage:
 *   SHOPIFY_ADMIN_API_TOKEN=xxx SHOPIFY_STORE_DOMAIN=oilslickpad.com node scripts/repair-blog-images.js
 *
 *   Add DRY_RUN=true to preview changes without writing:
 *   DRY_RUN=true SHOPIFY_ADMIN_API_TOKEN=xxx node scripts/repair-blog-images.js
 */

import axios from 'axios';

// ── Config ──────────────────────────────────────────────────────────────────
const STORE_DOMAIN = (process.env.SHOPIFY_STORE_DOMAIN || 'oilslickpad.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
const API_TOKEN    = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION  = '2025-04';
const DRY_RUN      = process.env.DRY_RUN === 'true';

if (!API_TOKEN) {
  console.error('ERROR: SHOPIFY_ADMIN_API_TOKEN environment variable is required');
  process.exit(1);
}

const REST_BASE = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}`;
const GQL_URL   = `${REST_BASE}/graphql.json`;

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': API_TOKEN
};

// ── API helpers ─────────────────────────────────────────────────────────────

async function restGet(path) {
  const res = await axios.get(`${REST_BASE}${path}`, { headers: HEADERS, timeout: 30000 });
  return res.data;
}

async function restPut(path, data) {
  const res = await axios.put(`${REST_BASE}${path}`, data, { headers: HEADERS, timeout: 60000 });
  return res.data;
}

async function gql(query, variables = {}) {
  const res = await axios.post(GQL_URL, { query, variables }, { headers: HEADERS, timeout: 30000 });
  if (res.data.errors) {
    throw new Error(`GraphQL: ${res.data.errors[0]?.message}`);
  }
  return res.data.data;
}

// ── Step 1: Get all articles ────────────────────────────────────────────────

async function getAllArticles() {
  // First, find the "News" blog
  const blogData = await restGet('/blogs.json');
  const newsBlog = blogData.blogs.find(b => b.title === 'News' || b.handle === 'news');
  if (!newsBlog) {
    console.error('Could not find "News" blog');
    process.exit(1);
  }

  console.log(`Found blog: "${newsBlog.title}" (ID: ${newsBlog.id})`);

  // Fetch all articles (paginated)
  const allArticles = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await restGet(`/blogs/${newsBlog.id}/articles.json?limit=50&page=${page}`);
    const articles = data.articles || [];
    allArticles.push(...articles);
    hasMore = articles.length === 50;
    page++;
  }

  console.log(`Fetched ${allArticles.length} total articles`);
  return { articles: allArticles, blogId: newsBlog.id };
}

// ── Step 2: Identify broken articles ────────────────────────────────────────

/**
 * Find <figure> elements that are missing their <img> tag.
 * After the broken regex stripped <img> tags, figures look like:
 *   <figure style="...">< <figcaption>DESC</figcaption></figure>   (lone <)
 *   <figure style="...">&lt;<figcaption>DESC</figcaption></figure>  (entity-encoded)
 *   <figure style="..."><figcaption>DESC</figcaption></figure>      (artifact stripped by Shopify)
 *
 * This function matches ANY <figure> that has a <figcaption> but NO <img> tag.
 */
function findBrokenFigures(bodyHtml) {
  const broken = [];
  const regex = /<figure([^>]*)>([\s\S]*?)<figcaption([^>]*)>([\s\S]*?)<\/figcaption>\s*<\/figure>/g;
  let match;

  while ((match = regex.exec(bodyHtml)) !== null) {
    const betweenFigureAndCaption = match[2];

    // Skip if there's already a valid <img> tag — this figure is fine
    if (/<img\s/.test(betweenFigureAndCaption)) continue;

    broken.push({
      fullMatch: match[0],
      figureStyle: match[1],
      figcaptionStyle: match[3],
      description: match[4].trim(),
      offset: match.index
    });
  }

  return broken;
}

// ── Step 3: Search Shopify Files for matching images ────────────────────────

/**
 * Build a search slug from a figcaption description, matching the logic
 * in generateImageFilename() from seoOptimizer.js.
 */
function descriptionToSlug(description) {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

/**
 * Search Shopify Files for images whose filename or alt text matches
 * the given description. Returns the CDN URL if found.
 */
async function findImageInFiles(description) {
  const slug = descriptionToSlug(description);
  // Take key words from the slug for a broader search
  const searchTerms = slug.split('-').slice(0, 5).join(' ');

  // Search by filename first
  const query = `
    query SearchFiles($query: String!) {
      files(first: 10, query: $query) {
        edges {
          node {
            ... on MediaImage {
              id
              alt
              image {
                url
                originalSrc
              }
            }
          }
        }
      }
    }
  `;

  // Try filename-based search
  try {
    const data = await gql(query, { query: `filename:${slug}*` });
    const files = data.files?.edges || [];
    for (const edge of files) {
      const url = edge.node?.image?.url || edge.node?.image?.originalSrc;
      if (url) {
        return { url, alt: edge.node.alt || description };
      }
    }
  } catch (err) {
    console.warn(`  Filename search failed: ${err.message}`);
  }

  // Try alt text search
  try {
    const data = await gql(query, { query: searchTerms });
    const files = data.files?.edges || [];
    for (const edge of files) {
      const url = edge.node?.image?.url || edge.node?.image?.originalSrc;
      const alt = edge.node?.alt || '';
      // Check if the alt text is related to the description
      if (url && isRelatedText(alt, description)) {
        return { url, alt: alt || description };
      }
    }
  } catch (err) {
    console.warn(`  Alt text search failed: ${err.message}`);
  }

  return null;
}

/**
 * Check if two text strings are related by comparing word overlap.
 */
function isRelatedText(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  if (words1.size === 0 || words2.length === 0) return false;

  const overlap = words2.filter(w => words1.has(w)).length;
  return overlap >= 2 || overlap / words2.length >= 0.4;
}

// ── Step 4: Reconstruct <img> and update article ────────────────────────────

function buildImgTag(url, altText) {
  // Escape any quotes in alt text
  const safeAlt = altText.replace(/"/g, '&quot;');
  return `<img src="${url}" alt="${safeAlt}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">`;
}

function repairArticleHtml(bodyHtml, brokenFigures, imageResults) {
  let repaired = bodyHtml;

  // Process in reverse order to preserve offsets
  for (let i = brokenFigures.length - 1; i >= 0; i--) {
    const broken = brokenFigures[i];
    const image = imageResults[i];

    if (!image) {
      // No image found — remove the broken figure entirely
      console.log(`    Figure "${broken.description.substring(0, 40)}..." — no image found, removing broken figure`);
      repaired = repaired.replace(broken.fullMatch, '');
      continue;
    }

    // Rebuild the full <figure> with <img> restored
    const imgTag = buildImgTag(image.url, image.alt);
    const newFigure = `<figure${broken.figureStyle}>${imgTag}<figcaption${broken.figcaptionStyle}>${broken.description}</figcaption></figure>`;

    repaired = repaired.replace(broken.fullMatch, newFigure);
    console.log(`    Figure "${broken.description.substring(0, 40)}..." — REPAIRED with CDN URL`);
  }

  return repaired;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('BLOG IMAGE REPAIR SCRIPT');
  console.log('='.repeat(60));
  if (DRY_RUN) console.log('*** DRY RUN — no changes will be written ***\n');

  // 1. Fetch all articles
  const { articles, blogId } = await getAllArticles();

  // 2. Identify broken ones
  const brokenArticles = [];
  for (const article of articles) {
    const brokenFigures = findBrokenFigures(article.body_html || '');
    if (brokenFigures.length > 0) {
      brokenArticles.push({ article, brokenFigures });
    }
  }

  if (brokenArticles.length === 0) {
    console.log('\nNo broken articles found! All images are intact.');
    return;
  }

  console.log(`\nFound ${brokenArticles.length} article(s) with broken images:\n`);
  for (const { article, brokenFigures } of brokenArticles) {
    console.log(`  - "${article.title}" (${brokenFigures.length} broken image(s))`);
  }

  // 3. Repair each article
  let totalFixed = 0;
  let totalFailed = 0;

  for (const { article, brokenFigures } of brokenArticles) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Repairing: "${article.title}" (ID: ${article.id})`);
    console.log(`  ${brokenFigures.length} broken figure(s) to fix`);

    // Search for matching images
    const imageResults = [];
    for (const broken of brokenFigures) {
      console.log(`  Searching for: "${broken.description.substring(0, 60)}..."`);
      const result = await findImageInFiles(broken.description);
      imageResults.push(result);

      if (result) {
        console.log(`    Found: ${result.url.substring(0, 70)}...`);
      } else {
        console.log(`    NOT FOUND in Shopify Files`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    // Rebuild HTML
    const repairedHtml = repairArticleHtml(article.body_html, brokenFigures, imageResults);

    const fixed = imageResults.filter(r => r !== null).length;
    const failed = imageResults.filter(r => r === null).length;
    totalFixed += fixed;
    totalFailed += failed;

    if (repairedHtml === article.body_html) {
      console.log(`  No changes needed (all images missing from Files)`);
      continue;
    }

    // Update the article
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would update article with ${fixed} repaired image(s)`);
    } else {
      try {
        await restPut(`/blogs/${blogId}/articles/${article.id}.json`, {
          article: { id: article.id, body_html: repairedHtml }
        });
        console.log(`  UPDATED article successfully (${fixed} image(s) restored)`);
      } catch (err) {
        console.error(`  ERROR updating article: ${err.message}`);
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('REPAIR SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Articles scanned:  ${articles.length}`);
  console.log(`Articles broken:   ${brokenArticles.length}`);
  console.log(`Images restored:   ${totalFixed}`);
  console.log(`Images not found:  ${totalFailed}`);
  if (DRY_RUN) console.log('\n*** DRY RUN — run without DRY_RUN=true to apply changes ***');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
