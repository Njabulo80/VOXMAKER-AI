'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeSamples, detectPitch, estimateTempo } = require('./audio-analysis.js');

const sampleRate = 12000;
function tone(seconds, frequency, amplitude = 0.35, rate = sampleRate) {
  const samples = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < samples.length; i++) samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / rate);
  return samples;
}

test('detects a stable A3 tone and builds note events', () => {
  const result = analyzeSamples(tone(2.4, 220), sampleRate);
  assert.ok(Math.abs(result.medianHz - 220) < 5, 'median frequency should be close to 220 Hz');
  assert.equal(result.medianNote, 'A3');
  assert.ok(result.pitchCoverage > 85);
  assert.ok(result.pitchConfidence >= 60);
  assert.ok(result.melodyNotes.length >= 1);
  assert.equal(result.melodyNotes[0].midi, 57);
});

test('handles common 48 kHz Android/browser audio', () => {
  const result = analyzeSamples(tone(1.2, 196, 0.3, 48000), 48000);
  assert.ok(Math.abs(result.medianHz - 196) < 6);
  assert.equal(result.medianNote, 'G3');
});

test('returns a graceful no-pitch result for silence', () => {
  const result = analyzeSamples(new Float32Array(sampleRate * 2), sampleRate);
  assert.equal(result.medianHz, null);
  assert.equal(result.voicedFrames, 0);
  assert.deepEqual(result.melodyNotes, []);
});

test('separates a simple two-note contour', () => {
  const first = tone(1, 220), second = tone(1, 261.6256);
  const samples = new Float32Array(first.length + second.length);
  samples.set(first, 0); samples.set(second, first.length);
  const result = analyzeSamples(samples, sampleRate);
  const notes = new Set(result.melodyNotes.map(item => item.midi));
  assert.ok(notes.has(57));
  assert.ok(notes.has(60));
});

test('estimates a regular 120 BPM pulse without treating silence as tempo', () => {
  const samples = new Float32Array(sampleRate * 6), pulseLength = Math.floor(sampleRate * 0.12);
  for (let pulse = 0; pulse < 11; pulse++) {
    const start = Math.floor(pulse * 0.5 * sampleRate);
    for (let i = 0; i < pulseLength && start + i < samples.length; i++) {
      const fade = Math.min(1, i / 120, (pulseLength - i) / 120);
      samples[start + i] = 0.35 * fade * Math.sin(2 * Math.PI * 220 * i / sampleRate);
    }
  }
  const tempo = estimateTempo(samples, sampleRate);
  assert.ok(tempo.bpm === 120 || tempo.bpm === 60);
  assert.ok(tempo.confidence > 0);
});

test('rejects invalid input cleanly', () => {
  assert.throws(() => analyzeSamples(null, sampleRate), /samples/);
  assert.equal(detectPitch(new Float32Array(100), sampleRate), null);
});
