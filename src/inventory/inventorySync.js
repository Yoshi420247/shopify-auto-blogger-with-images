/**
 * Inventory Sync Engine
 *
 * Matches products between WYN Distribution (WooCommerce) and Shopify
 * by product name, then updates Shopify inventory levels to mirror WYN stock.
 *
 * Sync rules:
 * - Simple WC products: use stock_quantity directly
 * - Variable WC products: use first variation's stock_quantity, or stock_status
 * - WC "instock" with null quantity: set Shopify to a high number (999)
 * - WC "outofstock": set Shopify variants to 0
 * - Unmatched products are logged for review
 */

import { buildStockMap, normalizeName } from './wooCommerceClient.js';
import {
  buildProductMap,
  getLocations,
  setInventoryLevel
} from './shopifyInventoryClient.js';

// Default stock quantity when WC says "instock" but has no specific quantity
const DEFAULT_INSTOCK_QTY = 999;

// Rate limiting: Shopify allows 2 requests/second for REST API
const SHOPIFY_DELAY_MS = 550;  // ~1.8 req/s to stay safely under limit

/**
 * Run the full inventory sync
 * @param {object} options
 * @param {boolean} options.dryRun - If true, log changes without applying them
 * @param {number} options.locationId - Shopify location ID (auto-detected if not provided)
 * @returns {object} Sync results summary
 */
export async function runInventorySync(options = {}) {
  const { dryRun = false } = options;
  let { locationId } = options;

  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log(`INVENTORY SYNC${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Step 1: Get Shopify location
  if (!locationId) {
    console.log('\n--- Step 1: Getting Shopify location ---');
    const locations = getLocations();
    if (locations.length === 0) {
      throw new Error('No Shopify locations found');
    }
    // Use the first active location (primary warehouse)
    const activeLocations = locations.filter(l => l.active);
    // Prefer "4457 NorthWest" or first active location
    const preferred = activeLocations.find(l => l.name.includes('NorthWest') || l.name.includes('Northwest'));
    locationId = preferred?.id || activeLocations[0]?.id;
    console.log(`Using location: ${preferred?.name || activeLocations[0]?.name} (ID: ${locationId})`);
  }

  // Step 2: Build stock map from WYN Distribution
  console.log('\n--- Step 2: Fetching WYN Distribution inventory ---');
  const wcStockMap = await buildStockMap();

  // Step 3: Build product map from Shopify
  console.log('\n--- Step 3: Fetching Shopify products ---');
  const shopifyProductMap = await buildProductMap();

  // Step 4: Match and sync
  console.log('\n--- Step 4: Matching and syncing inventory ---');
  const results = {
    matched: 0,
    updated: 0,
    skipped: 0,      // Already in sync
    errors: 0,
    unmatchedWc: [],  // WC products not found on Shopify
    unmatchedShopify: [], // Shopify products not found on WC
    updates: []       // Detailed update log
  };

  // Track which Shopify products were matched
  const matchedShopifyKeys = new Set();

  // Iterate through WC products and match to Shopify
  for (const [wcKey, wcStock] of wcStockMap) {
    const shopifyProduct = shopifyProductMap.get(wcKey);

    if (!shopifyProduct) {
      results.unmatchedWc.push({ name: wcStock.name, wcId: wcStock.wcId });
      continue;
    }

    matchedShopifyKeys.add(wcKey);
    results.matched++;

    // Determine target stock quantity
    let targetQty;
    if (wcStock.stock_quantity !== null && wcStock.stock_quantity !== undefined) {
      targetQty = Math.max(0, wcStock.stock_quantity);
    } else if (wcStock.stock_status === 'outofstock') {
      targetQty = 0;
    } else if (wcStock.stock_status === 'instock') {
      targetQty = DEFAULT_INSTOCK_QTY;
    } else {
      targetQty = 0;  // Unknown status, default to 0
    }

    // Update each Shopify variant
    for (const variant of shopifyProduct.variants) {
      const currentQty = variant.inventory_quantity || 0;

      if (currentQty === targetQty) {
        results.skipped++;
        continue;
      }

      const updateInfo = {
        shopifyProduct: shopifyProduct.title,
        variant: variant.title,
        variantId: variant.id,
        inventoryItemId: variant.inventory_item_id,
        from: currentQty,
        to: targetQty,
        wcSource: wcStock.name,
        wcStockStatus: wcStock.stock_status
      };

      if (dryRun) {
        console.log(`  [DRY RUN] ${shopifyProduct.title} (${variant.title}): ${currentQty} → ${targetQty}`);
        results.updates.push(updateInfo);
        results.updated++;
      } else {
        try {
          setInventoryLevel(variant.inventory_item_id, locationId, targetQty);
          results.updates.push(updateInfo);
          results.updated++;

          if (results.updated % 50 === 0) {
            console.log(`  Updated ${results.updated} variants so far...`);
          }

          // Rate limiting
          await sleep(SHOPIFY_DELAY_MS);
        } catch (error) {
          console.error(`  Error updating ${shopifyProduct.title} (${variant.title}):`, error.message);
          results.errors++;
          updateInfo.error = error.message;
          results.updates.push(updateInfo);
        }
      }
    }
  }

  // Find unmatched Shopify products
  for (const [shopifyKey, shopifyProduct] of shopifyProductMap) {
    if (!matchedShopifyKeys.has(shopifyKey)) {
      results.unmatchedShopify.push({ title: shopifyProduct.title, shopifyId: shopifyProduct.shopifyId });
    }
  }

  // Step 5: Report
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Duration: ${elapsed}s`);
  console.log(`Products matched: ${results.matched}`);
  console.log(`Variants updated: ${results.updated}`);
  console.log(`Variants already in sync: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`WC products not found on Shopify: ${results.unmatchedWc.length}`);
  console.log(`Shopify products not found on WC: ${results.unmatchedShopify.length}`);

  if (results.unmatchedWc.length > 0 && results.unmatchedWc.length <= 20) {
    console.log('\nUnmatched WC products (not on Shopify):');
    for (const p of results.unmatchedWc.slice(0, 20)) {
      console.log(`  - ${p.name}`);
    }
  }

  if (results.unmatchedShopify.length > 0 && results.unmatchedShopify.length <= 20) {
    console.log('\nUnmatched Shopify products (not on WC):');
    for (const p of results.unmatchedShopify.slice(0, 20)) {
      console.log(`  - ${p.title}`);
    }
  }

  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
