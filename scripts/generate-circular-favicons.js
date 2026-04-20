#!/usr/bin/env node

/**
 * Generate circular favicons from the Noobly JS logo
 * Creates favicon.ico, favicon-16x16.png, favicon-32x32.png, and apple-touch-icon.png
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const LOGO_PATH = path.join(__dirname, '../public/images/nooblyjs-logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public');

// Favicon sizes to generate
const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function createCircularMask(size) {
  // Create a white circle on transparent background
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
    </svg>
  `;
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function createCircularFavicon(logoPath, outputPath, size) {
  try {
    // Resize the logo to fit the size
    const resizedLogo = await sharp(logoPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    // Create a circular mask
    const mask = await createCircularMask(size);

    // Create the final favicon by compositing the logo with the circular mask
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      }
    })
      .composite([
        {
          input: resizedLogo,
          top: 0,
          left: 0
        },
        {
          input: mask,
          top: 0,
          left: 0,
          blend: 'dest-in' // Apply mask: only keep where mask is white
        }
      ])
      .png()
      .toFile(outputPath);

    console.log(`✓ Created ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to create ${path.basename(outputPath)}:`, error.message);
    throw error;
  }
}

async function generateFavicons() {
  console.log('Generating circular favicons with transparent backgrounds...\n');

  try {
    // Generate PNG favicons with transparency
    for (const { name, size } of SIZES) {
      const outputPath = path.join(OUTPUT_DIR, name);
      await createCircularFavicon(LOGO_PATH, outputPath, size);
    }

    console.log('\n✓ All circular favicons generated successfully!');
    console.log('✓ Favicons now have transparent corners for true circular appearance');
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
