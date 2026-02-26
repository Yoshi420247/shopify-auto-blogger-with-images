#!/usr/bin/env python3
"""Fetch all blog articles from Shopify using curl and extract hyperlinks."""

import subprocess
import json
import os
import re
import sys
import time

STORE_URL = os.environ.get("SHOPIFY_STORE_URL", "https://oil-slick-pad.myshopify.com")
API_TOKEN = os.environ["SHOPIFY_ADMIN_API_TOKEN"]
API_VERSION = "2025-04"
BLOG_ID = "gid://shopify/Blog/51499267"


def graphql_request(query):
    """Execute a GraphQL request via curl."""
    payload = json.dumps({"query": query})
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST",
            f"{STORE_URL}/admin/api/{API_VERSION}/graphql.json",
            "-H", "Content-Type: application/json",
            "-H", f"X-Shopify-Access-Token: {API_TOKEN}",
            "-d", payload,
        ],
        capture_output=True, text=True, timeout=30
    )
    return json.loads(result.stdout)


def fetch_all_articles():
    """Fetch all articles with pagination."""
    articles = []
    cursor = None
    page = 0

    while True:
        page += 1
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = (
            '{ blog(id: "' + BLOG_ID + '") { '
            'articles(first: 50' + after_clause + ') { '
            'edges { node { id title handle body } cursor } '
            'pageInfo { hasNextPage } } } }'
        )

        result = graphql_request(query)

        if "errors" in result:
            print(f"GraphQL errors: {result['errors']}", file=sys.stderr)
            break

        edges = result["data"]["blog"]["articles"]["edges"]
        for edge in edges:
            articles.append(edge["node"])
            cursor = edge["cursor"]

        has_next = result["data"]["blog"]["articles"]["pageInfo"]["hasNextPage"]
        print(f"  Page {page}: fetched {len(edges)} articles (total: {len(articles)})", file=sys.stderr)

        if not has_next:
            break

        time.sleep(0.3)

    return articles


def extract_links(html):
    """Extract all <a> tag hrefs and anchor text from HTML."""
    if not html:
        return []
    links = []
    pattern = re.compile(r'<a\s[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
    for match in pattern.finditer(html):
        href = match.group(1)
        anchor_text = re.sub(r'<[^>]*>', '', match.group(2)).strip()
        links.append({"href": href, "anchorText": anchor_text})
    return links


def main():
    print("=== Fetching all blog articles ===", file=sys.stderr)
    articles = fetch_all_articles()
    print(f"\nTotal articles fetched: {len(articles)}", file=sys.stderr)

    # Extract all links
    all_links = []
    for article in articles:
        links = extract_links(article.get("body", ""))
        for link in links:
            all_links.append({
                "articleId": article["id"],
                "articleTitle": article["title"],
                "articleHandle": article["handle"],
                **link,
            })

    print(f"Total hyperlinks found: {len(all_links)}", file=sys.stderr)

    # Get unique URLs
    unique_urls = {}
    for link in all_links:
        href = link["href"]
        if href not in unique_urls:
            unique_urls[href] = []
        unique_urls[href].append({
            "articleId": link["articleId"],
            "articleTitle": link["articleTitle"],
            "articleHandle": link["articleHandle"],
            "anchorText": link["anchorText"],
        })

    print(f"Unique URLs: {len(unique_urls)}", file=sys.stderr)

    # Categorize
    internal = []
    external = []
    for url, usages in unique_urls.items():
        if url.startswith("/") or "oilslickpad.com" in url or "oil-slick-pad.myshopify.com" in url:
            internal.append({"url": url, "usages": usages})
        else:
            external.append({"url": url, "usages": usages})

    print(f"Internal unique URLs: {len(internal)}", file=sys.stderr)
    print(f"External unique URLs: {len(external)}", file=sys.stderr)

    report = {
        "totalArticles": len(articles),
        "totalLinks": len(all_links),
        "uniqueUrls": len(unique_urls),
        "internalUrls": internal,
        "externalUrls": external,
    }

    # Save full report
    with open("link-report.json", "w") as f:
        json.dump(report, f, indent=2)

    # Also save articles for later use
    with open("all-articles.json", "w") as f:
        json.dump(articles, f)

    print("\nSaved link-report.json and all-articles.json", file=sys.stderr)


if __name__ == "__main__":
    main()
