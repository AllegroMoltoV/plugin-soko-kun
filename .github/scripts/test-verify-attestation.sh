#!/usr/bin/env bash
# verify-attestation.sh のテスト。CI の test のジョブで実行する。gh は呼ばず、終了コードと標準エラーを返す偽の gh を PATH の先頭に置き、
# 一時的な失敗と本物の失敗の分類と、名前の集約を確かめる。
# 使い方: test-verify-attestation.sh
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/verify-attestation.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir -p "${work}/bin"
export FAKE="${work}/fake"

# 偽の gh。リポジトリの名前ごとに、$FAKE/<download|verify>/<owner_repo>.code と .err で終了コードと標準エラーを決める。
# 呼び出しの引数は $FAKE/calls に 1 行ずつ残す。download が成功したら、gh と同じく作業ディレクトリに <digest>.jsonl を書く。
cat > "${work}/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${FAKE}/calls"
sub="$2"
repo=""
prev=""
for a in "$@"; do
  if [ "${prev}" = "--repo" ]; then repo="${a}"; fi
  prev="${a}"
done
key="${FAKE}/${sub}/${repo//\//_}"
code=$(cat "${key}.code" 2>/dev/null || echo 0)
if [ -f "${key}.err" ]; then cat "${key}.err" >&2; fi
if [ "${code}" -ne 0 ]; then exit "${code}"; fi
if [ "${sub}" = "download" ]; then
  if [ -f "${key}.out" ]; then cat "${key}.out"; fi
  if [ ! -f "${key}.nobundle" ]; then echo '{"bundle":1}' > 'sha256:0000.jsonl'; fi
fi
if [ "${sub}" = "verify" ]; then
  if [ -f "${key}.out" ]; then cat "${key}.out"; else
    echo '[{"verificationResult":{"signature":{"certificate":{"sourceRepositoryIdentifier":"42","buildSignerURI":"https://github.com/o/r/.github/workflows/release.yml@refs/tags/v1.0.0"}}}}]'
  fi
fi
EOF
chmod +x "${work}/bin/gh"
export PATH="${work}/bin:${PATH}"

echo 'asset' > "${work}/asset"
echo '{"root":1}' > "${work}/trusted_root.jsonl"
failures=0

# 場面を初期化する。引数は「<download|verify>:<owner_repo>:<終了コード>:<標準エラー>」の並び。
setup() {
  rm -rf "${FAKE}"
  mkdir -p "${FAKE}/download" "${FAKE}/verify"
  : > "${FAKE}/calls"
  for spec in "$@"; do
    IFS=: read -r sub repo code err <<< "${spec}"
    echo "${code}" > "${FAKE}/${sub}/${repo}.code"
    printf '%s\n' "${err}" > "${FAKE}/${sub}/${repo}.err"
  done
}

# check <場面の名前> <期待する JSON> <verify-attestation.sh の引数のうち、信頼の根・リポジトリ ID・名前>...
check() {
  local label="$1" expected="$2" root="$3" repo_id="$4"
  shift 4
  local actual
  actual="$(bash "${script}" "${work}/asset" "${root}" v1.0.0 abc123 "" "${repo_id}" "$@" 2> "${work}/log.txt")"
  if [ "${actual}" != "${expected}" ]; then
    echo "FAIL ${label}: expected ${expected}, got ${actual}" >&2
    sed 's/^/  /' "${work}/log.txt" >&2
    failures=$((failures + 1))
  else
    echo "ok ${label}"
  fi
}

root="${work}/trusted_root.jsonl"

setup
check 'success' '{"result":"passed","signerWorkflow":".github/workflows/release.yml"}' "${root}" 42 o/r
if ! grep -q -- '--bundle .*sha256:0000.jsonl --custom-trusted-root '"${root}" "${FAKE}/calls"; then
  echo "FAIL success: verify did not use the downloaded bundle and the trusted root offline" >&2
  cat "${FAKE}/calls" >&2
  failures=$((failures + 1))
fi

setup 'download:o_r:1:Error: failed to fetch attestations: HTTP 404: Not Found (https://api.github.com/repos/o/r/attestations/sha256:0)'
check 'download 404' '{"result":"failed","reason":"no_attestation"}' "${root}" 42 o/r
if grep -q '^attestation verify' "${FAKE}/calls"; then
  echo "FAIL download 404: verify ran after the download failed" >&2
  failures=$((failures + 1))
fi

# 不変のリリースにはリリースの証明が付くため、ビルドの証明が無くても API は 200 を返し、gh の絞り込みで 0 件になる。
setup 'download:o_r:1:failed to filter attestations: no attestations found with predicate type: https://slsa.dev/provenance/v1'
check 'download 200 without SLSA provenance' '{"result":"failed","reason":"no_attestation"}' "${root}" 42 o/r

# API が 0 件を返すと、gh は終了コード 0 で標準出力に No attestations found と書き、証明のファイルを作らない。
setup
touch "${FAKE}/download/o_r.nobundle"
echo 'No attestations found for /tmp/asset' > "${FAKE}/download/o_r.out"
check 'download returns no attestations with exit code 0' '{"result":"failed","reason":"no_attestation"}' "${root}" 42 o/r

# download は種類を問わず取得してから手元で絞り込むため、既定の 30 件ではビルドの証明が押し出されうる。gh の上限の 1000 件を取る。
setup
check 'download limit' '{"result":"passed","signerWorkflow":".github/workflows/release.yml"}' "${root}" 42 o/r
if ! grep -q '^attestation download .*--limit 1000' "${FAKE}/calls"; then
  echo "FAIL download limit: download did not request 1000 attestations" >&2
  cat "${FAKE}/calls" >&2
  failures=$((failures + 1))
fi

setup 'download:o_r:1:Error: failed to fetch attestations: HTTP 502: Bad Gateway (https://api.github.com/repos/o/r/attestations/sha256:0)'
check 'download 5xx' '{"result":"error","reason":"attestation_fetch_failed"}' "${root}" 42 o/r

setup 'download:o_r:1:Error: Get "https://api.github.com/": dial tcp: i/o timeout'
check 'download network failure' '{"result":"error","reason":"attestation_fetch_failed"}' "${root}" 42 o/r

setup
touch "${FAKE}/download/o_r.nobundle"
check 'download without a bundle file' '{"result":"error","reason":"attestation_fetch_failed"}' "${root}" 42 o/r

setup 'verify:o_r:1:Error: expected SourceRepositoryRef to be refs/tags/v1.0.0, got refs/tags/v0.9.0'
check 'verify failure' '{"result":"failed","reason":"verification_failed"}' "${root}" 42 o/r

setup
check 'repository id mismatch' '{"result":"failed","reason":"repository_id_mismatch"}' "${root}" 7 o/r

setup 'download:o_new:1:HTTP 404: Not Found'
check 'old name passes' '{"result":"passed","signerWorkflow":".github/workflows/release.yml"}' "${root}" 42 o/new o/r

setup 'download:o_new:1:HTTP 503: Service Unavailable' 'download:o_r:1:HTTP 404: Not Found'
check 'transient and genuine failures' '{"result":"error","reason":"attestation_fetch_failed"}' "${root}" 42 o/new o/r

setup 'verify:o_new:1:Error: verifying with issuer "sigstore.dev"' 'download:o_r:1:HTTP 404: Not Found'
check 'only genuine failures' '{"result":"failed","reason":"no_attestation"}' "${root}" 42 o/new o/r

setup
check 'trusted root unavailable' '{"result":"error","reason":"trust_root_unavailable"}' "${work}/missing.jsonl" 42 o/r
if [ -s "${FAKE}/calls" ]; then
  echo "FAIL trusted root unavailable: gh ran without the trusted root" >&2
  failures=$((failures + 1))
fi

if [ "${failures}" -ne 0 ]; then
  echo "verify-attestation.sh: ${failures} failures" >&2
  exit 1
fi
echo "verify-attestation.sh: ok"
