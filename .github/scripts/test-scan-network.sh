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
# ファイル名に : を含むファイル。grep の出力を最初の : で分けると、行番号の欄を作者が決められる。
# a:null:b.cpp は行番号が null になって受け口に捨てられ、a:x:b.cpp は jq の --argjson が失敗して検出が止まる。
printf 'curl_easy_init();\n' > "${work}/src/a:null:b.cpp"
printf 'curl_easy_init();\n' > "${work}/src/a:x:b.cpp"

result="$(bash "${script}" "${work}")"
actual="$(jq -c '[.hits[] | {file, line, api}]' <<< "${result}")"
expected='[{"file":"src/a:null:b.cpp","line":1,"api":"libcurl"},{"file":"src/a:x:b.cpp","line":1,"api":"libcurl"},{"file":"src/legacy.cpp","line":1,"api":"libcurl"}]'
if [ "${actual}" != "${expected}" ]; then
  echo "scan-network.sh: expected ${expected}, got ${actual}" >&2
  echo "locale: LANG=${LANG:-unset} LC_ALL=${LC_ALL:-unset}" >&2
  exit 1
fi
echo "scan-network.sh: ok (LANG=${LANG:-unset} LC_ALL=${LC_ALL:-unset})"
