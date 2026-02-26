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

You can verify programmatically or manually:

```bash
# Verify via API
node src/marketing/setupAutomation.js --verify-only
```

Or manually:
1. Go to **Shopify Admin > Settings > Files**
2. Confirm all 4 images were uploaded
3. Note the CDN URLs (they look like `https://cdn.shopify.com/s/files/...`)

### Step 3: Upload Your Logo

If you haven't already:
1. Go to **Settings > Files > Upload files**
2. Upload your Oil Slick Pad logo as `oil-slick-pad-logo.png`
3. Recommended size: 400x100px, transparent PNG

### Step 4: Activate the Automation

> **Note:** Shopify has moved abandoned checkout emails from Settings > Checkout
> to **Marketing > Automations**. The old location is deprecated.

1. Go to **Marketing > Automations** in your Shopify admin
2. Click **View templates**
3. Select the **Abandoned checkout** automation template
4. Click **Edit** to customize the email content
5. Switch to **HTML/Code view**
6. Copy the entire contents of `src/marketing/templates/abandoned-cart-recovery.html`
7. Paste it into the code editor
8. Update these placeholder URLs with your actual CDN URLs:
   - Logo image src
   - Hero image src
   - Product recommendation image srcs and links
   - Social media links in the footer
9. **Send a test email** to yourself to verify rendering
10. Click **Turn on automation**

Or run the full automated setup:

```bash
node src/marketing/setupAutomation.js
```

**Important:**
- Opting into the new automation is a **permanent change** — you can't revert to the legacy abandoned checkout emails
- By default, only email marketing subscribers receive the email
- Change the audience to "Anyone who abandons their checkout" for broader reach

### Step 5: Configure Timing

Default timing is 10 hours. Recommended timing for abandoned cart recovery:

| Email | Delay | Purpose |
|-------|-------|---------|
| 1st | 1 hour | Quick reminder while intent is high |
| 2nd | 24 hours | Follow-up with social proof |
| 3rd | 3 days | Final reminder, consider adding a discount |

To change timing: Go to **Marketing > Automations**, select your abandoned checkout
automation, click **... > Edit settings**, and adjust "Send after."

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
