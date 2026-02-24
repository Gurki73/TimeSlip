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

echo "📦 Checking artifact sizes"

check_size () {
  FILE=$1
  MAX=$2
  LABEL=$3

  if [[ -f "$FILE" ]]; then
    SIZE=$(du -m "$FILE" | cut -f1)
    echo "📏 $LABEL size: ${SIZE} MB (limit ${MAX} MB)"

    if (( SIZE > MAX )); then
      echo "❌ $LABEL too large"
      exit 1
    fi

    if (( SIZE < 50 )); then
      echo "❌ $LABEL suspiciously small"
      exit 1
    fi
  else
    echo "ℹ️ $LABEL not built"
  fi
}

# ---- Linux ----
check_size "dist/MitarbeiterKalenderApp-${VERSION}.AppImage" 240 "Linux AppImage"
check_size "dist/mitarbeiterkalender_${VERSION}_amd64.deb" 180 "Linux deb"

# ---- Windows ----
WIN_FILE=$(find dist -type f -name "*nsis*.exe" | head -n 1)
if [[ -n "$WIN_FILE" ]]; then
  check_size "$WIN_FILE" 220 "Windows installer"
else
  echo "ℹ️ Windows build not present"
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
