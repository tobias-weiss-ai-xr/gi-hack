#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/output"
OUTPUT_FILE="${OUTPUT_DIR}/pitch.pdf"
MARPFILE="${SCRIPT_DIR}/pitch.md"

echo "📄 LeadGraph — MARP → PDF Builder"
echo "────────────────────────────────────"

mkdir -p "${OUTPUT_DIR}"

if command -v marp &>/dev/null; then
  MARP_CMD="marp"
elif command -v npx &>/dev/null; then
  echo "🔧 marp not found locally — using npx (first run may take a moment)..."
  MARP_CMD="npx @marp-team/marp-cli"
else
  echo "❌ Neither marp nor npx found. Install Node.js or marp-cli."
  exit 1
fi

echo "🚀 Generating PDF from ${MARPFILE}..."
${MARP_CMD} "${MARPFILE}" \
  --pdf \
  --allow-local-files \
  --output "${OUTPUT_FILE}" \
  --pdf-notes \
  --html

echo "✅ Done — PDF saved to: ${OUTPUT_FILE}"
echo "   $(du -h "${OUTPUT_FILE}" | cut -f1)"
