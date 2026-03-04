# Handoff: Trigger & Verify Google Search Console Workflow Test

## Objective
Trigger a dry-run test of the "Unified Auto-Blogger" GitHub Actions workflow in GSC-analyze mode, then verify that the Google Search Console integration is functioning correctly.

## Repository
- **Owner:** Yoshi420247
- **Repo:** shopify-auto-blogger-with-images
- **Default branch:** `claude/auto-blogger-vercel-01Vyh8o5YyKjmWr9iPLXQBMM`

---

## Step 1: Create a GitHub Personal Access Token (if needed)

1. Navigate to: https://github.com/settings/personal-access-tokens/new
2. Create a fine-grained token with these settings:
   - **Name:** `gsc-test-trigger`
   - **Expiration:** 7 days
   - **Repository access:** Select only `Yoshi420247/shopify-auto-blogger-with-images`
   - **Repository permissions:**
     - **Actions:** Read and write
3. Copy the generated token.

---

## Step 2: Trigger the Workflow via GitHub API

Make this API call using the token from Step 1:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  https://api.github.com/repos/Yoshi420247/shopify-auto-blogger-with-images/actions/workflows/unified-autoblogger.yml/dispatches \
  -d '{
    "ref": "claude/auto-blogger-vercel-01Vyh8o5YyKjmWr9iPLXQBMM",
    "inputs": {
      "strategy": "gsc-analyze",
      "dry_run": "true"
    }
  }'
```

**Expected response:** HTTP 204 No Content (empty body = success). Any other status means failure.

If the curl approach fails, use the GitHub UI instead:
1. Go to https://github.com/Yoshi420247/shopify-auto-blogger-with-images/actions/workflows/unified-autoblogger.yml
2. Click "Run workflow"
3. Branch: `claude/auto-blogger-vercel-01Vyh8o5YyKjmWr9iPLXQBMM`
4. Strategy: `gsc-analyze`
5. Dry run: `true`
6. Click "Run workflow"

---

## Step 3: Monitor the Workflow Run

1. Navigate to: https://github.com/Yoshi420247/shopify-auto-blogger-with-images/actions
2. Find the most recent "Unified Auto-Blogger" run (should appear within 10 seconds)
3. Click into it and watch the live logs

---

## Step 4: Verify Results — What to Check in the Logs

The workflow runs `npm start` with `RUN_STRATEGY=gsc-analyze`. Here is what each log section should show and what constitutes pass/fail:

### 4a. Secret Validation Step
- **PASS:** "All required secrets are configured"
- **FAIL:** Any "ERROR: <SECRET_NAME> is not set" message
- **Action if failed:** The following secrets must be set in repo Settings > Secrets and variables > Actions:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` — Full JSON key from a Google Cloud service account with Search Console access
  - `SHOPIFY_ADMIN_API_TOKEN` — Shopify Admin API access token
  - `SHOPIFY_STORE_DOMAIN` — e.g., `your-store.myshopify.com`
  - `ANTHROPIC_API_KEY` — Anthropic API key (starts with `sk-ant-api03-`)
  - `GEMINI_API_KEY` (optional) — for image generation
  - `OPENAI_API_KEY` (optional) — only needed for GPT model fallback

### 4b. Google Search Console Connection
- **PASS:** Log shows "Google Search Console: OK" or similar successful connection message
- **FAIL:** "Google Search Console connection failed" or authentication errors
- **Action if failed:**
  - Verify `GOOGLE_SERVICE_ACCOUNT_JSON` contains the full JSON key (not just the key ID)
  - Verify the service account email has been added as a user in Google Search Console (https://search.google.com/search-console > Settings > Users and permissions)
  - Verify the Google Search Console API is enabled in the Google Cloud project

### 4c. Search Analytics Data Fetch
- **PASS:** Log shows fetched data with page URLs, clicks, impressions, and position data
- **FAIL:** Empty results or API errors
- **Action if failed:**
  - The site may have no Search Console data yet (new property)
  - Check that `GSC_SITE_URL` secret is set correctly if the domain doesn't match the Shopify store domain
  - Google Search Console data has a 2-3 day lag, so very new properties may return empty

### 4d. Trend Analysis
- **PASS:** Log shows a trend report with categorized pages (trending products, collections, blogs) and growth metrics
- **FAIL:** "No trending pages found" (not necessarily an error — could mean stable traffic)
- **Note:** In `gsc-analyze` strategy, this step analyzes but does NOT write new blogs

### 4e. Blog Hyperlink Optimization
- **PASS:** Log shows "Found X trending blogs to optimize" and either optimizes them or reports no optimization needed
- **FAIL:** Errors connecting to Shopify to fetch/update articles
- **Note:** Since `dry_run=true`, no actual changes will be published. Logs should show "[DRY RUN] Would update..." messages

### 4f. Overall Run
- **PASS:** Workflow completes with green checkmark, summary shows "GSC Connected: Yes", "Trends Analyzed: Yes"
- **FAIL:** Red X on the workflow run

---

## Step 5: Report Back

Collect and report the following:
1. **Workflow run URL** (e.g., https://github.com/Yoshi420247/shopify-auto-blogger-with-images/actions/runs/XXXXX)
2. **Overall status:** Success or failure
3. **Secret validation:** All present, or which are missing
4. **GSC connection:** Success or failure (include error message if failed)
5. **Data fetched:** Were search analytics returned? How many pages?
6. **Trend analysis:** Any trending pages identified?
7. **Any errors:** Copy the full error text from logs

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "GOOGLE_SERVICE_ACCOUNT_JSON is not set" | Secret missing | Add it in repo Settings > Secrets > Actions |
| "Google Search Console connection failed" | Bad service account JSON or no API access | Re-download JSON key; enable Search Console API in Google Cloud |
| "Permission denied" on Search Console | Service account not added to GSC property | Add the service account email as Full user in GSC Settings > Users |
| "SHOPIFY_ADMIN_API_TOKEN is not set" | Secret missing | Add Shopify Admin API token in repo secrets |
| "ANTHROPIC_API_KEY is not set" | Secret missing | Add key starting with `sk-ant-api03-` in repo secrets |
| Empty search analytics data | New site or no traffic | Normal for new properties; data appears after crawling |
| Workflow not found | Wrong branch or file missing | Ensure `unified-autoblogger.yml` exists on the target branch |
