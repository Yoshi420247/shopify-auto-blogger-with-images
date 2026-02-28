#!/usr/bin/env node
/**
 * Repair broken blog images using curl (bypasses proxy issues with axios).
 *
 * Fetches articles and images via curl subprocess, matches them,
 * and updates articles with restored <img> tags.
 */

import { execSync } from 'child_process';

const STORE = 'oil-slick-pad.myshopify.com';
const TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VER = '2025-04';
const DRY_RUN = process.env.DRY_RUN === 'true';

function curlGet(path) {
  const url = `https://${STORE}/admin/api/${API_VER}${path}`;
  const out = execSync(`curl -s "${url}" -H "X-Shopify-Access-Token: ${TOKEN}" -H "Content-Type: application/json"`, { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

function curlGql(query, variables = {}) {
  const body = JSON.stringify({ query, variables });
  const url = `https://${STORE}/admin/api/${API_VER}/graphql.json`;
  const out = execSync(`curl -s "${url}" -H "X-Shopify-Access-Token: ${TOKEN}" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`, { maxBuffer: 10 * 1024 * 1024 });
  const result = JSON.parse(out.toString());
  if (result.errors) throw new Error(result.errors[0]?.message);
  return result.data;
}

function curlPut(path, data) {
  const url = `https://${STORE}/admin/api/${API_VER}${path}`;
  // Write JSON to temp file to avoid shell escaping issues
  const tmpFile = `/tmp/shopify_put_${Date.now()}.json`;
  execSync(`cat > ${tmpFile} << 'JSONEOF'\n${JSON.stringify(data)}\nJSONEOF`);
  const out = execSync(`curl -s -X PUT "${url}" -H "X-Shopify-Access-Token: ${TOKEN}" -H "Content-Type: application/json" -d @${tmpFile}`, { maxBuffer: 10 * 1024 * 1024 });
  execSync(`rm -f ${tmpFile}`);
  return JSON.parse(out.toString());
}

// ── Find broken figures ──
function findBrokenFigures(bodyHtml) {
  const broken = [];
  const regex = /<figure([^>]*)>([\s\S]*?)<figcaption([^>]*)>([\s\S]*?)<\/figcaption>\s*<\/figure>/g;
  let match;
  while ((match = regex.exec(bodyHtml)) !== null) {
    if (/<img\s/.test(match[2])) continue; // has valid img, skip
    broken.push({
      fullMatch: match[0],
      figureStyle: match[1],
      figcaptionStyle: match[3],
      description: match[4].replace(/<[^>]*>/g, '').trim()
    });
  }
  return broken;
}

// ── Text similarity ──
function similarity(t1, t2) {
  const w1 = new Set(t1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const w2 = new Set(t2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  if (!w1.size || !w2.size) return 0;
  let overlap = 0;
  for (const w of w2) { if (w1.has(w)) overlap++; }
  return overlap / Math.max(w1.size, w2.size);
}

// ── Main ──
async function main() {
  console.log('='.repeat(60));
  console.log('BLOG IMAGE REPAIR (curl-based)');
  console.log('='.repeat(60));
  if (DRY_RUN) console.log('*** DRY RUN ***\n');

  // 1. Get blog ID
  const blogs = curlGet('/blogs.json');
  const newsBlog = blogs.blogs.find(b => b.handle === 'news');
  console.log(`Blog: "${newsBlog.title}" (ID: ${newsBlog.id})`);

  // 2. Fetch recent articles (last 20)
  const articles = curlGet(`/blogs/${newsBlog.id}/articles.json?limit=20&order=created_at+desc`).articles;
  console.log(`Fetched ${articles.length} articles`);

  // 3. Identify broken ones
  const brokenArticles = [];
  for (const art of articles) {
    const broken = findBrokenFigures(art.body_html || '');
    if (broken.length > 0) {
      brokenArticles.push({ article: art, brokenFigures: broken });
    }
  }
  console.log(`Found ${brokenArticles.length} broken article(s)`);
  if (!brokenArticles.length) { console.log('Nothing to fix!'); return; }

  for (const { article, brokenFigures } of brokenArticles) {
    console.log(`  - "${article.title}" (${brokenFigures.length} broken images)`);
  }

  // 4. Load ALL recent images from Shopify Files
  console.log('\nLoading images from Shopify Files...');
  const allImages = [];
  let cursor = null;
  for (let page = 0; page < 5; page++) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const data = curlGql(`{ files(first: 50, sortKey: CREATED_AT, reverse: true${afterClause}, query: "media_type:IMAGE") { edges { cursor node { ... on MediaImage { alt image { url } createdAt } } } pageInfo { hasNextPage } } }`);
    const edges = data.files?.edges || [];
    for (const e of edges) {
      if (e.node?.image?.url) {
        allImages.push({ url: e.node.image.url, alt: e.node.alt || '', created: e.node.createdAt });
      }
    }
    if (!data.files?.pageInfo?.hasNextPage || !edges.length) break;
    cursor = edges[edges.length - 1].cursor;
  }
  // Filter to only blog images (have alt text with descriptions)
  const blogImages = allImages.filter(img => img.alt && img.alt.length > 20);
  console.log(`Loaded ${allImages.length} total images, ${blogImages.length} with blog alt text`);

  // 5. Fix each broken article
  let totalFixed = 0;
  let totalFailed = 0;

  for (const { article, brokenFigures } of brokenArticles) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Repairing: "${article.title}" (ID: ${article.id})`);

    let html = article.body_html;
    let fixedCount = 0;

    for (const broken of brokenFigures) {
      const desc = broken.description;
      console.log(`  Looking for: "${desc.substring(0, 60)}..."`);

      // Find best matching image
      let bestImg = null;
      let bestScore = 0;
      for (const img of blogImages) {
        const score = similarity(img.alt, desc);
        if (score > bestScore) {
          bestScore = score;
          bestImg = img;
        }
        // Also check URL filename
        const urlSlug = img.url.split('/').pop()?.replace(/\.\w+(\?.*)?$/, '').replace(/-/g, ' ') || '';
        const urlScore = similarity(urlSlug, desc);
        if (urlScore > bestScore) {
          bestScore = urlScore;
          bestImg = img;
        }
      }

      if (bestImg && bestScore >= 0.25) {
        const safeAlt = (bestImg.alt || desc).replace(/"/g, '&quot;');
        const imgTag = `<img src="${bestImg.url}" alt="${safeAlt}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy">`;
        const newFigure = `<figure${broken.figureStyle}>${imgTag}<figcaption${broken.figcaptionStyle}>${broken.description}</figcaption></figure>`;
        html = html.replace(broken.fullMatch, newFigure);
        console.log(`    MATCHED (${(bestScore * 100).toFixed(0)}%): ${bestImg.url.substring(0, 70)}...`);
        fixedCount++;
        // Remove used image so it's not reused for a different figure
        const idx = blogImages.indexOf(bestImg);
        if (idx >= 0) blogImages.splice(idx, 1);
      } else {
        console.log(`    NO MATCH found (best: ${(bestScore * 100).toFixed(0)}%)`);
        // Remove the broken figure entirely
        html = html.replace(broken.fullMatch, '');
        totalFailed++;
      }
    }

    totalFixed += fixedCount;

    if (fixedCount === 0) {
      console.log(`  No fixes possible, skipping update`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would update with ${fixedCount} fixed images`);
    } else {
      console.log(`  Updating article...`);
      try {
        curlPut(`/blogs/${newsBlog.id}/articles/${article.id}.json`, {
          article: { id: article.id, body_html: html }
        });
        console.log(`  UPDATED successfully (${fixedCount} images restored)`);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('REPAIR SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Articles broken:  ${brokenArticles.length}`);
  console.log(`Images restored:  ${totalFixed}`);
  console.log(`Images not found: ${totalFailed}`);
  if (DRY_RUN) console.log('\nRun without DRY_RUN=true to apply changes');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
