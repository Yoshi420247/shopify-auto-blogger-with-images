/**
 * Test: Verify that inline blog images survive the full HTML pipeline.
 *
 * This test simulates the exact same sequence of operations that happen
 * during blog publishing:
 *   1. Markdown with [IMAGE:] markers → markdownToHtml()
 *   2. protectImageMarkers() → HTML comment placeholders
 *   3. (AI review would happen here — we skip it)
 *   4. restoreAndInsertImages() → <figure><img> HTML
 *   5. Verify the final HTML contains valid <img> tags
 *
 * Run:  node scripts/test-image-pipeline.js
 */

// We can't import the private functions from index.js directly,
// so we replicate the exact same logic here for testing.

// ── replicate protectImageMarkers ──
function protectImageMarkers(htmlContent) {
  const markers = [];
  let index = 0;

  const content = htmlContent.replace(/(<p[^>]*>)?\s*\[IMAGE:([^\]]*)\]\s*(<\/p>)?/g, (match, pOpen, desc, pClose) => {
    markers.push(desc.trim());
    return `<!--IMG_PLACEHOLDER_${index++}-->`;
  });

  return { content, markers };
}

// ── replicate restoreAndInsertImages ──
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

// ── Test ──

console.log('='.repeat(60));
console.log('IMAGE PIPELINE TEST');
console.log('='.repeat(60));

// Simulate content with [IMAGE:] markers (as the AI would produce)
const markdownContent = `
## The Best Dab Rigs for Beginners

If you're new to dabbing, finding the right rig matters.

[IMAGE: Professional dab rig setup on a wooden table with accessories]

Here are some tips for choosing your first dab rig.

### Temperature Control

Low-temp dabs preserve terpenes and flavor.

[IMAGE: Close-up of a quartz banger being heated with a torch]

Always start with lower temperatures and work your way up.
`.trim();

// Simulate uploaded images (CDN URLs from Shopify Files)
const uploadedImages = [
  {
    url: 'https://cdn.shopify.com/s/files/1/test/professional-dab-rig-setup-1.png',
    altText: 'Dab rig professional setup with silicone accessories on wooden table'
  },
  {
    url: 'https://cdn.shopify.com/s/files/1/test/quartz-banger-heated-torch-2.png',
    altText: 'Close-up quartz banger being heated with butane torch for dabbing'
  }
];

// Step 1: Simulate markdownToHtml (simplified — just wrap in <p> tags)
let html = markdownContent;
// Convert headers
html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
// Convert paragraphs
const paragraphs = html.split(/\n\n+/);
html = paragraphs.map(p => {
  p = p.trim();
  if (!p) return '';
  if (/^<(h[1-6]|figure|img)/i.test(p)) return p;
  // [IMAGE:] markers get wrapped in <p> by markdownToHtml
  return `<p style="font-size: 18px;">${p}</p>`;
}).filter(Boolean).join('\n');

console.log('\n--- After markdownToHtml ---');
console.log('Contains [IMAGE:] markers:', /\[IMAGE:/.test(html) ? 'YES' : 'NO');
console.log('Contains <img> tags:', /<img\s/.test(html) ? 'YES (unexpected!)' : 'NO (correct)');

// Step 2: Protect image markers
const { content: protectedHtml, markers } = protectImageMarkers(html);

console.log('\n--- After protectImageMarkers ---');
console.log('Markers saved:', markers.length);
console.log('Contains [IMAGE:]:', /\[IMAGE:/.test(protectedHtml) ? 'YES (BUG!)' : 'NO (correct)');
console.log('Contains placeholders:', /<!--IMG_PLACEHOLDER_/.test(protectedHtml) ? 'YES (correct)' : 'NO (BUG!)');
markers.forEach((m, i) => console.log(`  Marker ${i}: "${m.substring(0, 50)}..."`));

// Step 3: Simulate AI review (just pass through)
const reviewedHtml = protectedHtml;

// Step 4: Restore and insert images
const finalHtml = restoreAndInsertImages(reviewedHtml, markers, uploadedImages);

console.log('\n--- After restoreAndInsertImages ---');
console.log('Contains <img> tags:', /<img\s/.test(finalHtml) ? 'YES (correct!)' : 'NO (BUG!)');
console.log('Contains <figure> tags:', /<figure/.test(finalHtml) ? 'YES (correct!)' : 'NO (BUG!)');
console.log('Contains placeholders:', /<!--IMG_PLACEHOLDER_/.test(finalHtml) ? 'YES (BUG!)' : 'NO (correct)');
console.log('Contains [IMAGE:]:', /\[IMAGE:/.test(finalHtml) ? 'YES (BUG!)' : 'NO (correct)');
console.log('Contains broken &lt;:', /&lt;/.test(finalHtml) ? 'YES (BUG!)' : 'NO (correct)');

// Count images
const imgMatches = finalHtml.match(/<img\s[^>]*src="[^"]+"/g) || [];
console.log(`\nImage tags found: ${imgMatches.length} (expected: ${uploadedImages.length})`);
imgMatches.forEach((m, i) => console.log(`  ${i + 1}: ${m.substring(0, 80)}...`));

// Verify each image has the CDN URL
let allCorrect = true;
for (const img of uploadedImages) {
  if (!finalHtml.includes(img.url)) {
    console.error(`FAIL: CDN URL not found in output: ${img.url}`);
    allCorrect = false;
  }
  if (!finalHtml.includes(img.altText)) {
    console.error(`FAIL: Alt text not found in output: ${img.altText}`);
    allCorrect = false;
  }
}

// Verify figure structure
const figureRegex = /<figure[^>]*><img src="[^"]+" alt="[^"]+"[^>]*><figcaption[^>]*>[^<]+<\/figcaption><\/figure>/g;
const figures = finalHtml.match(figureRegex) || [];
console.log(`\nComplete <figure><img><figcaption> blocks: ${figures.length} (expected: ${uploadedImages.length})`);

console.log('\n' + '='.repeat(60));
if (allCorrect && imgMatches.length === uploadedImages.length && figures.length === uploadedImages.length) {
  console.log('RESULT: ALL TESTS PASSED - Images survive the pipeline!');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log('RESULT: TESTS FAILED - Image pipeline is broken');
  console.log('='.repeat(60));
  console.log('\nFull output HTML for debugging:\n');
  console.log(finalHtml);
  process.exit(1);
}
