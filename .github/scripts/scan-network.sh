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
expressions=()
for entry in "${patterns[@]}"; do
  expressions+=(-e "${entry#*|}")
done
candidates=()
# 候補は NUL 区切りのまま sort -z で並べる。結果の順序と max_hits での打ち切りの順を、ファイル名の順にそろえるため。
while IFS= read -r -d '' file; do
  candidates+=("${file}")
done < <(LC_ALL=C grep -rlIEZ --exclude-dir=.git "${expressions[@]}" "${dir}" | LC_ALL=C sort -z || true)

hits='[]'
count=0
truncated=false
for entry in "${patterns[@]}"; do
  [ "${#candidates[@]}" -gt 0 ] || break
  name="${entry%%|*}"
  regex="${entry#*|}"
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
  done < <(LC_ALL=C grep -nHIEZ -e "${regex}" -- "${candidates[@]}" || true)
done

jq -n --argjson hits "${hits}" --argjson truncated "${truncated}" '{hits: $hits, truncated: $truncated}'
