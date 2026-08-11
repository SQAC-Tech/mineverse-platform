const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '../mineverse/public');

async function convertVideos() {
    const files = glob.sync('**/*.mp4', { cwd: publicDir, absolute: true });
    
    for (const file of files) {
        const basename = path.basename(file, path.extname(file));
        const outPath = file.replace(/\.mp4$/i, '.gif');
        
        console.log(`Converting to GIF: ${basename}.mp4`);
        
        try {
            // Use ffmpeg with a palette for high quality GIFs
            // We scale to a max width of 1024 to keep file size somewhat manageable, 
            // and fps to 15.
            const cmd = `ffmpeg -y -i "${file}" -vf "fps=15,scale='min(1024,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${outPath}"`;
            execSync(cmd, { stdio: 'inherit' });
            
            console.log(`Successfully converted ${basename}.mp4 to GIF.`);
        } catch (err) {
            console.error(`Failed to convert ${basename}.mp4 to GIF`, err);
        }
    }
}

convertVideos();
