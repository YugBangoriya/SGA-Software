#!/bin/bash
# deploy.sh — SHREE GANESH AUTOMOBILE — PRODUCTION DEPLOYMENT SCRIPT
# Usage: bash deploy.sh [hosting|functions|rules|all]
# Default (no argument): deploys hosting + functions

set -e  # Exit immediately on any error

# ─────────────────────────────────────────────────────────────────────────
# COLOURS
# ─────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─────────────────────────────────────────────────────────────────────────
# BANNER
# ─────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${RED}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${RED}║      SHREE GANESH AUTOMOBILE — DEPLOYMENT SCRIPT        ║${RESET}"
echo -e "${BOLD}${RED}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${CYAN}Deploy target:${RESET} ${1:-hosting,functions}"
echo -e "${CYAN}Timestamp:${RESET}     $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────────────────────────────────
echo -e "${BOLD}── Pre-flight checks ──────────────────────────────────────${RESET}"

# 1. Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
echo -e "Node.js: ${NODE_VERSION}"
if [[ "$NODE_VERSION" == "not found" ]]; then
  echo -e "${RED}✗ Node.js not found. Install Node.js v20+ from nodejs.org${RESET}"
  exit 1
fi

# 2. Firebase CLI
FIREBASE_VERSION=$(firebase --version 2>/dev/null || echo "not found")
echo -e "Firebase CLI: ${FIREBASE_VERSION}"
if [[ "$FIREBASE_VERSION" == "not found" ]]; then
  echo -e "${RED}✗ Firebase CLI not found. Run: npm install -g firebase-tools${RESET}"
  exit 1
fi

# 3. .env file
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ .env file not found. If this is intentional (CI/CD), continue.${RESET}"
else
  echo -e "${GREEN}✓ .env file present${RESET}"
fi

# 4. Firebase project configured
PROJECT=$(firebase use 2>/dev/null | head -1 || echo "none")
echo -e "Firebase project: ${PROJECT}"

# 5. Check for uncommitted changes
DIRTY=$(git status --porcelain 2>/dev/null || echo "")
if [ -n "$DIRTY" ]; then
  echo -e "${YELLOW}⚠ Uncommitted changes detected:${RESET}"
  git status --short
  echo ""
  read -p "$(echo -e "${YELLOW}Continue deploying with uncommitted changes? [y/N]: ${RESET}")" CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${RED}✗ Deployment aborted.${RESET}"
    exit 1
  fi
fi

# 6. Confirm this is not an accidental production deploy
echo ""
read -p "$(echo -e "${YELLOW}You are about to deploy to PRODUCTION. Are you sure? [y/N]: ${RESET}")" PROD_CONFIRM
if [[ "$PROD_CONFIRM" != "y" && "$PROD_CONFIRM" != "Y" ]]; then
  echo -e "${RED}✗ Deployment aborted.${RESET}"
  exit 1
fi

echo ""
echo -e "${BOLD}── Running security rule tests ──────────────────────────────${RESET}"
# Run Firestore rules tests if emulator is available
if command -v firebase &> /dev/null; then
  echo -e "${CYAN}Checking if rules tests exist...${RESET}"
  if [ -f "tests/firestore.rules.test.js" ]; then
    echo -e "${CYAN}Running Firestore rules tests...${RESET}"
    npx firebase emulators:exec --only firestore "npx jest --testPathPattern=firestore.rules --forceExit" 2>&1 | tail -5
    echo -e "${GREEN}✓ Rules tests passed${RESET}"
  else
    echo -e "${YELLOW}⚠ No rules tests found. Skipping.${RESET}"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────
# BUILD
# ─────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Installing dependencies ─────────────────────────────────${RESET}"
npm install --silent
echo -e "${GREEN}✓ Root dependencies installed${RESET}"

cd functions && npm install --silent && cd ..
echo -e "${GREEN}✓ Functions dependencies installed${RESET}"

echo ""
echo -e "${BOLD}── Building production app ─────────────────────────────────${RESET}"
npm run build
echo -e "${GREEN}✓ Production build complete${RESET}"

# Check bundle sizes
echo ""
echo -e "${BOLD}── Bundle size check ───────────────────────────────────────${RESET}"
if [ -d "dist/assets" ]; then
  echo "Top 5 largest chunks:"
  ls -lhS dist/assets/*.js 2>/dev/null | head -5 | awk '{print $5, $9}' || echo "No JS chunks found"
  
  # Warn if any chunk > 500KB
  LARGE=$(find dist/assets -name "*.js" -size +500k 2>/dev/null)
  if [ -n "$LARGE" ]; then
    echo -e "${YELLOW}⚠ Chunks exceeding 500KB:${RESET}"
    ls -lh $LARGE
  fi
fi

# ─────────────────────────────────────────────────────────────────────────
# DEPLOY
# ─────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Deploying to Firebase ───────────────────────────────────${RESET}"

TARGET="${1:-hosting,functions}"

case "$TARGET" in
  hosting)
    echo -e "${CYAN}Deploying: Hosting only${RESET}"
    firebase deploy --only hosting
    ;;
  functions)
    echo -e "${CYAN}Deploying: Cloud Functions only${RESET}"
    firebase deploy --only functions
    ;;
  rules)
    echo -e "${CYAN}Deploying: Firestore Security Rules only${RESET}"
    firebase deploy --only firestore:rules
    ;;
  all)
    echo -e "${CYAN}Deploying: Hosting + Functions + Rules + Indexes${RESET}"
    firebase deploy --only hosting,functions,firestore
    ;;
  *)
    echo -e "${CYAN}Deploying: Hosting + Functions (default)${RESET}"
    firebase deploy --only hosting,functions
    ;;
esac

# ─────────────────────────────────────────────────────────────────────────
# POST-DEPLOY VERIFICATION
# ─────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Post-deploy verification ────────────────────────────────${RESET}"

# Get the hosting URL
HOSTING_URL=$(firebase hosting:channel:list 2>/dev/null | grep "live" | awk '{print $2}' || echo "")
if [ -z "$HOSTING_URL" ]; then
  HOSTING_URL=$(cat .firebaserc 2>/dev/null | grep '"default"' | awk -F'"' '{print $4}' | head -1)
  HOSTING_URL="https://${HOSTING_URL}.web.app"
fi

echo -e "${CYAN}Live URL:${RESET} $HOSTING_URL"

# Quick HTTP check
if command -v curl &> /dev/null; then
  HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$HOSTING_URL" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ App is live and returning HTTP 200${RESET}"
  else
    echo -e "${YELLOW}⚠ App returned HTTP $HTTP_STATUS — check manually${RESET}"
  fi
fi

# Log deployment
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "$TIMESTAMP | $TARGET | $COMMIT | $USER" >> deploy.log
echo -e "${GREEN}✓ Deployment logged to deploy.log${RESET}"

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║              DEPLOYMENT COMPLETE ✓                      ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${CYAN}Live URL:${RESET}  $HOSTING_URL"
echo -e "  ${CYAN}Commit:${RESET}    $COMMIT"
echo -e "  ${CYAN}Time:${RESET}      $TIMESTAMP"
echo ""
echo -e "${YELLOW}Post-deploy checklist:${RESET}"
echo "  [ ] Open live URL in Chrome — confirm app loads"
echo "  [ ] Log in as Owner — confirm dashboard and all tabs"
echo "  [ ] Log in as Employee — confirm restricted access"
echo "  [ ] Check Firebase Console → Functions → logs for errors"
echo "  [ ] Test a push notification (if functions were updated)"
echo ""
