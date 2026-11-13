(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VOXAudioAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function midiToNote(midi) {
    if (!Number.isFinite(midi)) return '—';
    const rounded = Math.round(midi);
    return NOTE_NAMES[(rounded % 12 + 12) % 12] + (Math.floor(rounded / 12) - 1);
  }

  function quantile(values, q) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
  }

  // YIN-style cumulative-mean normalised difference; uncertain frames are omitted.
  function detectPitch(frame, sampleRate) {
    const stride = Math.max(1, Math.floor(sampleRate / 8000));
    const rate = sampleRate / stride;
    const count = Math.floor(frame.length / stride);
    if (count < 160 || !Number.isFinite(rate)) return null;
    let mean = 0;
    for (let i = 0; i < count; i++) mean += frame[i * stride];
    mean /= count;
    let energy = 0;
    for (let i = 0; i < count; i++) {
      const value = frame[i * stride] - mean;
      energy += value * value;
    }
    if (Math.sqrt(energy / count) < 0.012) return null;

    const minLag = Math.max(2, Math.floor(rate / 1000));
    const maxLag = Math.min(Math.floor(rate / 65), Math.floor(count / 2));
    if (maxLag <= minLag) return null;
    const compareCount = count - maxLag;
    const normalized = new Float64Array(maxLag + 1);
    let cumulative = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < compareCount; i++) {
        const a = frame[i * stride] - mean;
        const b = frame[(i + lag) * stride] - mean;
        const delta = a - b;
        sum += delta * delta;
      }
      cumulative += sum;
      normalized[lag] = cumulative > 0 ? (sum * lag) / cumulative : 1;
    }

    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (normalized[lag] < 0.20) {
        bestLag = lag;
        while (bestLag < maxLag && normalized[bestLag + 1] < normalized[bestLag]) bestLag++;
        break;
      }
    }
    if (!bestLag) {
      let best = Infinity;
      for (let lag = minLag; lag <= maxLag; lag++) {
        if (normalized[lag] < best) {
          best = normalized[lag];
          bestLag = lag;
        }
      }
    }
    const periodicity = normalized[bestLag];
    const hz = rate / bestLag;
    if (periodicity > 0.38 || hz < 65 || hz > 1000) return null;
    return { hz, confidence: clamp(1 - periodicity, 0, 1) };
  }

  function estimateTempo(samples, sampleRate) {
    const step = Math.max(1, Math.floor(sampleRate * 0.02));
    const envelope = [];
    for (let i = 0; i + step < samples.length; i += step) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += samples[i + j] * samples[i + j];
      envelope.push(Math.sqrt(sum / step));
    }
    if (envelope.length < 100) return { bpm: null, confidence: 0 };
    const floor = quantile(envelope, 0.5);
    const peak = quantile(envelope, 0.85);
    if (peak - floor < 0.008) return { bpm: null, confidence: 0 };
    const threshold = floor + (peak - floor) * 0.38;
    const peaks = [];
    const refractory = 8;
    for (let i = 2; i < envelope.length - 2; i++) {
      if (envelope[i] > threshold && envelope[i] >= envelope[i - 1] && envelope[i] > envelope[i + 1] && (!peaks.length || i - peaks[peaks.length - 1] >= refractory)) peaks.push(i);
    }
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      const ms = (peaks[i] - peaks[i - 1]) * 20;
      if (ms >= 280 && ms <= 1500) intervals.push(ms);
    }
    if (intervals.length < 3) return { bpm: null, confidence: 0 };
    const median = quantile(intervals, 0.5);
    const bpm = Math.round(60000 / median);
    const deviations = intervals.map(value => Math.abs(value - median) / median);
    const consistency = 1 - Math.min(1, deviations.reduce((sum, value) => sum + value, 0) / deviations.length);
    const confidence = Math.round(Math.min(1, intervals.length / 10) * consistency * 100);
    return bpm >= 40 && bpm <= 200 ? { bpm, confidence } : { bpm: null, confidence: 0 };
  }

  function analyzeSamples(samples, sampleRate) {
    if (!samples || typeof samples.length !== 'number' || !Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new TypeError('Audio samples and a valid sample rate are required.');
    }
    const frameSize = Math.max(160, Math.floor(sampleRate * 0.04));
    const hopSize = Math.max(80, Math.floor(sampleRate * 0.08));
    const points = [];
    let totalFrames = 0;
    for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
      totalFrames++;
      const frame = samples.subarray ? samples.subarray(start, start + frameSize) : samples.slice(start, start + frameSize);
      const detected = detectPitch(frame, sampleRate);
      if (!detected) continue;
      points.push({ time: start / sampleRate, hz: detected.hz, midi: Math.round(69 + 12 * Math.log2(detected.hz / 440)), confidence: detected.confidence });
    }
    const tempo = estimateTempo(samples, sampleRate);
    const coverage = Math.round(points.length / Math.max(1, totalFrames) * 100);
    if (!points.length) {
      return { medianHz: null, medianNote: '—', lowNote: '—', highNote: '—', voicedFrames: 0, totalFrames, pitchCoverage: 0, pitchConfidence: 0, estimatedTempo: tempo.bpm, tempoConfidence: tempo.confidence, melodyNotes: [] };
    }

    const frequencies = points.map(point => point.hz);
    const confidenceValues = points.map(point => point.confidence);
    const medianHz = quantile(frequencies, 0.5);
    const lowHz = quantile(frequencies, 0.1);
    const highHz = quantile(frequencies, 0.9);
    const melodyNotes = [];
    let group = null;
    for (const point of points) {
      if (!group || Math.abs(point.midi - group.midi) > 1 || point.time - group.lastTime > 0.20) {
        if (group && group.frames >= 2) {
          melodyNotes.push({ time: group.start, duration: Math.max(0.12, group.lastTime - group.start + hopSize / sampleRate), midi: Math.round(group.midi), confidence: Math.round(group.confidence / group.frames * 100) / 100 });
        }
        group = { midi: point.midi, start: point.time, lastTime: point.time, frames: 1, confidence: point.confidence };
      } else {
        group.midi = (group.midi * group.frames + point.midi) / (group.frames + 1);
        group.lastTime = point.time;
        group.frames++;
        group.confidence += point.confidence;
      }
    }
    if (group && group.frames >= 2) {
      melodyNotes.push({ time: group.start, duration: Math.max(0.12, group.lastTime - group.start + hopSize / sampleRate), midi: Math.round(group.midi), confidence: Math.round(group.confidence / group.frames * 100) / 100 });
    }
    return {
      medianHz: Math.round(medianHz * 10) / 10,
      medianNote: midiToNote(69 + 12 * Math.log2(medianHz / 440)),
      lowNote: midiToNote(69 + 12 * Math.log2(lowHz / 440)),
      highNote: midiToNote(69 + 12 * Math.log2(highHz / 440)),
      voicedFrames: points.length,
      totalFrames,
      pitchCoverage: coverage,
      pitchConfidence: Math.round(quantile(confidenceValues, 0.5) * 100),
      estimatedTempo: tempo.bpm,
      tempoConfidence: tempo.confidence,
      melodyNotes
    };
  }

  return { analyzeSamples, detectPitch, estimateTempo, midiToNote };
});
