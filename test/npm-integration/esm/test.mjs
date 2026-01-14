/**
 * ESM Import Integration Test
 *
 * Verifies that the built package can be imported correctly in ESM environment.
 */

import assert from 'node:assert';

console.log('Testing ESM imports...\n');

// Test 1: Main entry point
console.log('1. Testing main entry point (type-git)...');
const main = await import('type-git');
assert(main.createGit, 'createGit should be exported from main entry');
assert(typeof main.createGit === 'function', 'createGit should be a function');
console.log('   ✓ Main entry point works');

// Test 2: Node adapter entry point
console.log('2. Testing Node adapter (type-git/node)...');
const node = await import('type-git/node');
assert(node.TypeGit, 'TypeGit should be exported from node entry');
assert(node.createNodeAdapters, 'createNodeAdapters should be exported from node entry');
assert(typeof node.TypeGit === 'function', 'TypeGit should be a constructor');
assert(typeof node.createNodeAdapters === 'function', 'createNodeAdapters should be a function');
console.log('   ✓ Node adapter entry point works');

// Test 3: Bun adapter entry point
console.log('3. Testing Bun adapter (type-git/bun)...');
const bun = await import('type-git/bun');
assert(bun.createBunAdapters, 'createBunAdapters should be exported from bun entry');
assert(typeof bun.createBunAdapters === 'function', 'createBunAdapters should be a function');
console.log('   ✓ Bun adapter entry point works');

// Test 4: Deno adapter entry point
console.log('4. Testing Deno adapter (type-git/deno)...');
const deno = await import('type-git/deno');
assert(deno.createDenoAdapters, 'createDenoAdapters should be exported from deno entry');
assert(typeof deno.createDenoAdapters === 'function', 'createDenoAdapters should be a function');
console.log('   ✓ Deno adapter entry point works');

// Test 5: Runtime test - actually use the library
console.log('5. Testing runtime functionality...');
const git = new node.TypeGit();
const version = await git.version();
assert(version, 'version() should return a string');
assert(version.match(/^\d+\.\d+/), 'version should be in semver format');
console.log(`   ✓ Runtime works (Git version: ${version})`);

console.log('\n✓ All ESM integration tests passed!\n');
