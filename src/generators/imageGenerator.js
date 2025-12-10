/**
 * Image Generator Module
 *
 * Uses Google Gemini's Nano Banana Pro (gemini-2.0-flash-exp) for AI image generation.
 * Creates relevant, high-quality images for blog posts.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';

// Initialize Gemini client
let genAI = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
}

/**
 * Generate an image based on a description
 */
export async function generateImage(description, options = {}) {
  const {
    aspectRatio = config.blog.imageAspectRatio,
    style = 'photorealistic'
  } = options;

  console.log(`Generating image: ${description}`);

  // Build enhanced prompt for better image generation
  const enhancedPrompt = buildImagePrompt(description, style);

  try {
    const ai = getGenAI();

    // Use Gemini 2.0 Flash with image generation capabilities (Nano Banana)
    const model = ai.getGenerativeModel({
      model: config.gemini.imageModel,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    const result = await model.generateContent({
      contents: [{
        parts: [{ text: enhancedPrompt }]
      }],
      generationConfig: {
        candidateCount: 1
      }
    });

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];

    // Find the image part in the response
    for (const part of parts) {
      if (part.inlineData) {
        return {
          success: true,
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          prompt: enhancedPrompt,
          generatedAt: new Date().toISOString()
        };
      }
    }

    // If no image was generated, try alternative approach
    return await generateImageAlternative(description, options);

  } catch (error) {
    console.error('Error generating image with Gemini:', error.message);

    // Fallback to alternative method
    return await generateImageAlternative(description, options);
  }
}

/**
 * Alternative image generation using Imagen model directly
 */
async function generateImageAlternative(description, options = {}) {
  try {
    const ai = getGenAI();

    // Try using Imagen 3 model
    const model = ai.getGenerativeModel({ model: 'imagen-3.0-generate-001' });

    const result = await model.generateImages({
      prompt: buildImagePrompt(description, options.style || 'photorealistic'),
      numberOfImages: 1,
      aspectRatio: options.aspectRatio || '16:9',
      safetySettings: 'block_only_high'
    });

    if (result.images && result.images.length > 0) {
      const image = result.images[0];
      return {
        success: true,
        imageData: image.bytesBase64Encoded,
        mimeType: image.mimeType || 'image/png',
        prompt: description,
        generatedAt: new Date().toISOString()
      };
    }

    throw new Error('No images generated');

  } catch (error) {
    console.error('Alternative image generation failed:', error.message);
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

  const styleModifier = styleModifiers[style] || styleModifiers.photorealistic;

  return `${description}

Style: ${styleModifier}
${safetyGuidance}

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

  for (let i = 0; i < imageMarkers.length; i++) {
    const marker = imageMarkers[i];

    // Determine appropriate style based on marker description
    const style = determineImageStyle(marker.description);

    console.log(`Generating image ${i + 1}/${imageMarkers.length}: ${marker.description}`);

    const result = await generateImage(marker.description, {
      style,
      aspectRatio: config.blog.imageAspectRatio
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
