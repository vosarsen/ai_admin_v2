#!/bin/bash

# =============================================================================
# Apply Phase 0.8 Schema Migrations to Timeweb PostgreSQL
# Date: 2025-11-09
# Purpose: Apply business data tables schema to Timeweb PostgreSQL
# =============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/migrations"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${BLUE}Loading environment variables from .env${NC}"
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# PostgreSQL connection details
POSTGRES_HOST="${POSTGRES_HOST:-a84c973324fdaccfc68d929d.twc1.net}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DATABASE:-default_db}"
POSTGRES_USER="${POSTGRES_USER:-gen_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
PGSSLROOTCERT="${PGSSLROOTCERT:-/root/.cloud-certs/root.crt}"

# Build connection string
if [ -f "$PGSSLROOTCERT" ]; then
    PGCONNSTRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=verify-full"
    export PGSSLROOTCERT
    echo -e "${GREEN}✅ Using SSL connection${NC}"
else
    PGCONNSTRING="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo -e "${YELLOW}⚠️  SSL certificate not found, using non-SSL connection${NC}"
fi

# =============================================================================
# Functions
# =============================================================================

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test database connection
test_connection() {
    print_header "Testing Database Connection"

    if psql "$PGCONNSTRING" -c "SELECT NOW();" > /dev/null 2>&1; then
        print_success "Connected to Timeweb PostgreSQL successfully"
        psql "$PGCONNSTRING" -c "SELECT VERSION();" | head -n 1
        return 0
    else
        print_error "Failed to connect to Timeweb PostgreSQL"
        print_info "Connection string: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
        return 1
    fi
}

# Check if tables already exist
check_existing_tables() {
    print_header "Checking Existing Tables"

    echo "Querying existing tables in database..."

    EXISTING_TABLES=$(psql "$PGCONNSTRING" -t -c "
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    " | tr -d ' ')

    if [ -z "$EXISTING_TABLES" ]; then
        print_info "No existing tables found (clean database)"
        return 0
    fi

    echo "Existing tables:"
    echo "$EXISTING_TABLES" | while read -r table; do
        if [ -n "$table" ]; then
            echo "  - $table"
        fi
    done

    # Check if business tables already exist
    BUSINESS_TABLES=("companies" "clients" "services" "staff" "bookings" "messages")
    CONFLICTS=0

    for table in "${BUSINESS_TABLES[@]}"; do
        if echo "$EXISTING_TABLES" | grep -q "^${table}$"; then
            print_warning "Table '$table' already exists"
            CONFLICTS=$((CONFLICTS + 1))
        fi
    done

    if [ $CONFLICTS -gt 0 ]; then
        print_warning "Found $CONFLICTS potentially conflicting tables"
        echo ""
        read -p "Continue with migration? This may skip existing tables. (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Migration cancelled by user"
            exit 0
        fi
    else
        print_success "No conflicts detected, safe to proceed"
    fi
}

# Apply a single migration file
apply_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sql)

    print_info "Applying migration: $migration_name"

    if psql "$PGCONNSTRING" -f "$migration_file" > /tmp/migration_output.log 2>&1; then
        print_success "Migration $migration_name applied successfully"

        # Show any notices or warnings
        if grep -qi "NOTICE\|WARNING" /tmp/migration_output.log; then
            echo ""
            echo "Migration output:"
            grep -i "NOTICE\|WARNING\|✅" /tmp/migration_output.log || true
            echo ""
        fi

        return 0
    else
        print_error "Migration $migration_name failed"
        echo ""
        echo "Error details:"
        cat /tmp/migration_output.log
        echo ""
        return 1
    fi
}

# Get database statistics
get_stats() {
    print_header "Database Statistics"

    echo "Table statistics:"
    psql "$PGCONNSTRING" -c "
        SELECT
            schemaname,
            tablename,
            n_tup_ins - n_tup_del AS row_count,
            pg_size_pretty(pg_total_relation_size(quote_ident(tablename)::regclass)) AS table_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY (n_tup_ins - n_tup_del) DESC;
    "

    echo ""
    echo "Message partitions:"
    psql "$PGCONNSTRING" -c "SELECT * FROM get_messages_stats();" 2>/dev/null || \
        echo "  (messages table not yet created or get_messages_stats() function not available)"

    echo ""
    echo "Total database size:"
    psql "$PGCONNSTRING" -c "
        SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
    "
}

# Verify schema
verify_schema() {
    print_header "Verifying Schema"

    echo "Checking tables..."

    REQUIRED_TABLES=(
        "companies"
        "clients"
        "services"
        "staff"
        "staff_schedules"
        "bookings"
        "appointments_cache"
        "dialog_contexts"
        "reminders"
        "sync_status"
        "messages"
    )

    MISSING_TABLES=0

    for table in "${REQUIRED_TABLES[@]}"; do
        if psql "$PGCONNSTRING" -t -c "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='$table';" | grep -q 1; then
            print_success "Table '$table' exists"
        else
            print_error "Table '$table' is missing"
            MISSING_TABLES=$((MISSING_TABLES + 1))
        fi
    done

    echo ""

    if [ $MISSING_TABLES -eq 0 ]; then
        print_success "All ${#REQUIRED_TABLES[@]} required tables exist"
        return 0
    else
        print_error "$MISSING_TABLES required tables are missing"
        return 1
    fi
}

# Verify indexes
verify_indexes() {
    print_header "Verifying Indexes"

    echo "Checking key indexes..."

    TOTAL_INDEXES=$(psql "$PGCONNSTRING" -t -c "
        SELECT COUNT(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'whatsapp_%';
    " | tr -d ' ')

    print_info "Total indexes: $TOTAL_INDEXES"

    # Show indexes by table
    echo ""
    echo "Indexes by table:"
    psql "$PGCONNSTRING" -c "
        SELECT
            tablename,
            COUNT(*) as index_count
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'whatsapp_%'
        GROUP BY tablename
        ORDER BY tablename;
    "
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    print_header "Phase 0.8 Schema Migration - Timeweb PostgreSQL"

    print_info "Migration directory: $MIGRATIONS_DIR"
    print_info "PostgreSQL host: $POSTGRES_HOST"
    print_info "PostgreSQL database: $POSTGRES_DB"
    echo ""

    # Step 1: Test connection
    if ! test_connection; then
        print_error "Cannot proceed without database connection"
        exit 1
    fi

    # Step 2: Check existing tables
    check_existing_tables

    # Step 3: Apply migrations
    print_header "Applying Migrations"

    MIGRATIONS=(
        "$MIGRATIONS_DIR/20251109_create_business_tables_phase_08.sql"
        "$MIGRATIONS_DIR/20251109_create_partitioned_messages_table.sql"
    )

    FAILED=0

    for migration in "${MIGRATIONS[@]}"; do
        if [ ! -f "$migration" ]; then
            print_warning "Migration file not found: $migration"
            continue
        fi

        if ! apply_migration "$migration"; then
            FAILED=$((FAILED + 1))
        fi
    done

    echo ""

    if [ $FAILED -gt 0 ]; then
        print_error "$FAILED migrations failed"
        exit 1
    fi

    print_success "All migrations applied successfully!"

    # Step 4: Verify schema
    verify_schema

    # Step 5: Verify indexes
    verify_indexes

    # Step 6: Get statistics
    get_stats

    # Final summary
    print_header "Migration Complete!"

    print_success "Phase 0.8 schema successfully applied to Timeweb PostgreSQL"
    print_info "Next steps:"
    echo "  1. Test schema with sample data (Phase 0.8.6)"
    echo "  2. Begin Phase 0.9 (Query Pattern Library)"
    echo "  3. Monitor database performance"
    echo ""
    print_info "To check database stats: SELECT * FROM get_database_stats();"
    print_info "To check message partitions: SELECT * FROM get_messages_stats();"
    echo ""
}

# Run main function
main "$@"
