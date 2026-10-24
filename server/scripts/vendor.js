// Keep browser dependencies local and reproducible from package-lock.json.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const target = path.join(root, '../client/public/vendor');
fs.mkdirSync(target, { recursive: true });
const assets = [
  ['chart.js', 'dist/chart.umd.js', 'chart.umd.js'],
  ['chart.js', 'LICENSE.md', 'chart.LICENSE.md'],
  ['flatpickr', 'dist/flatpickr.min.js', 'flatpickr.min.js'],
  ['flatpickr', 'dist/flatpickr.min.css', 'flatpickr.min.css'],
  ['flatpickr', 'LICENSE.md', 'flatpickr.LICENSE.md']
];
const manifest = [];
for (const [name, source, destination] of assets) {
  const packageDir = path.join(root, 'node_modules', name);
  const bytes = fs.readFileSync(path.join(packageDir, source));
  fs.writeFileSync(path.join(target, destination), bytes);
  manifest.push({ file: destination, package: name, version: JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Local browser assets synchronized from locked dependencies.');
