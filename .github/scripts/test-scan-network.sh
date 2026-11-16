#!/usr/bin/env bash
# scan-network.sh のテスト。CI の test のジョブで実行する。vitest は Workers のプールで動き子プロセスを起動できないため、bash で書く。
# 使い方: test-scan-network.sh
set -euo pipefail

script="$(dirname "$0")/scan-network.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir -p "${work}/src" "${work}/bin"

# 一致する行に UTF-8 として読めないバイト (cp1252 の引用符) を含むファイル。UTF-8 のロケールの grep はこの行を出力しないため、
# 通信の処理をこの種の行に置くと検出を逃れられる。
printf 'curl_easy_init(); // \x93x\x94\n' > "${work}/src/legacy.cpp"
# NUL を含むファイルは、-I でバイナリとして読まない。現在の動作を確かめるもので、望ましい挙動として固定する意図ではない。
printf '\x00\x01curl_easy_init\x00' > "${work}/bin/blob.dat"

result="$(bash "${script}" "${work}")"
actual="$(jq -c '[.hits[] | {file, line, api}]' <<< "${result}")"
expected='[{"file":"src/legacy.cpp","line":1,"api":"libcurl"}]'
if [ "${actual}" != "${expected}" ]; then
  echo "scan-network.sh: expected ${expected}, got ${actual}" >&2
  echo "locale: LANG=${LANG:-unset} LC_ALL=${LC_ALL:-unset}" >&2
  exit 1
fi
echo "scan-network.sh: ok (LANG=${LANG:-unset} LC_ALL=${LC_ALL:-unset})"
