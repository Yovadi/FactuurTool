#!/usr/bin/env bash
# Cloud Agent install script for FactuurTool (HAL5 Facturatie Manager).
# Idempotent: safe to run repeatedly. Refreshes JS dependencies and seeds a
# local .env with the app's public Supabase credentials when none are provided.
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci

# The web app reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build/dev time.
# Without them the UI renders a fatal "Applicatie kon niet starten" screen.
# These are the project's PUBLIC Supabase anon credentials (already embedded in
# the application source, e.g. src/components/Integrations.tsx) and are safe to
# ship to clients. They are only written when the developer has NOT supplied
# their own values via environment variables (e.g. Cursor secrets) or a .env file.
if [ -z "${VITE_SUPABASE_URL:-}" ] && [ ! -f .env ]; then
  cat > .env <<'EOF'
VITE_SUPABASE_URL=https://qlvndvpxhqmjljjpehkn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk
EOF
  echo "Seeded .env with public Supabase dev credentials."
else
  echo "Existing Supabase configuration detected; leaving .env untouched."
fi
