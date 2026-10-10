"""Render idle -> redline -> lift sweeps from single engine loops (pitch by resampling)."""
import sys, wave
import numpy as np

RATE = 44100

def load(path):
    w = wave.open(path)
    n, ch, width, rate = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    raw = w.readframes(n)
    if width == 2:
        x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768
    else:
        x = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128) / 128
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, rate

def sweep(x, rate, seconds, pitch_at):
    """pitch_at(t) -> playback rate relative to the recording; the loop wraps."""
    t = np.arange(int(seconds * RATE)) / RATE
    step = pitch_at(t) * rate / RATE
    pos = np.cumsum(step) % len(x)
    i = pos.astype(int); f = pos - i
    out = x[i] * (1 - f) + x[(i + 1) % len(x)] * f
    return out

def main(out_path, *paths):
    parts = []
    for p in paths:
        x, rate = load(p)
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
        def pitch(t):
            # 1 s idle, 3.5 s rising to redline with two "upshifts", 1.5 s lift-off.
            p = np.where(t < 1, 0.55,
                np.where(t < 4.5, 0.55 + 1.65 * ((t - 1) / 3.5) ** 1.2, 2.2 - 1.2 * np.clip((t - 4.5) / 1.5, 0, 1)))
            return p
        y = sweep(x, rate, 6.0, pitch)
        env = np.ones_like(y); env[:2000] = np.linspace(0, 1, 2000); env[-4000:] = np.linspace(1, 0, 4000)
        parts += [y * env, np.zeros(int(0.5 * RATE))]
    y = np.concatenate(parts)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    w = wave.open(out_path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes()); w.close()

if __name__ == '__main__':
    main(sys.argv[1], *sys.argv[2:])
