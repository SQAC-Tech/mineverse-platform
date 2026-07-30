const fs = require('fs');

const colors = [
  '#7BB057', // High light green
  '#71A34D', // Light green
  '#5D8C3E', // Base green
  '#4B7331', // Dark green
  '#3E5C29', // Darkest green
];

let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">';
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    // Better noise distribution for grass
    let noise = Math.abs(Math.sin(x*12.9898 + y*78.233) * 43758.5453);
    let n = noise - Math.floor(noise);
    
    let colorIndex = 2; // base
    if (n < 0.1) colorIndex = 0;
    else if (n < 0.3) colorIndex = 1;
    else if (n < 0.7) colorIndex = 2;
    else if (n < 0.9) colorIndex = 3;
    else colorIndex = 4;
    
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[colorIndex]}"/>`;
  }
}
svg += '</svg>';

fs.writeFileSync('public/grass-block.svg', svg);
console.log('grass-block.svg created successfully');
