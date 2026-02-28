/**
 * Test: Uses the REAL markdownToHtml function from the codebase to verify
 * that [IMAGE:] markers survive through actual markdown→HTML conversion,
 * and that the full protect→restore cycle produces valid <figure><img> HTML.
 *
 * This is the definitive test that proves the fix works.
 *
 * Run: node scripts/test-real-pipeline.js
 */

import { markdownToHtml } from '../src/publishers/shopifyPublisher.js';

// ── Replicate the protect/restore functions from index.js ──
function protectImageMarkers(htmlContent) {
  const markers = [];
  let index = 0;
  const content = htmlContent.replace(/(<p[^>]*>)?\s*\[IMAGE:([^\]]*)\]\s*(<\/p>)?/g, (match, pOpen, desc, pClose) => {
    markers.push(desc.trim());
    return `<!--IMG_PLACEHOLDER_${index++}-->`;
  });
  return { content, markers };
}

function restoreAndInsertImages(htmlContent, savedMarkers, uploadedImages) {
  let content = htmlContent;
  for (let i = 0; i < savedMarkers.length; i++) {
    const placeholder = `<!--IMG_PLACEHOLDER_${i}-->`;
    if (i < uploadedImages.length) {
      const img = uploadedImages[i];
      const caption = savedMarkers[i];
      const figureHtml = `<figure style="margin: 1.2em 0 0.6em 0; text-align: center;"><img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 12px;" loading="lazy"><figcaption style="font-size: 15px; line-height: 1.5; font-weight: 400; color: #666; margin-top: 0.4em; margin-bottom: 1.2em; font-style: italic;">${caption}</figcaption></figure>`;
      const wrappedPattern = new RegExp(`<p[^>]*>\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`);
      if (wrappedPattern.test(content)) {
        content = content.replace(wrappedPattern, figureHtml);
      } else {
        content = content.replace(placeholder, figureHtml);
      }
    } else {
      const wrappedPattern = new RegExp(`<p[^>]*>\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`);
      content = content.replace(wrappedPattern, '');
      content = content.replace(placeholder, '');
    }
  }
  content = content.replace(/\[IMAGE:[^\]]*\]/g, '');
  content = content.replace(/<!--IMG_PLACEHOLDER_\d+-->/g, '');
  content = content.replace(/<figure[^>]*>\s*(?:&lt;)?\s*<figcaption[^>]*>[^<]*<\/figcaption>\s*<\/figure>/g, '');
  return content;
}

// ── Realistic blog content ──
const blogMarkdown = `## Dab Rig Joint Sizes: 10mm vs 14mm vs 18mm — Complete Guide

When it comes to choosing a dab rig, the joint size is one of the most important factors. Your joint size determines which accessories — bangers, nails, and adapters — will fit your setup.

### What Are Dab Rig Joint Sizes?

Dab rig joints come in three standard sizes: 10mm, 14mm, and 18mm. The measurement refers to the diameter of the glass-on-glass joint connection.

- **10mm** — Smallest and most portable, ideal for micro rigs
- **14mm** — The most common size, great balance of airflow and portability
- **18mm** — Largest size, maximum airflow for big hits

[IMAGE: Comparison of 10mm 14mm and 18mm dab rig joints side by side on a clean surface]

### Which Joint Size Should You Choose?

The right joint size depends on your dabbing style. Low-temp flavor chasers typically prefer 10mm or 14mm joints for concentrated flavor.

**Pro Tip:** If you're buying your first rig, start with 14mm — it has the widest selection of compatible accessories.

### Silicone vs Glass Rigs

Silicone dab rigs are becoming increasingly popular because they're virtually indestructible. Many silicone rigs use the standard 14mm joint size.

[IMAGE: Silicone dab rig next to a glass dab rig showing joint size compatibility]

### Final Thoughts

Choosing the right joint size is essential for building a dab setup that works for you. Whether you go with 10mm for portability or 18mm for maximum airflow, make sure all your accessories match.`;

const uploadedImages = [
  {
    url: 'https://cdn.shopify.com/s/files/1/0274/1331/1795/files/comparison-10mm-14mm-18mm-dab-rig-joints-1.png',
    altText: 'Dab rig joint sizes comparison 10mm 14mm 18mm side by side on clean surface'
  },
  {
    url: 'https://cdn.shopify.com/s/files/1/0274/1331/1795/files/silicone-dab-rig-glass-dab-rig-joint-size-2.png',
    altText: 'Silicone dab rig next to glass dab rig showing 14mm joint size compatibility'
  }
];

// ── Run the full pipeline ──
console.log('='.repeat(60));
console.log('REAL PIPELINE TEST (using actual markdownToHtml)');
console.log('='.repeat(60));

// Step 1: Convert markdown to HTML using the REAL function
const html = markdownToHtml(blogMarkdown);

console.log('\n--- Step 1: markdownToHtml() ---');
const hasMarkers = /\[IMAGE:/.test(html);
console.log(`[IMAGE:] markers preserved: ${hasMarkers ? 'YES (correct!)' : 'NO (BUG!)'}`);

if (!hasMarkers) {
  console.error('\nFATAL: markdownToHtml() is stripping [IMAGE:] markers!');
  console.error('The HTML conversion should preserve [IMAGE:] markers for later replacement.');
  console.error('\nHTML output:\n');
  console.error(html);
  process.exit(1);
}

// Step 2: Protect markers
const { content: protectedHtml, markers } = protectImageMarkers(html);

console.log('\n--- Step 2: protectImageMarkers() ---');
console.log(`Markers extracted: ${markers.length} (expected: 2)`);
console.log(`[IMAGE:] still present: ${/\[IMAGE:/.test(protectedHtml) ? 'YES (BUG!)' : 'NO (correct)'}`);
console.log(`Placeholders present: ${/<!--IMG_PLACEHOLDER_/.test(protectedHtml) ? 'YES (correct)' : 'NO (BUG!)'}`);

// Step 3: Simulate AI review (pass through)
const reviewed = protectedHtml;

// Step 4: Restore images
const finalHtml = restoreAndInsertImages(reviewed, markers, uploadedImages);

console.log('\n--- Step 4: restoreAndInsertImages() ---');
const imgCount = (finalHtml.match(/<img\s/g) || []).length;
const figureCount = (finalHtml.match(/<figure/g) || []).length;
const hasBrokenArtifact = /&lt;/.test(finalHtml);
const hasPlaceholders = /<!--IMG_PLACEHOLDER_/.test(finalHtml);

console.log(`<img> tags: ${imgCount} (expected: 2)`);
console.log(`<figure> tags: ${figureCount} (expected: 2)`);
console.log(`Broken &lt; artifacts: ${hasBrokenArtifact ? 'YES (BUG!)' : 'NONE (correct)'}`);
console.log(`Leftover placeholders: ${hasPlaceholders ? 'YES (BUG!)' : 'NONE (correct)'}`);

// Verify CDN URLs present
let pass = true;
for (const img of uploadedImages) {
  if (!finalHtml.includes(img.url)) {
    console.error(`FAIL: Missing CDN URL: ${img.url}`);
    pass = false;
  }
}

// Verify img is INSIDE figure (not stripped)
const figureImgPattern = /<figure[^>]*>\s*<img\s+src="https:\/\/cdn\.shopify\.com[^"]*"[^>]*>\s*<figcaption/g;
const validFigures = (finalHtml.match(figureImgPattern) || []).length;
console.log(`Valid <figure><img><figcaption> structures: ${validFigures} (expected: 2)`);

// Final verdict
console.log('\n' + '='.repeat(60));
if (pass && imgCount === 2 && figureCount === 2 && !hasBrokenArtifact && !hasPlaceholders && validFigures === 2) {
  console.log('RESULT: ALL TESTS PASSED');
  console.log('Images survive the real markdownToHtml pipeline!');
  console.log('='.repeat(60));

  // Show a snippet of the figure HTML for visual confirmation
  const figSnippet = finalHtml.match(/<figure[^>]*>.*?<\/figure>/gs);
  if (figSnippet) {
    console.log('\nSample figure HTML:');
    console.log(figSnippet[0].substring(0, 300) + '...');
  }

  process.exit(0);
} else {
  console.log('RESULT: TESTS FAILED');
  console.log('='.repeat(60));
  console.log('\nFull HTML output:\n');
  console.log(finalHtml);
  process.exit(1);
}
