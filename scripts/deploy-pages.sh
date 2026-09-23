#!/usr/bin/env bash
# ==============================================================================
# EasyOAuth Cloudflare Pages Automated Deployment Script
# ==============================================================================
# This script automates deploying easy-oauth-worker to Cloudflare Pages:
# 1. Environment pre-flight check (Node, pnpm, Wrangler, Cloudflare Auth)
# 2. Quality gate verification (TypeScript typecheck & Vitest test suite)
# 3. D1 database migration & optional seeding
# 4. Cloudflare Pages project initialization with nodejs_compat
# 5. Secrets synchronization (SESSION_SECRET, OIDC_SIGNING_KEY, Gmail SMTP)
# 6. Fullstack deployment of public assets & Pages Functions
# ==============================================================================

set -euo pipefail

# ANSI color codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[1;32m"
CLR_BLUE="\033[1;34m"
CLR_YELLOW="\033[1;33m"
CLR_RED="\033[1;31m"
CLR_CYAN="\033[1;36m"

log_info() {
  echo -e "${CLR_BLUE}[INFO]${CLR_RESET} $1"
}

log_success() {
  echo -e "${CLR_GREEN}[SUCCESS]${CLR_RESET} $1"
}

log_warn() {
  echo -e "${CLR_YELLOW}[WARN]${CLR_RESET} $1"
}

log_error() {
  echo -e "${CLR_RED}[ERROR]${CLR_RESET} $1"
}

log_header() {
  echo -e "\n${CLR_CYAN}${CLR_BOLD}=== $1 ===${CLR_RESET}\n"
}

# Default configuration values (Default: FAST instant deployment)
PROJECT_NAME="easy-oauth-worker"
BRANCH="main"
DB_NAME="easy-oauth-db"
DB_ID=""
PUBLIC_DIR="public"
SKIP_TESTS=true
SKIP_MIGRATE=true
SEED_DATA=false
NON_INTERACTIVE=true
FAST_MODE=true

show_help() {
  cat << EOF
EasyOAuth Cloudflare Pages Deployment Utility

Usage:
  bash scripts/deploy-pages.sh [OPTIONS]

Default Behavior:
  ⚡ Fast deployment by default (skips redundant tests and D1 migrations, non-interactive).
  Simply run 'bash scripts/deploy-pages.sh' for instant seconds-fast deployment!

Options:
  -f, --fast                 Fast deploy mode (default behavior)
  -t, --test                 Run TypeScript typecheck and Vitest test suite before deploy
  -m, --migrate              Run remote D1 database migrations before deploy
  --full                     Full verification mode (runs tests, migrations, and interactive checks)
  -p, --project-name <name>  Cloudflare Pages project name (default: easy-oauth-worker)
  -b, --branch <branch>      Production or target git branch (default: main)
  -d, --db-name <name>       Cloudflare D1 database name (default: easy-oauth-db)
  -i, --db-id <uuid>         Cloudflare D1 database UUID (overrides auto-detection)
  --seed                     Execute seed.sql on remote D1 after migration
  --skip-tests               Skip running TypeScript typecheck and Vitest tests (default)
  --skip-migrate             Skip remote D1 database migration (default)
  --interactive              Enable interactive confirmation prompts
  -y, --non-interactive      Non-interactive mode (default)
  -h, --help                 Display this help message and exit

Environment Requirements:
  - Node.js >= 18
  - Wrangler CLI installed or available via npx
  - Cloudflare Authentication (wrangler login or CLOUDFLARE_API_TOKEN with Pages & D1 Edit permissions)
  - .dev.vars or .env for secret values (optional, prompts available)

Examples:
  # Instant deployment (Default fast mode, takes 2~3 seconds)
  bash scripts/deploy-pages.sh

  # Full verification deployment with test suite and remote migrations
  bash scripts/deploy-pages.sh --full

  # Deploy and seed initial admin & demo clients
  bash scripts/deploy-pages.sh --seed

  # Deploy with explicit D1 database UUID
  bash scripts/deploy-pages.sh --db-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--fast)
      FAST_MODE=true
      SKIP_TESTS=true
      SKIP_MIGRATE=true
      NON_INTERACTIVE=true
      shift
      ;;
    -t|--test)
      SKIP_TESTS=false
      FAST_MODE=false
      shift
      ;;
    -m|--migrate)
      SKIP_MIGRATE=false
      FAST_MODE=false
      shift
      ;;
    --full)
      FAST_MODE=false
      SKIP_TESTS=false
      SKIP_MIGRATE=false
      NON_INTERACTIVE=false
      shift
      ;;
    --interactive)
      NON_INTERACTIVE=false
      shift
      ;;
    -p|--project-name)
      PROJECT_NAME="$2"
      shift 2
      ;;
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -d|--db-name)
      DB_NAME="$2"
      shift 2
      ;;
    -i|--db-id)
      DB_ID="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    --seed)
      SEED_DATA=true
      SKIP_MIGRATE=false
      shift
      ;;
    -y|--non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      echo "Use --help for usage instructions."
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

log_header "EasyOAuth Cloudflare Pages Deployment"
echo -e "Target Pages Project: ${CLR_BOLD}${PROJECT_NAME}${CLR_RESET}"
echo -e "Target Git Branch:    ${CLR_BOLD}${BRANCH}${CLR_RESET}"
echo -e "Target D1 Database:   ${CLR_BOLD}${DB_NAME}${CLR_RESET}"
echo -e "Working Directory:    ${CLR_BOLD}${ROOT_DIR}${CLR_RESET}"
echo ""

# ------------------------------------------------------------------------------
# 1. Environment & Pre-flight Checks
# ------------------------------------------------------------------------------
log_header "1/6 Pre-flight Environment Checks"

# Node.js check
if ! command -v node >/dev/null 2>&1; then
  log_error "Node.js is not installed or not found in PATH."
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  log_error "Node.js version 18 or higher is required. Found: v$NODE_VERSION"
  exit 1
fi
log_success "Node.js environment verified: v$NODE_VERSION"

# Package manager check
PACKAGE_RUNNER="pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  PACKAGE_RUNNER="npm"
fi
log_info "Package runner: $PACKAGE_RUNNER"

# Wrangler check
if ! command -v npx >/dev/null 2>&1; then
  log_error "npx is required to run Cloudflare Wrangler."
  exit 1
fi

log_info "Verifying Cloudflare Wrangler CLI..."
WRANGLER_VERSION=$(npx wrangler --version 2>/dev/null | head -n 1 || echo "unknown")
log_success "Wrangler CLI found: $WRANGLER_VERSION"

# Cloudflare authentication check
log_info "Checking Cloudflare authentication status..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  log_warn "Wrangler authentication check returned non-zero status."
  log_warn "If using CLOUDFLARE_API_TOKEN, ensure it has Pages & D1 Edit permissions."
  log_warn "If not logged in, please run 'npx wrangler login' first."
  if [ "$NON_INTERACTIVE" = false ]; then
    read -r -p "Do you want to continue anyway? [y/N] " CONTINUE_AUTH
    if [[ ! "$CONTINUE_AUTH" =~ ^[Yy]$ ]]; then
      log_error "Deployment aborted by user."
      exit 1
    fi
  fi
else
  log_success "Cloudflare credentials verified successfully."
fi

# ------------------------------------------------------------------------------
# 2. Quality Verification & Testing
# ------------------------------------------------------------------------------
log_header "2/6 Quality Gate Verification"

if [ "$SKIP_TESTS" = true ]; then
  log_warn "Skipping typecheck and tests as requested (--skip-tests)."
else
  log_info "Running TypeScript typecheck (tsc --noEmit)..."
  $PACKAGE_RUNNER run typecheck
  log_success "TypeScript typecheck passed with 0 errors."

  log_info "Running Vitest test suite..."
  $PACKAGE_RUNNER run test
  log_success "All unit, integration, and E2E test suites passed."
fi

# Auto-detect existing DB_ID from wrangler.toml if not explicitly specified via --db-id
if [ -z "$DB_ID" ] && [ -f "wrangler.toml" ]; then
  DETECTED_ID=$(grep -E '^\s*database_id\s*=' wrangler.toml | head -n 1 | cut -d= -f2- | tr -d ' "\r\n' || true)
  if [[ "$DETECTED_ID" =~ ^[0-9a-fA-F-]{36}$ ]] && [ "$DETECTED_ID" != "00000000-0000-0000-0000-000000000000" ]; then
    DB_ID="$DETECTED_ID"
    log_info "Detected existing D1 database ID from wrangler.toml: ${DB_ID}"
  fi
fi

# ------------------------------------------------------------------------------
# 3. D1 Database Configuration & Migrations
# ------------------------------------------------------------------------------
log_header "3/6 Remote D1 Database Preparation & Persistence Setup"

if [ "$SKIP_MIGRATE" = true ]; then
  log_warn "Skipping remote D1 database migration as requested (--skip-migrate)."
else
  # Step 3a: Ensure Database exists and DB_ID is acquired
  if [ -z "$DB_ID" ] || [ "$DB_ID" = "00000000-0000-0000-0000-000000000000" ]; then
    log_info "Attempting to create remote Cloudflare D1 database '${DB_NAME}'..."
    CREATE_OUTPUT=$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)
    
    # Check if a UUID was returned
    EXTRACTED_UUID=$(echo "$CREATE_OUTPUT" | grep -oE '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | head -n 1 || true)
    if [ -n "$EXTRACTED_UUID" ]; then
      DB_ID="$EXTRACTED_UUID"
      log_success "Successfully created D1 database '${DB_NAME}' with UUID: ${DB_ID}"
      # Persist newly created DB_ID to wrangler.toml
      if [ -f "wrangler.toml" ]; then
        sed -i "s/database_id = \"00000000-0000-0000-0000-000000000000\"/database_id = \"${DB_ID}\"/" wrangler.toml
        log_success "Saved database_id (${DB_ID}) to wrangler.toml."
      fi
    else
      # Analyze failure reason
      if echo "$CREATE_OUTPUT" | grep -q "already exists"; then
        log_info "D1 database '${DB_NAME}' already exists on Cloudflare."
      elif echo "$CREATE_OUTPUT" | grep -E "10000|7403|Authentication error|not authorized"; then
        log_warn "=========================================================================="
        log_warn "  [权限诊断] 当前 CLOUDFLARE_API_TOKEN 缺乏 Cloudflare D1 操作权限 (Code 10000)"
        log_warn "  Cloudflare 拒绝了通过 API 自动创建/迁移 D1 数据库。"
        log_warn ""
        log_warn "  👉 解决方法 (二选一即可彻底打通):"
        log_warn "  1. 开启 API 权限: 访问 https://dash.cloudflare.com/profile/api-tokens"
        log_warn "     为当前 Token 勾选 [Account -> D1 -> Edit] 权限并重新运行脚本；"
        log_warn "  2. 手动创建并指定: 访问 Cloudflare 控制台 D1 页面创建 '${DB_NAME}'，"
        log_warn "     复制生成的 UUID，然后运行: bash scripts/deploy-pages.sh --db-id <UUID>"
        log_warn "=========================================================================="
      else
        log_warn "D1 database creation returned: ${CREATE_OUTPUT}"
      fi
    fi
  fi

  # Step 3b: Apply Migrations
  log_info "Applying schema migrations to remote D1 database '${DB_NAME}'..."
  if echo "y" | npx wrangler d1 migrations apply "$DB_NAME" --remote 2>/dev/null; then
    log_success "Remote D1 schema migrations applied successfully."
  else
    log_warn "Remote D1 migration execution skipped or failed (check D1 permissions)."
  fi

  # Step 3c: Seed Data
  if [ "$SEED_DATA" = true ]; then
    log_info "Executing seed.sql to provision initial admin and sample clients on remote D1..."
    echo "y" | npx wrangler d1 execute "$DB_NAME" --remote --file=scripts/seed.sql 2>/dev/null && \
      log_success "Remote seed data executed successfully." || \
      log_warn "Seed execution failed or skipped. Please verify remote D1 status."
  elif [ "$NON_INTERACTIVE" = false ]; then
    read -r -p "Would you like to seed initial admin & sample clients to remote D1 now? [y/N] " SEED_CHOICE
    if [[ "$SEED_CHOICE" =~ ^[Yy]$ ]]; then
      log_info "Executing seed.sql..."
      echo "y" | npx wrangler d1 execute "$DB_NAME" --remote --file=scripts/seed.sql 2>/dev/null && \
        log_success "Remote seed data executed successfully." || \
        log_warn "Seed execution failed. Please verify remote D1 status."
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 4. Pages Project Initialization
# ------------------------------------------------------------------------------
log_header "4/6 Cloudflare Pages Project Verification"

log_info "Checking if Pages project '${PROJECT_NAME}' exists..."
PROJECT_EXISTS=false
if npx wrangler pages project list 2>/dev/null | grep -qw "$PROJECT_NAME"; then
  PROJECT_EXISTS=true
  log_success "Cloudflare Pages project '${PROJECT_NAME}' already exists."
else
  log_info "Creating Cloudflare Pages project '${PROJECT_NAME}'..."
  if npx wrangler pages project create "$PROJECT_NAME" \
      --production-branch "$BRANCH" \
      --compatibility-flags "nodejs_compat" \
      --compatibility-date "2024-09-23" 2>/dev/null; then
    log_success "Cloudflare Pages project '${PROJECT_NAME}' created successfully."
  else
    log_warn "Could not create project via CLI (it may already exist or API token lacks permission)."
  fi
fi

# ------------------------------------------------------------------------------
# 5. Secrets Synchronization
# ------------------------------------------------------------------------------
log_header "5/6 Secrets & Environment Variables Synchronization"

# Helper to read key from .dev.vars or .env
get_local_secret() {
  local KEY="$1"
  local VAL=""
  if [ -f ".dev.vars" ]; then
    VAL=$(grep -E "^${KEY}=" .dev.vars | cut -d= -f2- | tr -d '"\r\n' || true)
  fi
  if [ -z "$VAL" ] && [ -f ".env" ]; then
    VAL=$(grep -E "^${KEY}=" .env | cut -d= -f2- | tr -d '"\r\n' || true)
  fi
  echo "$VAL"
}

upload_secret() {
  local KEY="$1"
  local VAL="$2"
  if [ -n "$VAL" ]; then
    log_info "Uploading secret '${KEY}' to Pages project '${PROJECT_NAME}'..."
    echo -n "$VAL" | npx wrangler pages secret put "$KEY" --project-name "$PROJECT_NAME" >/dev/null 2>&1 && \
      log_success "Secret '${KEY}' updated." || \
      log_warn "Failed to upload '${KEY}' via CLI. You can set it in Cloudflare Pages dashboard."
  fi
}

SYNC_SECRETS=true
if [ "$NON_INTERACTIVE" = false ]; then
  read -r -p "Sync secrets (.dev.vars / .env) to Cloudflare Pages project now? [Y/n] " SYNC_CHOICE
  if [[ "$SYNC_CHOICE" =~ ^[Nn]$ ]]; then
    SYNC_SECRETS=false
  fi
fi

if [ "$SYNC_SECRETS" = true ]; then
  SESSION_SECRET_VAL=$(get_local_secret "SESSION_SECRET")
  OIDC_KEY_VAL=$(get_local_secret "OIDC_SIGNING_KEY")
  SMTP_PASS_VAL=$(get_local_secret "SMTP_PASSWORD")
  SMTP_USER_VAL=$(get_local_secret "SMTP_USERNAME")

  upload_secret "SESSION_SECRET" "$SESSION_SECRET_VAL"
  upload_secret "OIDC_SIGNING_KEY" "$OIDC_KEY_VAL"
  upload_secret "SMTP_PASSWORD" "$SMTP_PASS_VAL"
  upload_secret "SMTP_USERNAME" "$SMTP_USER_VAL"
fi

# ------------------------------------------------------------------------------
# 6. Build & Deploy to Cloudflare Pages with Automated D1 Binding
# ------------------------------------------------------------------------------
log_header "6/6 Deploying to Cloudflare Pages with Automated D1 Binding"

DEPLOYED_DOMAIN="${PROJECT_NAME}.pages.dev"

# Ensure public directory and functions entry exist
if [ ! -d "$PUBLIC_DIR" ]; then
  log_info "Creating '${PUBLIC_DIR}' directory..."
  mkdir -p "$PUBLIC_DIR"
fi

if [ ! -f "functions/[[path]].ts" ]; then
  log_error "Cloudflare Pages Functions adapter 'functions/[[path]].ts' is missing!"
  exit 1
fi

# Prepare Pages-compatible wrangler.toml for zero-click automatic D1 and vars binding
RESTORE_WRANGLER=false
if [ -f "wrangler.toml" ]; then
  cp wrangler.toml wrangler.toml.bak
  RESTORE_WRANGLER=true
fi

cleanup_wrangler() {
  if [ "$RESTORE_WRANGLER" = true ] && [ -f "wrangler.toml.bak" ]; then
    mv -f wrangler.toml.bak wrangler.toml
  fi
}
trap cleanup_wrangler EXIT INT TERM

# Generate Pages-specific deployment configuration
cat << EOF > wrangler.toml
name = "${PROJECT_NAME}"
pages_build_output_dir = "${PUBLIC_DIR}"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
AUTH_URL = "https://${DEPLOYED_DOMAIN}"
SITE_NAME = "${PROJECT_NAME}"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = "465"
SMTP_FROM = "EasyOAuth 认证中心 <cloud.mailer.service@gmail.com>"
EOF

if [ -n "$DB_ID" ] && [ "$DB_ID" != "00000000-0000-0000-0000-000000000000" ]; then
  cat << EOF >> wrangler.toml

[[d1_databases]]
binding = "DB"
database_name = "${DB_NAME}"
database_id = "${DB_ID}"
EOF
  log_success "Attached automated D1 binding to Pages configuration: DB -> ${DB_NAME} (${DB_ID})"
else
  log_warn "No valid D1 UUID available for automated Pages binding. Functions will require dashboard binding if not set."
fi

log_info "Deploying '${PUBLIC_DIR}' and Pages Functions to project '${PROJECT_NAME}'..."
npx wrangler pages deploy "$PUBLIC_DIR" \
  --project-name "$PROJECT_NAME" \
  --branch "$BRANCH" \
  --commit-dirty=true

# Restore original wrangler.toml
cleanup_wrangler
RESTORE_WRANGLER=false
trap - EXIT INT TERM

log_header "🎉 Deployment Complete!"
echo -e "${CLR_GREEN}${CLR_BOLD}EasyOAuth is now deployed to Cloudflare Pages!${CLR_RESET}"
echo -e "URL: ${CLR_CYAN}https://${DEPLOYED_DOMAIN}${CLR_RESET}\n"

if [ -n "$DB_ID" ] && [ "$DB_ID" != "00000000-0000-0000-0000-000000000000" ]; then
  echo -e "${CLR_GREEN}${CLR_BOLD}✔ D1 Database (${DB_NAME}) has been automatically bound to Pages (Variable: DB)!${CLR_RESET}\n"
else
  echo -e "${CLR_YELLOW}${CLR_BOLD}Notice on D1 Persistence:${CLR_RESET}"
  echo -e "To automatically bind D1 without manually visiting the dashboard, run with:"
  echo -e "  ${CLR_CYAN}bash scripts/deploy-pages.sh --db-id <YOUR_D1_UUID>${CLR_RESET}\n"
fi

echo -e "${CLR_BOLD}Online Health Verification:${CLR_RESET}"
echo -e "  curl -s https://${DEPLOYED_DOMAIN}/health"
echo -e "  curl -s https://${DEPLOYED_DOMAIN}/.well-known/openid-configuration"
echo ""

