#!/usr/bin/env node

/**
 * CLI script to generate and upload email marketing assets to Shopify Files.
 *
 * Usage:
 *   node src/marketing/generateAssets.js              # Generate all assets
 *   node src/marketing/generateAssets.js --dry-run    # Preview without uploading
 *   node src/marketing/generateAssets.js --only hero  # Generate specific asset
 *
 * Required env vars:
 *   SHOPIFY_ADMIN_API_TOKEN  - Your Shopify admin API token
 *   GEMINI_API_KEY           - For image generation (default provider)
 *   or OPENAI_API_KEY        - If IMAGE_PROVIDER=gpt-image-1
 */

import { generateEmailAssets } from './emailAssetGenerator.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex !== -1 ? [args[onlyIndex + 1]] : null;

  // Validate required environment
  if (!process.env.SHOPIFY_ADMIN_API_TOKEN) {
    console.error('Error: SHOPIFY_ADMIN_API_TOKEN is required');
    console.error('Set it in your .env file or as an environment variable');
    process.exit(1);
  }

  const imageProvider = process.env.IMAGE_PROVIDER || 'gemini';
  if (imageProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is required for Gemini image generation');
    process.exit(1);
  }
  if (imageProvider === 'gpt-image-1' && !process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is required for gpt-image-1 image generation');
    process.exit(1);
  }

  console.log('Oil Slick Pad - Email Marketing Asset Generator');
  console.log('================================================\n');

  try {
    const results = await generateEmailAssets({ dryRun, only });

    const allSucceeded = Object.values(results).every(r => r.success);
    if (allSucceeded) {
      console.log('\nAll assets generated successfully.');
      if (!dryRun) {
        console.log('\nNext steps:');
        console.log('1. Go to Shopify Admin > Settings > Files to verify uploads');
        console.log('2. Copy the CDN URLs into your email template');
        console.log('3. Go to Marketing > Automations > Create automation');
        console.log('4. Choose "Recover abandoned carts" template');
        console.log('5. Paste the email HTML from: src/marketing/templates/abandoned-cart-recovery.html');
      }
    } else {
      console.log('\nSome assets failed. Check the errors above and retry.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
