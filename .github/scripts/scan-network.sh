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

hits='[]'
count=0
truncated=false
for entry in "${patterns[@]}"; do
  name="${entry%%|*}"
  regex="${entry#*|}"
  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    if [ "${count}" -ge "${max_hits}" ]; then
      truncated=true
      break 2
    fi
    file="${line%%:*}"
    rest="${line#*:}"
    number="${rest%%:*}"
    text="${rest#*:}"
    hits=$(jq -c --arg file "${file#"${dir}"/}" --argjson line "${number}" --arg api "${name}" --arg text "${text:0:160}" \
      '. + [{file: $file, line: $line, api: $api, text: $text}]' <<< "${hits}")
    count=$((count + 1))
  done < <(grep -rnIE \
    --include='*.c' --include='*.cc' --include='*.cpp' --include='*.cxx' \
    --include='*.h' --include='*.hh' --include='*.hpp' --include='*.m' --include='*.mm' \
    --exclude-dir=.git --exclude-dir=.deps --exclude-dir=build --exclude-dir='build_*' \
    -e "${regex}" "${dir}" | sort -t: -k1,1 -k2,2n || true)
done

jq -n --argjson hits "${hits}" --argjson truncated "${truncated}" '{hits: $hits, truncated: $truncated}'
