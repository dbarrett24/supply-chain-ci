#!/usr/bin/env bash
# Resolve lockfile paths from newline/glob input. Prints one relative path per line.
# Works on macOS Bash 3.2 (no globstar) and Ubuntu runners.
set -euo pipefail

ROOT="${1:-.}"
PATTERNS_FILE="${2:-}"

if [[ -z "${PATTERNS_FILE}" || ! -f "${PATTERNS_FILE}" ]]; then
  echo "Usage: resolve-lockfiles.sh <root> <patterns-file>" >&2
  exit 2
fi

cd "${ROOT}"

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

while IFS= read -r pattern || [[ -n "${pattern}" ]]; do
  # trim
  pattern="${pattern#"${pattern%%[![:space:]]*}"}"
  pattern="${pattern%"${pattern##*[![:space:]]}"}"
  [[ -z "${pattern}" || "${pattern}" == \#* ]] && continue

  # Strip leading ./
  pattern="${pattern#./}"

  if [[ "${pattern}" == *\*\*/* ]]; then
    # **/name → find -name name
    name="${pattern##**/}"
    find . \
      \( -path './.git' -o -path './.git/*' -o -path '*/node_modules/*' -o -path './.supply-chain-ci' -o -path './.supply-chain-ci/*' \) -prune \
      -o -type f -name "${name}" -print 2>/dev/null >> "${tmp}" || true
  elif [[ "${pattern}" == */* && "${pattern}" != *\** ]]; then
    # Exact relative path
    if [[ -f "${pattern}" ]]; then
      echo "${pattern}" >> "${tmp}"
    elif [[ -f "./${pattern}" ]]; then
      echo "${pattern}" >> "${tmp}"
    fi
  elif [[ "${pattern}" == *\** ]]; then
    # Single-segment glob via find -name
    find . \
      \( -path './.git' -o -path './.git/*' -o -path '*/node_modules/*' -o -path './.supply-chain-ci' -o -path './.supply-chain-ci/*' \) -prune \
      -o -type f -name "${pattern}" -print 2>/dev/null >> "${tmp}" || true
  else
    # Bare filename
    find . \
      \( -path './.git' -o -path './.git/*' -o -path '*/node_modules/*' -o -path './.supply-chain-ci' -o -path './.supply-chain-ci/*' \) -prune \
      -o -type f -name "${pattern}" -print 2>/dev/null >> "${tmp}" || true
  fi
done < "${PATTERNS_FILE}"

if [[ ! -s "${tmp}" ]]; then
  echo "No lockfiles matched the given patterns under ${ROOT}" >&2
  exit 1
fi

# Normalize: drop leading ./
sed 's|^\./||' "${tmp}" | sort -u
