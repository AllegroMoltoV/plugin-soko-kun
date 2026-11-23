#!/usr/bin/env bash
# 取得したソースのディレクトリから、通信の API の使用を探し、{hits, truncated} の JSON を標準出力に書く。
# ソースは実行もビルドもせず、文字列で探すだけにする (docs/design/scanning.md の「通信の検出」)。
# パターンの名前は src/review/network.ts の NETWORK_APIS と同じにする。受け口は知らない名前を捨てる。
# 使い方: scan-network.sh <ソースのディレクトリ>
set -euo pipefail

dir="$1"
max_hits=50

patterns=(
  'winhttp|WinHttpOpen|WinHttpConnect|WinHttpSendRequest'
  'wininet|InternetOpen|InternetConnect|InternetOpenUrl|HttpSendRequest'
  'libcurl|curl_easy_init|curl_easy_perform|curl_multi_'
  'qt-network|QNetworkAccessManager|QWebSocket|QTcpSocket|QUdpSocket'
  'socket|WSAStartup|getaddrinfo|\bsocket[[:space:]]*\('
  'cpp-httplib|httplib::Client|httplib::SSLClient'
  'ixwebsocket|ix::WebSocket|ix::HttpClient'
  'websocketpp|websocketpp::'
  'libwebsockets|lws_client_connect'
  'boost-asio|boost::asio::ip::tcp|boost::asio::ip::udp'
  'poco-net|Poco::Net::'
  'nsurlsession|NSURLSession|NSURLConnection'
)

# 拡張子とディレクトリで絞らず、.git を除くすべてのテキストファイルを探す (-I でバイナリは読まない)。C のプリプロセッサは
# 拡張子に関係なく #include で取り込み、grep の --include は大文字と小文字を区別するため、拡張子で絞ると
# net.inc や NET.CPP に置いた通信の処理を見逃す。取得するのはコミット済みのファイルだけなので、build や .deps も探す。
# UTF-8 として読めないバイト (cp1252 や Shift_JIS のコメント) を含む行も当てるため、grep と sort だけをバイト列として実行する。
# UTF-8 のロケールの grep は、その行を出力しないか、Binary file ... matches と出力する。スクリプト全体には掛けず、
# 行の文字列の切り出し (${text:0:160}) を文字単位のまま保つ。
# ツリーの全体は、全パターンで候補のファイルを探す 1 回だけ読み、パターンごとの照合は候補のファイルだけに当てる。
# grep の失敗 (終了コード 2 以上) は、当たり 0 件として扱わずにスクリプトを失敗させる。失敗を 0 件にすると、作者は grep を
# 失敗させるだけで通信の検出を逃れられる。スクリプトが失敗すると、verify.yaml はその版を error として送る。
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
fail() {
  echo "scan-network.sh: $1" >&2
  exit 1
}

expressions=()
for entry in "${patterns[@]}"; do
  expressions+=(-e "${entry#*|}")
done
status=0
LC_ALL=C grep -rlIEZ --exclude-dir=.git "${expressions[@]}" "${dir}" > "${work}/candidates" || status=$?
[ "${status}" -le 1 ] || fail "grep failed while listing candidates (exit ${status})"
candidates=()
# 候補は NUL 区切りのまま sort -z で並べる。結果の順序と max_hits での打ち切りの順を、ファイル名の順にそろえるため。
while IFS= read -r -d '' file; do
  candidates+=("${file}")
done < <(LC_ALL=C sort -z "${work}/candidates")

hits='[]'
count=0
truncated=false
for entry in "${patterns[@]}"; do
  [ "${#candidates[@]}" -gt 0 ] || break
  name="${entry%%|*}"
  regex="${entry#*|}"
  # 候補は grep のコマンドラインに並べず、xargs で分けて渡す。並べると、作者が長いパスのファイルを数百個置いて引数の上限
  # (ARG_MAX) を超えさせ、grep を起動できなくできる。printf は組み込みなので上限を受けず、xargs は候補の順に分けて渡す。
  # xargs は呼んだコマンドが 1〜125 で終わるとまとめて 123 を返し、grep の 1 (一致なし) と 2 (エラー) を区別できない。
  # そこで grep を包み、1 以下は成功、2 以上は 255 で終えて xargs を止める (xargs は 124 を返す)。
  printf '%s\0' "${candidates[@]}" \
    | LC_ALL=C xargs -0 sh -c 'grep -nHIEZ -e "$0" -- "$@"; rc=$?; [ "${rc}" -le 1 ] || exit 255' "${regex}" \
    > "${work}/matches" || fail "grep failed while matching ${name}"
  # grep -Z はファイル名の後ろを NUL にする。ファイル名に : や空白を含めても、ファイル名と行番号の分け方を作者に決めさせない。
  # 行番号は grep が出すため、rest の最初の : までが常に数になる。IFS= はファイル名の末尾の空白を残すために付ける。
  while IFS= read -r -d '' file && IFS= read -r rest; do
    if [ "${count}" -ge "${max_hits}" ]; then
      truncated=true
      break 2
    fi
    number="${rest%%:*}"
    text="${rest#*:}"
    hits=$(jq -c --arg file "${file#"${dir}"/}" --argjson line "${number}" --arg api "${name}" --arg text "${text:0:160}" \
      '. + [{file: $file, line: $line, api: $api, text: $text}]' <<< "${hits}")
    count=$((count + 1))
  done < "${work}/matches"
done

# hits は標準入力から渡す。コマンドライン引数で渡すと、1 つの引数の上限 (128 KiB) を超えたときに jq が起動できない。
jq -n --argjson truncated "${truncated}" '{hits: input, truncated: $truncated}' <<< "${hits}"
