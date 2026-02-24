#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."   # go to project root

ITCH_TARGET="youritchuser/mitarbeiterkalender"

echo "🔍 Git clean check"
[ -z "$(git status --porcelain)" ] || { echo "❌ Git not clean"; exit 1; }

echo "📡 Pull latest"
git pull

# -------------------------
# VERSION BUMP
# -------------------------

BUMP="patch"

if [[ "$1" == "--ask" ]]; then
  echo "Select version bump:"
  select opt in patch minor major; do
    BUMP=$opt
    break
  done
fi

echo "🔢 Version bump: $BUMP"
npm version $BUMP

VERSION=$(node -p "require('./package.json').version")
echo "🏷 Version: $VERSION"

# -------------------------
# BUILD
# -------------------------

echo "🏗 Building"
npm run build

# -------------------------
# SIZE CHECK
# -------------------------

echo "📦 Checking artifact size"

ARTIFACT=$(find dist -type f \( -name "*.exe" -o -name "*.AppImage" \) | head -n 1)

if [[ -z "$ARTIFACT" ]]; then
  echo "❌ No build artifact found"
  exit 1
fi

SIZE=$(du -m "$ARTIFACT" | cut -f1)
echo "Size: ${SIZE} MB"

if (( SIZE > 110 )); then
  echo "❌ Build too large"
  exit 1
fi

if (( SIZE < 75 )); then
  echo "❌ Build too small"
  exit 1
fi

# -------------------------
# UPLOAD
# -------------------------

echo "🚀 Upload Windows"
butler push "dist/*nsis*.exe" $ITCH_TARGET:win --userversion $VERSION

echo "🚀 Upload Linux AppImage"
butler push "dist/*.AppImage" $ITCH_TARGET:linux --userversion $VERSION

echo "🚀 Upload Linux deb"
butler push "dist/*.deb" $ITCH_TARGET:linux-deb --userversion $VERSION

echo "✅ Release finished"
echo "📤 Now run: git push --follow-tags"
