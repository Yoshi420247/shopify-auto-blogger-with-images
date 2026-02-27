/**
 * Shopify Inventory Client
 *
 * Fetches "What You Need" vendor products and updates inventory levels
 * using the Shopify Admin REST API with cursor-based pagination.
 */

import { get, post } from './httpClient.js';

const SHOPIFY_DOMAIN = (process.env.SHOPIFY_STORE_DOMAIN || 'oil-slick-pad.myshopify.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = '2025-04';

function shopifyUrl(path) {
  return `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`;
}

function shopifyHeaders() {
  return {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
    'Content-Type': 'application/json'
  };
}

/**
 * Parse the Shopify Link header to extract the next page URL
 * Shopify uses cursor-based pagination with page_info in the Link header
 * Format: <https://...?page_info=xxx&limit=250>; rel="next"
 */
function parseNextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

/**
 * Fetch all "What You Need" vendor products with inventory data (paginated)
 * Uses Shopify cursor-based pagination via Link header
 */
export async function fetchAllVendorProducts(vendor = 'What You Need') {
  const allProducts = [];
  let page = 0;
  let nextUrl = `${shopifyUrl('/products.json')}?limit=250&vendor=${encodeURIComponent(vendor)}`;

  console.log(`Fetching Shopify products with vendor "${vendor}"...`);

  while (nextUrl) {
    try {
      const { data, headers } = get(nextUrl, {
        headers: shopifyHeaders(),
        timeout: 60,
        includeHeaders: true
      });

      const products = data?.products || [];
      if (products.length === 0) break;

      for (const p of products) {
        allProducts.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          vendor: p.vendor,
          variants: p.variants?.map(v => ({
            id: v.id,
            title: v.title,
            sku: v.sku,
            inventory_quantity: v.inventory_quantity,
            inventory_item_id: v.inventory_item_id
          })) || []
        });
      }

      page++;
      console.log(`  Page ${page}: fetched ${products.length} products (total: ${allProducts.length})`);

      // Get next page URL from Link header
      nextUrl = parseNextPageUrl(headers?.link || '');

      if (products.length < 250) break;
    } catch (error) {
      console.error(`  Error fetching page ${page + 1}:`, error.message);
      break;
    }
  }

  console.log(`Fetched ${allProducts.length} total Shopify vendor products`);
  return allProducts;
}

/**
 * Get store locations
 */
export function getLocations() {
  const { data } = get(shopifyUrl('/locations.json'), {
    headers: shopifyHeaders()
  });
  return data?.locations || [];
}

/**
 * Set inventory level for an inventory item at a location
 * Uses the "set" endpoint which sets to an absolute quantity
 */
export function setInventoryLevel(inventoryItemId, locationId, quantity) {
  const { data } = post(shopifyUrl('/inventory_levels/set.json'), {
    location_id: locationId,
    inventory_item_id: inventoryItemId,
    available: quantity
  }, {
    headers: shopifyHeaders()
  });
  return data?.inventory_level || null;
}

/**
 * Build a product map keyed by normalized name
 */
export async function buildProductMap(vendor = 'What You Need') {
  const products = await fetchAllVendorProducts(vendor);
  const productMap = new Map();

  for (const product of products) {
    const key = normalizeName(product.title);
    productMap.set(key, {
      shopifyId: product.id,
      title: product.title,
      handle: product.handle,
      variants: product.variants
    });
  }

  console.log(`Built Shopify product map with ${productMap.size} products`);
  return productMap;
}

/**
 * Normalize product name for matching (same logic as WC client)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
