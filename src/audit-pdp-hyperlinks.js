/**
 * PDP Hyperlink Audit & Fix Script
 *
 * Fetches all products from Shopify, extracts hyperlinks from body_html,
 * tests each link for correctness, and fixes broken/misdirected links.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const STORE_DOMAIN = 'oil-slick-pad.myshopify.com';
const API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = '2025-04';
const BASE_URL = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}`;

// Rate limiting
const RATE_LIMIT_DELAY = 550; // ms between API calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Stats tracking
const stats = {
  totalProducts: 0,
  productsWithLinks: 0,
  totalLinks: 0,
  brokenLinks: 0,
  redirectLinks: 0,
  fixedLinks: 0,
  errors: 0,
};

const brokenLinkReport = [];
const fixedProducts = [];

/**
 * Make authenticated Shopify API request
 */
async function shopifyRequest(endpoint, method = 'GET', data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'X-Shopify-Access-Token': API_TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (data) config.data = data;

  const response = await axios(config);
  return response;
}

/**
 * Fetch all products with pagination
 */
async function fetchAllProducts() {
  const allProducts = [];
  let page_info = null;
  let page = 1;

  console.log('Fetching all products...');

  while (true) {
    let endpoint;
    if (page_info) {
      endpoint = `/products.json?limit=250&fields=id,title,handle,body_html&page_info=${page_info}`;
    } else {
      endpoint = `/products.json?limit=250&fields=id,title,handle,body_html`;
    }

    const response = await shopifyRequest(endpoint);
    const products = response.data.products || [];
    allProducts.push(...products);

    console.log(`  Page ${page}: fetched ${products.length} products (total: ${allProducts.length})`);

    // Check for next page via Link header
    const linkHeader = response.headers['link'] || response.headers['Link'] || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);

    if (nextMatch && products.length === 250) {
      page_info = nextMatch[1];
      page++;
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  console.log(`Total products fetched: ${allProducts.length}\n`);
  return allProducts;
}

/**
 * Extract all hyperlinks from a product's body_html
 */
function extractLinks(bodyHtml, productHandle) {
  if (!bodyHtml) return [];

  const $ = cheerio.load(bodyHtml);
  const links = [];

  $('a[href]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Skip empty, javascript:, mailto:, tel:, and anchor-only links
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') ||
        href.startsWith('tel:') || href === '#') {
      return;
    }

    links.push({ href, text, element: el });
  });

  return links;
}

/**
 * Normalize a URL to fully qualified
 */
function normalizeUrl(href) {
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  if (href.startsWith('/')) {
    return `https://${STORE_DOMAIN}${href}`;
  }
  if (!href.startsWith('http')) {
    return `https://${STORE_DOMAIN}/${href}`;
  }
  return href;
}

/**
 * Check if a URL is internal to the store
 */
function isInternalLink(href) {
  const normalized = normalizeUrl(href);
  return normalized.includes('oil-slick-pad.myshopify.com') ||
         normalized.includes('oilslickpad.com') ||
         href.startsWith('/');
}

/**
 * Test a single link - check if it resolves correctly
 */
async function testLink(href, retries = 2) {
  const normalizedUrl = normalizeUrl(href);

  try {
    const response = await axios({
      method: 'HEAD',
      url: normalizedUrl,
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkAuditBot/1.0)',
      },
    });

    return {
      status: response.status,
      redirectUrl: response.headers['location'] || null,
      ok: response.status >= 200 && response.status < 400,
    };
  } catch (err) {
    if (retries > 0) {
      await sleep(1000);
      return testLink(href, retries - 1);
    }

    // Try GET as fallback (some servers reject HEAD)
    try {
      const response = await axios({
        method: 'GET',
        url: normalizedUrl,
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkAuditBot/1.0)',
        },
      });

      return {
        status: response.status,
        redirectUrl: response.headers['location'] || null,
        ok: response.status >= 200 && response.status < 400,
      };
    } catch (err2) {
      return {
        status: 0,
        redirectUrl: null,
        ok: false,
        error: err2.message,
      };
    }
  }
}

/**
 * Follow redirect chain to find the final destination
 */
async function followRedirects(url, maxRedirects = 10) {
  let currentUrl = normalizeUrl(url);
  const chain = [currentUrl];

  for (let i = 0; i < maxRedirects; i++) {
    try {
      const response = await axios({
        method: 'GET',
        url: currentUrl,
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkAuditBot/1.0)',
        },
      });

      if (response.status >= 300 && response.status < 400 && response.headers['location']) {
        let nextUrl = response.headers['location'];
        // Handle relative redirects
        if (nextUrl.startsWith('/')) {
          const urlObj = new URL(currentUrl);
          nextUrl = `${urlObj.protocol}//${urlObj.host}${nextUrl}`;
        }
        chain.push(nextUrl);
        currentUrl = nextUrl;
      } else {
        return { finalUrl: currentUrl, chain, status: response.status };
      }
    } catch (err) {
      return { finalUrl: currentUrl, chain, status: 0, error: err.message };
    }
  }

  return { finalUrl: currentUrl, chain, status: 0, error: 'Too many redirects' };
}

/**
 * Build a map of all valid product handles for link correction
 */
async function buildProductHandleMap() {
  console.log('Building product handle map for link correction...');
  const handleMap = new Map();
  let page_info = null;

  while (true) {
    let endpoint;
    if (page_info) {
      endpoint = `/products.json?limit=250&fields=id,title,handle&page_info=${page_info}`;
    } else {
      endpoint = `/products.json?limit=250&fields=id,title,handle`;
    }

    const response = await shopifyRequest(endpoint);
    const products = response.data.products || [];

    for (const p of products) {
      handleMap.set(p.handle, { id: p.id, title: p.title });
      // Also store simplified version for fuzzy matching
      const simplified = p.handle.replace(/-/g, '').toLowerCase();
      handleMap.set(simplified, { id: p.id, title: p.title, handle: p.handle });
    }

    const linkHeader = response.headers['link'] || response.headers['Link'] || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);

    if (nextMatch && products.length === 250) {
      page_info = nextMatch[1];
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  console.log(`  Product handle map built: ${handleMap.size} entries\n`);
  return handleMap;
}

/**
 * Build a map of all collection handles
 */
async function buildCollectionMap() {
  console.log('Building collection handle map...');
  const collectionMap = new Map();

  // Smart collections
  let page_info = null;
  while (true) {
    let endpoint;
    if (page_info) {
      endpoint = `/smart_collections.json?limit=250&fields=id,title,handle&page_info=${page_info}`;
    } else {
      endpoint = `/smart_collections.json?limit=250&fields=id,title,handle`;
    }

    const response = await shopifyRequest(endpoint);
    const collections = response.data.smart_collections || [];
    for (const c of collections) {
      collectionMap.set(c.handle, { id: c.id, title: c.title, type: 'smart' });
    }

    const linkHeader = response.headers['link'] || response.headers['Link'] || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);

    if (nextMatch && collections.length === 250) {
      page_info = nextMatch[1];
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  // Custom collections
  page_info = null;
  while (true) {
    let endpoint;
    if (page_info) {
      endpoint = `/custom_collections.json?limit=250&fields=id,title,handle&page_info=${page_info}`;
    } else {
      endpoint = `/custom_collections.json?limit=250&fields=id,title,handle`;
    }

    const response = await shopifyRequest(endpoint);
    const collections = response.data.custom_collections || [];
    for (const c of collections) {
      collectionMap.set(c.handle, { id: c.id, title: c.title, type: 'custom' });
    }

    const linkHeader = response.headers['link'] || response.headers['Link'] || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);

    if (nextMatch && collections.length === 250) {
      page_info = nextMatch[1];
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  console.log(`  Collection map built: ${collectionMap.size} entries\n`);
  return collectionMap;
}

/**
 * Determine the correct URL for a broken internal link
 */
function findCorrectUrl(brokenHref, productHandleMap, collectionMap) {
  // Extract the path
  let path = brokenHref;
  try {
    const urlObj = new URL(normalizeUrl(brokenHref));
    path = urlObj.pathname;
  } catch (e) {
    // Keep as-is
  }

  // Check if it's a /products/ link
  const productMatch = path.match(/\/products\/([^/?#]+)/);
  if (productMatch) {
    const handle = productMatch[1];
    if (productHandleMap.has(handle)) {
      return `/products/${handle}`;
    }
    // Try fuzzy match
    const simplified = handle.replace(/-/g, '').toLowerCase();
    if (productHandleMap.has(simplified)) {
      const correct = productHandleMap.get(simplified);
      return `/products/${correct.handle || handle}`;
    }
  }

  // Check if it's a /collections/ link
  const collectionMatch = path.match(/\/collections\/([^/?#]+)/);
  if (collectionMatch) {
    const handle = collectionMatch[1];
    if (collectionMap.has(handle)) {
      return `/collections/${handle}`;
    }
  }

  return null;
}

/**
 * Fix links in a product's body_html
 */
function fixLinksInHtml(bodyHtml, linkFixes) {
  if (!bodyHtml || linkFixes.length === 0) return bodyHtml;

  let fixedHtml = bodyHtml;

  for (const fix of linkFixes) {
    // Replace the old href with the new one
    // Use exact attribute matching to avoid false replacements
    const oldPatterns = [
      `href="${fix.oldHref}"`,
      `href='${fix.oldHref}'`,
      `href="${fix.oldHref.replace(/&/g, '&amp;')}"`,
    ];

    for (const pattern of oldPatterns) {
      if (fixedHtml.includes(pattern)) {
        fixedHtml = fixedHtml.replace(pattern, `href="${fix.newHref}"`);
        break;
      }
    }
  }

  return fixedHtml;
}

/**
 * Update a product's body_html via Shopify API
 */
async function updateProductHtml(productId, newBodyHtml) {
  const endpoint = `/products/${productId}.json`;
  await shopifyRequest(endpoint, 'PUT', {
    product: {
      id: productId,
      body_html: newBodyHtml,
    },
  });
}

/**
 * Main audit function
 */
async function auditAllPDPHyperlinks() {
  console.log('=== PDP Hyperlink Audit & Fix Tool ===\n');
  console.log(`Store: ${STORE_DOMAIN}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Phase 1: Fetch all products
  const allProducts = await fetchAllProducts();
  stats.totalProducts = allProducts.length;

  // Phase 2: Build reference maps for link correction
  const productHandleMap = await buildProductHandleMap();
  const collectionMap = await buildCollectionMap();

  // Phase 3: Extract and test all links
  console.log('=== Phase 3: Extracting and testing hyperlinks ===\n');

  const productsWithIssues = [];
  let processedCount = 0;

  for (const product of allProducts) {
    processedCount++;
    const links = extractLinks(product.body_html, product.handle);

    if (links.length === 0) continue;

    stats.productsWithLinks++;
    stats.totalLinks += links.length;

    const issues = [];

    for (const link of links) {
      const isInternal = isInternalLink(link.href);

      // Test the link
      const result = await testLink(link.href);

      if (!result.ok && result.status !== 301 && result.status !== 302 && result.status !== 308) {
        // Broken link (4xx, 5xx, or connection error)
        if (result.status === 404) {
          stats.brokenLinks++;
          const correctUrl = isInternal ? findCorrectUrl(link.href, productHandleMap, collectionMap) : null;

          issues.push({
            type: 'broken',
            href: link.href,
            text: link.text,
            status: result.status,
            error: result.error,
            suggestedFix: correctUrl,
          });

          brokenLinkReport.push({
            product: product.title,
            productId: product.id,
            handle: product.handle,
            linkHref: link.href,
            linkText: link.text,
            status: result.status,
            error: result.error,
            suggestedFix: correctUrl,
          });
        } else if (result.status >= 400) {
          stats.brokenLinks++;
          issues.push({
            type: 'error',
            href: link.href,
            text: link.text,
            status: result.status,
            error: result.error,
          });

          brokenLinkReport.push({
            product: product.title,
            productId: product.id,
            handle: product.handle,
            linkHref: link.href,
            linkText: link.text,
            status: result.status,
            error: result.error,
          });
        }
      } else if (result.status === 301 || result.status === 302 || result.status === 308) {
        // Redirect - follow it and update the link to the final destination
        stats.redirectLinks++;
        const redirectResult = await followRedirects(link.href);

        issues.push({
          type: 'redirect',
          href: link.href,
          text: link.text,
          status: result.status,
          redirectUrl: result.redirectUrl,
          finalUrl: redirectResult.finalUrl,
          chain: redirectResult.chain,
        });

        brokenLinkReport.push({
          product: product.title,
          productId: product.id,
          handle: product.handle,
          linkHref: link.href,
          linkText: link.text,
          status: result.status,
          redirectTo: redirectResult.finalUrl,
          chain: redirectResult.chain,
        });
      }

      await sleep(200); // Rate limit link checking
    }

    if (issues.length > 0) {
      productsWithIssues.push({
        product,
        issues,
      });
    }

    if (processedCount % 50 === 0) {
      console.log(`  Progress: ${processedCount}/${allProducts.length} products checked, ${stats.totalLinks} links tested`);
    }
  }

  // Phase 4: Fix issues
  console.log('\n=== Phase 4: Fixing broken and redirected links ===\n');

  for (const { product, issues } of productsWithIssues) {
    const linkFixes = [];

    for (const issue of issues) {
      if (issue.type === 'broken' && issue.suggestedFix) {
        linkFixes.push({
          oldHref: issue.href,
          newHref: issue.suggestedFix,
          reason: `404 -> corrected product/collection URL`,
        });
      } else if (issue.type === 'redirect') {
        // Convert final URL to relative path for internal links
        let newHref = issue.finalUrl;
        try {
          const urlObj = new URL(issue.finalUrl);
          if (urlObj.hostname.includes('oil-slick-pad') || urlObj.hostname.includes('oilslickpad')) {
            newHref = urlObj.pathname + urlObj.search + urlObj.hash;
          }
        } catch (e) {
          // Keep absolute URL
        }

        if (newHref !== issue.href) {
          linkFixes.push({
            oldHref: issue.href,
            newHref: newHref,
            reason: `${issue.status} redirect -> updated to final destination`,
          });
        }
      }
    }

    if (linkFixes.length > 0) {
      const fixedHtml = fixLinksInHtml(product.body_html, linkFixes);

      if (fixedHtml !== product.body_html) {
        try {
          await updateProductHtml(product.id, fixedHtml);
          stats.fixedLinks += linkFixes.length;
          fixedProducts.push({
            product: product.title,
            productId: product.id,
            handle: product.handle,
            fixes: linkFixes,
          });
          console.log(`  Fixed ${linkFixes.length} link(s) in: ${product.title}`);
          for (const fix of linkFixes) {
            console.log(`    ${fix.oldHref} -> ${fix.newHref} (${fix.reason})`);
          }
          await sleep(RATE_LIMIT_DELAY);
        } catch (err) {
          stats.errors++;
          console.error(`  ERROR updating ${product.title}: ${err.message}`);
        }
      }
    }
  }

  // Phase 5: Report
  console.log('\n\n========================================');
  console.log('         AUDIT SUMMARY REPORT');
  console.log('========================================\n');
  console.log(`Total products scanned:     ${stats.totalProducts}`);
  console.log(`Products with links:        ${stats.productsWithLinks}`);
  console.log(`Total links tested:         ${stats.totalLinks}`);
  console.log(`Broken links (404/error):   ${stats.brokenLinks}`);
  console.log(`Redirect links (301/302):   ${stats.redirectLinks}`);
  console.log(`Links fixed:                ${stats.fixedLinks}`);
  console.log(`Errors during fix:          ${stats.errors}`);

  if (brokenLinkReport.length > 0) {
    console.log('\n--- Detailed Issue Report ---\n');
    for (const entry of brokenLinkReport) {
      console.log(`Product: ${entry.product} (${entry.handle})`);
      console.log(`  Link: ${entry.linkHref}`);
      console.log(`  Text: "${entry.linkText}"`);
      console.log(`  Status: ${entry.status}`);
      if (entry.redirectTo) console.log(`  Redirects to: ${entry.redirectTo}`);
      if (entry.suggestedFix) console.log(`  Suggested fix: ${entry.suggestedFix}`);
      if (entry.error) console.log(`  Error: ${entry.error}`);
      console.log('');
    }
  }

  if (fixedProducts.length > 0) {
    console.log('\n--- Fixed Products ---\n');
    for (const entry of fixedProducts) {
      console.log(`Product: ${entry.product} (ID: ${entry.productId})`);
      for (const fix of entry.fixes) {
        console.log(`  ${fix.oldHref} -> ${fix.newHref}`);
      }
      console.log('');
    }
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);

  // Return report data for programmatic use
  return {
    stats,
    brokenLinkReport,
    fixedProducts,
  };
}

// Run the audit
auditAllPDPHyperlinks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
