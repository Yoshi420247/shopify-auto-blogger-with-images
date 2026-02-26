/**
 * PDP Hyperlink Fix Script
 *
 * Fixes all broken and redirected hyperlinks across all product descriptions.
 * Uses curl via child_process to handle proxy correctly.
 *
 * AUDIT FINDINGS:
 *
 * BROKEN INTERNAL (404) - 8 collections affecting ~3,525 product links:
 *   nectar-collectors-straws -> nectar-collectors (414 products)
 *   storage-packaging -> storage-containers (822 products)
 *   silicone-smoking-devices -> silicone-products (801 products)
 *   silicone-pipes -> silicone-hand-pipes (410 products)
 *   rolling-papers -> rolling-papers-cones (76 products)
 *   herb-grinders -> grinders (1 product)
 *   pipes -> all-pipes (1 product)
 *   recycler-rigs -> dab-rigs (1 product)
 *
 * REDIRECT (301) - 7 collections affecting ~3,153 product links:
 *   clearance-2 -> clearance (27 products)
 *   dab-tools-dabbers -> dab-tools (557 products)
 *   glass-jars-extract-packaging -> glass-jars (428 products)
 *   non-stick-paper-and-ptfe -> ptfe-sheets (55 products)
 *   parchment-papers -> parchment-paper (203 products)
 *   rolling-accessories -> rolling-papers-cones (14 products)
 *   smoke-shop-products -> smoke-and-vape (1869 products)
 *
 * BROKEN EXTERNAL - 34 Leafly URLs (404) affecting ~100 product links
 */

import { execSync } from 'child_process';

const STORE_DOMAIN = 'oil-slick-pad.myshopify.com';
const API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = '2025-04';
const BASE_URL = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}`;
const PUBLIC_DOMAIN = 'oilslickpad.com';

const RATE_LIMIT_DELAY = 600;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// URL REPLACEMENT MAP
// ============================================================

const URL_REPLACEMENTS = {
  // === BROKEN INTERNAL COLLECTION LINKS (404) ===
  [`https://${PUBLIC_DOMAIN}/collections/nectar-collectors-straws`]:
    `https://${PUBLIC_DOMAIN}/collections/nectar-collectors`,

  [`https://${PUBLIC_DOMAIN}/collections/storage-packaging`]:
    `https://${PUBLIC_DOMAIN}/collections/storage-containers`,

  [`https://${PUBLIC_DOMAIN}/collections/silicone-smoking-devices`]:
    `https://${PUBLIC_DOMAIN}/collections/silicone-products`,

  [`https://${PUBLIC_DOMAIN}/collections/silicone-pipes`]:
    `https://${PUBLIC_DOMAIN}/collections/silicone-hand-pipes`,

  [`https://${PUBLIC_DOMAIN}/collections/rolling-papers`]:
    `https://${PUBLIC_DOMAIN}/collections/rolling-papers-cones`,

  [`https://${PUBLIC_DOMAIN}/collections/herb-grinders`]:
    `https://${PUBLIC_DOMAIN}/collections/grinders`,

  [`https://${PUBLIC_DOMAIN}/collections/pipes`]:
    `https://${PUBLIC_DOMAIN}/collections/all-pipes`,

  [`https://${PUBLIC_DOMAIN}/collections/recycler-rigs`]:
    `https://${PUBLIC_DOMAIN}/collections/dab-rigs`,

  // === REDIRECT INTERNAL COLLECTION LINKS (301) ===
  [`https://${PUBLIC_DOMAIN}/collections/clearance-2`]:
    `https://${PUBLIC_DOMAIN}/collections/clearance`,

  [`https://${PUBLIC_DOMAIN}/collections/dab-tools-dabbers`]:
    `https://${PUBLIC_DOMAIN}/collections/dab-tools`,

  [`https://${PUBLIC_DOMAIN}/collections/glass-jars-extract-packaging`]:
    `https://${PUBLIC_DOMAIN}/collections/glass-jars`,

  [`https://${PUBLIC_DOMAIN}/collections/non-stick-paper-and-ptfe`]:
    `https://${PUBLIC_DOMAIN}/collections/ptfe-sheets`,

  [`https://${PUBLIC_DOMAIN}/collections/parchment-papers`]:
    `https://${PUBLIC_DOMAIN}/collections/parchment-paper`,

  [`https://${PUBLIC_DOMAIN}/collections/rolling-accessories`]:
    `https://${PUBLIC_DOMAIN}/collections/rolling-papers-cones`,

  [`https://${PUBLIC_DOMAIN}/collections/smoke-shop-products`]:
    `https://${PUBLIC_DOMAIN}/collections/smoke-and-vape`,

  // === BROKEN EXTERNAL LEAFLY LINKS ===
  'https://www.leafly.com/brands/vibes':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/cannabis-101/cannabis-and-spirituality':
    'https://www.leafly.com/learn/consume',

  'https://www.leafly.com/learn/consume/concentrates':
    'https://www.leafly.com/learn/consume/dabs',

  'https://www.leafly.com/learn/consume/pipes':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoke/best-bongs':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/learn/consume/smoke/best-way-to-store-cannabis':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoke/grinder':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-a-bong':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-a-pipe':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoke/how-to-clean-bong':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/learn/consume/smoke/how-to-roll-a-joint':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/learn/consume/smoke/pipes':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoke/rolling-papers':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/learn/consume/smoke/what-is-a-bong':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/learn/consume/smoking':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/smoking/how-to-store-cannabis':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/learn/consume/vaporizers':
    'https://www.leafly.com/learn/consume',

  'https://www.leafly.com/news/cannabis-101/blunts-vs-joints-whats-the-difference':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/cannabis-101/cannabis-rolling-papers-101':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/cannabis-101/cannabis-rolling-papers-guide':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/cannabis-101/different-types-of-rolling-papers':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-bong':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-glass-pipe':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-pipe':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/cannabis-101/how-to-clean-a-pipe-bong-or-vaporizer':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/cannabis-101/how-to-use-a-bong':
    'https://www.leafly.com/learn/cannabis-glossary/bong',

  'https://www.leafly.com/news/cannabis-101/how-to-vape-cannabis-oil-and-flower':
    'https://www.leafly.com/learn/consume',

  'https://www.leafly.com/news/cannabis-101/rolling-papers-101':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/industry/american-glass-artists-fight-to-protect-their-craft':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/lifestyle/how-to-roll-a-joint':
    'https://www.leafly.com/learn/cannabis-glossary/rolling-papers',

  'https://www.leafly.com/news/strains-products/best-rolling-trays':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/strains-products/heady-glass-guide-collecting-functional-glass-art':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/strains-products/heady-glass-pipes-art':
    'https://www.leafly.com/learn/consume/smoke',

  'https://www.leafly.com/news/strains-products/heady-glass-pipes-functional-glass-art':
    'https://www.leafly.com/learn/consume/smoke',
};

/**
 * Make Shopify API request using curl (handles proxy correctly)
 */
function curlShopifyGet(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  const cmd = `curl -s -D /tmp/shopify_headers.txt "${url}" -H "X-Shopify-Access-Token: ${API_TOKEN}" -H "Content-Type: application/json"`;
  const result = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }).toString();
  const headers = execSync('cat /tmp/shopify_headers.txt').toString();
  return { data: JSON.parse(result), headers };
}

function curlShopifyPut(endpoint, data) {
  const jsonData = JSON.stringify(data);
  // Write JSON to temp file to avoid shell escaping issues
  const tmpFile = '/tmp/shopify_put_data.json';
  execSync(`cat > ${tmpFile} << 'JSONEOF'\n${jsonData}\nJSONEOF`);
  const url = `${BASE_URL}${endpoint}`;
  const cmd = `curl -s -X PUT "${url}" -H "X-Shopify-Access-Token: ${API_TOKEN}" -H "Content-Type: application/json" -d @${tmpFile}`;
  const result = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }).toString();
  return JSON.parse(result);
}

// Stats
const stats = {
  totalProducts: 0,
  productsChecked: 0,
  productsWithIssues: 0,
  productsFixed: 0,
  totalLinksFixed: 0,
  errors: 0,
};

/**
 * Apply URL replacements to body_html
 */
function applyFixes(bodyHtml) {
  if (!bodyHtml) return { fixedHtml: bodyHtml, fixes: [] };

  let fixedHtml = bodyHtml;
  const fixes = [];

  for (const [oldUrl, newUrl] of Object.entries(URL_REPLACEMENTS)) {
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

/**
 * Main processing function
 */
async function processAllProducts() {
  console.log('=== PDP Hyperlink Fix Tool ===\n');
  console.log(`Store: ${STORE_DOMAIN}`);
  console.log(`URL replacements configured: ${Object.keys(URL_REPLACEMENTS).length}`);
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

    let response;
    try {
      response = curlShopifyGet(endpoint);
    } catch (err) {
      console.error(`Error fetching page ${page}: ${err.message}`);
      break;
    }

    const products = response.data.products || [];
    console.log(`\nPage ${page}: Processing ${products.length} products...`);

    for (const product of products) {
      stats.totalProducts++;

      if (!product.body_html) continue;
      stats.productsChecked++;

      const { fixedHtml, fixes } = applyFixes(product.body_html);

      if (fixes.length > 0) {
        stats.productsWithIssues++;

        try {
          // Write the fixed HTML to a temp file and use curl for the PUT
          const fs = await import('fs');
          const putData = JSON.stringify({ product: { id: product.id, body_html: fixedHtml } });
          fs.writeFileSync('/tmp/shopify_put_data.json', putData);

          const url = `${BASE_URL}/products/${product.id}.json`;
          execSync(
            `curl -s -X PUT "${url}" -H "X-Shopify-Access-Token: ${API_TOKEN}" -H "Content-Type: application/json" -d @/tmp/shopify_put_data.json > /tmp/shopify_put_result.json`,
            { timeout: 60000 }
          );

          const result = JSON.parse(fs.readFileSync('/tmp/shopify_put_result.json', 'utf-8'));

          if (result.errors) {
            throw new Error(JSON.stringify(result.errors));
          }

          stats.productsFixed++;
          const totalFixCount = fixes.reduce((sum, f) => sum + f.count, 0);
          stats.totalLinksFixed += totalFixCount;

          allFixed.push({
            id: product.id,
            title: product.title,
            handle: product.handle,
            fixes,
          });

          console.log(`  FIXED: ${product.title} (${totalFixCount} link(s))`);
          for (const fix of fixes) {
            console.log(`    ${fix.old} -> ${fix.new} (x${fix.count})`);
          }

          await sleep(RATE_LIMIT_DELAY);
        } catch (err) {
          stats.errors++;
          console.error(`  ERROR updating ${product.title} (${product.id}): ${err.message}`);
        }
      }
    }

    console.log(`  Batch complete. Running totals: ${stats.productsFixed} fixed, ${stats.totalLinksFixed} links`);

    // Parse Link header for pagination
    const headers = response.headers;
    const nextMatch = headers.match(/page_info=([^>&\s]*)[^>]*>;\s*rel="next"/);

    if (nextMatch && products.length === 250) {
      page_info = nextMatch[1];
      page++;
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  // Final report
  console.log('\n\n========================================');
  console.log('         FIX SUMMARY REPORT');
  console.log('========================================\n');
  console.log(`Total products in store:     ${stats.totalProducts}`);
  console.log(`Products with body_html:     ${stats.productsChecked}`);
  console.log(`Products with broken links:  ${stats.productsWithIssues}`);
  console.log(`Products successfully fixed:  ${stats.productsFixed}`);
  console.log(`Total links fixed:           ${stats.totalLinksFixed}`);
  console.log(`Errors:                      ${stats.errors}`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);

  if (allFixed.length > 0) {
    console.log('\n--- All Fixed Products ---\n');
    for (const entry of allFixed) {
      console.log(`${entry.title} (ID: ${entry.id}, Handle: ${entry.handle})`);
      for (const fix of entry.fixes) {
        console.log(`  ${fix.old}`);
        console.log(`    -> ${fix.new} (x${fix.count})`);
      }
    }
  }

  return { stats, allFixed };
}

processAllProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
