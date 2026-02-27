/**
 * HTTP Client using curl as transport
 *
 * Uses child_process + curl for reliable HTTP across all environments.
 * Both Shopify and WooCommerce APIs work perfectly with curl but can
 * have issues with Node.js HTTP clients in certain network configurations.
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Make an HTTP request using curl
 * @param {string} url - Full URL to request
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object} options.headers - HTTP headers
 * @param {object} options.params - Query parameters
 * @param {object|string} options.data - Request body (JSON)
 * @param {object} options.auth - Basic auth { username, password }
 * @param {number} options.timeout - Timeout in seconds (default: 30)
 * @param {boolean} options.includeHeaders - Return response headers
 * @returns {object} { status, data, headers? }
 */
export function curlRequest(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    params = {},
    data = null,
    auth = null,
    timeout = 30,
    includeHeaders = false
  } = options;

  // Build URL with query parameters
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    urlObj.searchParams.set(key, value);
  }

  // Build curl arguments array
  const args = [
    '-s',
    '-w', '\n__HTTP_STATUS__%{http_code}',
    '-X', method,
    '--max-time', String(timeout)
  ];

  // Capture response headers to a temp file if needed
  let headerFile = null;
  if (includeHeaders) {
    headerFile = join(tmpdir(), `curl-headers-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    args.push('-D', headerFile);
  }

  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }

  // Add auth
  if (auth) {
    args.push('-u', `${auth.username}:${auth.password}`);
  }

  // Add request body
  if (data) {
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', typeof data === 'string' ? data : JSON.stringify(data));
  }

  // Add URL
  args.push(urlObj.toString());

  try {
    const output = execFileSync('curl', args, {
      encoding: 'utf-8',
      timeout: (timeout + 5) * 1000,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore']
    });

    // Parse status code from output
    const statusMatch = output.match(/__HTTP_STATUS__(\d+)$/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;
    const body = output.replace(/\n?__HTTP_STATUS__\d+$/, '').trim();

    // Parse JSON body
    let parsedData;
    try {
      parsedData = body ? JSON.parse(body) : null;
    } catch {
      parsedData = body;
    }

    // Parse response headers if requested
    let responseHeaders = {};
    if (includeHeaders && headerFile) {
      try {
        const headerText = readFileSync(headerFile, 'utf-8');
        for (const line of headerText.split('\r\n')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim().toLowerCase();
            const value = line.substring(colonIdx + 1).trim();
            responseHeaders[key] = value;
          }
        }
      } catch { /* ignore header parse errors */ }
      try { unlinkSync(headerFile); } catch { /* ignore cleanup errors */ }
    }

    if (status >= 400) {
      const error = new Error(`HTTP ${status}: ${typeof parsedData === 'string' ? parsedData.substring(0, 200) : JSON.stringify(parsedData)?.substring(0, 200)}`);
      error.status = status;
      error.data = parsedData;
      throw error;
    }

    const result = { status, data: parsedData };
    if (includeHeaders) result.headers = responseHeaders;
    return result;
  } catch (error) {
    // Clean up header file on error
    if (headerFile) {
      try { unlinkSync(headerFile); } catch { /* ignore */ }
    }
    if (error.status) throw error;
    const err = new Error(`curl request failed: ${error.message?.substring(0, 200)}`);
    err.cause = error;
    throw err;
  }
}

/**
 * Convenience methods
 */
export function get(url, options = {}) {
  return curlRequest(url, { ...options, method: 'GET' });
}

export function post(url, data, options = {}) {
  return curlRequest(url, { ...options, method: 'POST', data });
}

export function put(url, data, options = {}) {
  return curlRequest(url, { ...options, method: 'PUT', data });
}
