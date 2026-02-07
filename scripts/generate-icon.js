const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

(async () => {
  try {
    const cwd = process.cwd();
    const src = path.join(cwd, 'dist', 'app-portal.png');
    const outDir = path.join(cwd, 'public');
    const out = path.join(outDir, 'icon.ico');

    if (!fs.existsSync(src)) {
      console.error('Source PNG not found:', src);
      process.exit(1);
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const buf = await pngToIco(src);
    fs.writeFileSync(out, buf);
    console.log('Wrote icon:', out);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
