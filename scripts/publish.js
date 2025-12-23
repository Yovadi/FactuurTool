const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let GH_TOKEN = null;
envContent.split('\n').forEach(line => {
  const match = line.match(/^GH_TOKEN=(.+)$/);
  if (match) {
    GH_TOKEN = match[1].trim();
  }
});

if (!GH_TOKEN) {
  console.error('ERROR: GH_TOKEN is not set in .env file!');
  process.exit(1);
}

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.GH_TOKEN = GH_TOKEN;
process.env.GITHUB_TOKEN = GH_TOKEN;
process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';

console.log('GH_TOKEN is set:', GH_TOKEN.substring(0, 10) + '...');
console.log('GH_TOKEN length:', GH_TOKEN.length);
console.log('Publishing to GitHub...\n');

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
