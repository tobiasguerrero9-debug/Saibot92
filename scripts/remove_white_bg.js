import fs from 'fs';
import { PNG } from 'pngjs';

const inputPath = 'public/mascot_official.png';
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

        // If pure white/near white, make transparent
        if (r > 248 && g > 248 && b > 248) {
          this.data[idx + 3] = 0;
        } else if (r > 235 && g > 235 && b > 235) {
          // Smooth edge alpha transition
          const minVal = Math.min(r, g, b);
          const alpha = Math.max(0, Math.min(255, Math.floor((255 - minVal) * 8)));
          this.data[idx + 3] = alpha;
        }
      }
    }

    this.pack().pipe(fs.createWriteStream(outputPath)).on('finish', () => {
      console.log('Processed official mascot image to', outputPath);
    });
  });
