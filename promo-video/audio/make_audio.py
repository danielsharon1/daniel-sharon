"""Original soundtrack + SFX for the Coach Daniel promo (120 BPM, A minor), synced to the edit.
Outputs out/music.wav, out/sfx.wav, out/mix_raw.wav (48 kHz stereo). Mastering is done with ffmpeg loudnorm."""
import numpy as np, json, os, sys
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; DUR = 66.6; N = int(SR * DUR)
rng = np.random.default_rng(7)
BEAT = 0.5; S16 = BEAT / 4
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'; os.makedirs(OUT, exist_ok=True)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2))

def t_(n): return np.arange(n) / SR
def filt(x, kind, f, order=2):
    if kind == 'bp': sos = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], 'bandpass', output='sos')
    else: sos = butter(order, f / (SR / 2), kind, output='sos')
    return sosfilt(sos, x, axis=0)
def place(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0: return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    s0 = max(0, -i); i = max(0, i); n = min(len(sig) - s0, len(buf) - i)
    buf[i:i + n] += sig[s0:s0 + n] * gain
def adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, sus_len=None):
    t = t_(n); e = np.zeros(n)
    A = int(a * SR); D = int(d * SR)
    e[:A] = np.linspace(0, 1, A, endpoint=False) if A else e[:A]
    e[A:A + D] = np.linspace(1, s, max(1, len(e[A:A + D])))[:len(e[A:A + D])]
    e[A + D:] = s
    if r and s > 0: R = int(r * SR); e[-R:] *= np.linspace(1, 0, R)
    return e
def saw(f, n, phase=0.0):
    ph = (phase + np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR) % 1.0
    return 2 * ph - 1
def note_hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------- instruments ----------------
def kick():
    n = int(0.5 * SR); t = t_(n)
    f = 46 + 115 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.0) * np.minimum(1, t / 0.0015)
    click = filt(rng.standard_normal(n), 'highpass', 2500) * np.exp(-t * 400) * 0.35
    return np.tanh(1.6 * (body + click)) * 0.9
KICK = kick()
def clap():
    n = int(0.45 * SR); t = t_(n); x = np.zeros(n)
    for k, dt in enumerate([0, 0.011, 0.022]):
        i = int(dt * SR); m = n - i; tt = t_(m); x[i:] += rng.standard_normal(m) * np.exp(-tt * (90 if k < 2 else 13))
    return filt(x, 'bp', (900, 5200)) * 0.55
CLAP = clap()
def hat(open_=False):
    n = int((0.3 if open_ else 0.06) * SR); t = t_(n)
    x = filt(rng.standard_normal(n), 'highpass', 7200) * np.exp(-t * (14 if open_ else 75))
    return x * (0.28 if open_ else 0.33)
HC, HO = hat(), hat(True)
def pluck(freq, dur=0.22, bright=1.0):
    n = int(dur * SR); t = t_(n)
    x = 0.6 * saw(freq, n) + 0.4 * saw(freq * 1.006, n, 0.3)
    env = np.exp(-t * 16) * np.minimum(1, t / 0.002)
    # simple decaying lowpass: blend of filtered versions
    lo = filt(x, 'lowpass', 900 * bright); hi = filt(x, 'lowpass', 4200 * bright)
    k = np.exp(-t * 22)
    return (lo * (1 - k) + hi * k) * env * 0.5
def bell(freq, dur=1.2):
    n = int(dur * SR); t = t_(n)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 5) + 0.12 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 9)
    return x * np.exp(-t * 3.2) * np.minimum(1, t / 0.004) * 0.3
def pad_chord(midis, dur, cutoff=1600, amp=0.12):
    n = int(dur * SR); t = t_(n); L = np.zeros(n); R = np.zeros(n)
    for m in midis:
        f = note_hz(m)
        for d, side in [(-0.11, 'L'), (0.0, 'B'), (0.12, 'R'), (0.05, 'L'), (-0.06, 'R')]:
            s = saw(f * 2 ** (d / 12 * 0.6), n, rng.random())
            if side in 'LB': L += s
            if side in 'RB': R += s
    env = np.minimum(1, t / 0.7) * np.minimum(1, (dur - t) / 0.6)
    X = np.stack([L, R], 1) * env[:, None]
    return filt(X, 'lowpass', cutoff, 2) * amp / len(midis)
def bass_note(freq, dur=0.22):
    n = int(dur * SR); t = t_(n)
    x = saw(freq, n) * 0.7 + np.sin(2 * np.pi * freq * t) * 0.6
    env = np.minimum(1, t / 0.003) * np.exp(-t * 7)
    cut = filt(x, 'lowpass', 520) * 0.85 + filt(x, 'lowpass', 1600) * 0.15 * np.exp(-t * 30)
    return np.tanh(cut * env * 1.6) * 0.55
def noise_sweep(dur, f0, f1, q=0.35, shape='rise'):
    n = int(dur * SR); t = t_(n); x = rng.standard_normal(n); out = np.zeros(n)
    seg = 1024
    for i in range(0, n, seg):
        k = i / n; fc = f0 * (f1 / f0) ** k
        lo, hi = max(40, fc * (1 - q)), min(SR / 2 - 100, fc * (1 + q))
        out[i:i + seg] = filt(x[max(0, i - 2048):i + seg], 'bp', (lo, hi))[-len(x[i:i + seg]):]
    env = (t / dur) ** 2.2 if shape == 'rise' else np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return out * env
def riser(dur):
    n = int(dur * SR); t = t_(n)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2.6 * t / dur)) / SR) * (t / dur) ** 2 * 0.12
    return noise_sweep(dur, 300, 7000, 0.4) * 0.5 + tone
def impact(heavy=1.0, dur=2.4):
    n = int(dur * SR); t = t_(n)
    f = 38 + 50 * np.exp(-t * 9); boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * np.minimum(1, t / 0.002)
    crash = filt(rng.standard_normal(n), 'highpass', 2500) * np.exp(-t * 3.0) * 0.25
    hit = filt(rng.standard_normal(n), 'bp', (200, 1800)) * np.exp(-t * 25) * 0.6
    return np.tanh((boom * 1.1 * heavy + crash + hit) * 1.2) * 0.8
def whoosh(dur, f0=400, f1=4000, pan0=-0.6, pan1=0.6):
    x = noise_sweep(dur, f0, f1, 0.6, 'bell') * 0.9
    n = len(x); p = np.linspace(pan0, pan1, n)
    l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1) * 1.3
def blip(freq=2400, dur=0.035, amp=0.18):
    n = int(dur * SR); t = t_(n); return np.sin(2 * np.pi * freq * t) * np.exp(-t * 90) * amp
def tap_click():
    n = int(0.05 * SR); t = t_(n)
    return (filt(rng.standard_normal(n), 'bp', (1500, 6000)) * np.exp(-t * 260) * 0.5 + np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 160) * 0.25)
def mouse_click():
    n = int(0.04 * SR); t = t_(n)
    return filt(rng.standard_normal(n), 'bp', (800, 3500)) * np.exp(-t * 330) * 0.45
def scan_sound(dur, up=True):
    n = int(dur * SR); t = t_(n)
    f = (600 * 2 ** (2.2 * t / dur)) if up else (2600 * 2 ** (-2.2 * t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.08 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.04
    shimmer = filt(rng.standard_normal(n), 'highpass', 5000) * 0.08
    env = np.sin(np.pi * t / dur) ** 0.8
    return (tone + shimmer + noise_sweep(dur, 800, 6000, 0.3, 'bell') * 0.35) * env
def reverb(x, secs=2.4, wet=0.25):
    n = int(secs * SR); t = t_(n)
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 3.2 / secs * 2.2)[:, None]
    ir = filt(ir, 'lowpass', 6000); ir /= np.sqrt((ir ** 2).sum(0))
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 2.0

# ---------------- arrangement ----------------
CHORDS = [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 60, 64], [55, 59, 62, 67]]   # Am(add9-ish) F(add9) C G(add?)
ROOTS = [45, 41, 48, 43]
def chord_at(t): return int(t // 2) % 4
def in_any(t, spans): return any(a <= t < b for a, b in spans)
KICK_ON = [(8.0, 41.0), (45.0, 59.95)]
BASS_ON = [(8.0, 41.0), (45.0, 60.0)]
HAT_ON = [(2.0, 41.5), (43.0, 60.0)]
OPEN_ON = [(16.0, 41.0), (49.0, 60.0)]
CLAP_ON = [(10.0, 41.0), (47.0, 60.0)]
ARP_ON = [(4.0, 41.0), (44.0, 60.0)]
BELL_ON = [(16.0, 26.0), (53.5, 60.0)]

kick_times = []
t = 0.0
while t < DUR:
    b = round(t / BEAT)
    if in_any(t, KICK_ON) and not (40.0 <= t < 41.0 and b % 2):  # thin out before the break
        place(music, KICK, t, 0.95); kick_times.append(t)
    if in_any(t, CLAP_ON) and b % 2 == 1: place(music, CLAP, t, 0.55, 0.05)
    if in_any(t + BEAT / 2, OPEN_ON): place(music, HO, t + BEAT / 2, 0.5, 0.25)
    for s in range(4):
        ts = t + s * S16
        if in_any(ts, HAT_ON):
            g = (0.18 if ts < 8 else 0.42) * (1.0 if s % 2 else 0.55)
            place(music, HC, ts, g, -0.3 if s % 2 else 0.3)
        # offbeat rolling bass: 16ths except the kick position
        if in_any(ts, BASS_ON) and s != 0:
            root = ROOTS[chord_at(ts)]
            place(music, bass_note(note_hz(root), 0.13 if s != 2 else 0.2), ts, 0.62 if s == 2 else 0.4)
    t += BEAT
# pads (one per bar), louder in intro / break / outro
for bar in range(int(DUR // 2) + 1):
    t0 = bar * 2.0
    if t0 >= 66: break
    ch = CHORDS[bar % 4]
    lvl = 1.0 if (t0 < 8 or 41.5 <= t0 < 45 or t0 >= 60) else 0.55
    cut = 900 + 1400 * min(1, t0 / 8) if t0 < 8 else (2200 if t0 >= 60 else 1700)
    place(music, pad_chord(ch, 2.35 if t0 < 64 else 2.6, cut, 0.16 * lvl), t0)
# arp: 16th notes over chord tones, filter opening in the intro
for i in range(int(DUR / S16)):
    ts = i * S16
    if not in_any(ts, ARP_ON): continue
    ch = CHORDS[chord_at(ts)]; pat = [0, 1, 2, 3, 2, 1, 2, 3]
    m = ch[pat[i % 8]] + 12
    bright = 0.35 + 0.65 * min(1, max(0, (ts - 4) / 6)) if ts < 16 else 1.0
    g = 0.11 if ts < 8 else 0.16
    place(music, pluck(note_hz(m), 0.2, bright), ts, g, 0.35 if i % 2 else -0.35)
# bell motif (dotted rhythm on chord tops)
for bar in range(33):
    t0 = bar * 2.0
    if not in_any(t0, BELL_ON): continue
    ch = CHORDS[bar % 4]
    for k, (dt, idx) in enumerate([(0, 3), (0.75, 2), (1.5, 3)]):
        place(music, bell(note_hz(ch[idx] + 12), 1.1), t0 + dt, 0.18, -0.2 + 0.2 * k)
# sub drone in intro
n = int(8 * SR); tt = t_(n)
place(music, np.sin(2 * np.pi * 55 * tt) * np.minimum(1, tt / 3) * np.minimum(1, (8 - tt) / 0.3) * 0.18, 0)
# sidechain duck (pads/bass/arp breathe with the kick)
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR); m = min(N - i, int(0.35 * SR)); tt = t_(m)
    duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.55 * np.exp(-tt / 0.09))
# apply duck to everything except kick: approximate by ducking the whole bus and re-adding kick dry
kick_bus = np.zeros((N, 2))
for kt in kick_times: place(kick_bus, KICK, kt, 0.95)
music = (music - kick_bus) * duck[:, None] + kick_bus
music = reverb(music, 1.6, 0.14)
# outro fade
fade = np.ones(N); a, b = int(64.6 * SR), int(66.3 * SR); fade[a:b] = np.linspace(1, 0, b - a); fade[b:] = 0
music *= fade[:, None]

# ---------------- SFX ----------------
cues = json.load(open(os.path.join(os.path.dirname(__file__), 'cues.json')))
for tt_ in cues['taps_phone']: place(sfx, tap_click(), tt_, 0.55, 0.1)
for tt_ in cues['taps_mouse']: place(sfx, mouse_click(), tt_, 0.45, -0.1)
for t0, t1 in [(6.0, 8.0), (14.9, 16.0), (24.7, 26.0), (40.2, 42.0), (52.2, 53.55), (58.6, 60.0)]: place(sfx, riser(t1 - t0), t0, 0.55)
for tt_, h in [(8.0, 0.55), (16.0, 1.0), (26.0, 0.75), (42.0, 1.0), (60.0, 1.15)]: place(sfx, impact(h), tt_, 0.8 * min(1, h + 0.2))
for t0, t1, f0, f1, p0, p1 in [(15.0, 16.0, 300, 3500, 0, 0), (18.25, 19.35, 250, 2500, 0.2, -0.9), (33.7, 35.3, 400, 3000, -0.5, 0.5), (37.6, 38.9, 300, 4500, 0, 0.6),
                                 (55.15, 56.05, 300, 3800, 0.3, -0.2), (59.45, 60.4, 500, 5000, 0, 0), (26.0, 27.4, 3000, 500, 0, 0)]:
    place(sfx, whoosh(t1 - t0, f0, f1, p0, p1), t0, 0.6)
place(sfx, scan_sound(1.45, True), 3.95, 0.9); place(sfx, scan_sound(0.6, True), 15.4, 0.5); place(sfx, scan_sound(1.0, False), 41.0, 0.8); place(sfx, scan_sound(1.1, True), 43.95, 0.8)
# blueprint drafting blips
for i in range(26):
    tb = 0.15 + i * 0.12 + rng.random() * 0.05
    place(sfx, blip(2800 + rng.random() * 2400, 0.03, 0.09), tb, 1.0, rng.random() * 1.2 - 0.6)
for tb in [42.6, 43.2]: place(sfx, blip(1320, 0.12, 0.16), tb, 1.0)
# rest timer ticks
for i in range(5): place(sfx, blip(4200, 0.02, 0.14), 22.2 + i * 0.5, 1.0, 0.3)
# plate roll rumble + settle clunk
n = int(1.6 * SR); tt = t_(n); rum = filt(rng.standard_normal(n), 'lowpass', 180) * np.sin(np.pi * tt / 1.6) * 0.9
place(sfx, rum, 24.3, 0.9, -0.4); place(sfx, impact(0.35, 0.8), 25.5, 0.5)
# beam zap + arrival chime
n = int(0.75 * SR); tt = t_(n); zap = np.sin(2 * np.pi * np.cumsum(500 * 2 ** (2.5 * tt / 0.75)) / SR) * 0.12 * np.sin(np.pi * tt / 0.75)
place(sfx, zap, 53.55, 1.0, 0.3)
for k, m in enumerate([81, 85, 88]): place(sfx, bell(note_hz(m), 1.4), 54.3 + k * 0.06, 0.32, 0.4)
# text slams (soft thumps)
for tb in [16.3, 16.8, 17.3, 7.15, 57.1]: place(sfx, impact(0.25, 0.4), tb, 0.35)
# final sparkle
for k, m in enumerate([69, 76, 81, 88]): place(sfx, bell(note_hz(m), 2.5), 60.05 + k * 0.09, 0.22, -0.3 + 0.2 * k)
sfx = reverb(sfx, 2.2, 0.22)
sfx *= fade[:, None] if False else 1

def write(path, x):
    import wave
    x = np.clip(x, -1, 1); d = (x * 32767).astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
mix = np.tanh((music * 0.85 + sfx * 0.9) * 1.1) * 0.9
pk = max(1e-9, np.abs(music).max()); write(os.path.join(OUT, 'music.wav'), music / pk * 0.89)
pk = max(1e-9, np.abs(sfx).max()); write(os.path.join(OUT, 'sfx.wav'), sfx / pk * 0.89)
write(os.path.join(OUT, 'mix_raw.wav'), mix / max(1e-9, np.abs(mix).max()) * 0.89)
print('ok', N / SR, 'kicks', len(kick_times))
