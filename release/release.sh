#!/usr/bin/env bash
set -e
export HOME="$HOME"

cd "$(dirname "$0")/.."   # go to project root

# -------------------------
# HELP
# -------------------------
show_help() {
  cat <<EOF
Usage: ./release.sh [OPTIONS]

Options:
  -dry                 Perform a dry run (skip Butler uploads & version bump)
  --ask                Prompt to select version bump (patch, minor, major)
  --version=X.Y.Z      Override version bump (manual)
  --platform=PLATFORM  Build only specified platform (linux, win)
  -h, -?               Show this help message

Examples:
    npm run release -- -h
    npm run release -- -dry
    npm run release -- --ask
    npm run release -- --version=1.5.4
    npm run release -- --platform=win
EOF
  exit 0
}

# -------------------------
# PARSE ARGUMENTS
# -------------------------
DRY_RUN=false
VERSION_OVERRIDE=""
BUMP="patch"
PLATFORM="all"

for arg in "$@"; do
  case "$arg" in
    -h|--help|-\?) show_help ;;
    -dry) DRY_RUN=true ;;
    --ask) BUMP="ask" ;;
    --version=*) VERSION_OVERRIDE="${arg#*=}" ;;
    --platform=*) PLATFORM="${arg#*=}" ;;
  esac
done

# -------------------------
# LOAD ENV
# -------------------------
if [[ -f .env ]]; then
  export $(grep -v '^#' .env | xargs)
fi

if [[ -z "$ITCH_TARGET" ]]; then
  echo "❌ ITCH_TARGET not set. Put it in .env"
  exit 1
fi

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
# BUILD
# -------------------------
echo "🏗 Building"

case "$PLATFORM" in
  linux) npm run build ;;
  win) npm run build:win64 ;;
  all) npm run build ;;
  *) echo "❌ Unknown platform '$PLATFORM'"; exit 1 ;;
esac

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

CURRENT_VERSION=$(node -p "require('./package.json').version")
APPIMAGE="dist/MitarbeiterKalenderApp-${CURRENT_VERSION}.AppImage"
DEB="dist/mitarbeiterkalender_${CURRENT_VERSION}_amd64.deb"
WIN_FILE=$(find dist -type f -name "*nsis*.exe" | head -n 1)

check_size "$APPIMAGE" 130 "Linux AppImage"
check_size "$DEB" 130 "Linux deb"
if [[ -n "$WIN_FILE" ]]; then
  check_size "$WIN_FILE" 130 "Windows installer"
else
  echo "ℹ️ Windows build not present"
fi

# -------------------------
# VERSION BUMP (after successful build)
# -------------------------
if ! $DRY_RUN; then
  if [[ -n "$VERSION_OVERRIDE" ]]; then
    echo "🔢 Using manual version: $VERSION_OVERRIDE"
    npm version "$VERSION_OVERRIDE" --no-git-tag-version
  elif [[ "$BUMP" == "ask" ]]; then
    echo "Select version bump:"
    select opt in patch minor major; do
      BUMP=$opt
      break
    done
    echo "🔢 Version bump: $BUMP"
    npm version $BUMP
  else
    echo "🔢 Version bump: $BUMP"
    npm version $BUMP
  fi
fi

VERSION=$(node -p "require('./package.json').version")
echo "🏷 Version: $VERSION"

# -------------------------
# UPLOAD FUNCTION
# -------------------------
upload () {
  LABEL=$1       # e.g., "Windows"
  FILES=$2       # glob pattern of files to upload
  CHANNEL=$3     # itch.io channel: win / linux / linux-deb

  if compgen -G "$FILES" > /dev/null; then
    echo "🚀 Upload $LABEL → $CHANNEL"

    if ! $DRY_RUN; then
      # Delete previous builds for this channel
      echo "🗑️ Deleting old $LABEL builds on channel $CHANNEL"
      butler push --delete $FILES "$ITCH_TARGET:$CHANNEL" --userversion "$VERSION"

      # Upload the new files
      echo "📤 Uploading $LABEL build(s)"
      butler push $FILES "$ITCH_TARGET:$CHANNEL" --userversion "$VERSION"
    else
      echo "🧪 Dry run – skipping upload of $LABEL"
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
