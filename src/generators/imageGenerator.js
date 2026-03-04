/**
 * Image Generator Module
 *
 * Uses Google Gemini's Nano Banana Pro 3.0 (gemini-3-pro-image-preview) for AI image generation.
 * Creates relevant, high-quality images for blog posts.
 *
 * Nano Banana Pro 3.0 features (Gemini 3 Pro Image):
 * - High-resolution output: 1K, 2K, and 4K visuals
 * - Advanced text rendering for infographics and marketing assets
 * - Reasoning-enhanced composition
 * - Character consistency with up to 14 reference inputs
 * - SynthID watermarking for AI detection
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import config from '../config.js';
import { withRetry } from '../utils/apiRetry.js';
import { generateImageFilename } from '../utils/seoOptimizer.js';

// Initialize Gemini client
let genAI = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
}

/**
 * Fetch a product image from URL and convert to base64 for Gemini reference input.
 *
 * @param {string} imageUrl - The product image URL (Shopify CDN)
 * @returns {Object|null} { data: base64string, mimeType: string } or null on failure
 */
async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'Accept': 'image/*' }
    });

    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';

    return { data: base64, mimeType: contentType };
  } catch (error) {
    console.log(`  Could not fetch reference image: ${error.message}`);
    return null;
  }
}

/**
 * Generate an image based on a description, optionally using a product photo as reference.
 *
 * @param {string} description - What to generate
 * @param {Object} options - Generation options
 * @param {string} options.aspectRatio - Image aspect ratio
 * @param {string} options.style - Image style
 * @param {Object} options.referenceProduct - Product reference data from productMatcher
 * @param {string} options.referenceProduct.imageUrl - Product photo URL to use as inspiration
 * @param {string} options.referenceProduct.title - Product name for prompt context
 */
export async function generateImage(description, options = {}) {
  const {
    aspectRatio = config.blog.imageAspectRatio,
    style = 'photorealistic',
    referenceProduct = null
  } = options;

  console.log(`Generating image: ${description}`);

  // Build the content parts — text prompt, optionally with a reference product image
  const contentParts = [];
  let usedReference = false;

  // If we have a reference product photo, include it as inspiration
  if (referenceProduct?.imageUrl) {
    console.log(`  Using product reference photo: "${referenceProduct.title}"`);
    const refImage = await fetchImageAsBase64(referenceProduct.imageUrl);
    if (refImage) {
      contentParts.push({
        inlineData: {
          data: refImage.data,
          mimeType: refImage.mimeType
        }
      });
      usedReference = true;
    }
  }

  // Build enhanced prompt — include reference context if we have a product photo
  let enhancedPrompt;
  if (usedReference && referenceProduct) {
    enhancedPrompt = buildImagePromptWithReference(description, referenceProduct.title, style);
  } else {
    enhancedPrompt = buildImagePrompt(description, style);
  }

  contentParts.push({ text: enhancedPrompt });

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
        contents: [{ parts: contentParts }],
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
          model: 'Nano Banana Pro 3.0 (gemini-3-pro-image-preview)',
          usedProductReference: usedReference,
          referenceProductTitle: referenceProduct?.title || null
        };
      }
    }

    // If no image was generated, try alternative approach (without reference — simpler)
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
 * Build enhanced image prompt that incorporates a real product photo as reference.
 * Tells the AI to use the attached photo as inspiration for the generated image.
 */
function buildImagePromptWithReference(description, productTitle, style = 'photorealistic') {
  const styleModifiers = {
    photorealistic: 'photorealistic, high quality, professional photography, sharp focus, well-lit',
    product: 'product photography, clean background, professional lighting, commercial quality, studio shot',
    lifestyle: 'lifestyle photography, natural lighting, authentic feel, candid moment, warm tones',
    artistic: 'artistic interpretation, creative composition, visually striking, unique perspective'
  };

  const styleModifier = styleModifiers[style] || styleModifiers.photorealistic;

  return `The attached photo shows a real product called "${productTitle}" from an online store.
Use this actual product as visual reference — match its shape, color, material, and design in the generated image.

Generate a new image for this scene: ${description}

IMPORTANT reference instructions:
- The product in the generated image should look like the one in the reference photo
- Match the product's actual appearance — its real colors, materials, proportions, and design details
- Place the product in the described scene/setting, but keep the product itself faithful to the reference
- DO NOT add any text, logos, words, or writing to the product
- The reference photo is the ground truth — if the description contradicts the photo, follow the photo

Style: ${styleModifier}
Create a tasteful, professional image suitable for a cannabis accessories e-commerce blog.
Focus on the tools, accessories, and lifestyle aspects rather than plant material.
High resolution, clean modern aesthetic, professional quality.`;
}

/**
 * Generate multiple images for a blog post
 */
export async function generateBlogImages(imageMarkers, blogTitle) {
  const results = [];

  for (let i = 0; i < imageMarkers.length; i++) {
    const marker = imageMarkers[i];

    // Determine appropriate style based on marker description
    // Use 'product' style when we have a reference product photo
    let style = determineImageStyle(marker.description);
    if (marker.referenceProduct?.imageUrl) {
      style = 'product';
    }

    console.log(`Generating image ${i + 1}/${imageMarkers.length}: ${marker.description}`);

    const result = await generateImage(marker.description, {
      style,
      aspectRatio: config.blog.imageAspectRatio,
      referenceProduct: marker.referenceProduct || null
    });

    results.push({
      ...result,
      originalMarker: marker.marker,
      description: marker.description,
      altText: generateAltText(marker.description, blogTitle),
      index: i,
      referenceProduct: marker.referenceProduct || null
    });

    // Delay between image generations to respect rate limits
    if (i < imageMarkers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
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
