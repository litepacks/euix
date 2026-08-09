import { execSync } from 'child_process';

console.log(`
=====================================================
          EUIX Release Verification Gate             
=====================================================
`);

const suites = [
  { name: 'Build Bundles', cmd: 'npm run build' },
  { name: 'Unit & Integration', cmd: 'npm test' },
  { name: 'Battle Tests (Property, Fuzz, Chaos, Permutations, Torture)', cmd: 'npm run test:battle' },
  { name: 'Package Artifact Smoke Test', cmd: 'npm run test:package' }
];

let allPassed = true;
const results = [];

for (const suite of suites) {
  console.log(`\n▶ [Executing] ${suite.name}...`);
  try {
    execSync(suite.cmd, { stdio: 'inherit' });
    console.log(`✅ ${suite.name}: PASS`);
    results.push({ name: suite.name, status: 'PASS' });
  } catch (err) {
    console.log(`❌ ${suite.name}: FAIL`);
    results.push({ name: suite.name, status: 'FAIL' });
    allPassed = false;
  }
}

console.log(`
-----------------------------------------------------
                   VERIFICATION SUMMARY              
-----------------------------------------------------
`);

for (const res of results) {
  console.log(`${res.name.padEnd(50, '.')} [ ${res.status} ]`);
}

console.log(`
-----------------------------------------------------
Release Status: ${allPassed ? '🚀 READY FOR RELEASE' : '❌ RELEASE BLOCKED - INVARIANTS FAILED'}
=====================================================
`);

if (!allPassed) {
  process.exit(1);
}
