#!/usr/bin/env bash
# Render the left stage's Manim scenes (manim/left.py) in both themes and
# encode them for the page:
#   acts  -> <scene>.webm (VP9) + <scene>.mp4 (H.264), EVERY FRAME A KEYFRAME,
#            because the page scrubs them with the scroll and a seek to a
#            non-keyframe decodes from the previous keyframe (visible lag)
#   idles -> the same pair, ordinary GOP, looped by the page
# Output: Media/web/leftfilm/<theme>/<scene>.{webm,mp4} (+ <scene>.webp, the
# first frame, shown before a clip has loaded).
# Needs manim 0.20 (conda-forge: `micromamba create -p env -c conda-forge manim`)
# and ffmpeg. Usage: MANIM=/path/to/manim scripts/render-left.sh [scene...]
set -euo pipefail
cd "$(dirname "$0")/.."
MANIM=${MANIM:-manim}
TMP=$(mktemp -d)
SCENES=${*:-"IdleRest Act0 IdleUntrained Act1 IdleTwin Act2 IdleData Act3 IdleTrain Act4 IdleReal"}
for theme in light dark; do
  out=Media/web/leftfilm/$theme; mkdir -p "$out"
  for sc in $SCENES; do
    THEME=$theme "$MANIM" -qh --disable_caching --media_dir "$TMP/$theme" manim/left.py "$sc" >/dev/null 2>&1
    src=$(find "$TMP/$theme/videos" -name "$sc.mp4" | head -1)
    if [[ $sc == Act* ]]; then gop="-g 1 -keyint_min 1"; crf_w=36; crf_m=30; else gop="-g 60"; crf_w=38; crf_m=31; fi
    # the VP9 copy is the SOFTWARE-decoded fallback (browsers without H.264,
    # e.g. Linux Firefox), so its act clips are at the stage's 1x size: at
    # 1.5x, a decode per scroll step dropped frames there (p90 33-49 ms).
    # The H.264 copy stays at 1.5x: it is decoded in hardware almost everywhere.
    if [[ $sc == Act* ]]; then vs="-vf scale=340:660"; else vs=""; fi
    ffmpeg -v error -y -i "$src" -an $vs -c:v libvpx-vp9 -b:v 0 -crf $crf_w $gop -row-mt 1 -deadline good -pix_fmt yuv420p "$out/$sc.webm"
    ffmpeg -v error -y -i "$src" -an -c:v libx264 -preset slow -crf $crf_m $gop -pix_fmt yuv420p -movflags +faststart "$out/$sc.mp4"
    ffmpeg -v error -y -i "$src" -frames:v 1 -quality 85 "$out/$sc.webp"
    echo "$theme/$sc: $(du -h "$out/$sc.webm" | cut -f1) webm, $(du -h "$out/$sc.mp4" | cut -f1) mp4"
  done
done
rm -rf "$TMP"
