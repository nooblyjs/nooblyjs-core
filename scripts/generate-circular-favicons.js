#!/usr/bin/env node

/**
 * Generate circular favicons from the Noobly JS circular logo
 * Creates favicon.ico, favicon-16x16.png, favicon-32x32.png, and apple-touch-icon.png
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Try multiple possible paths for the circular logo
const POSSIBLE_PATHS = [
  path.join(__dirname, '../public/images/nooblyjs-logo-circular.png'),
  path.join(__dirname, '../public/images/nooblyjs-circular.png'),
  path.join(__dirname, '../public/images/nooblyjs-logo.png')
];

const OUTPUT_DIR = path.join(__dirname, '../public');

// Favicon sizes to generate
const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function findLogoPath() {
  for (const logoPath of POSSIBLE_PATHS) {
    try {
      await fs.access(logoPath);
      console.log(`✓ Found logo at: ${logoPath}`);
      return logoPath;
    } catch (error) {
      // Path not found, try next
    }
  }
  throw new Error(`Logo file not found in any of the expected locations:\n${POSSIBLE_PATHS.join('\n')}`);
}

async function createCircularFavicon(logoPath, outputPath, size) {
  try {
    // Resize the circular logo to the desired size
    await sharp(logoPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Created ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to create ${path.basename(outputPath)}:`, error.message);
    throw error;
  }
}

async function generateFavicons() {
  console.log('Generating circular favicons...\n');

  try {
    // Find the circular logo
    const logoPath = await findLogoPath();

    // Generate PNG favicons
    for (const { name, size } of SIZES) {
      const outputPath = path.join(OUTPUT_DIR, name);
      await createCircularFavicon(logoPath, outputPath, size);
    }

    console.log('\n✓ All circular favicons generated successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error.message);
    process.exit(1);
  }
}

generateFavicons();
