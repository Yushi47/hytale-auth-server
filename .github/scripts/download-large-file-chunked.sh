#!/usr/bin/env bash
set -euo pipefail

url="${1:?usage: download-large-file-chunked.sh URL OUT}"
out="${2:?usage: download-large-file-chunked.sh URL OUT}"
chunk_size="${CHUNK_SIZE:-8388608}"
max_attempts="${MAX_ATTEMPTS:-8}"

tmp_dir="${out}.parts"
mkdir -p "$tmp_dir"

size="$(
  curl -sSI --http1.1 --max-time 30 "$url" \
    | awk 'tolower($1) == "content-length:" { gsub("\r", "", $2); print $2 }' \
    | tail -1
)"

if ! [[ "$size" =~ ^[0-9]+$ ]] || [ "$size" -le 0 ]; then
  echo "Could not determine Content-Length for $url" >&2
  exit 1
fi

echo "Downloading $url"
echo "Size: $size bytes"
echo "Chunk size: $chunk_size bytes"

start=0
part=0
while [ "$start" -lt "$size" ]; do
  end=$((start + chunk_size - 1))
  if [ "$end" -ge "$size" ]; then
    end=$((size - 1))
  fi

  part_file="$tmp_dir/part-$(printf '%06d' "$part")"
  tmp_file="$part_file.tmp"
  expected=$((end - start + 1))

  if [ -f "$part_file" ]; then
    actual="$(stat -c%s "$part_file")"
    if [ "$actual" -eq "$expected" ]; then
      echo "part $part already complete ($expected bytes)"
      start=$((end + 1))
      part=$((part + 1))
      continue
    fi
  fi

  attempt=1
  while true; do
    echo "part $part bytes=$start-$end attempt=$attempt/$max_attempts"
    rm -f "$tmp_file"

    if curl --http1.1 \
      --fail \
      --location \
      --show-error \
      --retry 3 \
      --retry-delay 2 \
      --retry-all-errors \
      --connect-timeout 20 \
      --max-time 90 \
      --range "$start-$end" \
      --output "$tmp_file" \
      "$url"; then
      actual="$(stat -c%s "$tmp_file")"
      if [ "$actual" -eq "$expected" ]; then
        mv "$tmp_file" "$part_file"
        break
      fi
      echo "part $part size mismatch: got $actual expected $expected" >&2
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "part $part failed after $max_attempts attempts" >&2
      exit 1
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  start=$((end + 1))
  part=$((part + 1))
done

echo "Assembling $out"
cat "$tmp_dir"/part-* > "$out.tmp"

actual_total="$(stat -c%s "$out.tmp")"
if [ "$actual_total" -ne "$size" ]; then
  echo "final size mismatch: got $actual_total expected $size" >&2
  exit 1
fi

mv "$out.tmp" "$out"
ls -lh "$out"
