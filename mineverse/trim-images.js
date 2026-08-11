const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

const imagesToProcess = [
  'code-craft-conquer.svg',
  'sqac-presents.svg',
  'srmist.svg',
  'pigman.svg',
  'zombie.svg',
  'contactus.svg'
];

async function trimImage(filename) {
  const filePath = path.join(publicDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }

  const tempPath = path.join(publicDir, `temp-${filename}`);

  try {
    console.log(`Trimming ${filename}...`);
    // Trim removes transparent pixels from the edges automatically
    await sharp(filePath)
      .trim()
      .toFile(tempPath);
    
    // Replace original file with the trimmed version
    fs.renameSync(tempPath, filePath);
    console.log(`Successfully trimmed ${filename}`);
  } catch (err) {
    console.error(`Error processing ${filename}:`, err);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

async function main() {
  for (const img of imagesToProcess) {
    await trimImage(img);
  }
}

main();
