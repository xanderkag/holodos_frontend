#!/usr/bin/env node
// scripts/patch-google-auth.js
// Patches @codetrix-studio/capacitor-google-auth's build.gradle
// to replace deprecated jcenter() with mavenCentral() for Gradle 9+ compatibility.
// Runs automatically via postinstall.

const fs = require('fs');
const path = require('path');

const gradleFile = path.resolve(
  __dirname,
  '../node_modules/@codetrix-studio/capacitor-google-auth/android/build.gradle'
);

if (!fs.existsSync(gradleFile)) {
  console.log('patch-google-auth: build.gradle not found, skipping patch.');
  process.exit(0);
}

const original = fs.readFileSync(gradleFile, 'utf8');

let patched = original;
let changed = false;

if (patched.includes('jcenter()')) {
  patched = patched.replace(/jcenter\(\)/g, 'mavenCentral()');
  changed = true;
  console.log('✅ patch-google-auth: replaced jcenter() with mavenCentral()');
}

if (patched.includes("proguard-android.txt'")) {
  patched = patched.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
  changed = true;
  console.log('✅ patch-google-auth: replaced proguard-android.txt with proguard-android-optimize.txt');
}

if (!changed) {
  console.log('patch-google-auth: already patched, nothing to do.');
  process.exit(0);
}

fs.writeFileSync(gradleFile, patched, 'utf8');
