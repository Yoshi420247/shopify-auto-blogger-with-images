/**
 * Image Generator Module
 *
 * Supports two image providers (controlled by IMAGE_PROVIDER env var):
 *
 * 1. Gemini (default) - Google Gemini's Nano Banana Pro 3.0 (gemini-3-pro-image-preview)
 *    - Cost: ~$0.039/image at 1K resolution
 *    - Good quality, very affordable
 *
 * 2. gpt-image-1 - OpenAI's gpt-image-1 model
 *    - Cost: ~$0.167/image at High quality (1536x1024)
 *    - Premium quality, ~4x more expensive
 *    - Requires OPENAI_API_KEY
 *
 * Both produce high-quality images suitable for blog posts.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';
import { withRetry } from '../utils/apiRetry.js';
import { generateImageFilename } from '../utils/seoOptimizer.js';
import { trackImageCall } from '../utils/costTracker.js';

// Initialize clients lazily
let genAI = null;
let openaiClient = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
}

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/**
 * Generate an image based on a description.
 * Routes to the configured provider (gemini or gpt-image-1).
 */
export async function generateImage(description, options = {}) {
  const {
    aspectRatio = config.blog.imageAspectRatio,
    style = 'photorealistic'
  } = options;

  console.log(`Generating image: ${description}`);

  if (config.imageProvider === 'gpt-image-1') {
    return generateImageGPT(description, { aspectRatio, style });
  }

  return generateImageGemini(description, { aspectRatio, style });
}

// ============================================================
// GPT Image-1 Provider
// ============================================================

/**
 * Generate an image using OpenAI gpt-image-1
 */
async function generateImageGPT(description, options = {}) {
  const { style = 'photorealistic' } = options;
  const enhancedPrompt = buildImagePrompt(description, style);

  try {
    const client = getOpenAI();

    const result = await withRetry(
      () => client.images.generate({
        model: config.gptImage.model,
        prompt: enhancedPrompt,
        n: 1,
        size: config.gptImage.size,
        quality: config.gptImage.quality,
        output_format: config.gptImage.outputFormat
      }),
      { maxRetries: 2, operationName: 'Image generation (gpt-image-1)' }
    );

    const imageData = result.data?.[0]?.b64_json;
    if (imageData) {
      return {
        success: true,
        imageData,
        mimeType: 'image/png',
        prompt: enhancedPrompt,
        generatedAt: new Date().toISOString(),
        model: `gpt-image-1 (${config.gptImage.quality} quality)`
      };
    }

    throw new Error('No image data returned from gpt-image-1');

  } catch (error) {
    console.error('Error generating image with gpt-image-1:', error.message);
    // Fall back to Gemini if gpt-image-1 fails
    console.log('Falling back to Gemini for image generation...');
    return generateImageGemini(description, options);
  }
}

// ============================================================
// Gemini Provider (default)
// ============================================================

/**
 * Generate an image using Gemini Nano Banana Pro 3.0
 */
async function generateImageGemini(description, options = {}) {
  const {
    aspectRatio = config.blog.imageAspectRatio,
    style = 'photorealistic'
  } = options;

  const enhancedPrompt = buildImagePrompt(description, style);

  try {
    const ai = getGenAI();

    // Use Gemini 3 Pro Image (Nano Banana Pro 3.0) with retry logic
    const model = ai.getGenerativeModel({
      model: config.gemini.imageModel,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: config.gemini.aspectRatio || aspectRatio,
          imageSize: config.gemini.imageSize || '2K'
        }
      }
    });

    const result = await withRetry(
      () => model.generateContent({
        contents: [{ parts: [{ text: enhancedPrompt }] }],
        generationConfig: { candidateCount: 1 }
      }),
      { maxRetries: 2, operationName: 'Image generation (Gemini Pro)' }
    );

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        return {
          success: true,
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          prompt: enhancedPrompt,
          generatedAt: new Date().toISOString(),
          model: 'Nano Banana Pro 3.0 (gemini-3-pro-image-preview)'
        };
      }
    }

    // If no image was generated, try alternative approach
    return await generateImageAlternative(description, options);

  } catch (error) {
    console.error('Error generating image with Nano Banana Pro:', error.message);
    return await generateImageAlternative(description, options);
  }
}

/**
 * Alternative image generation using Nano Banana (faster model)
 * Falls back to Imagen 4 if Nano Banana fails
 */
async function generateImageAlternative(description, options = {}) {
  try {
    const ai = getGenAI();

    // Try Nano Banana (Gemini 2.5 Flash Image) - faster alternative
    console.log('Trying Nano Banana (gemini-2.5-flash-image) as fallback...');
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    const result = await model.generateContent({
      contents: [{
        parts: [{ text: buildImagePrompt(description, options.style || 'photorealistic') }]
      }]
    });

    const parts = result.response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          success: true,
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          prompt: description,
          generatedAt: new Date().toISOString(),
          model: 'Nano Banana (gemini-2.5-flash-image)'
        };
      }
    }

    // Final fallback: Try Imagen 4
    console.log('Trying Imagen 4 as final fallback...');
    const imagenModel = ai.getGenerativeModel({ model: 'imagen-4.0-generate-001' });

    const imagenResult = await imagenModel.generateImages({
      prompt: buildImagePrompt(description, options.style || 'photorealistic'),
      numberOfImages: 1,
      aspectRatio: options.aspectRatio || '16:9'
    });

    if (imagenResult.images && imagenResult.images.length > 0) {
      const image = imagenResult.images[0];
      return {
        success: true,
        imageData: image.bytesBase64Encoded,
        mimeType: image.mimeType || 'image/png',
        prompt: description,
        generatedAt: new Date().toISOString(),
        model: 'Imagen 4'
      };
    }

    throw new Error('No images generated from any model');

  } catch (error) {
    console.error('All image generation attempts failed:', error.message);
    return {
      success: false,
      error: error.message,
      placeholder: true,
      prompt: description
    };
  }
}

/**
 * Build enhanced image prompt
 */
function buildImagePrompt(description, style = 'photorealistic') {
  // Base style modifiers
  const styleModifiers = {
    photorealistic: 'photorealistic, high quality, professional photography, sharp focus, well-lit',
    product: 'product photography, clean background, professional lighting, commercial quality, studio shot',
    lifestyle: 'lifestyle photography, natural lighting, authentic feel, candid moment, warm tones',
    artistic: 'artistic interpretation, creative composition, visually striking, unique perspective'
  };

  // Cannabis-related image guidance (keeping it appropriate)
  const safetyGuidance = `
Create a tasteful, professional image suitable for a cannabis accessories e-commerce blog.
Focus on the tools, accessories, and lifestyle aspects rather than the plant material itself.
Keep it clean, modern, and appealing to adult consumers.
`;

  // Oil Slick brand guidelines - subtle, realistic
  const brandGuidelines = `
Product styling notes:
- Silicone dab mats should look realistic: thin, flexible, silpat-style with a thin colored edge binding (like bias tape)
- If a silicone mat is shown, it may have a subtle green edge trim - but this is optional, not required
- DO NOT add any text, logos, words, inscriptions, or writing to products
- DO NOT make everything green - use natural, varied colors appropriate to each item
- Keep products looking like real commercial items you'd find in a store
`;

  const styleModifier = styleModifiers[style] || styleModifiers.photorealistic;

  return `${description}

Style: ${styleModifier}
${safetyGuidance}
${brandGuidelines}
Technical specifications:
- High resolution
- Clean, modern aesthetic
- Professional quality suitable for commercial use
- Well-composed with good use of space`;
}

/**
 * Generate multiple images for a blog post
 */
export async function generateBlogImages(imageMarkers, blogTitle) {
  const results = [];

  console.log(`Using image provider: ${config.imageProvider}`);

  for (let i = 0; i < imageMarkers.length; i++) {
    const marker = imageMarkers[i];

    // Determine appropriate style based on marker description
    const style = determineImageStyle(marker.description);

    console.log(`Generating image ${i + 1}/${imageMarkers.length}: ${marker.description}`);

    const result = await generateImage(marker.description, {
      style,
      aspectRatio: config.blog.imageAspectRatio
    });

    // Track image generation cost
    trackImageCall({
      model: getImageCostKey(result),
      label: `Blog image ${i + 1}: ${marker.description.substring(0, 50)}`,
      success: result.success
    });

    results.push({
      ...result,
      originalMarker: marker.marker,
      description: marker.description,
      altText: generateAltText(marker.description, blogTitle),
      index: i
    });

    // Delay between image generations to respect rate limits
    if (i < imageMarkers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Map an image generation result to its cost tracker model key
 */
function getImageCostKey(result) {
  if (!result.success) return 'unknown';
  const m = (result.model || '').toLowerCase();
  if (m.includes('gpt-image-1'))          return `gpt-image-1-${config.gptImage.quality || 'high'}`;
  if (m.includes('gemini-3') || m.includes('nano banana pro')) return 'gemini-3-pro-image-preview';
  if (m.includes('flash') || m.includes('nano banana'))        return 'gemini-2.5-flash-image';
  if (m.includes('imagen'))               return 'imagen-4.0-generate-001';
  return 'unknown';
}

/**
 * Determine the best image style based on description
 */
function determineImageStyle(description) {
  const lower = description.toLowerCase();

  if (lower.includes('product') || lower.includes('close-up') || lower.includes('detail')) {
    return 'product';
  }

  if (lower.includes('person') || lower.includes('using') || lower.includes('lifestyle') || lower.includes('scene')) {
    return 'lifestyle';
  }

  if (lower.includes('artistic') || lower.includes('creative') || lower.includes('abstract')) {
    return 'artistic';
  }

  return 'photorealistic';
}

/**
 * Generate SEO-friendly alt text for an image
 */
function generateAltText(description, blogTitle) {
  // Create concise, descriptive alt text
  const cleanDescription = description
    .replace(/showing|displaying|featuring|image of|picture of/gi, '')
    .trim();

  // Keep under 125 characters
  let altText = cleanDescription;
  if (altText.length > 120) {
    altText = altText.substring(0, 117) + '...';
  }

  return altText;
}

/**
 * Save image to file system (for local testing/backup)
 */
export async function saveImage(imageResult, outputDir, filename) {
  if (!imageResult.success || !imageResult.imageData) {
    console.warn('Cannot save image: no image data');
    return null;
  }

  try {
    await fs.mkdir(outputDir, { recursive: true });

    const extension = imageResult.mimeType?.includes('jpeg') ? 'jpg' : 'png';
    const fullPath = path.join(outputDir, `${filename}.${extension}`);

    const buffer = Buffer.from(imageResult.imageData, 'base64');
    await fs.writeFile(fullPath, buffer);

    console.log(`Image saved: ${fullPath}`);
    return fullPath;

  } catch (error) {
    console.error('Error saving image:', error.message);
    return null;
  }
}

/**
 * Convert image to base64 data URL for HTML embedding
 */
export function imageToDataUrl(imageResult) {
  if (!imageResult.success || !imageResult.imageData) {
    return null;
  }

  return `data:${imageResult.mimeType};base64,${imageResult.imageData}`;
}

/**
 * Generate a placeholder image description when generation fails
 */
export function getPlaceholderImageHtml(description, altText) {
  return `<div class="image-placeholder" style="background: #f0f0f0; padding: 40px; text-align: center; border-radius: 8px;">
  <p style="color: #666; font-style: italic;">Image: ${altText || description}</p>
</div>`;
}

export default {
  generateImage,
  generateBlogImages,
  saveImage,
  imageToDataUrl,
  getPlaceholderImageHtml
};
