#!/bin/bash
# Build 6 video segments with Ken Burns slow-zoom effect + narration audio.
# Output: segment{1..6}.mp4 in the video-assets directory.

set -uo pipefail

ASSETS_DIR="/home/z/my-project/scripts-doc/video-assets"
FPS=25

for i in 1 2 3 4 5 6; do
  PNG="${ASSETS_DIR}/scene${i}.png"
  WAV="${ASSETS_DIR}/scene${i}.wav"
  OUT="${ASSETS_DIR}/segment${i}.mp4"

  if [[ ! -f "$PNG" || ! -f "$WAV" ]]; then
    echo "[segment${i}] MISSING input (png or wav), skipping"
    continue
  fi

  # Get audio duration (float seconds)
  DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$WAV")
  # Integer frame count, ceil(duration * fps)
  FRAMES=$(awk -v d="$DURATION" -v fps="$FPS" 'BEGIN{ printf "%d", (d*fps + 0.999) }')

  echo "[segment${i}] duration=${DURATION}s  frames=${FRAMES}"

  # Ken Burns: slow zoom-in from 1.0 to ~1.15 over the segment.
  # Pre-scale image to 1280x720 (cover-fit), then apply zoompan.
  # zoompan d=total frames, fps=25, output 1280x720.
  ffmpeg -y -loop 1 -i "$PNG" -i "$WAV" \
    -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,zoompan=z='min(zoom+0.0006,1.12)':d=${FRAMES}:s=1280x720:fps=${FPS}[v]" \
    -map "[v]" -map 1:a \
    -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ar 44100 -ac 2 \
    -t "${DURATION}" \
    -movflags +faststart \
    "$OUT" 2>&1 | tail -5

  if [[ -f "$OUT" ]]; then
    SZ=$(stat -c%s "$OUT")
    echo "[segment${i}] ✓ OK  size=$((SZ/1024)) KB"
  else
    echo "[segment${i}] ✗ FAILED — falling back to static image"
    ffmpeg -y -loop 1 -i "$PNG" -i "$WAV" \
      -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1" \
      -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -tune stillimage \
      -c:a aac -b:a 128k -ar 44100 -ac 2 \
      -shortest -movflags +faststart \
      "$OUT" 2>&1 | tail -5
    [[ -f "$OUT" ]] && echo "[segment${i}] ✓ fallback OK" || echo "[segment${i}] ✗ fallback FAILED"
  fi
done

echo ""
echo "=== Segments built ==="
ls -lh "${ASSETS_DIR}"/segment*.mp4 2>/dev/null
