import fs from 'fs';
import { PNG } from 'pngjs';

// Input is the EXACT original user-uploaded mascot image file
const inputPath = 'C:\\Users\\tobia\\.gemini\\antigravity\\brain\\12f79b04-8ff8-4646-a19b-30c6a4a5e157\\.user_uploaded\\media__1785192831690.png';
const outputPath = 'public/mascot_transparent.png';

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        // Remove pure black background pixels without altering mascot colors
        const maxVal = Math.max(r, g, b);

        if (maxVal < 15) {
          // Pure black background -> transparent
          this.data[idx + 3] = 0;
        } else if (maxVal < 60 && r > g && b > g) {
          // Soft edge alpha transition for dark purple glow near edges
          const alpha = Math.min(255, Math.floor((maxVal - 10) * 5.1));
          this.data[idx + 3] = alpha;
        }
        // Mascot pixels remain 100% untouched!
      }
    }

    this.pack().pipe(fs.createWriteStream(outputPath)).on('finish', () => {
      console.log('Original mascot processed cleanly to', outputPath);
    });
  });
