const jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, 'public');

const imagesToProcess = [
  'code-craft-conquer.png',
  'sqac-presents.png',
  'srmist.png',
  'pigman.png',
  'zombie.png'
];

async function removeWhiteBg(filename) {
  const filePath = path.join(publicDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }

  try {
    const Jimp = jimp.Jimp || jimp.default || jimp;
    const image = await Jimp.read(filePath);
    console.log(`Processing ${filename}...`);

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];

      // A simple threshold for "white"
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0
      }
    });

    await new Promise((resolve, reject) => {
      image.write(filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`Successfully removed background for ${filename}`);
  } catch (err) {
    console.error(`Error processing ${filename}:`, err);
  }
}

async function main() {
  for (const img of imagesToProcess) {
    await removeWhiteBg(img);
  }
}

main();
