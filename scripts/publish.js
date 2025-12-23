const { spawn } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.error('\n❌ ERROR: GH_TOKEN environment variable is not set!');
  console.error('\nPlease set it using ONE of these methods:');
  console.error('  1. Add GH_TOKEN=your_token to the .env file in project root');
  console.error('  2. Set it as system environment variable:');
  console.error('     Windows: $env:GH_TOKEN="your_token"');
  console.error('     Linux/Mac: export GH_TOKEN="your_token"');
  console.error('  3. Run: set GH_TOKEN=your_token && npm run electron:publish\n');
  process.exit(1);
}

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.GITHUB_TOKEN = GH_TOKEN;
process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';

console.log('✓ GH_TOKEN is set:', GH_TOKEN.substring(0, 10) + '...');
console.log('✓ Token length:', GH_TOKEN.length);
console.log('📦 Publishing to GitHub...\n');

const buildProcess = spawn('npx', ['electron-builder', '--win', '--publish', 'always', '--config', 'electron-builder.json'], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: true
});

buildProcess.on('error', (error) => {
  console.error('Build process error:', error);
  process.exit(1);
});

buildProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error('Build failed with code:', code);
    process.exit(code);
  }
  console.log('Build completed successfully!');
});
