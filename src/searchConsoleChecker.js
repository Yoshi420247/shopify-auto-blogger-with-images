/**
 * Search Console Checker (Deprecated)
 *
 * This functionality has been merged into the unified auto-blogger (src/index.js).
 * Use RUN_STRATEGY=gsc-analyze to run GSC analysis + link optimization.
 *
 * This file is kept for backwards compatibility but simply delegates to the
 * unified system with the gsc-analyze strategy.
 */

console.log('NOTE: searchConsoleChecker.js is deprecated.');
console.log('GSC functionality is now part of the unified auto-blogger.');
console.log('Setting RUN_STRATEGY=gsc-analyze and delegating...');
console.log('');

// Set the strategy to GSC analysis mode
process.env.RUN_STRATEGY = 'gsc-analyze';

// Import and run the unified system
await import('./index.js');
