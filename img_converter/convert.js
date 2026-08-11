const fs = require('fs');
const path = require('path');
const glob = require('glob');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '../mineverse/public');

const webpKeywords = [
    'bg', 'background', 'map', 'sheet', 'event', 'structure', 'cinematic', 'dashboard', 'image', 'tab'
];

async function convertImages() {
    const files = glob.sync('**/*.{png,jpg,jpeg}', { cwd: publicDir, absolute: true });
    
    for (const file of files) {
        const basename = path.basename(file, path.extname(file));
        const ext = path.extname(file).toLowerCase();
        
        let toWebp = false;
        const lowerName = basename.toLowerCase();
        
        for (const kw of webpKeywords) {
            if (lowerName.includes(kw)) {
                toWebp = true;
                break;
            }
        }
        
        if (lowerName === 'assets sheet') toWebp = true;
        if (lowerName.includes('guardian')) toWebp = true;
        
        if (toWebp) {
            console.log(`Converting to WebP: ${basename}${ext}`);
            const outPath = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
            try {
                await sharp(file)
                    .webp({ quality: 80 })
                    .toFile(outPath);
            } catch (err) {
                console.error(`Failed WebP: ${file}`, err);
            }
        } else {
            console.log(`Converting to SVG: ${basename}${ext}`);
            const outPath = file.replace(/\.(png|jpg|jpeg)$/i, '.svg');
            
            try {
                // Get image dimensions using sharp
                const metadata = await sharp(file).metadata();
                const width = metadata.width;
                const height = metadata.height;
                
                // Read file as base64
                const base64Data = fs.readFileSync(file).toString('base64');
                const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                
                const svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <image href="data:${mimeType};base64,${base64Data}" width="${width}" height="${height}" />
</svg>`;
                
                fs.writeFileSync(outPath, svgContent);
                console.log(`Saved SVG: ${outPath}`);
            } catch (err) {
                console.error(`Failed SVG: ${file}`, err);
            }
        }
    }
}

convertImages();
