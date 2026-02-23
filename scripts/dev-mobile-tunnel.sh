#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$(mktemp -t newsdrip-lt.XXXXXX.log)"
API_PID=""
LT_PID=""

cleanup() {
  if [[ -n "${LT_PID}" ]]; then
    kill "${LT_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
  rm -f "${LOG_FILE}"
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"

echo "[newsdrip] starting API server..."
node server.js &
API_PID=$!

echo "[newsdrip] creating HTTPS tunnel..."
npx --yes localtunnel --port 3000 >"${LOG_FILE}" 2>&1 &
LT_PID=$!

TUNNEL_URL=""
for _ in {1..120}; do
  if grep -qi "your url is" "${LOG_FILE}"; then
    TUNNEL_URL="$(sed -nE 's/.*your url is: (https:\/\/[^[:space:]]+).*/\1/p' "${LOG_FILE}" | head -n1)"
    break
  fi
  sleep 0.5
done

if [[ -z "${TUNNEL_URL}" ]]; then
  echo "[newsdrip] failed to create tunnel."
  echo "--- localtunnel log ---"
  cat "${LOG_FILE}"
  exit 1
fi

echo "[newsdrip] tunnel ready: ${TUNNEL_URL}"
echo "[newsdrip] launching Expo with tunneled API..."
EXPO_PUBLIC_API_BASE_URL="${TUNNEL_URL}" npm --prefix apps/mobile start
