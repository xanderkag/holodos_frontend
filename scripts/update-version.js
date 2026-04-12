import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const versionTsPath = path.resolve(__dirname, '../src/constants/version.ts');
const buildGradlePath = path.resolve(__dirname, '../android/app/build.gradle');
const pbxprojPath = path.resolve(__dirname, '../ios/App/App.xcodeproj/project.pbxproj');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  const buildTime = new Date().toLocaleString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 1. Update Version Constants
  const content = `
// This file is auto-generated during build. Do not edit manually.
export const APP_VERSION = '${version}';
export const BUILD_TIME = '${buildTime}';
`;

  const dir = path.dirname(versionTsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(versionTsPath, content.trim() + '\n');
  console.log(`✅ Web version updated to ${version}`);

  // 2. Update Android Version (build.gradle)
  if (fs.existsSync(buildGradlePath)) {
    let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Calculate unique versionCode: 2.92.11 -> 29211
    const vParts = version.split('.').map(p => parseInt(p, 10));
    const versionCode = vParts[0] * 10000 + vParts[1] * 100 + vParts[2];

    gradleContent = gradleContent.replace(/versionCode \d+/g, `versionCode ${versionCode}`);
    gradleContent = gradleContent.replace(/versionName "[^"]+"/g, `versionName "${version}"`);
    
    fs.writeFileSync(buildGradlePath, gradleContent);
    console.log(`🤖 Android version updated: ${version} (Code: ${versionCode})`);
  }

  // 3. Update iOS Version (pbxproj)
  if (fs.existsSync(pbxprojPath)) {
    let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
    
    // Replace all occurrences of MARKETING_VERSION
    pbxContent = pbxContent.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
    
    fs.writeFileSync(pbxprojPath, pbxContent);
    console.log(`🍎 iOS version sync completed: ${version}`);
  }

} catch (error) {
  console.error('❌ Failed to update version:', error);
  process.exit(1);
}

