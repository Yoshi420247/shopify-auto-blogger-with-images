/**
 * Research Cache Module
 *
 * Caches competitor and blog analysis data to reduce API calls and web scraping.
 * Cache is stored as JSON files with timestamps for freshness checking.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache directory (in project root)
const CACHE_DIR = path.join(__dirname, '../../.cache');

// Cache configuration
const CACHE_CONFIG = {
  // How long cache is considered fresh (in hours)
  maxAgeHours: {
    competitorData: 12,    // Competitor analysis - refresh every 12 hours
    existingBlogs: 6,      // Own blog analysis - refresh every 6 hours
    trendingTopics: 12,    // Trending topics - refresh every 12 hours
    contentIdeas: 24       // Content ideas - refresh every 24 hours
  }
};

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('Created cache directory:', CACHE_DIR);
  }
}

/**
 * Get cache file path for a specific key
 */
function getCacheFilePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

/**
 * Check if cache is fresh (not expired)
 */
function isCacheFresh(key, maxAgeHours) {
  const filePath = getCacheFilePath(key);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cachedAt = new Date(data.cachedAt);
    const now = new Date();
    const ageHours = (now - cachedAt) / (1000 * 60 * 60);

    return ageHours < maxAgeHours;
  } catch (error) {
    console.log(`Cache check failed for ${key}:`, error.message);
    return false;
  }
}

/**
 * Read data from cache
 */
function readCache(key) {
  const filePath = getCacheFilePath(key);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cachedAt = new Date(data.cachedAt);
    const ageMinutes = Math.round((new Date() - cachedAt) / (1000 * 60));
    console.log(`Using cached ${key} (${ageMinutes} minutes old)`);
    return data.payload;
  } catch (error) {
    console.log(`Failed to read cache for ${key}:`, error.message);
    return null;
  }
}

/**
 * Write data to cache
 */
function writeCache(key, payload) {
  ensureCacheDir();
  const filePath = getCacheFilePath(key);

  try {
    const data = {
      cachedAt: new Date().toISOString(),
      key,
      payload
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Cached ${key} for future use`);
    return true;
  } catch (error) {
    console.log(`Failed to write cache for ${key}:`, error.message);
    return false;
  }
}

/**
 * Clear specific cache or all caches
 */
function clearCache(key = null) {
  ensureCacheDir();

  if (key) {
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleared cache: ${key}`);
    }
  } else {
    // Clear all cache files
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    });
    console.log('Cleared all caches');
  }
}

/**
 * Get cached data or fetch fresh
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch fresh data
 * @param {number} maxAgeHours - How long cache is valid (optional, uses config)
 */
async function getCachedOrFetch(key, fetchFn, maxAgeHours = null) {
  const maxAge = maxAgeHours || CACHE_CONFIG.maxAgeHours[key] || 6;

  // Check if cache is fresh
  if (isCacheFresh(key, maxAge)) {
    const cached = readCache(key);
    if (cached) {
      return cached;
    }
  }

  // Fetch fresh data
  console.log(`Fetching fresh ${key}...`);
  const freshData = await fetchFn();

  // Cache the result
  writeCache(key, freshData);

  return freshData;
}

/**
 * Get cache status for debugging
 */
function getCacheStatus() {
  ensureCacheDir();
  const status = {};

  const files = fs.readdirSync(CACHE_DIR);
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const key = file.replace('.json', '');
      const filePath = path.join(CACHE_DIR, file);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cachedAt = new Date(data.cachedAt);
        const ageMinutes = Math.round((new Date() - cachedAt) / (1000 * 60));
        const maxAgeHours = CACHE_CONFIG.maxAgeHours[key] || 6;
        const fresh = ageMinutes < (maxAgeHours * 60);

        status[key] = {
          cachedAt: data.cachedAt,
          ageMinutes,
          maxAgeMinutes: maxAgeHours * 60,
          fresh
        };
      } catch (error) {
        status[key] = { error: error.message };
      }
    }
  });

  return status;
}

export {
  getCachedOrFetch,
  readCache,
  writeCache,
  clearCache,
  isCacheFresh,
  getCacheStatus,
  CACHE_CONFIG
};

export default {
  getCachedOrFetch,
  clearCache,
  getCacheStatus
};
