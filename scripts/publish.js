const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

if (!process.env.GH_TOKEN) {
  console.error('ERROR: GH_TOKEN is not set in .env file!');
  process.exit(1);
}

console.log('GH_TOKEN is set:', process.env.GH_TOKEN.substring(0, 10) + '...');
console.log('Publishing to GitHub...\n');

try {
  execSync('npx electron-builder --win --publish always --config electron-builder.json', {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..')
  });
} catch (error) {
  process.exit(1);
}
