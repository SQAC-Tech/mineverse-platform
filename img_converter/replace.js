const fs = require('fs');
const path = require('path');
const glob = require('glob');

const mineverseDir = path.join(__dirname, '../mineverse');
const publicDir = path.join(mineverseDir, 'public');

const webpKeywords = [
    'bg', 'background', 'map', 'sheet', 'event', 'structure', 'cinematic', 'dashboard', 'image', 'tab'
];

// 1. Build a dictionary of replacements
const replacements = {};
const publicFiles = glob.sync('**/*.{png,jpg,jpeg}', { cwd: publicDir });

for (const file of publicFiles) {
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
    
    const newExt = toWebp ? '.webp' : '.svg';
    
    // We want to replace instances of "filename.png" with "filename.webp"
    // Also support paths like "/filename.png" or "filename.png"
    const oldFileName = basename + ext;
    const newFileName = basename + newExt;
    
    replacements[oldFileName] = newFileName;
}

console.log(`Found ${Object.keys(replacements).length} image files to replace in code.`);

// 2. Search and replace in source code
const sourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,css,scss,json,md}', { 
    cwd: mineverseDir, 
    ignore: ['node_modules/**', '.next/**', 'public/**'],
    absolute: true
});

let modifiedFiles = 0;

for (const file of sourceFiles) {
    const originalContent = fs.readFileSync(file, 'utf8');
    let newContent = originalContent;
    
    for (const [oldName, newName] of Object.entries(replacements)) {
        // Create a regex to match the filename exactly, taking care of paths
        // e.g. match "dashboard.png" in "/dashboard.png" or "src='/dashboard.png'"
        // We use string replace with global flag, ensuring it's not a substring of a longer word
        // Since these are file names, simple global replace is usually safe, but let's be careful.
        
        // Escape special characters in oldName just in case (like "assets sheet.png")
        const escapedOldName = oldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(?<=['"\`/\\\\])${escapedOldName}`, 'g');
        
        newContent = newContent.replace(regex, newName);
        
        // Also just in case they are used without prefixes in CSS like url("bg.png")
        const regex2 = new RegExp(`\\b${escapedOldName}\\b`, 'g');
        newContent = newContent.replace(regex2, newName);
    }
    
    if (originalContent !== newContent) {
        fs.writeFileSync(file, newContent);
        console.log(`Updated: ${path.relative(mineverseDir, file)}`);
        modifiedFiles++;
    }
}

console.log(`Finished updating ${modifiedFiles} files.`);
