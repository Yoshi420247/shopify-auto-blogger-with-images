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
    imageAlt = null
  } = article;

  console.log(`Creating article: ${title}`);

  // Convert body markdown to HTML
  const htmlBody = markdownToHtml(body);

  // Ensure title is not too long (Shopify max is 255 characters)
  const safeTitle = title.length > 250 ? title.substring(0, 247) + '...' : title;

  try {
    // Try GraphQL mutation (2024-10+ format)
    const mutation = `
      mutation CreateArticle($article: ArticleInput!) {
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
      author: author,
      tags,
      published
    };

    // Add image if available
    if (imageUrl) {
      articleInput.image = {
        url: imageUrl,
        altText: imageAlt || safeTitle
      };
    }

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

    if (imageUrl) {
      articleData.article.image = {
        src: imageUrl,
        alt: imageAlt || safeTitle
      };
    }

    const response = await shopifyRequest(getShopifyEndpoint(`/blogs/${numericBlogId}/articles.json`), {
      method: 'POST',
      data: articleData
    });

    return response.article;
  }
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
 * Convert basic markdown to HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)\n(<li>)/g, '$1$2');
  html = html.replace(/(<li>.*<\/li>)(?!\n<li>)/gs, '<ul>$1</ul>');

  // Paragraphs
  html = html.split(/\n\n+/).map(para => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) {
      return para;
    }
    return `<p>${para}</p>`;
  }).join('\n');

  // Clean up newlines within paragraphs
  html = html.replace(/<p>(.*?)\n(.*?)<\/p>/gs, (match, p1, p2) => {
    return `<p>${p1} ${p2}</p>`;
  });

  // Remove image markers (they should be handled separately)
  html = html.replace(/\[IMAGE:[^\]]+\]/g, '');

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
