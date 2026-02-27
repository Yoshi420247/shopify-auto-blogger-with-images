#!/usr/bin/env node

/**
 * Inventory Sync Runner
 *
 * Syncs stock levels from WYN Distribution (wyndistribution.com) to Shopify.
 * Matches products by name and updates Shopify inventory to mirror WYN stock.
 *
 * Usage:
 *   node src/inventory/syncRunner.js              # Full sync
 *   node src/inventory/syncRunner.js --dry-run    # Preview changes only
 *   node src/inventory/syncRunner.js --location-id 12345  # Specify location
 *
 * Environment variables required:
 *   SHOPIFY_ADMIN_API_TOKEN - Shopify Admin API token
 *   SHOPIFY_STORE_DOMAIN    - Shopify store domain (e.g., oil-slick-pad.myshopify.com)
 *   WC_STORE_URL            - WooCommerce store URL (e.g., https://wyndistribution.com)
 *   WC_CONSUMER_KEY         - WooCommerce consumer key
 *   WC_CONSUMER_SECRET      - WooCommerce consumer secret
 */

import 'dotenv/config';
import { runInventorySync } from './inventorySync.js';

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const locationIdArg = args.find((_, i) => args[i - 1] === '--location-id');

const options = {
  dryRun,
  locationId: locationIdArg ? parseInt(locationIdArg) : undefined
};

// Validate required environment variables
const required = [
  'SHOPIFY_ADMIN_API_TOKEN',
  'SHOPIFY_STORE_DOMAIN',
  'WC_STORE_URL',
  'WC_CONSUMER_KEY',
  'WC_CONSUMER_SECRET'
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('Missing required environment variables:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  process.exit(1);
}

// Run sync
try {
  const results = await runInventorySync(options);

  // Exit with error code if there were failures
  if (results.errors > 0) {
    console.error(`\nSync completed with ${results.errors} errors`);
    process.exit(1);
  }

  console.log('\nSync completed successfully');
  process.exit(0);
} catch (error) {
  console.error('\nFatal error during sync:', error.message);
  console.error(error.stack);
  process.exit(1);
}
