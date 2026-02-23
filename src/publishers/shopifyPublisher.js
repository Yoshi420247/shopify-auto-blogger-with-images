/**
 * Shopify Publisher Module
 *
 * Publishes blog posts to Shopify using the Admin API.
 * Uses GraphQL API (2025-04+) for articles, blogs, and images.
 */

import axios from 'axios';
import config from '../config.js';

/**
 * Get the Shopify API endpoint
 */
function getShopifyEndpoint(path = '') {
  const domain = config.shopify.storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${domain}/admin/api/${config.shopify.apiVersion}${path}`;
}

/**
 * Get GraphQL endpoint
 */
function getGraphQLEndpoint() {
  return getShopifyEndpoint('/graphql.json');
}

/**
 * Make authenticated request to Shopify
 */
async function shopifyRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': config.shopify.adminApiToken,
    ...options.headers
  };

  try {
    const response = await axios({
      url: endpoint,
      method: options.method || 'GET',
      headers,
      data: options.data,
      timeout: 30000
    });

    return response.data;

  } catch (error) {
    if (error.response) {
      console.error('Shopify API Error:', error.response.status, error.response.data);
      throw new Error(`Shopify API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Execute GraphQL query
 */
async function graphqlQuery(query, variables = {}) {
  const response = await shopifyRequest(getGraphQLEndpoint(), {
    method: 'POST',
    data: { query, variables }
  });

  if (response.errors) {
    console.error('GraphQL Errors:', response.errors);
    throw new Error(`GraphQL Error: ${response.errors[0]?.message}`);
  }

  return response.data;
}

/**
 * Get all blogs in the store
 */
async function getBlogs() {
  // First try GraphQL (2024-10+)
  try {
    const query = `
      query GetBlogs {
        blogs(first: 10) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }
    `;

    const data = await graphqlQuery(query);
    return data.blogs.edges.map(edge => edge.node);

  } catch (error) {
    // Fallback to REST API
    console.log('Falling back to REST API for blogs...');
    const response = await shopifyRequest(getShopifyEndpoint('/blogs.json'));
    return response.blogs || [];
  }
}

/**
 * Get or create the main blog
 */
async function getOrCreateBlog(blogTitle = 'News') {
  const blogs = await getBlogs();

  // Find existing blog
  let blog = blogs.find(b =>
    b.title?.toLowerCase() === blogTitle.toLowerCase() ||
    b.handle?.toLowerCase() === blogTitle.toLowerCase().replace(/\s+/g, '-')
  );

  if (blog) {
    console.log(`Found existing blog: ${blog.title} (${blog.id})`);
    return blog;
  }

  // Create new blog if none exists
  console.log(`Creating new blog: ${blogTitle}`);

  try {
    // Try GraphQL mutation
    const mutation = `
      mutation CreateBlog($title: String!) {
        blogCreate(blog: { title: $title }) {
          blog {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await graphqlQuery(mutation, { title: blogTitle });

    if (data.blogCreate?.userErrors?.length > 0) {
      throw new Error(data.blogCreate.userErrors[0].message);
    }

    return data.blogCreate.blog;

  } catch (error) {
    // Fallback to REST
    const response = await shopifyRequest(getShopifyEndpoint('/blogs.json'), {
      method: 'POST',
      data: { blog: { title: blogTitle } }
    });

    return response.blog;
  }
}

/**
 * Get existing articles from a blog
 */
async function getArticles(blogId, limit = 50) {
  try {
    // Try GraphQL
    const query = `
      query GetArticles($blogId: ID!, $first: Int!) {
        blog(id: $blogId) {
          articles(first: $first) {
            edges {
              node {
                id
                title
                handle
                publishedAt
                createdAt
              }
            }
          }
        }
      }
    `;

    const data = await graphqlQuery(query, {
      blogId: blogId.includes('gid://') ? blogId : `gid://shopify/Blog/${blogId}`,
      first: limit
    });

    return data.blog?.articles?.edges?.map(edge => edge.node) || [];

  } catch (error) {
    // Fallback to REST
    const numericId = blogId.split('/').pop();
    const response = await shopifyRequest(getShopifyEndpoint(`/blogs/${numericId}/articles.json?limit=${limit}`));
    return response.articles || [];
  }
}

/**
 * Upload an image to Shopify Files and get a permanent CDN URL
 * Used for inline blog images that need to be embedded in content
 */
async function uploadImageToFiles(imageData, filename, altText) {
  if (!imageData) {
    return null;
  }

  try {
    // Clean base64 data
    let cleanBase64 = imageData;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    // Step 1: Create staged upload
    const stageMutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stageData = await graphqlQuery(stageMutation, {
      input: [{
        resource: 'FILE',
        filename: filename,
        mimeType: 'image/png',
        httpMethod: 'POST',
        fileSize: Buffer.from(cleanBase64, 'base64').length.toString()
      }]
    });

    if (stageData.stagedUploadsCreate?.userErrors?.length > 0) {
      throw new Error(stageData.stagedUploadsCreate.userErrors[0].message);
    }

    const target = stageData.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      throw new Error('Failed to create staged upload');
    }

    // Step 2: Upload the file to staged URL
    const formData = new FormData();
    target.parameters.forEach(param => {
      formData.append(param.name, param.value);
    });

    const buffer = Buffer.from(cleanBase64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, filename);

    await axios.post(target.url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });

    // Step 3: Create the file in Shopify to get permanent URL
    const fileCreateMutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            alt
            createdAt
            ... on MediaImage {
              image {
                url
                originalSrc
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fileData = await graphqlQuery(fileCreateMutation, {
      files: [{
        alt: altText || filename,
        contentType: 'IMAGE',
        originalSource: target.resourceUrl
      }]
    });

    if (fileData.fileCreate?.userErrors?.length > 0) {
      console.warn('File create warning:', fileData.fileCreate.userErrors[0].message);
    }

    const createdFile = fileData.fileCreate?.files?.[0];
    const imageUrl = createdFile?.image?.url || createdFile?.image?.originalSrc || target.resourceUrl;

    console.log(`Uploaded image to Shopify Files: ${filename}`);

    return {
      url: imageUrl,
      altText,
      fileId: createdFile?.id
    };

  } catch (error) {
    console.error('Error uploading to Shopify Files:', error.message);
    return null;
  }
}

/**
 * Upload an image to Shopify (legacy - for article featured images)
 */
async function uploadImage(imageData, filename, altText) {
  if (!imageData) {
    return null;
  }

  try {
    // For Shopify, we need to use staged uploads for images
    // First, create a staged upload
    const stageMutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stageData = await graphqlQuery(stageMutation, {
      input: [{
        resource: 'IMAGE',
        filename: filename,
        mimeType: 'image/png',
        httpMethod: 'POST'
      }]
    });

    if (stageData.stagedUploadsCreate?.userErrors?.length > 0) {
      throw new Error(stageData.stagedUploadsCreate.userErrors[0].message);
    }

    const target = stageData.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      throw new Error('Failed to create staged upload');
    }

    // Upload the image to the staged URL
    const formData = new FormData();
    target.parameters.forEach(param => {
      formData.append(param.name, param.value);
    });

    const buffer = Buffer.from(imageData, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, filename);

    await axios.post(target.url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return {
      url: target.resourceUrl,
      altText
    };

  } catch (error) {
    console.error('Error uploading image:', error.message);
    return null;
  }
}

/**
 * Create a new blog article
 */
async function createArticle(blogId, article) {
  const {
    title,
    body,
    metaDescription,
    author = 'Oil Slick Pad',
    tags = [],
    published = true,
    imageUrl = null,
    imageAlt = null,
    imageData = null  // Base64 image data
  } = article;

  // Ensure we have a valid title
  const finalTitle = title && title.trim() ? title.trim() : 'New Blog Post';
  console.log(`Creating article: ${finalTitle}`);

  // Check if body is already HTML (contains HTML tags) or still markdown
  // If already HTML (from prepareContentWithImages), don't convert again
  const isAlreadyHtml = body && (
    body.includes('<figure') ||
    body.includes('<p style=') ||
    body.includes('<h2 id=') ||
    body.includes('<table style=')
  );

  let htmlBody;
  if (isAlreadyHtml) {
    console.log('Body already contains HTML, skipping markdown conversion');
    htmlBody = body;
  } else {
    // Convert body markdown to HTML
    htmlBody = markdownToHtml(body);
  }

  // NOTE: Structured data (JSON-LD) is injected by index.js generateAndPublishBlog()
  // before the body reaches this function. Do NOT inject it again here to avoid
  // duplicate schemas which confuse search engines.

  // Ensure title is not too long (Shopify max is 255 characters)
  const safeTitle = finalTitle.length > 250 ? finalTitle.substring(0, 247) + '...' : finalTitle;

  // If we have image data, use REST API directly (GraphQL doesn't support image attachments)
  if (imageData) {
    console.log('Using REST API for image attachment support...');
    return await createArticleViaRest(blogId, {
      title: safeTitle,
      body: htmlBody,
      author,
      tags,
      published,
      imageData,
      imageAlt,
      metaDescription
    });
  }

  try {
    // Try GraphQL mutation (2024-10+ format)
    const mutation = `
      mutation CreateArticle($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article {
            id
            title
            handle
            publishedAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const gidBlogId = blogId.includes('gid://') ? blogId : `gid://shopify/Blog/${blogId}`;

    const articleInput = {
      blogId: gidBlogId,
      title: safeTitle,
      body: htmlBody,
      author: { name: author },
      tags,
      isPublished: published
    };

    // Note: GraphQL image upload requires staged uploads, skip for now
    // Images will be embedded in body HTML instead

    const data = await graphqlQuery(mutation, {
      article: articleInput
    });

    if (data.articleCreate?.userErrors?.length > 0) {
      throw new Error(data.articleCreate.userErrors[0].message);
    }

    const createdArticle = data.articleCreate?.article;

    // Update metafield for meta description if needed
    if (metaDescription && createdArticle?.id) {
      await updateArticleMetaDescription(createdArticle.id, metaDescription);
    }

    return createdArticle;

  } catch (error) {
    console.log('GraphQL failed, trying REST API...');

    // Fallback to REST API
    const numericBlogId = blogId.split('/').pop();

    const articleData = {
      article: {
        title: safeTitle,
        author,
        tags: tags.join(', '),
        body_html: htmlBody,
        published
      }
    };

    // Handle image - either URL or base64 attachment
    if (imageData) {
      // Base64 image data - use attachment field
      // Ensure we have clean base64 without data: prefix
      let cleanBase64 = imageData;
      if (cleanBase64.includes('base64,')) {
        cleanBase64 = cleanBase64.split('base64,')[1];
      }

      console.log(`Attaching featured image (${Math.round(cleanBase64.length / 1024)}KB base64)`);

      articleData.article.image = {
        attachment: cleanBase64,
        alt: imageAlt || safeTitle
      };
    } else if (imageUrl && imageUrl.startsWith('http')) {
      // External URL
      console.log(`Attaching featured image from URL: ${imageUrl}`);
      articleData.article.image = {
        src: imageUrl,
        alt: imageAlt || safeTitle
      };
    } else {
      console.log('No featured image available to attach');
    }

    const response = await shopifyRequest(getShopifyEndpoint(`/blogs/${numericBlogId}/articles.json`), {
      method: 'POST',
      data: articleData
    });

    return response.article;
  }
}

/**
 * Create article via REST API (supports image attachments)
 */
async function createArticleViaRest(blogId, options) {
  const {
    title,
    body,
    author = 'Oil Slick Pad',
    tags = [],
    published = true,
    imageData,
    imageAlt,
    metaDescription
  } = options;

  const numericBlogId = blogId.toString().split('/').pop();

  const articleData = {
    article: {
      title,
      author,
      tags: Array.isArray(tags) ? tags.join(', ') : tags,
      body_html: body,
      published
    }
  };

  // Attach image
  if (imageData) {
    let cleanBase64 = imageData;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    console.log(`Attaching featured image (${Math.round(cleanBase64.length / 1024)}KB)`);

    articleData.article.image = {
      attachment: cleanBase64,
      alt: imageAlt || title
    };
  }

  const response = await shopifyRequest(getShopifyEndpoint(`/blogs/${numericBlogId}/articles.json`), {
    method: 'POST',
    data: articleData
  });

  const createdArticle = response.article;

  // Set meta description if provided
  if (metaDescription && createdArticle?.id) {
    await updateArticleMetaDescription(`gid://shopify/Article/${createdArticle.id}`, metaDescription);
  }

  return createdArticle;
}

/**
 * Update article meta description
 */
async function updateArticleMetaDescription(articleId, description) {
  try {
    const mutation = `
      mutation UpdateArticleMetafields($input: ArticleUpdateInput!, $id: ID!) {
        articleUpdate(article: $input, id: $id) {
          article {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await graphqlQuery(mutation, {
      id: articleId,
      input: {
        metafields: [{
          namespace: 'global',
          key: 'description_tag',
          value: description,
          type: 'single_line_text_field'
        }]
      }
    });

  } catch (error) {
    console.warn('Could not update meta description:', error.message);
  }
}

/**
 * Update an existing article
 */
async function updateArticle(articleId, updates) {
  const {
    title,
    body,
    metaDescription,
    tags,
    imageUrl,
    imageAlt
  } = updates;

  console.log(`Updating article: ${articleId}`);

  const articleInput = {};

  if (title) articleInput.title = title;
  if (body) articleInput.body = markdownToHtml(body);
  if (tags) articleInput.tags = tags;
  if (imageUrl) {
    articleInput.image = {
      src: imageUrl,
      altText: imageAlt || title
    };
  }

  try {
    const mutation = `
      mutation UpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) {
          article {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await graphqlQuery(mutation, {
      id: articleId.includes('gid://') ? articleId : `gid://shopify/Article/${articleId}`,
      article: articleInput
    });

    if (data.articleUpdate?.userErrors?.length > 0) {
      throw new Error(data.articleUpdate.userErrors[0].message);
    }

    if (metaDescription) {
      await updateArticleMetaDescription(articleId, metaDescription);
    }

    return data.articleUpdate?.article;

  } catch (error) {
    // REST fallback
    const numericId = articleId.split('/').pop();
    const response = await shopifyRequest(getShopifyEndpoint(`/articles/${numericId}.json`), {
      method: 'PUT',
      data: { article: articleInput }
    });

    return response.article;
  }
}

/**
 * Generate schema.org JSON-LD structured data for the article
 * This helps with LLM/AI search engines and rich snippets
 */
function generateSchemaMarkup(title, description, author, publishDate, wordCount) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "author": {
      "@type": "Person",
      "name": author || "Oil Slick Pad"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Oil Slick Pad",
      "url": "https://oilslickpad.com"
    },
    "datePublished": publishDate || new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "wordCount": wordCount || 1200,
    "articleSection": "Cannabis Accessories",
    "keywords": ["dab pad", "dabbing", "concentrate tools", "cannabis accessories"]
  };

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * Convert markdown tables to HTML tables
 * Handles various markdown table formats including those with newlines
 */
function convertMarkdownTables(html) {
  // First, normalize tables - find table-like patterns and ensure proper formatting
  // Match lines that look like table rows (start and end with |)
  const lines = html.split('\n');
  const result = [];
  let tableLines = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this line looks like a table row
    const isTableRow = line.startsWith('|') && line.endsWith('|') && line.length > 2;
    const isSeparator = /^\|[\s\-:|]+\|$/.test(line);

    if (isTableRow || isSeparator) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
    } else {
      // End of table
      if (inTable && tableLines.length >= 2) {
        // Convert collected table lines to HTML
        const tableHtml = convertTableLinesToHtml(tableLines);
        result.push(tableHtml);
        tableLines = [];
      }
      inTable = false;
      result.push(lines[i]);
    }
  }

  // Handle table at end of content
  if (inTable && tableLines.length >= 2) {
    const tableHtml = convertTableLinesToHtml(tableLines);
    result.push(tableHtml);
  }

  return result.join('\n');
}

/**
 * Convert array of table lines to HTML table
 */
function convertTableLinesToHtml(tableLines) {
  // Find separator row (contains only |, -, :, and spaces)
  let separatorIndex = -1;
  for (let i = 0; i < tableLines.length; i++) {
    if (/^\|[\s\-:|]+\|$/.test(tableLines[i])) {
      separatorIndex = i;
      break;
    }
  }

  // If no separator found, not a valid table
  if (separatorIndex === -1 || separatorIndex === 0) {
    return tableLines.join('\n');
  }

  // Typography: 16px, line-height 1.55, cell-padding 0.55em 0.7em, header weight 650
  let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 1.1em 0; font-size: 16px; line-height: 1.55;">';

  tableLines.forEach((row, index) => {
    // Skip separator row
    if (index === separatorIndex) return;

    const cells = row.split('|').slice(1, -1); // Remove first and last empty elements
    if (cells.length === 0) return;

    const isHeader = index < separatorIndex;
    const tag = isHeader ? 'th' : 'td';
    const bgColor = isHeader ? '#f5f5f5' : (index % 2 === 0 ? '#fafafa' : '#fff');
    const fontWeight = isHeader ? 'font-weight: 650;' : '';

    tableHtml += '<tr>';
    cells.forEach(cell => {
      const cellContent = cell.trim();
      tableHtml += `<${tag} style="border: 1px solid #e0e0e0; padding: 0.55em 0.7em; text-align: left; ${fontWeight} background: ${bgColor};">${cellContent}</${tag}>`;
    });
    tableHtml += '</tr>';
  });

  tableHtml += '</table>';
  return tableHtml;
}

/**
 * Generate Table of Contents HTML from headings
 */
function generateTableOfContents(headings) {
  if (headings.length < 3) return ''; // Only add TOC if 3+ headings

  let tocHtml = '<nav style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 1.5em; margin: 1.6em 0; text-align: left;">';
  tocHtml += '<p style="font-weight: 700; margin: 0 0 1em 0; font-size: 18px; text-align: left;">In This Article</p>';
  tocHtml += '<ul style="margin: 0; padding-left: 1.2em; line-height: 1.7; font-size: 16px; text-align: left;">';

  headings.forEach(h => {
    const indent = h.level === 3 ? 'margin-left: 1em;' : '';
    tocHtml += `<li style="${indent}"><a href="#${h.id}" style="color: #2563eb; text-decoration: none;">${h.text}</a></li>`;
  });

  tocHtml += '</ul></nav>';
  return tocHtml;
}

/**
 * Convert markdown to HTML with proper styling
 * Handles both properly formatted markdown AND inline/compact content
 * Includes: TOC generation, tables, callout boxes, semantic HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Remove image markers that weren't replaced (but keep any remaining ones for cleanup)
  // Only remove if there are no figure tags (meaning images were handled)
  if (!html.includes('<figure')) {
    html = html.replace(/\[IMAGE:[^\]]+\]/g, '');
  }

  // STEP 0a: Strip markdown code fences and backticks
  html = html.replace(/```[\w]*\n?/g, '');   // Opening/closing ``` (with optional language tag)
  html = html.replace(/`([^`]+)`/g, '$1');    // Inline `code` → plain text

  // STEP 0b: Clean stray bracket artifacts (e.g. "][image]" remnants)
  // "][" not part of a markdown reference link — collapse to space
  html = html.replace(/\]\s*\[(?!IMAGE:)/gi, ' ');
  // Bare "[image]" (lowercase, not a valid [IMAGE: desc] marker) — remove
  html = html.replace(/\[image\]/gi, '');

  // STEP 0c: Extract headings for Table of Contents
  const headings = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    headings.push({ level, text, id });
  }

  // STEP 1: Normalize content - add line breaks around markdown markers
  // This handles content that comes as one long block without proper newlines

  // Add line break before ## headers (but not if already at start of line)
  html = html.replace(/([^\n])(\s*)(#{1,3}\s+)/g, '$1\n\n$3');

  // Add line break before --- separators
  html = html.replace(/([^\n])\s*---\s*/g, '$1\n\n---\n\n');

  // Add line break before list items that follow text
  html = html.replace(/([.!?:])(\s+)(- [A-Z])/g, '$1\n\n$3');

  // Clean up multiple newlines
  html = html.replace(/\n{3,}/g, '\n\n');

  // STEP 2: Convert horizontal rules (with subtle styling)
  html = html.replace(/^---+\s*$/gm, '<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 2em 0;">');

  // Also handle inline --- that weren't on their own line
  html = html.replace(/\s---\s/g, '\n<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 2em 0;">\n');

  // STEP 3: Convert headers with anchor IDs for TOC navigation
  // Typography: H1=42px, H2=30px, H3=22px with proper line-heights and margins
  html = html.replace(/^### (.+)$/gm, (match, title) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<h3 id="${id}" style="text-transform: none; font-size: clamp(20px, 1.22em, 22px); font-weight: 650; margin: 1.2em 0 0.45em 0; line-height: 1.35; text-align: left;">${title}</h3>`;
  });
  html = html.replace(/^## (.+)$/gm, (match, title) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<h2 id="${id}" style="text-transform: none; font-size: clamp(24px, 1.67em, 30px); font-weight: 700; margin: 1.6em 0 0.6em 0; line-height: 1.3; text-align: left;">${title}</h2>`;
  });
  html = html.replace(/^# (.+)$/gm, (match, title) => {
    const id = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    return `<h1 id="${id}" style="text-transform: none; font-size: clamp(32px, 2.33em, 42px); font-weight: 750; margin: 0.2em 0 0.6em 0; line-height: 1.2; text-align: left;">${title}</h1>`;
  });

  // STEP 4: Convert callout boxes (Pro Tip, Warning, Note patterns)
  // Typography: 18px, line-height 1.7, margin similar to blockquote
  html = html.replace(/\*\*Pro [Tt]ip:\*\*\s*([^\n]+)/g,
    '<div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 1em 1em 1em 1.2em; margin: 1.1em 0; border-radius: 4px; font-size: 18px; line-height: 1.7; text-align: left;"><strong style="color: #2e7d32;">Pro Tip:</strong> $1</div>');
  html = html.replace(/\*\*Warning:\*\*\s*([^\n]+)/g,
    '<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 1em 1em 1em 1.2em; margin: 1.1em 0; border-radius: 4px; font-size: 18px; line-height: 1.7; text-align: left;"><strong style="color: #e65100;">Warning:</strong> $1</div>');
  html = html.replace(/\*\*Note:\*\*\s*([^\n]+)/g,
    '<div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 1em 1em 1em 1.2em; margin: 1.1em 0; border-radius: 4px; font-size: 18px; line-height: 1.7; text-align: left;"><strong style="color: #1565c0;">Note:</strong> $1</div>');
  html = html.replace(/\*\*Important:\*\*\s*([^\n]+)/g,
    '<div style="background: #fce4ec; border-left: 4px solid #e91e63; padding: 1em 1em 1em 1.2em; margin: 1.1em 0; border-radius: 4px; font-size: 18px; line-height: 1.7; text-align: left;"><strong style="color: #c2185b;">Important:</strong> $1</div>');

  // STEP 5: Convert markdown tables to HTML
  html = convertMarkdownTables(html);

  // STEP 6: Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // STEP 7: Links with proper styling (underline, offset, inherit weight)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline; text-underline-offset: 0.12em; font-weight: inherit;">$1</a>');

  // STEP 8: Process lists (both unordered and ordered)
  const lines = html.split('\n');
  const processedLines = [];
  let inList = false;
  let listType = null; // 'ul' or 'ol'

  for (const line of lines) {
    const trimmed = line.trim();
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (ulMatch || olMatch) {
      const newListType = ulMatch ? 'ul' : 'ol';
      const content = ulMatch ? ulMatch[1] : olMatch[1];

      // If switching list types, close the old one first
      if (inList && listType !== newListType) {
        processedLines.push(`</${listType}>`);
        inList = false;
      }

      if (!inList) {
        const tag = newListType;
        processedLines.push(`<${tag} style="font-size: 18px; margin: 0.4em 0 1em 0; padding-left: 1.2em; line-height: 1.7; text-align: left;">`);
        inList = true;
        listType = newListType;
      }
      processedLines.push(`<li style="margin: 0.35em 0;">${content}</li>`);
    } else {
      if (inList) {
        processedLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push(`</${listType}>`);
  }

  html = processedLines.join('\n');

  // STEP 7: Convert paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';

    // Don't wrap if already an HTML element
    if (/^<(h[1-6]|ul|ol|li|hr|p|div|blockquote|table|figure|img|figcaption|nav|script)/i.test(para)) {
      return para;
    }

    // Check for orphan closing tags
    if (para === '</ul>' || para === '</ol>') {
      return para;
    }

    // Break up very long paragraphs (more than 500 chars) at sentence boundaries
    let text = para.replace(/\n/g, ' ');
    if (text.length > 500) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let currentChunk = '';

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 400 && currentChunk.length > 100) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      return chunks.map(chunk => `<p style="font-size: 18px; margin: 0 0 1.1em 0; line-height: 1.7; font-weight: 400; text-align: left;">${chunk}</p>`).join('\n');
    }

    // Wrap text in paragraph with proper spacing
    return `<p style="font-size: 18px; margin: 0 0 1.1em 0; line-height: 1.7; font-weight: 400; text-align: left;">${text}</p>`;
  }).filter(p => p).join('\n\n');

  // Final cleanup
  html = html.replace(/<\/ul>\s*<\/ul>/g, '</ul>');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  // Add Table of Contents after first paragraph if we have enough headings
  if (headings.length >= 3) {
    const tocHtml = generateTableOfContents(headings);
    // Insert TOC after the first paragraph
    const firstPEnd = html.indexOf('</p>');
    if (firstPEnd > 0) {
      html = html.substring(0, firstPEnd + 4) + '\n\n' + tocHtml + '\n\n' + html.substring(firstPEnd + 4);
    } else {
      // No paragraph found, prepend TOC
      html = tocHtml + '\n\n' + html;
    }
  }

  // Wrap entire content in a div with typography rules
  // max-width: 720px for optimal line length (55-75 chars at 18px)
  html = `<div style="text-align: left; max-width: 720px; margin: 0 auto; font-size: 18px; line-height: 1.7;">${html}</div>`;

  return html;
}

/**
 * Check connection to Shopify
 */
async function testConnection() {
  try {
    const blogs = await getBlogs();
    console.log(`Shopify connection successful. Found ${blogs.length} blog(s).`);
    return { success: true, blogs };
  } catch (error) {
    console.error('Shopify connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get products by vendor tag
 * @param {string} vendor - The vendor name to filter by (e.g., "What You Need")
 * @param {number} limit - Maximum number of products to return
 */
async function getProductsByVendor(vendor, limit = 20) {
  try {
    const query = `
      query GetProductsByVendor($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              description
              productType
              vendor
              tags
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }
    `;

    const data = await graphqlQuery(query, {
      query: `vendor:"${vendor}"`,
      first: limit
    });

    const products = data.products?.edges?.map(edge => edge.node) || [];
    console.log(`Found ${products.length} products from vendor "${vendor}"`);
    return products;

  } catch (error) {
    console.error(`Error fetching products by vendor "${vendor}":`, error.message);
    return [];
  }
}

export {
  getBlogs,
  getOrCreateBlog,
  getArticles,
  uploadImage,
  uploadImageToFiles,
  createArticle,
  updateArticle,
  testConnection,
  markdownToHtml,
  getProductsByVendor
};
