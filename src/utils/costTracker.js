/**
 * API Cost Tracker
 *
 * Tracks token usage and estimated costs across all API calls
 * during a run, then prints a summary at the end.
 *
 * Pricing (per 1M tokens, as of 2025):
 *   Claude Opus 4.6:   $15 input,  $75 output
 *   Claude Sonnet 4.6: $3  input,  $15 output
 *   Claude Haiku 4.5:  $0.80 input, $4 output
 *   Cache read:        10% of input price
 *   Cache write:       25% of input price
 *   GPT-5.2:           $2.50 input, $10 output
 *
 * Image pricing (per image):
 *   Gemini 3 Pro Image:    $0.039
 *   Gemini 2.5 Flash Image:$0.020
 *   Imagen 4:              $0.040
 *   gpt-image-1 (high):    $0.167
 *   gpt-image-1 (medium):  $0.080
 *   gpt-image-1 (low):     $0.020
 */

const PRICING = {
  'claude-opus-4-6':           { input: 15,    output: 75 },
  'claude-sonnet-4-6':         { input: 3,     output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4  },
  'gpt-5.2':                   { input: 2.50,  output: 10 },
};

const IMAGE_PRICING = {
  'gemini-3-pro-image-preview':  0.039,
  'gemini-2.5-flash-image':      0.020,
  'imagen-4.0-generate-001':     0.040,
  'gpt-image-1-high':            0.167,
  'gpt-image-1-medium':          0.080,
  'gpt-image-1-low':             0.020,
};

// Accumulated cost data
const entries = [];

/**
 * Record a text generation API call.
 *
 * @param {Object} opts
 * @param {string} opts.model          - Model ID (e.g. 'claude-sonnet-4-6')
 * @param {string} opts.label          - Human label (e.g. 'Blog content generation')
 * @param {number} opts.inputTokens    - Input tokens used
 * @param {number} opts.outputTokens   - Output tokens generated
 * @param {number} [opts.cacheRead]    - Tokens read from cache (Anthropic only)
 * @param {number} [opts.cacheCreation] - Tokens written to cache (Anthropic only)
 */
export function trackTextCall({ model, label, inputTokens, outputTokens, cacheRead = 0, cacheCreation = 0 }) {
  const pricing = PRICING[model];
  if (!pricing) {
    // Unknown model — still record it, cost will show as $0
    entries.push({ type: 'text', model, label, inputTokens, outputTokens, cacheRead, cacheCreation, cost: 0 });
    return;
  }

  const perM = 1_000_000;

  // For Anthropic models with caching:
  //   - cacheRead tokens are charged at 10% of input price
  //   - cacheCreation tokens are charged at 25% of input price
  //   - regular inputTokens is the TOTAL including cached; subtract cached portions for base cost
  const regularInput = Math.max(0, inputTokens - cacheRead - cacheCreation);
  const inputCost  = (regularInput * pricing.input / perM)
                   + (cacheRead * pricing.input * 0.10 / perM)
                   + (cacheCreation * pricing.input * 1.25 / perM);
  const outputCost = outputTokens * pricing.output / perM;
  const cost = inputCost + outputCost;

  entries.push({ type: 'text', model, label, inputTokens, outputTokens, cacheRead, cacheCreation, cost });
}

/**
 * Record an image generation API call.
 *
 * @param {Object} opts
 * @param {string} opts.model    - Image model key (e.g. 'gemini-3-pro-image-preview', 'gpt-image-1-high')
 * @param {string} opts.label    - Human label (e.g. 'Blog image 1')
 * @param {boolean} opts.success - Whether the generation succeeded
 */
export function trackImageCall({ model, label, success = true }) {
  const cost = success ? (IMAGE_PRICING[model] || 0) : 0;
  entries.push({ type: 'image', model, label, success, cost });
}

/**
 * Get total cost so far.
 */
export function getTotalCost() {
  return entries.reduce((sum, e) => sum + e.cost, 0);
}

/**
 * Print a detailed cost report to console.
 */
export function printCostReport() {
  if (entries.length === 0) {
    console.log('\n(No API calls tracked)');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('API COST REPORT');
  console.log('='.repeat(60));

  // --- Text calls ---
  const textEntries = entries.filter(e => e.type === 'text');
  if (textEntries.length > 0) {
    console.log('\nText Generation:');
    console.log('-'.repeat(60));
    let textTotal = 0;
    for (const e of textEntries) {
      const cacheInfo = e.cacheRead > 0 ? ` (${e.cacheRead} cached)` : '';
      console.log(`  ${e.label}`);
      console.log(`    Model: ${e.model}`);
      console.log(`    Tokens: ${e.inputTokens.toLocaleString()} in${cacheInfo} / ${e.outputTokens.toLocaleString()} out`);
      console.log(`    Cost: $${e.cost.toFixed(4)}`);
      textTotal += e.cost;
    }
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  Text subtotal: $${textTotal.toFixed(4)}`);
  }

  // --- Image calls ---
  const imageEntries = entries.filter(e => e.type === 'image');
  if (imageEntries.length > 0) {
    console.log('\nImage Generation:');
    console.log('-'.repeat(60));
    let imageTotal = 0;
    const succeeded = imageEntries.filter(e => e.success);
    const failed = imageEntries.filter(e => !e.success);
    for (const e of succeeded) {
      console.log(`  ${e.label}: ${e.model} — $${e.cost.toFixed(4)}`);
      imageTotal += e.cost;
    }
    if (failed.length > 0) {
      console.log(`  Failed (no cost): ${failed.length} image(s)`);
    }
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  Image subtotal: $${imageTotal.toFixed(4)}`);
  }

  // --- Grand total ---
  const total = getTotalCost();
  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL ESTIMATED COST: $${total.toFixed(4)}`);
  console.log('='.repeat(60));
}

/**
 * Reset all tracked data (useful for testing).
 */
export function resetCostTracker() {
  entries.length = 0;
}

export default { trackTextCall, trackImageCall, getTotalCost, printCostReport, resetCostTracker };
