/**
 * Shopify Publisher Module
 *
 * Publishes blog posts to Shopify using the Admin API.
 * Uses GraphQL API (2024-10+) for articles, blogs, and images.
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
export async function getBlogs() {
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
export async function getOrCreateBlog(blogTitle = 'News') {
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
export async function getArticles(blogId, limit = 50) {
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
 * Upload an image to Shopify
 */
export async function uploadImage(imageData, filename, altText) {
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
export async function createArticle(blogId, article) {
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

  // Convert body markdown to HTML
  const htmlBody = markdownToHtml(body);

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
export async function updateArticle(articleId, updates) {
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
 * Convert markdown to HTML with proper styling
 * Handles both properly formatted markdown AND inline/compact content
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Remove image markers first
  html = html.replace(/\[IMAGE:[^\]]+\]/g, '');

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

  // STEP 3: Convert headers (with inline styles to override Shopify theme's ALL CAPS)
  // Use text-transform: none to prevent uppercase, and proper font styling for readability
  html = html.replace(/^### (.+)$/gm, '<h3 style="text-transform: none; font-size: 1.25em; font-weight: 600; margin: 1.5em 0 0.75em 0; line-height: 1.4;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="text-transform: none; font-size: 1.5em; font-weight: 700; margin: 2em 0 1em 0; line-height: 1.3;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="text-transform: none; font-size: 2em; font-weight: 700; margin: 1em 0; line-height: 1.2;">$1</h1>');

  // STEP 4: Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // STEP 5: Links (with styling for visibility)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>');

  // STEP 6: Process lists
  const lines = html.split('\n');
  const processedLines = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (listMatch) {
      if (!inList) {
        processedLines.push('<ul style="margin: 1em 0; padding-left: 1.5em; line-height: 1.7;">');
        inList = true;
      }
      processedLines.push(`<li style="margin: 0.5em 0;">${listMatch[1]}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('\n');

  // STEP 7: Convert paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';

    // Don't wrap if already an HTML element
    if (/^<(h[1-6]|ul|ol|li|hr|p|div|blockquote|table)/i.test(para)) {
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

      return chunks.map(chunk => `<p style="margin: 1em 0; line-height: 1.7;">${chunk}</p>`).join('\n');
    }

    // Wrap text in paragraph with proper spacing
    return `<p style="margin: 1em 0; line-height: 1.7;">${text}</p>`;
  }).filter(p => p).join('\n\n');

  // Final cleanup
  html = html.replace(/<\/ul>\s*<\/ul>/g, '</ul>');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

/**
 * Check connection to Shopify
 */
export async function testConnection() {
  try {
    const blogs = await getBlogs();
    console.log(`Shopify connection successful. Found ${blogs.length} blog(s).`);
    return { success: true, blogs };
  } catch (error) {
    console.error('Shopify connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

export default {
  getBlogs,
  getOrCreateBlog,
  getArticles,
  uploadImage,
  createArticle,
  updateArticle,
  testConnection,
  markdownToHtml
};
