#!/usr/bin/env bash
# Detect package manager from lockfiles or explicit input.
set -euo pipefail

REQUESTED="${1:-auto}"
LOCKFILES_FILE="${2:-}"

if [[ "${REQUESTED}" != "auto" ]]; then
  echo "${REQUESTED}"
  exit 0
fi

has_npm=0
has_pnpm=0
has_yarn=0

if [[ -n "${LOCKFILES_FILE}" && -f "${LOCKFILES_FILE}" ]]; then
  while IFS= read -r path || [[ -n "${path}" ]]; do
    base="$(basename "${path}")"
    case "${base}" in
      package-lock.json|npm-shrinkwrap.json) has_npm=1 ;;
      pnpm-lock.yaml) has_pnpm=1 ;;
      yarn.lock) has_yarn=1 ;;
    esac
  done < "${LOCKFILES_FILE}"
fi

# Prefer explicit single ecosystem; if multiple, prefer pnpm > npm > yarn
if [[ "${has_pnpm}" -eq 1 && "${has_npm}" -eq 0 && "${has_yarn}" -eq 0 ]]; then
  echo "pnpm"
elif [[ "${has_npm}" -eq 1 && "${has_pnpm}" -eq 0 && "${has_yarn}" -eq 0 ]]; then
  echo "npm"
elif [[ "${has_yarn}" -eq 1 && "${has_pnpm}" -eq 0 && "${has_npm}" -eq 0 ]]; then
  echo "yarn"
elif [[ "${has_pnpm}" -eq 1 ]]; then
  echo "pnpm"
elif [[ "${has_npm}" -eq 1 ]]; then
  echo "npm"
elif [[ "${has_yarn}" -eq 1 ]]; then
  echo "yarn"
else
  echo "npm"
fi
