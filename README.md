# TranceForge 🎹⚡

**סאונד ליד מוכן לטראנס** – פלאגין VST3 / AU / Standalone. בוחרים סאונד, מנגנים, וזה כבר נשמע כמו טראק.

![TranceForge](docs/screenshot.png)

A ready-to-play trance lead instrument. No oscillators to program – pick a sound, play, done.

---

## איך משתמשים
1. **בוחרים סאונד** (חיצים `<` `>` או הרשימה) – כל סאונד מגיע מעוצב ומעובד במלואו: סופרסו, שכבת אוקטבה, "ביס" בהתקפה, פילטר, כורוס, דילאי ו-reverb.
2. **מנגנים** – מקלדת MIDI, ה-piano roll של ה-DAW, או המקלדת שבתוך הפלאגין.
3. **רוצים מלודיה מוכנה?** בוחרים מלודיה ב-**Melody Player**, ולוחצים על **מקש אחד** – הפלאגין מנגן מלודיית טראנס שלמה בסולם של המקש, מסונכרנת לטמפו של ה-DAW.

### 6 סאונדים מוכנים
| סאונד | אופי |
|---|---|
| **Uplifting Lead** | הליד הקלאסי של uplifting trance – רחב, בוהק, עם דילאי dotted |
| **Euphoric Supersaw** | ענק ורחב, התקפה רכה – לרגעי השיא אחרי הברייקדאון |
| **Pluck Lead** | פלאק חד עם פילטר מהיר ודילאי – למלודיות מהירות |
| **Gated Trance Lead** | סופרסו עם trance gate מובנה (`x.xx.x.xx.xx.x.x`) – מנגנים אקורד ארוך והוא "קוצץ" לבד |
| **Psy Lead** | ליד פסיכדלי רזוננטי עם ויברטו |
| **Bright Solo Lead** | ליד סולו בוהק עם ויברטו מושהה |

### 5 מלודיות מובנות (Melody Player)
`Uplifting Roll` · `Anthem Hook` · `Rising Arp` · `Call & Answer` · `Offbeat Stabs`
– כולן מקוריות, בסולם מינורי, ומתנגנות בכל סולם לפי המקש שלוחצים (התו הנמוך ביותר שנלחץ = הטוניקה).

### 6 כפתורים בלבד
| כפתור | מה זה עושה |
|---|---|
| **TONE** | כהה ↔ בוהק |
| **WIDTH** | מונו ↔ ענק ורחב (detune + סטריאו + כורוס) |
| **PLUCK** | רך ↔ חד וקצר |
| **SPACE** | יבש ↔ דילאי ו-reverb גדולים |
| **GATE** | כבוי ↔ trance gate מלא, מסונכרן לטמפו |
| **VIBRATO** | בלי ↔ ויברטו רחב |

ב-50% כל סאונד נשמע בדיוק כמו שעוצב. ה-gate וה-melody player מסתנכרנים לטמפו של ה-DAW (וב-Standalone רצים על 138 BPM).

---

## בנייה / Building

דרישות: **CMake 3.22+** וקומפיילר C++17 (Visual Studio 2022 / Xcode / GCC / Clang). JUCE יורד אוטומטית בזמן ה-configure.

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

הקבצים ייווצרו ב:
```
build/TranceForge_artefacts/Release/VST3/TranceForge.vst3
build/TranceForge_artefacts/Release/AU/TranceForge.component   (macOS בלבד)
build/TranceForge_artefacts/Release/Standalone/
```

**Linux** – צריך קודם:
```bash
sudo apt install libasound2-dev libfreetype-dev libfontconfig1-dev libx11-dev \
  libxrandr-dev libxinerama-dev libxcursor-dev libxext-dev libxcomposite-dev
```

### הורדה מוכנה בלי לקמפל
בכל push, GitHub Actions בונה את הפלאגין ל-Windows, macOS ו-Linux.
היכנס ל-**Actions → Build TranceForge → הריצה האחרונה → Artifacts** והורד את הגרסה למערכת שלך.

### התקנה
העתק את `TranceForge.vst3` לתיקיית ה-VST3:
- **Windows:** `C:\Program Files\Common Files\VST3\`
- **macOS:** `~/Library/Audio/Plug-Ins/VST3/` (ו-`TranceForge.component` ל-`~/Library/Audio/Plug-Ins/Components/`)
- **Linux:** `~/.vst3/`

ואז בצע rescan של הפלאגינים ב-DAW (Ableton, FL Studio, Cubase, Bitwig, Reaper…).

---

## מבנה הקוד / Code layout

```
Source/
  SoundDesigns.h       – 6 הסאונדים המוכנים (כל ההגדרות הפנימיות)
  LeadVoice.h          – מנוע הליד: 7 מסורים + שכבת אוקטבה + sub + pluck + פילטר + ויברטו
  PhrasePlayer.h       – נגן המלודיות המסונכרן לטמפו
  TranceFX.h           – Trance Gate + Ping-Pong Delay
  PluginProcessor.*    – פרמטרים, מאקרו, שרשרת האודיו
  PluginEditor.*       – הממשק הגרפי + מקלדת
```

שרשרת האודיו: `Melody Player → Lead (8 voices) → High-pass → Trance Gate → Chorus → Ping-Pong Delay → Reverb → Volume + Soft Clip`

ה-gate נמצא *לפני* האפקטים, כך שההדים וה-reverb "נושמים" עם הריתם – בדיוק כמו בטראנס.
