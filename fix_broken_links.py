#!/usr/bin/env python3
"""
Fix broken hyperlinks in all Shopify blog articles.
Builds a comprehensive URL replacement map and applies fixes via the Shopify Admin API.
"""

import subprocess
import json
import os
import re
import sys
import time
import html

STORE_URL = os.environ.get("SHOPIFY_STORE_URL", "https://oil-slick-pad.myshopify.com")
API_TOKEN = os.environ["SHOPIFY_ADMIN_API_TOKEN"]
API_VERSION = "2025-04"
BLOG_GID = "gid://shopify/Blog/51499267"

# ============================================================
# URL REPLACEMENT MAP
# Maps broken URLs to their correct replacements.
# ============================================================

# --- Collection fixes ---
COLLECTION_FIXES = {
    # Broken collection → correct collection
    "/collections/bongs": "/collections/bongs-water-pipes",
    "/collections/silicone-pipes": "/collections/silicone-rigs-bongs",
    "/collections/silicone-smoking-devices": "/collections/silicone-products",
    "/collections/rolling-papers": "/collections/rolling-papers-cones",
    "/collections/spoons": "/collections/hand-pipes",
    "/collections/extract-packaging-jars-and-nonstick": "/collections/extraction-packaging",
    "/collections/extraction-materials-packaging": "/collections/extraction-packaging",
    "/collections/parchment-papers": "/collections/parchment-paper",
    "/collections/non-stick-paper-and-ptfe": "/collections/ptfe-sheets",
    "/collections/silicone-glass-hybrid-rigs-and-bubblers": "/collections/silicone-rigs-bongs",
    "/collections/glass-jars-extract-packaging": "/collections/glass-jars",
}

# --- Blog article fixes (promotional posts that were deleted) ---
BLOG_FIXES = {
    "/blogs/news/get-free-shipping-until-midnite": "/blogs/news",
    "/blogs/news/black-friday-sale": "/blogs/news",
    "/blogs/news/420-sale-entire-site-20-60-off": "/blogs/news",
    "/blogs/news/the-complete-guide-to-dabbing-2026": "/blogs/news/the-complete-beginner-s-guide-to-dabbing-2025-tips",
    "/blogs": "/blogs/news",
}

# --- Product fixes (discontinued products → relevant collection) ---
PRODUCT_TO_COLLECTION = {
    # Silicone products → silicone collection
    "hybrid-ball-rig": "/collections/silicone-rigs-bongs",
    "baby-bubbler": "/collections/silicone-bubblers",
    "copy-of-copy-of-copy-of-silicone-straight-tube-11": "/collections/silicone-rigs-bongs",
    "oil-catcher": "/collections/silicone-rigs-bongs",
    "yoshi-egg-rig": "/collections/silicone-rigs-bongs",
    "eyeball-spoon": "/collections/silicone-hand-pipes",
    "geometric-silicone-rig": "/collections/silicone-rigs-bongs",
    "mini-bubs-tiny-silicone-rig": "/collections/silicone-rigs-bongs",
    "smoking-crescent": "/collections/silicone-hand-pipes",
    "silicone-tube-xl": "/collections/silicone-rigs-bongs",
    "hammer": "/collections/silicone-rigs-bongs",
    "love-key": "/collections/silicone-hand-pipes",
    "shroom-spoon": "/collections/hand-pipes",
    "honey-bee-spoon": "/collections/hand-pipes",
    "flying-saucer": "/collections/hand-pipes",
    "elephant-spoon": "/collections/hand-pipes",
    "elephant-bubble": "/collections/silicone-bubblers",
    "swiss-army-pipe": "/collections/silicone-hand-pipes",
    "smoke-ring-pipe": "/collections/silicone-hand-pipes",
    "silicone-skull": "/collections/silicone-hand-pipes",
    "silicone-pocket-pebble": "/collections/silicone-hand-pipes",
    "titan-silicone-glass-spoon": "/collections/silicone-hand-pipes",
    "copy-of-magnum-huge-silicone-rig": "/collections/silicone-rigs-bongs",
    "copy-of-silicone-sriracha-rig": "/collections/silicone-rigs-bongs",
    "hexabong-silicone": "/collections/silicone-rigs-bongs",
    "hybrid-silicone-beaker-with-glass-insert": "/collections/silicone-rigs-bongs",
    "hybrid-sherlock": "/collections/silicone-hand-pipes",
    "large-silicone-beaker-with-storage": "/collections/silicone-rigs-bongs",
    "glass-silicone-hybrid-percules": "/collections/silicone-rigs-bongs",
    "mt-baker-glass-silicone": "/collections/silicone-rigs-bongs",
    "mt-baker": "/collections/silicone-rigs-bongs",
    "chamber-of-secrets": "/collections/silicone-rigs-bongs",
    "silicone-nectar-collector-kit": "/collections/silicone-nectar-collectors",
    "transformer-silicone-ashcatcher": "/collections/ash-catchers",
    "w3-electric-nectar-collector": "/collections/nectar-collectors",
    "wolf-silicone-bubbler-rig": "/collections/silicone-bubblers",
    # Quartz / accessories
    "14mm-90-degree-quartz-terp-slurper": "/collections/quartz-bangers",
    "14mm-90-degree-thick-quartz-banger": "/collections/quartz-bangers",
    "14mm-gavel-flat-bottom-bucket-quartz-banger": "/collections/quartz-bangers",
    "disc-carb-cap": "/collections/carb-caps",
    "spike-the-turtle-ashtray": "/collections/accessories",
    # Packaging / containers
    "1ml-glass-syringe": "/collections/extraction-packaging",
    "5ml-child-resistant-jar-with-black-lids": "/collections/concentrate-jars",
    "mylar-bags-for-storage": "/collections/mylar-bags",
    "opaque-116mm-child-resistant-pre-roll-tube": "/collections/joint-tubes",
    "deluxe-jar-jar-bhang": "/collections/concentrate-containers",
    "5oz-jar-with-silicone-jar-jacket-and-dab-container": "/collections/concentrate-containers",
    "slick-ball-factory-2nds": "/collections/concentrate-containers",
    "slickr-stack": "/collections/concentrate-containers",
    # Pads / paper
    "limited-edition-oil-slickr-canvas-silicone-dab-pads": "/collections/silicone-pads",
    "oil-slickr-canvas-rounds": "/collections/silicone-pads",
    "custom-oil-slickr-printed-precut-non-stick-paper-4-5x-5": "/collections/parchment-paper",
    "custom-oil-slickr-pad": "/collections/silicone-pads",
    "custom-oil-slickrduo": "/collections/silicone-pads",
    # Other
    "rolling-tray": "/collections/accessories",
    "pulsar-concave-rainbow-anodized-aluminum-grinder-2-5": "/collections/grinders",
    # PTFE
    "oil-slickr-sheet-ptfe": "/collections/ptfe-sheets",
}

# --- External link fixes ---
EXTERNAL_FIXES = {
    "https://www.americanchemistry.com/chemistry-in-america/chemistry-in-everyday-products/silicones":
        "https://www.americanchemistry.com/chemistry-in-america/chemistries/silicones",
}

# --- www→non-www redirects (fix to canonical) ---
WWW_REDIRECTS = {
    "https://www.oilslickpad.com/": "https://oilslickpad.com/",
    "https://www.oilslickpad.com/collections/": "https://oilslickpad.com/collections/",
    "https://www.oilslickpad.com/products/": "https://oilslickpad.com/products/",
    "https://www.oilslickpad.com/pages/": "https://oilslickpad.com/pages/",
    "https://www.oilslickpad.com/blogs/": "https://oilslickpad.com/blogs/",
}


def build_replacement_map():
    """Build a comprehensive old→new URL map for string replacements."""
    rmap = {}

    # 1. External fixes (exact match)
    for old, new in EXTERNAL_FIXES.items():
        rmap[old] = new

    # 2. Blog fixes
    for old_path, new_path in BLOG_FIXES.items():
        rmap[f"https://oilslickpad.com{old_path}"] = f"https://oilslickpad.com{new_path}"
        rmap[f"https://www.oilslickpad.com{old_path}"] = f"https://oilslickpad.com{new_path}"

    # 3. Collection path fixes - these need to handle nested product URLs too
    for old_path, new_path in COLLECTION_FIXES.items():
        # Direct collection URL
        rmap[f"https://oilslickpad.com{old_path}"] = f"https://oilslickpad.com{new_path}"
        rmap[f"https://www.oilslickpad.com{old_path}"] = f"https://oilslickpad.com{new_path}"

    # 4. www → non-www canonical fixes
    # (handled via regex in apply_fixes)

    return rmap


def apply_fixes(html_content, rmap):
    """Apply URL fixes to HTML content. Returns (fixed_content, list_of_changes)."""
    changes = []
    fixed = html_content

    # --- Pass 1: Exact URL replacements ---
    for old_url, new_url in rmap.items():
        if old_url in fixed:
            count = fixed.count(old_url)
            fixed = fixed.replace(old_url, new_url)
            changes.append(f"Replaced {old_url} → {new_url} ({count}x)")

    # --- Pass 2: Fix collection-nested product URLs for broken collections ---
    # e.g., /collections/silicone-pipes/products/baby-bubbler → /collections/silicone-bubblers
    for old_coll in COLLECTION_FIXES:
        # Match /collections/OLD/products/PRODUCT with optional query params
        pattern = re.compile(
            re.escape(f"https://oilslickpad.com{old_coll}/products/") + r'([a-z0-9-]+)([^"\']*)',
            re.IGNORECASE
        )
        for m in pattern.finditer(fixed):
            product_handle = m.group(1)
            full_match = m.group(0)
            if product_handle in PRODUCT_TO_COLLECTION:
                new_url = f"https://oilslickpad.com{PRODUCT_TO_COLLECTION[product_handle]}"
            else:
                # Product doesn't have a specific mapping - use the collection redirect
                new_url = f"https://oilslickpad.com{COLLECTION_FIXES[old_coll]}"
            if full_match in fixed:
                fixed = fixed.replace(full_match, new_url)
                changes.append(f"Replaced {full_match} → {new_url}")

        # Same for www variant
        pattern_www = re.compile(
            re.escape(f"https://www.oilslickpad.com{old_coll}/products/") + r'([a-z0-9-]+)([^"\']*)',
            re.IGNORECASE
        )
        for m in pattern_www.finditer(fixed):
            product_handle = m.group(1)
            full_match = m.group(0)
            if product_handle in PRODUCT_TO_COLLECTION:
                new_url = f"https://oilslickpad.com{PRODUCT_TO_COLLECTION[product_handle]}"
            else:
                new_url = f"https://oilslickpad.com{COLLECTION_FIXES[old_coll]}"
            if full_match in fixed:
                fixed = fixed.replace(full_match, new_url)
                changes.append(f"Replaced {full_match} → {new_url}")

    # --- Pass 3: Fix direct product URLs for discontinued products ---
    for product_handle, collection_path in PRODUCT_TO_COLLECTION.items():
        # Match /products/HANDLE with optional query params
        # Be careful to match exact handle (not partial)
        escaped = re.escape(product_handle)
        for domain in ["https://oilslickpad.com", "https://www.oilslickpad.com"]:
            pattern = re.compile(
                re.escape(domain) + r'/products/' + escaped + r'(\?[^"\']*|)',
                re.IGNORECASE
            )
            for m in pattern.finditer(fixed):
                full_match = m.group(0)
                new_url = f"https://oilslickpad.com{collection_path}"
                if full_match in fixed:
                    fixed = fixed.replace(full_match, new_url)
                    changes.append(f"Replaced {full_match} → {new_url}")

    # --- Pass 4: Fix &amp; in URLs (HTML entities inside href attributes) ---
    # This is cosmetic but helps with cleanliness

    # --- Pass 5: Fix www→non-www redirects ---
    if "https://www.oilslickpad.com" in fixed:
        count = fixed.count("https://www.oilslickpad.com")
        fixed = fixed.replace("https://www.oilslickpad.com", "https://oilslickpad.com")
        changes.append(f"Replaced www.oilslickpad.com → oilslickpad.com ({count}x)")

    # --- Pass 6: Fix collection/BROKEN/products/* where collection itself is still valid
    # e.g., /collections/quartz-bangers/products/14mm-... → /collections/quartz-bangers
    valid_collections_with_broken_products = [
        "quartz-bangers", "carb-caps", "accessories", "dabbing",
        "concentrate-jars", "extraction-materials-packaging"
    ]
    for coll in valid_collections_with_broken_products:
        pattern = re.compile(
            re.escape(f"https://oilslickpad.com/collections/{coll}/products/") + r'([a-z0-9-]+)([^"\']*)',
            re.IGNORECASE
        )
        for m in pattern.finditer(fixed):
            product_handle = m.group(1)
            full_match = m.group(0)
            # Check if this product handle has a specific mapping
            if product_handle in PRODUCT_TO_COLLECTION:
                new_url = f"https://oilslickpad.com{PRODUCT_TO_COLLECTION[product_handle]}"
            else:
                new_url = f"https://oilslickpad.com/collections/{coll}"
            if full_match in fixed:
                fixed = fixed.replace(full_match, new_url)
                changes.append(f"Replaced {full_match} → {new_url}")

    return fixed, changes


def graphql_request(query, variables=None):
    """Execute a GraphQL request via curl."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST",
            f"{STORE_URL}/admin/api/{API_VERSION}/graphql.json",
            "-H", "Content-Type: application/json",
            "-H", f"X-Shopify-Access-Token: {API_TOKEN}",
            "-d", json.dumps(payload),
        ],
        capture_output=True, text=True, timeout=30
    )
    return json.loads(result.stdout)


def update_article(article_id, new_body):
    """Update an article's body HTML via GraphQL."""
    # Extract numeric ID from GID
    numeric_id = article_id.split("/")[-1]

    # Use REST API for article update (simpler for body update)
    # Need blog ID numeric too
    blog_numeric_id = BLOG_GID.split("/")[-1]

    payload = json.dumps({
        "article": {
            "id": int(numeric_id),
            "body_html": new_body,
        }
    })

    result = subprocess.run(
        [
            "curl", "-s", "-X", "PUT",
            f"{STORE_URL}/admin/api/{API_VERSION}/blogs/{blog_numeric_id}/articles/{numeric_id}.json",
            "-H", "Content-Type: application/json",
            "-H", f"X-Shopify-Access-Token: {API_TOKEN}",
            "-d", payload,
        ],
        capture_output=True, text=True, timeout=30
    )

    try:
        resp = json.loads(result.stdout)
        if "article" in resp:
            return True, None
        elif "errors" in resp:
            return False, str(resp["errors"])
        else:
            return False, result.stdout[:200]
    except Exception as e:
        return False, str(e)


def main():
    print("=== Blog Hyperlink Fixer ===\n", file=sys.stderr)

    # Load articles
    with open("all-articles.json") as f:
        articles = json.load(f)

    print(f"Loaded {len(articles)} articles", file=sys.stderr)

    # Build replacement map
    rmap = build_replacement_map()
    print(f"Built replacement map with {len(rmap)} direct URL replacements", file=sys.stderr)

    # Process each article
    articles_to_update = []
    total_changes = 0

    for article in articles:
        body = article.get("body", "")
        if not body:
            continue

        fixed_body, changes = apply_fixes(body, rmap)

        if changes:
            articles_to_update.append({
                "id": article["id"],
                "title": article["title"],
                "handle": article["handle"],
                "changes": changes,
                "new_body": fixed_body,
            })
            total_changes += len(changes)

    print(f"\nArticles needing updates: {len(articles_to_update)}", file=sys.stderr)
    print(f"Total link changes: {total_changes}\n", file=sys.stderr)

    # Show summary of changes by article
    for item in articles_to_update:
        print(f"\n  Article: {item['title']}", file=sys.stderr)
        for change in item["changes"]:
            print(f"    - {change}", file=sys.stderr)

    # Apply updates via API
    print(f"\n\n=== Applying {len(articles_to_update)} article updates ===\n", file=sys.stderr)

    success_count = 0
    fail_count = 0

    for i, item in enumerate(articles_to_update):
        ok, err = update_article(item["id"], item["new_body"])
        if ok:
            success_count += 1
            print(f"  [{i+1}/{len(articles_to_update)}] OK: {item['title']}", file=sys.stderr)
        else:
            fail_count += 1
            print(f"  [{i+1}/{len(articles_to_update)}] FAIL: {item['title']} - {err}", file=sys.stderr)

        # Respect rate limits - 2 requests per second for REST API
        time.sleep(0.5)

    print(f"\n=== DONE ===", file=sys.stderr)
    print(f"  Success: {success_count}", file=sys.stderr)
    print(f"  Failed: {fail_count}", file=sys.stderr)

    # Save a report
    report = {
        "total_articles_checked": len(articles),
        "articles_updated": success_count,
        "articles_failed": fail_count,
        "total_link_changes": total_changes,
        "changes": [
            {
                "article": item["title"],
                "handle": item["handle"],
                "changes": item["changes"],
            }
            for item in articles_to_update
        ],
    }

    with open("fix-report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved fix-report.json", file=sys.stderr)


if __name__ == "__main__":
    main()
