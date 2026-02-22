/**
 * Google Search Console API Client
 *
 * Authenticates with the Google Search Console API using a service account
 * and fetches search performance data (clicks, impressions, CTR, position)
 * grouped by page URL.
 *
 * Setup:
 * 1. Create a Google Cloud project and enable the Search Console API
 * 2. Create a service account and download the JSON key
 * 3. Add the service account email as a user in Google Search Console
 * 4. Set GOOGLE_SERVICE_ACCOUNT_JSON as a GitHub secret (the full JSON key contents)
 */

import { google } from 'googleapis';
import config from '../config.js';

let searchConsoleClient = null;

/**
 * Initialize the Google Search Console client with service account credentials
 */
function getClient() {
  if (searchConsoleClient) return searchConsoleClient;

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. ' +
      'Set it to the full JSON contents of your Google service account key.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  searchConsoleClient = google.searchconsole({ version: 'v1', auth });
  return searchConsoleClient;
}

/**
 * Get the site URL for Search Console (with or without trailing slash)
 * Search Console accepts both "sc-domain:" prefix and full URL formats
 */
function getSiteUrl() {
  if (process.env.GSC_SITE_URL) {
    return process.env.GSC_SITE_URL.trim();
  }
  const domain = config.shopify.storeDomain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .trim();
  return `sc-domain:${domain}`;
}

/**
 * Format a Date object as YYYY-MM-DD string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Query Search Console for search analytics data grouped by page
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {number} rowLimit - Maximum rows to return (default 500)
 * @returns {Array} - Array of {page, clicks, impressions, ctr, position}
 */
export async function querySearchAnalytics(startDate, endDate, rowLimit = 500) {
  const client = getClient();
  const siteUrl = getSiteUrl();

  console.log(`Querying GSC: ${siteUrl} from ${startDate} to ${endDate}`);

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit,
      dataState: 'all'
    }
  });

  const rows = response.data.rows || [];
  console.log(`GSC returned ${rows.length} page rows`);

  return rows.map(row => ({
    page: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }));
}

/**
 * Query Search Console for search analytics with query (keyword) dimension
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} pageFilter - Optional URL filter to get queries for a specific page
 * @param {number} rowLimit - Maximum rows to return
 * @returns {Array} - Array of {query, page, clicks, impressions, ctr, position}
 */
export async function querySearchAnalyticsByQuery(startDate, endDate, pageFilter = null, rowLimit = 100) {
  const client = getClient();
  const siteUrl = getSiteUrl();

  const requestBody = {
    startDate,
    endDate,
    dimensions: ['query', 'page'],
    rowLimit,
    dataState: 'all'
  };

  // Add page filter if specified
  if (pageFilter) {
    requestBody.dimensionFilterGroups = [{
      filters: [{
        dimension: 'page',
        operator: 'contains',
        expression: pageFilter
      }]
    }];
  }

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody
  });

  const rows = response.data.rows || [];

  return rows.map(row => ({
    query: row.keys[0],
    page: row.keys[1],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }));
}

/**
 * Fetch search performance for two consecutive periods for comparison
 * Used to identify trending pages (comparing recent vs previous period)
 *
 * @param {number} periodDays - Number of days per period (default 7)
 * @returns {Object} - { recentData, previousData, periodDays, recentRange, previousRange }
 */
export async function fetchComparisonData(periodDays = 7) {
  const now = new Date();

  // GSC data has a 2-3 day lag, so end date is 3 days ago
  const dataLagDays = 3;
  const recentEnd = new Date(now);
  recentEnd.setDate(recentEnd.getDate() - dataLagDays);

  const recentStart = new Date(recentEnd);
  recentStart.setDate(recentStart.getDate() - periodDays);

  const previousEnd = new Date(recentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - periodDays);

  console.log(`Recent period: ${formatDate(recentStart)} to ${formatDate(recentEnd)}`);
  console.log(`Previous period: ${formatDate(previousStart)} to ${formatDate(previousEnd)}`);

  // Fetch both periods in parallel
  const [recentData, previousData] = await Promise.all([
    querySearchAnalytics(formatDate(recentStart), formatDate(recentEnd)),
    querySearchAnalytics(formatDate(previousStart), formatDate(previousEnd))
  ]);

  return {
    recentData,
    previousData,
    periodDays,
    recentRange: { start: formatDate(recentStart), end: formatDate(recentEnd) },
    previousRange: { start: formatDate(previousStart), end: formatDate(previousEnd) }
  };
}

/**
 * Test the Search Console connection
 */
export async function testConnection() {
  try {
    const client = getClient();
    const siteUrl = getSiteUrl();

    // Try a small query to verify access
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);

    await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        rowLimit: 1
      }
    });

    console.log(`Search Console connection OK (site: ${siteUrl})`);
    return { success: true, siteUrl };
  } catch (error) {
    console.error('Search Console connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

export default {
  querySearchAnalytics,
  querySearchAnalyticsByQuery,
  fetchComparisonData,
  testConnection
};
