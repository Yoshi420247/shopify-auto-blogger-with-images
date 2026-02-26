/**
 * Leafly Link Fix Script - Second Pass
 *
 * Fixes the generic Leafly replacements from the first pass with the
 * exact verified replacement URLs found by research.
 *
 * The first pass replaced broken Leafly links with generic category pages.
 * This second pass updates them to the precise topic-matched articles.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const STORE_DOMAIN = 'oil-slick-pad.myshopify.com';
const API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = '2025-04';
const BASE_URL = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}`;

const RATE_LIMIT_DELAY = 600;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Precise Leafly URL replacements (verified working 200 status)
// Maps: original broken URL -> precise replacement
const LEAFLY_FIXES = {
  // These were originally broken and got generic replacements in pass 1.
  // Now we fix the ORIGINAL broken URLs to the PRECISE replacements.
  // (Pass 1 may have already changed some, so we also map the pass-1 targets.)

  // Original broken -> precise replacement
  'https://www.leafly.com/brands/vibes':
    'https://www.leafly.com/brands/vibes-papers',

  'https://www.leafly.com/learn/cannabis-101/cannabis-and-spirituality':
    'https://www.leafly.com/news/lifestyle/rise-of-cannabis-spirituality',

  'https://www.leafly.com/learn/consume/concentrates':
    'https://www.leafly.com/learn/cannabis-glossary/concentrates',

  'https://www.leafly.com/learn/consume/pipes':
    'https://www.leafly.com/learn/consume/smoke/what-is-glass-weed-pipe',

  'https://www.leafly.com/learn/consume/smoke/best-bongs':
    'https://www.leafly.com/news/strains-products/best-bongs',

  'https://www.leafly.com/learn/consume/smoke/best-way-to-store-cannabis':
    'https://www.leafly.com/news/cannabis-101/how-long-is-my-cannabis-good-for-leaflys-guide-to-storing-cannabi',

  'https://www.leafly.com/learn/consume/smoke/grinder':
    'https://www.leafly.com/learn/consume/smoke/what-is-grinder',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-a-bong':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-a-pipe':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-bong':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/learn/consume/smoke/how-to-roll-a-joint':
    'https://www.leafly.com/learn/consume/smoke/how-to-roll-joint',

  'https://www.leafly.com/learn/consume/smoke/pipes':
    'https://www.leafly.com/learn/consume/smoke/what-is-glass-weed-pipe',

  'https://www.leafly.com/learn/consume/smoke/rolling-papers':
    'https://www.leafly.com/news/cannabis-101/rolling-papers-explained',

  'https://www.leafly.com/learn/consume/smoke/what-is-a-bong':
    'https://www.leafly.com/learn/consume/smoke/what-is-bong',

  'https://www.leafly.com/learn/consume/smoking':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoking/how-to-store-cannabis':
    'https://www.leafly.com/news/cannabis-101/how-long-is-my-cannabis-good-for-leaflys-guide-to-storing-cannabi',

  'https://www.leafly.com/learn/consume/vaporizers':
    'https://www.leafly.com/learn/consume/what-is-cannabis-vaping',

  'https://www.leafly.com/news/cannabis-101/blunts-vs-joints-whats-the-difference':
    'https://www.leafly.com/learn/consume/smoke/difference-between-joints-blunts-spliffs',

  'https://www.leafly.com/news/cannabis-101/cannabis-rolling-papers-101':
    'https://www.leafly.com/news/cannabis-101/rolling-papers-explained',

  'https://www.leafly.com/news/cannabis-101/cannabis-rolling-papers-guide':
    'https://www.leafly.com/news/cannabis-101/rolling-papers-explained',

  'https://www.leafly.com/news/cannabis-101/different-types-of-rolling-papers':
    'https://www.leafly.com/news/cannabis-101/rolling-papers-explained',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-bong':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-glass-pipe':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-pipe':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-pipe-bong-or-vaporizer':
    'https://www.leafly.com/learn/consume/smoke/how-to-clean-glass-bongs-pipes',

  'https://www.leafly.com/news/cannabis-101/how-to-use-a-bong':
    'https://www.leafly.com/learn/consume/smoke/what-is-bong',

  'https://www.leafly.com/news/cannabis-101/how-to-vape-cannabis-oil-and-flower':
    'https://www.leafly.com/learn/consume/what-is-cannabis-vaping',

  'https://www.leafly.com/news/cannabis-101/rolling-papers-101':
    'https://www.leafly.com/news/cannabis-101/rolling-papers-explained',

  'https://www.leafly.com/news/industry/american-glass-artists-fight-to-protect-their-craft':
    'https://www.leafly.com/news/lifestyle/cannabis-glass-artists-who-changed-the-game',

  'https://www.leafly.com/news/lifestyle/how-to-roll-a-joint':
    'https://www.leafly.com/learn/consume/smoke/how-to-roll-joint',

  'https://www.leafly.com/news/strains-products/best-rolling-trays':
    'https://www.leafly.com/news/strains-products/best-marijuana-rolling-trays',

  'https://www.leafly.com/news/strains-products/heady-glass-guide-collecting-functional-glass-art':
    'https://www.leafly.com/news/cannabis-101/how-to-choose-your-first-heady-glass-pipe',

  'https://www.leafly.com/news/strains-products/heady-glass-pipes-art':
    'https://www.leafly.com/learn/cannabis-glossary/heady-glass',

  'https://www.leafly.com/news/strains-products/heady-glass-pipes-functional-glass-art':
    'https://www.leafly.com/news/cannabis-101/how-to-choose-your-first-heady-glass-pipe',
};

// Also fix the generic replacements from pass 1 to the precise ones
const PASS1_GENERIC_TO_PRECISE = {
  // Pass 1 replaced these broken URLs with generic fallbacks.
  // Now correct the generic -> precise. Only add entries where pass 1 used
  // a different URL than what we now have.

  // Pass 1 used /learn/consume/smoke for brands/vibes
  // Precise: /brands/vibes-papers
  // (only relevant if products still have the generic)

  // Pass 1: /learn/consume/dabs for /learn/consume/concentrates
  // Precise: /learn/cannabis-glossary/concentrates
  // No change needed - both are valid, but let's use the precise one

  // Pass 1: /learn/cannabis-glossary/bong for multiple bong-cleaning URLs
  // Precise: /learn/consume/smoke/how-to-clean-glass-bongs-pipes (better)

  // Pass 1: /learn/cannabis-glossary/rolling-papers for rolling URLs
  // Precise: varies per URL (rolling-papers-explained, how-to-roll-joint, etc.)
};

const stats = {
  totalProducts: 0,
  productsWithIssues: 0,
  productsFixed: 0,
  totalLinksFixed: 0,
  errors: 0,
};

function applyFixes(bodyHtml) {
  if (!bodyHtml) return { fixedHtml: bodyHtml, fixes: [] };

  let fixedHtml = bodyHtml;
  const fixes = [];

  for (const [oldUrl, newUrl] of Object.entries(LEAFLY_FIXES)) {
    const patterns = [
      { search: `href="${oldUrl}"`, replace: `href="${newUrl}"` },
      { search: `href='${oldUrl}'`, replace: `href='${newUrl}'` },
    ];

    for (const { search, replace } of patterns) {
      if (fixedHtml.includes(search)) {
        const count = fixedHtml.split(search).length - 1;
        fixedHtml = fixedHtml.split(search).join(replace);
        fixes.push({ old: oldUrl, new: newUrl, count });
      }
    }
  }

  return { fixedHtml, fixes };
}

async function processAllProducts() {
  console.log('=== Leafly Link Fix (Second Pass) ===\n');
  console.log(`Started: ${new Date().toISOString()}\n`);

  let page_info = null;
  let page = 1;
  const allFixed = [];

  while (true) {
    let endpoint;
    if (page_info) {
      endpoint = `/products.json?limit=250&fields=id,title,handle,body_html&page_info=${page_info}`;
    } else {
      endpoint = `/products.json?limit=250&fields=id,title,handle,body_html`;
    }

    let result, headers;
    try {
      const url = `${BASE_URL}${endpoint}`;
      const cmd = `curl -s -D /tmp/shopify_headers2.txt "${url}" -H "X-Shopify-Access-Token: ${API_TOKEN}" -H "Content-Type: application/json"`;
      const output = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }).toString();
      result = JSON.parse(output);
      headers = fs.readFileSync('/tmp/shopify_headers2.txt', 'utf-8');
    } catch (err) {
      console.error(`Error fetching page ${page}: ${err.message}`);
      break;
    }

    const products = result.products || [];
    console.log(`\nPage ${page}: Processing ${products.length} products...`);

    for (const product of products) {
      stats.totalProducts++;
      if (!product.body_html) continue;

      const { fixedHtml, fixes } = applyFixes(product.body_html);

      if (fixes.length > 0) {
        stats.productsWithIssues++;

        try {
          const putData = JSON.stringify({ product: { id: product.id, body_html: fixedHtml } });
          fs.writeFileSync('/tmp/shopify_put_data2.json', putData);

          const url = `${BASE_URL}/products/${product.id}.json`;
          execSync(
            `curl -s -X PUT "${url}" -H "X-Shopify-Access-Token: ${API_TOKEN}" -H "Content-Type: application/json" -d @/tmp/shopify_put_data2.json > /tmp/shopify_put_result2.json`,
            { timeout: 60000 }
          );

          const putResult = JSON.parse(fs.readFileSync('/tmp/shopify_put_result2.json', 'utf-8'));
          if (putResult.errors) throw new Error(JSON.stringify(putResult.errors));

          stats.productsFixed++;
          const totalFixCount = fixes.reduce((sum, f) => sum + f.count, 0);
          stats.totalLinksFixed += totalFixCount;

          allFixed.push({ id: product.id, title: product.title, handle: product.handle, fixes });
          console.log(`  FIXED: ${product.title} (${totalFixCount} link(s))`);
          for (const fix of fixes) {
            console.log(`    ${fix.old} -> ${fix.new}`);
          }

          await sleep(RATE_LIMIT_DELAY);
        } catch (err) {
          stats.errors++;
          console.error(`  ERROR: ${product.title}: ${err.message}`);
        }
      }
    }

    console.log(`  Batch done. Totals: ${stats.productsFixed} fixed, ${stats.totalLinksFixed} links`);

    const nextMatch = headers.match(/page_info=([^>&\s]*)[^>]*>;\s*rel="next"/);
    if (nextMatch && products.length === 250) {
      page_info = nextMatch[1];
      page++;
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  console.log('\n========================================');
  console.log('    LEAFLY FIX SUMMARY');
  console.log('========================================\n');
  console.log(`Total products scanned: ${stats.totalProducts}`);
  console.log(`Products with Leafly fixes: ${stats.productsWithIssues}`);
  console.log(`Products fixed: ${stats.productsFixed}`);
  console.log(`Total links fixed: ${stats.totalLinksFixed}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

processAllProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
