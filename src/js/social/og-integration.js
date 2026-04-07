/**
 * OG Embed Integration
 * Usage: Import and call updatePageOG() when palette changes
 */

import { generateOGMetaTags, generatePreviewPNG } from './embed-generator.js';

/**
 * Update page meta tags for current palette
 * Call this whenever the palette changes
 * Generates PNG as data URL and updates og:image
 * 
 * @param {string} slugUrl - Current URL slug/path
 */
export async function updatePageOG(slugUrl) {
  // Remove any existing OG meta tags
  document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(el => {
    el.remove();
  });
  
  // Generate preview PNG as data URL
  try {
    const imageDataUrl = await generatePreviewPNG();
    
    // Generate OG tags (will use the data URL)
    const ogTags = generateOGMetaTags(slugUrl, imageDataUrl);
    ogTags.forEach(tag => {
      document.head.appendChild(tag);
    });
  } catch (err) {
    console.error('Error generating OG preview:', err);
  }
}

/**
 * Copy embed code to clipboard
 * Includes HTML snippet for embedding preview
 */
export function copyEmbedCode(baseUrl = 'colors.ravgo.dev', slugUrl) {
  const embedCode = `<!-- Embed from ${baseUrl} -->
<div class="palette-embed">
  <a href="https://${baseUrl}/${slugUrl}" target="_blank">
    <img src="https://${baseUrl}/og/${slugUrl}.png" alt="Color Palette" />
  </a>
</div>`;
  
  navigator.clipboard.writeText(embedCode).then(() => {
    console.log('Embed code copied to clipboard');
  });
}

/**
 * Generate data URL for preview (for local preview display)
 * @returns {string} Data URL
 */
export function getPreviewDataUrl() {
  const svg = generatePreviewSVG();
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/**
 * Inject OG image preview into page
 * Useful for testing/preview
 */
export function injectPreview(containerId = 'og-preview') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const svg = generatePreviewSVG();
  const img = document.createElement('img');
  img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  img.style.maxWidth = '100%';
  img.style.border = '1px solid rgba(255,255,255,0.1)';
  img.style.borderRadius = '8px';
  
  container.innerHTML = '';
  container.appendChild(img);
}

/**
 * Format palette URL for sharing
 * Takes current palette and returns shareable URL
 */
export function getShareUrl(baseUrl = 'colors.ravgo.dev') {
  // This assumes you have access to the current URL or palette data
  // You may need to adapt based on your actual URL structure
  
  const currentPath = window.location.pathname + window.location.hash;
  return `https://${baseUrl}${currentPath}`;
}

/**
 * Create a copy-to-clipboard button
 * @param {string} buttonSelector - CSS selector for button element
 * @param {string} baseUrl - Domain
 * @param {string} slugUrl - Current slug
 */
export function attachShareButton(buttonSelector, baseUrl = 'colors.ravgo.dev', slugUrl) {
  const button = document.querySelector(buttonSelector);
  if (!button) return;
  
  button.addEventListener('click', async () => {
    const shareUrl = `https://${baseUrl}/${slugUrl}`;
    
    // Try Web Share API first (mobile friendly)
    if (navigator.share) {
      navigator.share({
        title: 'Color Palette',
        text: `Check out this cool palette on ${baseUrl}`,
        url: shareUrl,
      });
    } else {
      // Fallback: copy URL
      navigator.clipboard.writeText(shareUrl);
      // Show feedback (optional)
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }
  });
}

/**
 * HTML snippet to add to your index.html for testing:
 * 
 * <!-- Add in <head> -->
 * <meta property="og:title" content="Color Palette Visualizer" />
 * <meta property="og:description" content="Create and share stunning color palettes" />
 * <meta property="og:site_name" content="Color Palette Visualizer" />
 * <meta name="twitter:card" content="summary_large_image" />
 * <meta name="theme-color" content="#a855f7" />
 * 
 * <!-- Add for preview testing -->
 * <div id="og-preview" style="margin: 20px; max-width: 600px;"></div>
 * 
 * <!-- Usage in your app code -->
 * import { updatePageOG, injectPreview, attachShareButton } from './og-integration.js';
 * 
 * // When page loads or palette changes:
 * const slugUrl = 'aurora/a855f7-e879f9-fbbf24';
 * updatePageOG('colors.ravgo.dev', slugUrl);
 * injectPreview('og-preview'); // for testing
 * attachShareButton('[onclick="copyURL()"]', 'colors.ravgo.dev', slugUrl);
 */
