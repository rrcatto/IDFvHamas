#!/bin/bash
# usage: itch.sh <game-page-url> <filename-substring> <out>
set -e
page="$1"; want="$2"; out="$3"; jar=$(mktemp)
html=$(curl -sL -c "$jar" -b "$jar" --max-time 30 "$page")
csrf=$(echo "$html" | grep -oE 'csrf_token" value="[^"]+"' | head -1 | sed 's/.*value="//;s/"$//')
dlpage=$(curl -sL -c "$jar" -b "$jar" --max-time 30 -X POST --data-urlencode "csrf_token=$csrf" "$page/download_url" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')
dhtml=$(curl -sL -c "$jar" -b "$jar" --max-time 30 "$dlpage")
csrf2=$(echo "$dhtml" | grep -oE 'csrf_token" value="[^"]+"' | head -1 | sed 's/.*value="//;s/"$//')
echo "$dhtml" | python3 -c '
import sys,re
s=sys.stdin.read()
for m in re.finditer(r"data-upload_id=\"(\d+)\".{0,600}?title=\"([^\"]+)\".{0,300}?file_size\"><span>([^<]+)",s,re.S): print(m.group(1),"|",m.group(2),"|",m.group(3))
' > uploads.txt
cat uploads.txt >&2
[ -z "$want" ] && exit 0
id=$(grep -F -- "$want" uploads.txt | head -1 | cut -d' ' -f1)
url=$(curl -s -c "$jar" -b "$jar" --max-time 30 -X POST --data-urlencode "csrf_token=$csrf2" "$page/file/$id?source=game_download" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')
curl -sL --max-time 900 -o "$out" "$url"; ls -la "$out"
