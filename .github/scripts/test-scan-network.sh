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

# 候補のパスの合計が引数の上限 (ARG_MAX、ubuntu で 2 MiB) を超える場面。候補を grep のコマンドラインに並べると、grep を
# 起動できず、当たり 0 件として通信の検出を逃れられる。約 3,800 バイトのパスのファイルを 600 個置き、合計を 2 MiB より大きくする。
many="${work}/many"
deep="${many}/deep"
for _ in $(seq 1 15); do deep="${deep}/$(printf 'd%.0s' $(seq 1 250))"; done
mkdir -p "${deep}" "${many}/src"
for n in $(seq 1 600); do printf '// socket (\n' > "${deep}/f${n}.cpp"; done
printf 'curl_easy_init();\n' > "${many}/src/real.cpp"
result="$(bash "${script}" "${many}")"
actual="$(jq -c '[.hits[] | select(.file == "src/real.cpp") | {file, line, api}]' <<< "${result}")"
expected='[{"file":"src/real.cpp","line":1,"api":"libcurl"}]'
if [ "${actual}" != "${expected}" ] || [ "$(jq '.hits | length' <<< "${result}")" -ne 50 ] || [ "$(jq '.truncated' <<< "${result}")" != "true" ]; then
  echo "scan-network.sh (ARG_MAX): expected ${expected} with 50 hits and truncated, got $(jq -c '{n: (.hits | length), truncated, real: [.hits[] | select(.file == "src/real.cpp")]}' <<< "${result}")" >&2
  exit 1
fi

echo "scan-network.sh: ok (LANG=${LANG:-unset} LC_ALL=${LC_ALL:-unset})"
