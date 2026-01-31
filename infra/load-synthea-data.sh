#!/bin/bash
# load-synthea-data.sh - Load Synthea patient bundles into Aidbox
#
# Usage: ./load-synthea-data.sh [count] [--fresh]
#   count:   number of patients to load (default: all ~631)
#   --fresh: force re-download of data (ignore cache)
#
# Examples:
#   ./load-synthea-data.sh           # Load all patients (uses cache)
#   ./load-synthea-data.sh 50        # Load first 50 patients
#   ./load-synthea-data.sh 10        # Load first 10 patients (quick test)
#   ./load-synthea-data.sh --fresh   # Force re-download and load all
#   ./load-synthea-data.sh 50 --fresh # Re-download and load 50 patients
#
# Environment variables:
#   FHIR_BASE_URL    - FHIR endpoint (default: http://localhost:8080/fhir)
#   FHIR_USER        - Auth username (default: admin)
#   FHIR_PASS        - Auth password (default: ignis2026)
#   SYNTHEA_CACHE_DIR - Cache directory (default: ~/.cache/synthea-data)

set -euo pipefail

# Configuration
FHIR_BASE_URL="${FHIR_BASE_URL:-https://ignis.cognovis.de/fhir}"
FHIR_USER="${FHIR_USER:-admin}"
FHIR_PASS="${FHIR_PASS:-ignis2026}"
REPO_URL="https://github.com/smart-on-fhir/generated-sample-data.git"
DATA_PATH="R4/SYNTHEA"
CACHE_DIR="${SYNTHEA_CACHE_DIR:-$HOME/.cache/synthea-data}"

# Parse arguments
COUNT=0
FRESH=false
for arg in "$@"; do
    if [[ "$arg" == "--fresh" ]]; then
        FRESH=true
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        COUNT="$arg"
    fi
done

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

# Get or download Synthea data (with caching)
# Sets DATA_DIR global variable with the path to Synthea data
get_synthea_data() {
    local cached_data_dir="$CACHE_DIR/data"

    # Check if cache exists and is valid
    if [[ "$FRESH" == "false" ]] && [[ -d "$cached_data_dir" ]]; then
        local file_count
        file_count=$(ls -1 "$cached_data_dir"/*.json 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$file_count" -gt 0 ]]; then
            log_success "Using cached data ($file_count patient bundles)"
            log_info "Cache location: $cached_data_dir"
            log_info "Use --fresh to force re-download"
            DATA_DIR="$cached_data_dir"
            return 0
        fi
    fi

    # Remove old cache if --fresh or cache is invalid
    if [[ -d "$CACHE_DIR" ]]; then
        log_info "Clearing old cache..."
        rm -rf "$CACHE_DIR"
    fi

    # Download fresh data
    clone_synthea_data_to_cache
}

# Clone repository with sparse checkout (only Synthea data) into cache
clone_synthea_data_to_cache() {
    log_info "Downloading Synthea data from GitHub (sparse checkout)..."
    log_info "This may take a few minutes..."

    local orig_dir="$PWD"

    # Create cache directory
    mkdir -p "$CACHE_DIR"

    cd "$CACHE_DIR" || {
        log_error "Failed to cd to $CACHE_DIR"
        return 1
    }

    # Initialize sparse checkout (simplified output for SSH compatibility)
    log_info "[GIT] Cloning repository..."
    git clone --filter=blob:none --no-checkout --depth 1 "$REPO_URL" repo 2>&1 || {
        log_error "Failed to clone repository"
        cd "$orig_dir"
        return 1
    }

    cd repo || {
        log_error "Failed to cd to repo"
        cd "$orig_dir"
        return 1
    }

    # Configure sparse checkout
    log_info "[GIT] Setting up sparse checkout..."
    git sparse-checkout init --cone 2>/dev/null
    git sparse-checkout set "$DATA_PATH" 2>/dev/null

    # Checkout the files
    log_info "[GIT] Checking out files..."
    git checkout 2>&1

    cd "$orig_dir"

    # Check if files exist (checkout may report errors but still work)
    if ! ls "$CACHE_DIR/repo/$DATA_PATH"/*.json >/dev/null 2>&1; then
        log_error "Failed to checkout files - no JSON files found"
        return 1
    fi

    # Move data to consistent cache location
    mkdir -p "$CACHE_DIR/data"
    mv "$CACHE_DIR/repo/$DATA_PATH"/*.json "$CACHE_DIR/data/"
    rm -rf "$CACHE_DIR/repo"

    DATA_DIR="$CACHE_DIR/data"

    # Count files
    local file_count
    file_count=$(ls -1 "$DATA_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    log_success "Downloaded and cached $file_count patient bundles"
    log_info "Cache location: $DATA_DIR"
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

    # Strip problematic fields that Aidbox schema doesn't recognize
    # These are valid FHIR but Aidbox rejects as "extra property":
    # - multipleBirthBoolean/multipleBirthInteger (Patient)
    # - deceasedDateTime (Patient - for deceased patients)
    # - serviceProvider (Encounter - organization references)
    # - participant.individual (Encounter - practitioner references)
    #
    # Also add ifNoneExist to make POSTs idempotent - if resource with same ID
    # exists, skip it instead of failing. This handles shared Organization/Practitioner.
    local cleaned_file="$TEMP_DIR/cleaned.json"
    jq '
      # Add ifNoneExist header to make creates conditional (skip if exists)
      .entry |= map(
        if .request.method == "POST" and .resource.id then
          .request.ifNoneExist = ("_id=" + .resource.id)
        else . end
      ) |
      # Strip problematic fields
      walk(if type == "object" then
        del(.multipleBirthBoolean, .multipleBirthInteger, .deceasedDateTime, .serviceProvider) |
        if .participant then .participant |= map(del(.individual)) else . end
      else . end)
    ' "$bundle_file" > "$cleaned_file"

    # POST bundle to FHIR server
    local response_file="$TEMP_DIR/response.json"
    local http_code

    http_code=$(curl -s -L -w "%{http_code}" -o "$response_file" \
        -X POST \
        -H "Content-Type: application/fhir+json" \
        -u "${FHIR_USER}:${FHIR_PASS}" \
        -d @"$cleaned_file" \
        "${FHIR_BASE_URL}" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "201" ]]; then
        local entry_count=$(jq '.entry | length // 0' "$response_file")
        log_success "[$index/$TOTAL] Loaded: $filename ($entry_count resources)"
        ((LOADED++))
        return 0
    else
        local error_msg=$(jq -r '.issue[0].diagnostics // .message // "Unknown error"' "$response_file" 2>/dev/null || echo "HTTP $http_code")
        # Check if it's a duplicate error - means patient already fully loaded
        if [[ "$error_msg" == *"duplicate"* ]] && [[ "$error_msg" == *"patient_pkey"* ]]; then
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

    # Get data (from cache or download fresh)
    get_synthea_data

    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory not found: $DATA_DIR"
        exit 1
    fi

    # Get list of JSON files (using ls for simplicity and SSH compatibility)
    log_info "Looking for files in $DATA_DIR..."
    files=()
    while IFS= read -r file; do
        files+=("$file")
    done < <(ls -1 "$DATA_DIR"/*.json 2>/dev/null | sort)

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
