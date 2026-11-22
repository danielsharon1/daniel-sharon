# Coach Daniel: promo video (motion graphics)

A 66-second product film for the Coach Daniel app (https://coach-daniel.expo.app), rendered fully in code:

- **Real app footage.** Every phone and laptop screen is a frame-accurate recording of the live app, not a mock-up. `recorder/` drives the app with Playwright while a virtual clock (`recorder/vt-init.js`) advances exactly 1/30 s per frame, so taps, timers and transitions stay perfectly smooth.
- **3D + technical drawing.** `render/` is a Three.js scene rendered frame by frame in headless Chromium. It uses a procedural phone and laptop, blueprint wireframes that "materialize" via a scan plane, a 3D weight chart and the app icon. The dumbbell and bumper plate are photoreal AI product shots (`render/assets/`, cut out) animated in 2.5D.
- **Kinetic typography.** Hebrew RTL kinetic text (Karantina headlines, Rubik body) and rounded glass callouts are a DOM/SVG overlay, composited in the same screenshot. `render/qa_layout.js` checks every frame that no text leaves the safe zone (9:16 keeps clear of platform UI).
- **Audio.** `audio/make_audio.py` synthesizes an original 120 BPM track in A minor, plus SFX (risers, impacts, whooshes, scan sweeps, UI taps). Every SFX is placed from the edit's cue times.

## Storyboard (16:9 and 9:16 share one timeline)

| Time | Shot | Transition / technique |
|---|---|---|
| 0–8 s | Blueprint of the phone draws itself. A scan plane turns it into a real phone, which boots to the login screen. "המאמן שלך. בכיס." then "תוכנית אימונים. תפריט. מעקב. במקום אחד." | Technical drawing, continuous dolly, materialize scan |
| 8–16 s | Real onboarding (6 questions) with a live spec sheet, then the computed targets (2,870 kcal) on a card lifted off the screen | Continuous orbit, exploded UI layer |
| 16 s | Camera pushes into the dumbbell icon on the home screen. The icon dissolves into a real dumbbell | **Match cut** (icon to photoreal object) |
| 16–26 s | The dumbbell settles, then flies past the camera to the workout screen: log weight and reps, finish the set, rest timer. Callouts. The phone slides out as a weight plate rolls in | Continuous camera through space |
| 26 s | Plate to the calorie ring on the nutrition screen | **Match cut** (circle to circle, same size and position) |
| 26–35 s | Mark meals, the ring updates, ready-made swaps | Exploded UI + callouts |
| 35 s | The phone flips around its back and comes back on the metrics screen | Continuous flip |
| 35–42 s | The weight trend leaves the screen as a 3D chart | Screen-to-3D extrusion |
| 42–56 s | "ולמאמנים -": the laptop draws as a blueprint and materializes. Real coach editor: library, build a workout, publish a version, assign to a trainee. A beam carries the program to the trainee's phone | Blueprint motif returns, data beam |
| 56 s | Push into the trainee's phone, out to a lineup of 5 phones | **Match cut** (identical screen framing) |
| 60–66 s | End card: 3D app icon, "Coach Daniel", tagline, "נכנסים בלי הרשמה", URL | |

## Re-render

```bash
npm install                                  # three
# 1) app recordings (optional, already captured): needs the app + Supabase hosts reachable
SCRATCH=/path/to/work node recorder/scenes.js onboarding workout nutrition metrics home coach assigned
# 2) audio
python3 audio/make_audio.py /path/to/work/audio
# 3) video: serve the repo root, then render (aspect h = 1920x1080, v = 1080x1920)
npx http-server -p 8123 -s -c-1 . &
ln -sfn /path/to/work/rec render/rec
GRAIN=0 node render/render.js h /path/to/work/out 3   # workers=3
node render/qa_layout.js v 3                      # safe-zone check (0 issues expected)
./finish.sh h /path/to/work/out /path/to/work/audio coach-daniel-promo-16x9.mp4
```

Preview single frames: `node render/snap.js h 12.5,26.0 /tmp/snaps`.

Copy, timings and camera paths live in `render/js/timeline.js` (one `S1…S7` function per shot). To change the copy, edit the strings and re-render.

## Notes

- The recordings come from a guest account with demo data (weight history, steps, sleep, water) and coach mode turned on, plus a fresh guest for onboarding. Both accounts are in the app's real Supabase project.
- The phone and laptop are generic procedural models, with no third-party branding.
