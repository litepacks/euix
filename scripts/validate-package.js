import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== EUIX Package Artifact Validation ===');

const rootDir = process.cwd();
const scratchDir = path.join(rootDir, 'scratch', 'package_smoke');

try {
  // 1. Build project first
  console.log('[1/4] Building release bundles...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Run npm pack
  console.log('[2/4] Executing npm pack...');
  const packOutput = execSync('npm pack', { encoding: 'utf-8' }).trim();
  const tarballName = packOutput.split('\n').pop();
  const tarballPath = path.join(rootDir, tarballName);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Package tarball not found at: ${tarballPath}`);
  }
  console.log(`Created tarball: ${tarballName}`);

  // 3. Extract to scratch directory
  console.log('[3/4] Extracting tarball for smoke testing...');
  if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
  fs.mkdirSync(scratchDir, { recursive: true });

  execSync(`tar -xzf "${tarballPath}" -C "${scratchDir}"`, { stdio: 'inherit' });
  const extractedPackageDir = path.join(scratchDir, 'package');

  // 4. Verify package exports and files
  console.log('[4/4] Verifying exported bundle files...');
  const packageJson = JSON.parse(fs.readFileSync(path.join(extractedPackageDir, 'package.json'), 'utf-8'));
  
  const expectedFiles = [
    'dist/EUIXEngine.umd.js',
    'dist/EUIXEngine.es.js',
    'dist/EUIXEngineCore.umd.js',
    'dist/EUIXEngineCore.es.js',
    'dist/EUIXDevTools.es.js',
    'dist/EUIXDevTools.umd.js',
    'dist/plugins/EUIXApiPlugin.es.js',
    'dist/plugins/EUIXResiliencePlugin.es.js',
    'dist/plugins/EUIXReactivePlugin.es.js',
    'dist/plugins/EUIXComposerPlugin.es.js',
    'dist/plugins/EUIXAnimationPlugin.es.js',
    'dist/plugins/EUIXRouterPlugin.es.js',
    'dist/plugins/EUIXLeafletPlugin.es.js',
    'dist/plugins/EUIXNavigatorPlugin.es.js',
    'dist/plugins/EUIXHeadPlugin.es.js',
    'dist/plugins/EUIXDialogPlugin.es.js',
    'dist/plugins/EUIXDragDropPlugin.es.js',
    'dist/plugins/EUIXStoragePlugin.es.js',
    'dist/plugins/EUIXCollapsePlugin.es.js',
    'dist/plugins/EUIXChartPlugin.es.js'
  ];

  for (const relFile of expectedFiles) {
    const fullPath = path.join(extractedPackageDir, relFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing expected release file in tarball: ${relFile}`);
    }
  }

  // Cleanup tarball and scratch directory
  fs.unlinkSync(tarballPath);
  fs.rmSync(scratchDir, { recursive: true, force: true });

  console.log('✅ PACKAGE SMOKE TEST PASSED: All exports and bundles are intact!\n');
} catch (err) {
  console.error('❌ PACKAGE SMOKE TEST FAILED:', err.message);
  process.exit(1);
}
