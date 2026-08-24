import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  const routes = ['privacy', 'app'];

  routes.forEach((route) => {
    // Create dist/route/index.html
    const routeDir = path.join(distDir, route);
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }
    fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);

    // Create dist/route.html
    fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);

    console.log(`[Postbuild] Generated static entry for /${route}`);
  });
}
