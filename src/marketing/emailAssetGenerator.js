/**
 * Email Asset Generator
 *
 * Generates visual assets for marketing emails (hero banners, product cards,
 * social proof graphics) using the same AI image pipeline as the blog system.
 *
 * These assets are uploaded to Shopify Files for use in email templates.
 */

import config from '../config.js';
import { generateImage } from '../generators/imageGenerator.js';
import { uploadImageToFiles } from '../publishers/shopifyPublisher.js';

/**
 * Asset definitions for abandoned cart recovery emails
 */
const EMAIL_ASSETS = {
  'abandoned-cart-hero': {
    description: 'A clean, modern desktop workspace with premium dab accessories neatly arranged on a silicone mat. The scene includes a glass dab rig, quartz banger, carb cap, and dab tool on a dark wood surface. Soft warm overhead lighting, shallow depth of field, moody yet inviting atmosphere. Wide banner composition (3:1 ratio).',
    style: 'lifestyle',
    filename: 'abandoned-cart-hero.png',
    altText: 'Premium dab accessories on a clean workspace - Oil Slick Pad'
  },
  'rec-product-1': {
    description: 'A single colorful silicone dab pad/mat shown from a 3/4 angle on a clean white surface. The pad is thin and flexible with a subtle colored edge binding. Professional product photography with soft studio lighting. Square composition.',
    style: 'product',
    filename: 'rec-product-1.png',
    altText: 'Oil Slick Pad - Premium silicone dab mat'
  },
  'rec-product-2': {
    description: 'A neat stack of clean, translucent PTFE (Teflon) sheets for concentrate storage. Shot on a white background with professional studio lighting. The sheets look crisp, smooth, and food-grade quality. Square composition.',
    style: 'product',
    filename: 'rec-product-2.png',
    altText: 'PTFE Sheets for concentrate storage'
  },
  'rec-product-3': {
    description: 'Three small glass concentrate jars with black lids arranged in a triangle pattern on a clean surface. Professional product photography, clean and minimal. The jars are small (5ml-9ml), thick borosilicate glass. Square composition.',
    style: 'product',
    filename: 'rec-product-3.png',
    altText: 'Glass concentrate storage jars'
  }
};

/**
 * Generate all email marketing assets and upload them to Shopify Files.
 * Call this once to populate your Shopify Files with the images needed
 * by the email templates.
 *
 * @param {Object} options
 * @param {boolean} options.dryRun - If true, generate but don't upload
 * @param {string[]} options.only - Only generate specific asset keys
 * @returns {Object} Map of asset key -> Shopify CDN URL
 */
export async function generateEmailAssets(options = {}) {
  const { dryRun = false, only = null } = options;
  const results = {};
  const assetKeys = only || Object.keys(EMAIL_ASSETS);

  console.log(`\n=== Email Asset Generator ===`);
  console.log(`Provider: ${config.imageProvider}`);
  console.log(`Assets to generate: ${assetKeys.length}`);
  console.log(`Dry run: ${dryRun}\n`);

  for (const key of assetKeys) {
    const asset = EMAIL_ASSETS[key];
    if (!asset) {
      console.warn(`Unknown asset key: ${key}, skipping`);
      continue;
    }

    console.log(`\n--- Generating: ${key} ---`);
    console.log(`Description: ${asset.description.substring(0, 80)}...`);

    try {
      // Generate the image
      const imageResult = await generateImage(asset.description, {
        style: asset.style,
        aspectRatio: key === 'abandoned-cart-hero' ? '16:9' : '1:1'
      });

      if (!imageResult.success) {
        console.error(`Failed to generate ${key}: ${imageResult.error}`);
        results[key] = { success: false, error: imageResult.error };
        continue;
      }

      console.log(`Generated with model: ${imageResult.model}`);

      if (dryRun) {
        console.log(`[DRY RUN] Would upload ${asset.filename} to Shopify Files`);
        results[key] = { success: true, dryRun: true, model: imageResult.model };
        continue;
      }

      // Upload to Shopify Files
      const uploaded = await uploadImageToFiles(
        imageResult.imageData,
        asset.filename,
        asset.altText
      );

      if (uploaded) {
        console.log(`Uploaded to Shopify: ${uploaded.url}`);
        results[key] = {
          success: true,
          url: uploaded.url,
          fileId: uploaded.fileId,
          model: imageResult.model
        };
      } else {
        console.error(`Failed to upload ${key} to Shopify Files`);
        results[key] = { success: false, error: 'Upload failed' };
      }

    } catch (error) {
      console.error(`Error processing ${key}:`, error.message);
      results[key] = { success: false, error: error.message };
    }

    // Rate limit delay between generations
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Summary
  console.log('\n=== Asset Generation Summary ===');
  const succeeded = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success).length;
  console.log(`Succeeded: ${succeeded}/${assetKeys.length}`);
  if (failed > 0) console.log(`Failed: ${failed}`);

  for (const [key, result] of Object.entries(results)) {
    if (result.success && result.url) {
      console.log(`  ${key}: ${result.url}`);
    }
  }

  return results;
}

/**
 * Generate a single asset by key
 */
export async function generateSingleAsset(key, options = {}) {
  return generateEmailAssets({ ...options, only: [key] });
}

/**
 * Get the asset definitions (for reference or customization)
 */
export function getAssetDefinitions() {
  return { ...EMAIL_ASSETS };
}

export default {
  generateEmailAssets,
  generateSingleAsset,
  getAssetDefinitions
};
