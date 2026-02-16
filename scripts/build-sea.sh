#!/bin/bash
set -euo pipefail

# Build a standalone executable using Node.js SEA (Single Executable Application)
# Requires Node.js >= 20

echo "Building seedorm standalone executable..."

# Build first
npm run build

# Create SEA config
cat > sea-config.json << 'EOF'
{
  "main": "dist/bin/seedorm.cjs",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF

# Generate blob
node --experimental-sea-config sea-config.json

# Copy node binary
cp "$(which node)" seedorm

# Remove signature (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  codesign --remove-signature seedorm
fi

# Inject blob
npx postject seedorm NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Re-sign (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  codesign --sign - seedorm
fi

# Cleanup
rm -f sea-config.json sea-prep.blob

echo "Built: ./seedorm"
ls -lh seedorm
