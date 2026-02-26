# Marketing Automation Setup Guide

## Abandoned Cart Recovery Email

### Step 1: Generate Visual Assets

Run the asset generator to create and upload email images to your Shopify Files:

```bash
# Generate all email assets and upload to Shopify
node src/marketing/generateAssets.js

# Preview without uploading (dry run)
node src/marketing/generateAssets.js --dry-run

# Generate a specific asset only
node src/marketing/generateAssets.js --only abandoned-cart-hero
```

This creates 4 images:
| Asset | Description |
|-------|-------------|
| `abandoned-cart-hero.png` | Hero banner - lifestyle shot of dab gear on workspace |
| `rec-product-1.png` | Product card - Oil Slick Pad |
| `rec-product-2.png` | Product card - PTFE Sheets |
| `rec-product-3.png` | Product card - Glass Jars |

### Step 2: Verify Uploads in Shopify

1. Go to **Shopify Admin > Settings > Files**
2. Confirm all 4 images were uploaded
3. Note the CDN URLs (they look like `https://cdn.shopify.com/s/files/...`)

### Step 3: Upload Your Logo

If you haven't already:
1. Go to **Settings > Files > Upload files**
2. Upload your Oil Slick Pad logo as `oil-slick-pad-logo.png`
3. Recommended size: 400x100px, transparent PNG

### Step 4: Activate the Automation

1. Go to **Marketing > Automations** in your Shopify admin
2. Click **Create automation**
3. Choose the **Recover abandoned carts** template
4. In the email editor, switch to **HTML/Code view**
5. Copy the entire contents of `src/marketing/templates/abandoned-cart-recovery.html`
6. Paste it into the code editor
7. Update these placeholder URLs with your actual CDN URLs:
   - Logo image src
   - Hero image src
   - Product recommendation image srcs and links
   - Social media links in the footer
8. **Send a test email** to yourself to verify rendering
9. Click **Turn on automation**

### Step 5: Configure Timing

Shopify's recommended timing for abandoned cart recovery:

| Email | Delay | Purpose |
|-------|-------|---------|
| 1st | 1 hour | Quick reminder while intent is high |
| 2nd | 24 hours | Follow-up with social proof |
| 3rd | 3 days | Final reminder, consider adding a discount |

The provided template works for the first email. For follow-up emails, you can
duplicate and modify the template (e.g., add a discount code section).

### Template Customization

The email template uses Shopify Liquid variables:

| Variable | Description |
|----------|-------------|
| `{{ shop.url }}` | Your store URL |
| `{{ shop.name }}` | Your store name |
| `{{ abandoned_checkout.url }}` | Link back to the customer's cart |
| `{{ abandoned_checkout.line_items }}` | The products left in cart |
| `{{ line.title }}` | Product title |
| `{{ line.image \| img_url }}` | Product image |
| `{{ line.line_price \| money }}` | Line item price |
| `{{ unsubscribe_url }}` | Unsubscribe link |

### Environment Variables

The asset generator uses the same env vars as the blog system:

```
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxx  (required)
GEMINI_API_KEY=xxxxx                  (required if IMAGE_PROVIDER=gemini)
OPENAI_API_KEY=xxxxx                  (required if IMAGE_PROVIDER=gpt-image-1)
IMAGE_PROVIDER=gemini                 (optional, default: gemini)
```
