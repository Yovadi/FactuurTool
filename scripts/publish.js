const { spawn, execSync } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');

// Load .env file explicitly from project root
const envPath = path.resolve(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  }
  console.log('.env file loaded successfully');
} else {
  console.error('.env file not found at:', envPath);
}

let GH_TOKEN = process.env.GH_TOKEN;

console.log('Environment check:');
console.log('- GH_TOKEN exists:', !!GH_TOKEN);

if (!GH_TOKEN) {
  console.error('\nERROR: GH_TOKEN environment variable is not set!');
  console.error('Make sure GH_TOKEN is defined in your .env file.');
  process.exit(1);
}

GH_TOKEN = GH_TOKEN.trim().replace(/[\r\n]/g, '');

console.log('- GH_TOKEN (cleaned):', GH_TOKEN.substring(0, 4) + '****' + GH_TOKEN.substring(GH_TOKEN.length - 4));
console.log('- Token length:', GH_TOKEN.length);

function bumpVersion() {
  const packagePath = path.resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const versionParts = packageJson.version.split('.');
  versionParts[2] = parseInt(versionParts[2]) + 1;
  packageJson.version = versionParts.join('.');

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`Version bumped to ${packageJson.version}`);
  return packageJson.version;
}

function cleanBuildFolders() {
  const projectRoot = path.resolve(__dirname, '..');
  const releasePath = path.join(projectRoot, 'release');
  const distPath = path.join(projectRoot, 'dist');

  console.log('Cleaning build folders...');

  if (fs.existsSync(releasePath)) {
    fs.rmSync(releasePath, { recursive: true, force: true });
    console.log('- Removed release folder');
  }

  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('- Removed dist folder');
  }
}

function runBuild() {
  console.log('\nBuilding project...');
  try {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    console.log('Build completed successfully!\n');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

async function testToken() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'User-Agent': 'electron-builder-publish',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const user = JSON.parse(data);
          console.log('- Token valid! GitHub user:', user.login);
          resolve(true);
        } else {
          console.error('- Token INVALID! Status:', res.statusCode);
          console.error('- Response:', data);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error('- Token test failed:', e.message);
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log('=== HAL5 Facturatie Manager - Automated Publish ===\n');

  console.log('Step 1: Read current version');
  const packagePath = path.resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const newVersion = packageJson.version;
  console.log(`Using version ${newVersion} from package.json`);

  console.log('\nStep 2: Clean old builds');
  cleanBuildFolders();

  console.log('\nStep 3: Build project');
  runBuild();

  console.log('Step 4: Verify GitHub token');
  const tokenValid = await testToken();

  if (!tokenValid) {
    console.error('\nERROR: GitHub token is invalid!');
    console.error('Please check your token at https://github.com/settings/tokens');
    process.exit(1);
  }

  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  process.env.GITHUB_TOKEN = GH_TOKEN;
  process.env.GH_TOKEN = GH_TOKEN;
  process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';

  console.log(`\nStep 5: Publishing version ${newVersion} to GitHub...\n`);

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
    console.log(`\n=== Successfully published version ${newVersion}! ===`);
  });
}

main();
