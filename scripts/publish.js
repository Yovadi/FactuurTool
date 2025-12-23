const { spawn } = require('child_process');
const path = require('path');

const GH_TOKEN = process.env.GH_TOKEN;

console.log('Environment check:');
console.log('- GH_TOKEN exists:', !!GH_TOKEN);

if (!GH_TOKEN) {
  console.error('\nERROR: GH_TOKEN environment variable is not set!');
  console.error('Make sure GH_TOKEN is defined in your .env file.');
  process.exit(1);
}

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.GITHUB_TOKEN = GH_TOKEN;
process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';

console.log('- GH_TOKEN:', GH_TOKEN.substring(0, 10) + '...');
console.log('- Token length:', GH_TOKEN.length);
console.log('\nPublishing to GitHub...\n');

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
