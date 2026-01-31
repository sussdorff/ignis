#!/bin/bash
# load-synthea-data.sh - Load Synthea patient bundles into Aidbox
#
# Usage: ./load-synthea-data.sh [count]
#   count: number of patients to load (default: all ~631)
#
# Examples:
#   ./load-synthea-data.sh        # Load all patients
#   ./load-synthea-data.sh 50     # Load first 50 patients
#   ./load-synthea-data.sh 10     # Load first 10 patients (quick test)
#
# Environment variables:
#   FHIR_BASE_URL - FHIR endpoint (default: http://localhost:8080/fhir)
#   FHIR_USER     - Auth username (default: admin)
#   FHIR_PASS     - Auth password (default: ignis2026)

set -euo pipefail

# Configuration
FHIR_BASE_URL="${FHIR_BASE_URL:-https://ignis.cognovis.de}"
FHIR_USER="${FHIR_USER:-admin}"
FHIR_PASS="${FHIR_PASS:-ignis2026}"
REPO_URL="https://github.com/smart-on-fhir/generated-sample-data.git"
DATA_PATH="R4/SYNTHEA"
COUNT="${1:-0}"  # 0 means all

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics
LOADED=0
FAILED=0
SKIPPED=0
TOTAL=0

# Temp directory for downloads
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

# Test FHIR server connectivity
test_fhir_connection() {
    log_info "Testing FHIR server connection at $FHIR_BASE_URL..."

    local HTTP_CODE
    HTTP_CODE=$(curl -s -L -o /dev/null -w "%{http_code}" \
        -u "${FHIR_USER}:${FHIR_PASS}" \
        "${FHIR_BASE_URL}/metadata" 2>/dev/null) || HTTP_CODE="000"

    if [[ "$HTTP_CODE" == "200" ]]; then
        log_success "FHIR server is accessible"
        return 0
    else
        log_error "Cannot connect to FHIR server (HTTP $HTTP_CODE)"
        log_error "URL: $FHIR_BASE_URL"
        return 1
    fi
}

# Clone repository with sparse checkout (only Synthea data)
# Sets DATA_DIR global variable with the path to Synthea data
clone_synthea_data() {
    log_info "Cloning Synthea data from GitHub (sparse checkout)..."
    log_info "This may take a few minutes..."

    local orig_dir="$PWD"

    cd "$TEMP_DIR" || {
        log_error "Failed to cd to $TEMP_DIR"
        return 1
    }

    # Initialize sparse checkout (simplified output for SSH compatibility)
    log_info "[GIT] Cloning repository..."
    git clone --filter=blob:none --no-checkout --depth 1 "$REPO_URL" synthea-data 2>&1 || {
        log_error "Failed to clone repository"
        cd "$orig_dir"
        return 1
    }

    cd synthea-data || {
        log_error "Failed to cd to synthea-data"
        cd "$orig_dir"
        return 1
    }

    # Configure sparse checkout
    log_info "[GIT] Setting up sparse checkout..."
    git sparse-checkout init --cone 2>/dev/null
    git sparse-checkout set "$DATA_PATH" 2>/dev/null

    # Checkout the files
    log_info "[GIT] Checking out files..."
    git checkout 2>&1 || {
        log_error "Failed to checkout files"
        cd "$orig_dir"
        return 1
    }

    # Count files
    local file_count=$(ls -1 "$DATA_PATH"/*.json 2>/dev/null | wc -l | tr -d ' ')
    log_success "Downloaded $file_count patient bundles"

    # Set global variable instead of returning via stdout
    DATA_DIR="$TEMP_DIR/synthea-data/$DATA_PATH"

    cd "$orig_dir"
}

# Load a single bundle into FHIR server
load_bundle() {
    local bundle_file="$1"
    local filename=$(basename "$bundle_file")
    local index="$2"

    # Validate JSON
    if ! jq -e '.' "$bundle_file" > /dev/null 2>&1; then
        log_error "[$index/$TOTAL] Invalid JSON: $filename"
        ((FAILED++))
        return 1
    fi

    # Check if it's a Bundle
    local resource_type=$(jq -r '.resourceType // empty' "$bundle_file")
    if [[ "$resource_type" != "Bundle" ]]; then
        log_warn "[$index/$TOTAL] Skipping non-Bundle resource: $filename (type: $resource_type)"
        ((SKIPPED++))
        return 0
    fi

    # POST bundle to FHIR server
    local response_file="$TEMP_DIR/response.json"
    local http_code

    http_code=$(curl -s -L -w "%{http_code}" -o "$response_file" \
        -X POST \
        -H "Content-Type: application/fhir+json" \
        -u "${FHIR_USER}:${FHIR_PASS}" \
        -d @"$bundle_file" \
        "${FHIR_BASE_URL}" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "201" ]]; then
        local entry_count=$(jq '.entry | length // 0' "$bundle_file")
        log_success "[$index/$TOTAL] Loaded: $filename ($entry_count resources)"
        ((LOADED++))
        return 0
    else
        local error_msg=$(jq -r '.issue[0].diagnostics // .message // "Unknown error"' "$response_file" 2>/dev/null || echo "HTTP $http_code")
        # Check if it's a duplicate error (409 or contains "duplicate")
        if [[ "$error_msg" == *"duplicate"* ]] || [[ "$http_code" == "409" ]]; then
            log_warn "[$index/$TOTAL] Skipped (already exists): $filename"
            ((SKIPPED++))
            return 0
        fi
        log_error "[$index/$TOTAL] Failed to load: $filename - $error_msg"
        ((FAILED++))
        return 1
    fi
}

# Main function
main() {
    echo ""
    echo "======================================"
    echo "  Synthea Patient Bundle Loader"
    echo "======================================"
    echo ""

    # Test connection first
    if ! test_fhir_connection; then
        exit 1
    fi

    echo ""

    # Clone repository (sets DATA_DIR global variable)
    clone_synthea_data

    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory not found: $DATA_DIR"
        exit 1
    fi

    # Get list of JSON files (using ls for simplicity and SSH compatibility)
    log_info "Looking for files in $DATA_DIR..."
    mapfile -t files < <(ls -1 "$DATA_DIR"/*.json 2>/dev/null | sort)

    TOTAL=${#files[@]}
    log_info "Found $TOTAL JSON files to process"

    if [[ $TOTAL -eq 0 ]]; then
        log_error "No JSON files found in $DATA_DIR"
        exit 1
    fi

    # Apply count limit if specified
    if [[ "$COUNT" -gt 0 ]] && [[ "$COUNT" -lt "$TOTAL" ]]; then
        log_info "Limiting to first $COUNT bundles"
        TOTAL=$COUNT
    fi

    echo ""
    log_info "Starting to load $TOTAL bundles..."
    echo ""

    # Record start time
    local start_time=$(date +%s)

    # Process each bundle
    local index=0
    for file in "${files[@]}"; do
        index=$((index + 1))

        if [[ "$COUNT" -gt 0 ]] && [[ "$index" -gt "$COUNT" ]]; then
            break
        fi

        load_bundle "$file" "$index" || true

    done

    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))

    # Print summary
    echo ""
    echo "======================================"
    echo "  Loading Complete"
    echo "======================================"
    echo ""
    log_info "Duration: ${minutes}m ${seconds}s"
    log_success "Loaded:  $LOADED"
    if [[ $FAILED -gt 0 ]]; then
        log_error "Failed:  $FAILED"
    else
        log_info "Failed:  $FAILED"
    fi
    if [[ $SKIPPED -gt 0 ]]; then
        log_warn "Skipped: $SKIPPED"
    else
        log_info "Skipped: $SKIPPED"
    fi
    echo ""

    # Verify results
    log_info "Verifying loaded data..."
    echo ""

    local patient_count=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" \
        "${FHIR_BASE_URL}/Patient?_summary=count" 2>/dev/null | jq -r '.total // 0')
    local observation_count=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" \
        "${FHIR_BASE_URL}/Observation?_summary=count" 2>/dev/null | jq -r '.total // 0')
    local condition_count=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" \
        "${FHIR_BASE_URL}/Condition?_summary=count" 2>/dev/null | jq -r '.total // 0')
    local encounter_count=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" \
        "${FHIR_BASE_URL}/Encounter?_summary=count" 2>/dev/null | jq -r '.total // 0')

    echo "  Patients:     $patient_count"
    echo "  Observations: $observation_count"
    echo "  Conditions:   $condition_count"
    echo "  Encounters:   $encounter_count"
    echo ""

    if [[ $FAILED -gt 0 ]]; then
        exit 1
    fi

    exit 0
}

main "$@"
