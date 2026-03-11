const { imageSize } = require("image-size");
const fs = require("fs");

/**
 * Reads the width and height (in pixels) of an image file.
 *
 * Supported formats (via image-size):
 *   JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG, HEIF, BMP, ICO, and more.
 *
 * @param {string} absolutePath - Absolute path to the image file.
 * @returns {Promise<{width: number, height: number}>}
 */
async function getImageDimensions(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  const dimensions = imageSize(buffer);

  if (dimensions.width === undefined || dimensions.height === undefined) {
    throw new Error(
      `Could not determine dimensions for '${absolutePath}'. ` +
        `The file may be corrupt or in an unsupported format.`,
    );
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
  };
}

module.exports = { getImageDimensions };
