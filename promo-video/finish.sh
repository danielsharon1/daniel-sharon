#!/usr/bin/env bash
# Concat rendered segments, master the audio (EBU R128 -14 LUFS, -1 dBTP, two-pass) and mux.
# usage: ./finish.sh <h|v> <render_dir> <audio_dir> <out.mp4>
set -euo pipefail
A=$1; R=$2; AU=$3; OUT=$4
ffmpeg -y -loglevel error -f concat -safe 0 -i "$R/list_$A.txt" -c copy "$R/video_$A.mp4"
if [ ! -f "$AU/mix_master.wav" ]; then
  J=$(ffmpeg -hide_banner -nostats -i "$AU/mix_raw.wav" -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  MI=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'], d['input_tp'], d['input_lra'], d['input_thresh'], d['target_offset'])")
  read -r I TP LRA TH OFF <<< "$MI"
  ffmpeg -y -loglevel error -i "$AU/mix_raw.wav" -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,aresample=48000" -c:a pcm_s16le "$AU/mix_master.wav"
fi
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$R/video_$A.mp4")
ffmpeg -y -loglevel error -i "$R/video_$A.mp4" -i "$AU/mix_master.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -t "$DUR" -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration,size -of compact "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:" | tr -s ' '
