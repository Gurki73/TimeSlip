#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

# -------------------------
# HELP
# -------------------------
show_help() {
cat <<EOF
Usage: npm run release -- [options]

-dry                 Dry run (no version bump, no upload)
--ask                Ask for version bump
--version=X.Y.Z      Set version manually
--platform=win|linux Build only one platform
-h                   Help
EOF
exit 0
}

# -------------------------
# DEFAULTS
# -------------------------
DRY_RUN=false
BUMP="patch"
VERSION_OVERRIDE=""
PLATFORM="all"

# -------------------------
# ARGS
# -------------------------
for arg in "$@"; do
  case "$arg" in
    -h|--help) show_help ;;
    -dry) DRY_RUN=true ;;
    --ask) BUMP="ask" ;;
    --version=*) VERSION_OVERRIDE="${arg#*=}" ;;
    --platform=*) PLATFORM="${arg#*=}" ;;
  esac
done

# -------------------------
# ENV
# -------------------------
[[ -f .env ]] && export $(grep -v '^#' .env | xargs)
: "${ITCH_TARGET:?❌ ITCH_TARGET not set}"

# -------------------------
# CHECK BUTLER
# -------------------------
butler push --dry-run /dev/null "$ITCH_TARGET" &>/dev/null || {
  echo "❌ butler not logged in"
  exit 1
}

# -------------------------
# GIT
# -------------------------
echo "🔍 Git clean check"
[ -z "$(git status --porcelain)" ] || { echo "❌ Git not clean"; exit 1; }
git pull

# -------------------------
# VERSION
# -------------------------
if ! $DRY_RUN; then
  if [[ -n "$VERSION_OVERRIDE" ]]; then
    npm version "$VERSION_OVERRIDE"
  elif [[ "$BUMP" == "ask" ]]; then
    select opt in patch minor major; do npm version $opt; break; done
  else
    npm version $BUMP
  fi
fi

VERSION=$(node -p "require('./package.json').version")
echo "🏷 Version: $VERSION"

# -------------------------
# CLEAN
# -------------------------
echo "🧹 Cleaning dist"
rm -rf dist

# -------------------------
# BUILD
# -------------------------
echo "🏗 Building"

case "$PLATFORM" in
  win) npm run build:win64 ;;
  linux) npm run build ;;
  all)
    npm run build:win64
    npm run build
    ;;
  *) echo "❌ Unknown platform"; exit 1 ;;
esac

echo "📦 Files in dist:"
ls -lh dist || echo "dist folder missing"

# -------------------------
# SIZE CHECK
# -------------------------
check_size () {
  FILE=$1
  MAX=$2
  LABEL=$3

  if [[ -f "$FILE" ]]; then
    SIZE=$(du -m "$FILE" | cut -f1)
    echo "📏 $LABEL: ${SIZE} MB"
    (( SIZE > MAX )) && { echo "❌ too large"; exit 1; }
    (( SIZE < 50 )) && { echo "❌ suspiciously small"; exit 1; }
  else
    echo "ℹ️ $LABEL not built"
  fi
}

APPIMAGE="dist/MitarbeiterKalenderApp-${VERSION}.AppImage"
DEB="dist/mitarbeiterkalender_${VERSION}_amd64.deb"
WIN_FILE=$(find dist -iname "*.exe" | head -n 1)

echo "🪟 Windows installer detected: $WIN_FILE"

check_size "$APPIMAGE" 130 "AppImage"
check_size "$DEB" 130 "deb"
[[ -n "$WIN_FILE" ]] && check_size "$WIN_FILE" 130 "Windows"

# -------------------------
# UPLOAD
# -------------------------
upload () {
  LABEL=$1
  FILES=$2
  CHANNEL=$3

  echo "🔎 Checking $LABEL files: $FILES"

  if compgen -G "$FILES" > /dev/null; then
    echo "🚀 $LABEL → $CHANNEL"
    $DRY_RUN || butler push $FILES "$ITCH_TARGET:$CHANNEL" --userversion "$VERSION"
  else
    echo "ℹ️ No $LABEL files found"
  fi
}

[[ "$PLATFORM" != "linux" ]] && upload "Windows" "dist/*.exe" "win"
[[ "$PLATFORM" != "win"   ]] && upload "AppImage" "dist/*.AppImage" "linux"
[[ "$PLATFORM" != "win"   ]] && upload "deb" "dist/*.deb" "linux-deb"

echo "✅ Done"
$DRY_RUN || echo "📤 git push --follow-tags"
