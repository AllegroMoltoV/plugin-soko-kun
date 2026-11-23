#!/usr/bin/env bash
# 1 つの配布物の証明を検証し、結果を 1 行の JSON ({result, reason?, signerWorkflow?}) で標準出力に書く。verify.yaml の scan ジョブで使う。
# 使い方: verify-attestation.sh <配布物のファイル> <信頼の根のファイル> <タグ> <コミット> <署名者のワークフロー (空でよい)> <リポジトリ ID (空でよい)> <名前>...
# 名前は、現在の名前、旧い名前 (新しい順) の順に渡す。名前を変える前に作られた証明は、作られたときの名前でしか通らない (ADR 0015)。
#
# 一時的な障害 (GitHub や Sigstore の 5xx・レート制限・通信の失敗) を本物の検証の失敗と分けるため、検証を 3 段に分ける。
# gh attestation verify の終了コードは失敗の種類によらず 1 で、1 回の verify では両者を区別できないため。
#   1. 信頼の根は、呼び出し側が gh attestation trusted-root で 1 回だけ取得して渡す。無ければ error (trust_root_unavailable)。
#   2. 名前ごとに gh attestation download で証明を取得する。HTTP 404 (証明が無い) と、取得した証明に SLSA の証明が無い場合だけを
#      本物の失敗 (no_attestation) とし、それ以外の失敗は一時的な失敗 (attestation_fetch_failed) とする。不変のリリースには
#      GitHub がリリースの証明を付けるため、ビルドの証明が無い配布物でも API は 200 を返し、gh の絞り込みが no attestations found で失敗する。
#   3. 取得した証明と信頼の根で、通信を使わずに照合する。失敗はすべて本物の失敗 (verification_failed) とする。
# 名前の集約: どれかの名前で通れば passed。通らず、一時的な失敗が 1 つでもあれば error。すべて本物の失敗なら failed (最後の本物の失敗の理由)。
# 一時的な失敗は受け口で試行を数え、上限で管理者の待ちにする (ADR 0019 の原則 2)。
set -euo pipefail

file="$1"
trusted_root="$2"
tag="$3"
commit="$4"
signer="$5"
repository_id="$6"
shift 6
names=("$@")

emit() {
  jq -nc --arg result "$1" --arg reason "$2" --arg signer "${3:-}" \
    '{result: $result} + (if $reason == "" then {} else {reason: $reason} end) + (if $signer == "" then {} else {signerWorkflow: $signer} end)'
}

if [ ! -s "${trusted_root}" ]; then
  echo "  trusted root is not available" >&2
  emit error trust_root_unavailable
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
transient=""
genuine=verification_failed

for name in "${names[@]}"; do
  dl="${work}/dl"
  rm -rf "${dl}"
  mkdir "${dl}"
  if ! (cd "${dl}" && gh attestation download "${file}" --repo "${name}" --predicate-type https://slsa.dev/provenance/v1) > "${work}/dl.txt" 2> "${work}/err.txt"; then
    if grep -qF -e 'HTTP 404: Not Found' -e 'no attestations found' "${work}/err.txt"; then
      genuine=no_attestation
      echo "  ${name}: no attestation" >&2
    else
      transient=attestation_fetch_failed
      echo "  ${name}: failed to fetch the attestation" >&2
    fi
    head -5 "${work}/err.txt" | sed 's/^/    /' >&2
    continue
  fi
  bundles=("${dl}"/*.jsonl)
  if [ "${#bundles[@]}" -ne 1 ] || [ ! -s "${bundles[0]}" ]; then
    transient=attestation_fetch_failed
    echo "  ${name}: the downloaded attestation was not found" >&2
    continue
  fi

  args=(attestation verify "${file}" --repo "${name}" --source-ref "refs/tags/${tag}" --source-digest "${commit}"
    --bundle "${bundles[0]}" --custom-trusted-root "${trusted_root}" --format json)
  if [ -n "${signer}" ]; then args+=(--signer-workflow "${name}/${signer}"); fi
  if ! gh "${args[@]}" > "${work}/out.json" 2> "${work}/err.txt"; then
    genuine=verification_failed
    echo "  ${name}: not verified" >&2
    head -5 "${work}/err.txt" | sed 's/^/    /' >&2
    continue
  fi
  # 名前は別のリポジトリに使われうるため、証明書のリポジトリ ID が登録したものと同じことも確かめる。
  found_id=$(jq -r '.[0].verificationResult.signature.certificate.sourceRepositoryIdentifier // empty' "${work}/out.json")
  if [ -n "${repository_id}" ] && [ "${found_id}" != "${repository_id}" ]; then
    genuine=repository_id_mismatch
    echo "  ${name}: repository id ${found_id} differs from ${repository_id}" >&2
    continue
  fi
  # buildSignerURI は https://github.com/<owner>/<repo>/<workflow のパス>@<ref> の形。
  uri=$(jq -r '.[0].verificationResult.signature.certificate.buildSignerURI // empty' "${work}/out.json")
  emit passed "" "$(sed -E 's#^https://github\.com/[^/]+/[^/]+/##; s#@.*$##' <<< "${uri}")"
  exit 0
done

if [ -n "${transient}" ]; then
  emit error "${transient}"
else
  emit failed "${genuine}"
fi
