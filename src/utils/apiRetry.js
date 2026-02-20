/**
 * API Retry Utility
 *
 * Provides exponential backoff retry logic for API calls
 * to OpenAI, Gemini, and other external services.
 */

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay in milliseconds (default: 2000)
 * @param {number} options.maxDelayMs - Maximum delay cap (default: 30000)
 * @param {string} options.operationName - Name for logging (default: 'API call')
 * @param {Function} options.shouldRetry - Custom function to determine if error is retryable
 * @returns {Promise<any>} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    operationName = 'API call',
    shouldRetry = isRetryableError
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error)) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );

      console.log(
        `${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. ` +
        `Retrying in ${Math.round(delay / 1000)}s...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP status codes that are retryable
  const status = error.status || error.response?.status;
  if (status) {
    // 429 (rate limit), 500, 502, 503, 504 are retryable
    return [429, 500, 502, 503, 504].includes(status);
  }

  // OpenAI-specific errors
  if (error.message?.includes('rate limit') || error.message?.includes('Rate limit')) {
    return true;
  }
  if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    return true;
  }
  if (error.message?.includes('server error') || error.message?.includes('Internal server')) {
    return true;
  }
  if (error.message?.includes('overloaded')) {
    return true;
  }

  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { withRetry };
