#!/usr/bin/env bash
set -e
export HOME="$HOME"

cd "$(dirname "$0")/.."   # go to project root


show_help() {
  cat <<EOF
Usage: ./release.sh [OPTIONS]

Options:
  -dry           Perform a dry run (skip Butler uploads)
  --ask          Prompt to select version bump (patch, minor, major)
  --version=X.Y.Z  Override version bump with specific version
  --platform=PLATFORM  Build only the specified platform (linux, win)
  -h, -?         Show this help message

Examples:
  ./release.sh             # normal release
  ./release.sh -dry        # dry run
  ./release.sh --ask       # choose version bump type
  ./release.sh --platform=linux --version=1.5.4
EOF
  exit 0
}

# Handle help
for arg in "$@"; do
  case "$arg" in
    -h|--help|-\?) show_help ;;
    -v|--version) echo "Release script version 1.0.0"; exit 0 ;;
  esac
done


# -------------------------
# LOAD ENV
# -------------------------
if [[ -f .env ]]; then
  export $(grep -v '^#' .env | xargs)
fi

ITCH_TARGET="${ITCH_TARGET}"

if [[ -z "$ITCH_TARGET" ]]; then
  echo "❌ ITCH_TARGET not set. Put it in .env"
  exit 1
fi

# -------------------------
# DRY RUN MODE
# -------------------------
DRY_RUN=false
[[ "$1" == "-dry" ]] && DRY_RUN=true

# -------------------------
# CHECK BUTLER LOGIN
# -------------------------

if ! butler push --dry-run /dev/null "$ITCH_TARGET" 2>/dev/null; then
    echo "❌ Not logged into butler. Run: butler login"
    exit 1
fi

# -------------------------
# GIT CLEAN CHECK
# -------------------------
echo "🔍 Git clean check"
[ -z "$(git status --porcelain)" ] || { echo "❌ Git not clean"; exit 1; }

echo "📡 Pull latest"
git pull

# -------------------------
# VERSION BUMP
# -------------------------
CURRENT_VERSION=$(node -p "require('./package.json').version")

if $DRY_RUN; then
  echo "🧪 Dry run – keeping version $CURRENT_VERSION"
  VERSION="$CURRENT_VERSION"
else
  echo "🔢 Version bump: $BUMP"
  npm version $BUMP
  VERSION=$(node -p "require('./package.json').version")
fi

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

APPIMAGE="dist/MitarbeiterKalenderApp-${VERSION}.AppImage"
DEB="dist/mitarbeiterkalender_${VERSION}_amd64.deb"
WIN_FILE=$(find dist -type f -name "*nsis*.exe" | head -n 1)

check_size "$APPIMAGE" 130 "Linux AppImage"
check_size "$DEB" 130 "Linux deb"

if [[ -n "$WIN_FILE" ]]; then
  check_size "$WIN_FILE" 130 "Windows installer"
else
  echo "ℹ️ Windows build not present"
fi

# -------------------------
# UPLOAD FUNCTION
# -------------------------
upload () {
  LABEL=$1
  FILES=$2
  CHANNEL=$3

  if compgen -G "$FILES" > /dev/null; then
    echo "🚀 Upload $LABEL → $CHANNEL"

    if ! $DRY_RUN; then
      butler push $FILES "$ITCH_TARGET:$CHANNEL" --userversion "$VERSION"
    else
      echo "🧪 Dry run – skipping upload"
    fi
  else
    echo "ℹ️ Nothing to upload for $LABEL"
  fi
}

# -------------------------
# UPLOADS
# -------------------------
upload "Windows" "dist/*nsis*.exe" "win"
upload "Linux AppImage" "dist/*.AppImage" "linux"
upload "Linux deb" "dist/*.deb" "linux-deb"

echo "✅ Release finished"

if ! $DRY_RUN; then
  echo "📤 Now run: git push --follow-tags"
else
  echo "🧪 Dry run complete – nothing was uploaded"
fi
