/**
 * WooCommerce Client for WYN Distribution
 *
 * Fetches product catalog and stock levels from wyndistribution.com
 * using the WooCommerce REST API v3.
 */

import { get } from './httpClient.js';

const WC_STORE_URL = (process.env.WC_STORE_URL || 'https://wyndistribution.com').replace(/\/$/, '');
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY;
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET;

/**
 * Make authenticated WooCommerce API request
 */
function wcGet(endpoint, params = {}) {
  const url = `${WC_STORE_URL}/wp-json/wc/v3${endpoint}`;
  return get(url, {
    params: {
      consumer_key: WC_CONSUMER_KEY,
      consumer_secret: WC_CONSUMER_SECRET,
      ...params
    },
    timeout: 60
  });
}

/**
 * Fetch all products from WooCommerce (paginated)
 * Returns array of { id, name, sku, type, stock_status, stock_quantity, manage_stock }
 */
export async function fetchAllProducts() {
  const allProducts = [];
  let page = 1;
  const perPage = 100;  // WC max per page

  console.log('Fetching products from WYN Distribution...');

  while (true) {
    try {
      const { data } = wcGet('/products', {
        per_page: perPage,
        page: String(page),
        status: 'publish',
        orderby: 'title',
        order: 'asc'
      });

      if (!Array.isArray(data) || data.length === 0) break;

      for (const p of data) {
        allProducts.push({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          type: p.type,
          stock_status: p.stock_status,
          stock_quantity: p.stock_quantity,
          manage_stock: p.manage_stock,
          price: p.price,
          categories: p.categories?.map(c => c.name) || [],
          variationIds: p.variations || []
        });
      }

      console.log(`  Page ${page}: fetched ${data.length} products (total: ${allProducts.length})`);

      if (data.length < perPage) break;
      page++;
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error.message);
      // Retry once after a short delay
      await sleep(2000);
      try {
        const { data } = wcGet('/products', {
          per_page: perPage,
          page: String(page),
          status: 'publish',
          orderby: 'title',
          order: 'asc'
        });
        if (!Array.isArray(data) || data.length === 0) break;
        for (const p of data) {
          allProducts.push({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            type: p.type,
            stock_status: p.stock_status,
            stock_quantity: p.stock_quantity,
            manage_stock: p.manage_stock,
            price: p.price,
            categories: p.categories?.map(c => c.name) || [],
            variationIds: p.variations || []
          });
        }
        if (data.length < perPage) break;
        page++;
      } catch (retryError) {
        console.error(`  Retry failed for page ${page}, stopping:`, retryError.message);
        break;
      }
    }
  }

  console.log(`Fetched ${allProducts.length} total products from WYN Distribution`);
  return allProducts;
}

/**
 * Fetch variations for a variable product
 * @param {number} productId - WC product ID
 * @returns {Array} variations with stock data
 */
export function fetchVariations(productId) {
  try {
    const { data } = wcGet(`/products/${productId}/variations`, {
      per_page: '100'
    });

    if (!Array.isArray(data)) return [];

    return data.map(v => ({
      id: v.id,
      sku: v.sku || '',
      stock_status: v.stock_status,
      stock_quantity: v.stock_quantity,
      manage_stock: v.manage_stock,
      attributes: v.attributes?.map(a => ({ name: a.name, option: a.option })) || []
    }));
  } catch (error) {
    console.error(`  Error fetching variations for product ${productId}:`, error.message);
    return [];
  }
}

/**
 * Build a stock map from WooCommerce products
 * Returns Map<normalizedName, { stock_status, stock_quantity, type, sku }>
 */
export async function buildStockMap() {
  const products = await fetchAllProducts();
  const stockMap = new Map();

  for (const product of products) {
    const key = normalizeName(product.name);

    if (product.type === 'simple') {
      // Simple products have direct stock data
      stockMap.set(key, {
        wcId: product.id,
        name: product.name,
        sku: product.sku,
        type: 'simple',
        stock_status: product.stock_status,
        stock_quantity: product.manage_stock ? product.stock_quantity : null,
        manage_stock: product.manage_stock
      });
    } else if (product.type === 'variable') {
      // For variable products, get stock from first variation (stock managed at parent)
      // or use stock_status as fallback
      let stockQuantity = null;

      if (product.variationIds.length > 0) {
        const variations = fetchVariations(product.id);
        if (variations.length > 0) {
          // Use the stock quantity from the first variation (they share parent stock)
          stockQuantity = variations[0].stock_quantity;
        }
      }

      stockMap.set(key, {
        wcId: product.id,
        name: product.name,
        sku: product.sku,
        type: 'variable',
        stock_status: product.stock_status,
        stock_quantity: stockQuantity,
        manage_stock: product.manage_stock
      });
    }
  }

  console.log(`Built stock map with ${stockMap.size} products`);
  return stockMap;
}

/**
 * Normalize product name for matching
 * Strips whitespace, lowercases, removes special chars for fuzzy matching
 */
export function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
