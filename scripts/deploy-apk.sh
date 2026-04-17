#!/bin/bash
set -e

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
BRANCH="apk-release"

if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at $APK_PATH."
    echo "Please build the Android app first using: npm run build:android"
    exit 1
fi

echo "🚀 Deploying APK to $BRANCH branch..."

# Store the remote URL and current commit hash
REMOTE_URL=$(git config --get remote.origin.url)
COMMIT_HASH=$(git rev-parse --short HEAD)

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
cp "$APK_PATH" "$TEMP_DIR/holodos.apk"

# Navigate to the temp directory and initialize a clean repo
cd "$TEMP_DIR"
git init
git checkout -b "$BRANCH"
git add holodos.apk
git commit -m "chore(release): upload compiled APK for commit $COMMIT_HASH"
git push -f "$REMOTE_URL" "$BRANCH"

# Clean up
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "✅ APK successfully pushed to branch $BRANCH!"
echo "🔗 Download link: https://raw.githubusercontent.com/xanderkag/holodos_frontend/apk-release/holodos.apk"
