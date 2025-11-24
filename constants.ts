

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// While flats exist, focusing on sharps for simplicity in early learning avoids enharmonic confusion logic for now.
export const OPEN_STRING_NOTES = ['E', 'A', 'D', 'G', 'B', 'E']; // Low E (0) to High E (5)

// Semitone offset from Low E (E2) for each string
// E2=0, A2=5, D3=10, G3=15, B3=19, E4=24
export const STRING_PITCH_OFFSETS = [0, 5, 10, 15, 19, 24]; 

// Initial max fret for Level 1
export const INITIAL_MAX_FRET = 3;
export const TOTAL_FRETS = 12; // Focus on first octave for the app
export const MAX_HEALTH = 5;
export const TIME_LIMIT_MS = 10000; // 10 seconds per question

export const getNoteAtPosition = (stringIndex: number, fretIndex: number): string => {
  const openNote = OPEN_STRING_NOTES[stringIndex];
  const openNoteIndex = NOTES_SHARP.indexOf(openNote);
  const noteIndex = (openNoteIndex + fretIndex) % 12;
  return NOTES_SHARP[noteIndex];
};

export const getNoteHue = (noteName: string): number => {
  // Map A to 0 (Red) and move 30 degrees per semitone
  const index = NOTES_SHARP.indexOf(noteName);
  if (index === -1) return 0;
  
  // A is index 9. 
  // (index - 9) * 30
  let hue = (index - 9) * 30;
  if (hue < 0) hue += 360;
  
  return hue;
};

/**
 * Returns a CSS HSL string based on Note Hue + Pitch-based Saturation/Lightness
 * @param noteName The note (e.g. "C#")
 * @param stringIndex 0 (Low E) to 5 (High E)
 * @param fretIndex Fret number
 */
export const getNoteColor = (noteName: string, stringIndex: number, fretIndex: number): string => {
  const hue = getNoteHue(noteName);
  
  // Calculate absolute semitone index relative to Low E (0)
  // Low E (Str 0, Fret 0) = 0
  // Middle C (C4) is roughly index 20 (Str 4/B, Fret 1)
  const pitchIndex = STRING_PITCH_OFFSETS[stringIndex] + fretIndex;
  
  // Saturation Logic:
  // Peak at Middle C (~ index 20) at 95%.
  // Drop to ~75% at extremes (0 and ~36).
  const distFromMiddleC = Math.abs(pitchIndex - 20);
  const saturation = Math.max(70, 95 - (distFromMiddleC * 1.2));

  // Lightness (Value) Logic:
  // Increase brightness as pitch goes higher.
  // Base 25% (very dark/low) to 85% (very bright/high).
  // Pitch index 0 -> 36 (approx range for 12 frets)
  const lightness = Math.min(85, Math.max(30, 30 + (pitchIndex * 1.2)));

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Intervals (semitones)
const SCALE_INTERVALS = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  NATURAL_MINOR: [0, 2, 3, 5, 7, 8, 10]
};

export const getScaleNotes = (root: string, type: 'MAJOR' | 'NATURAL_MINOR'): string[] => {
  const rootIndex = NOTES_SHARP.indexOf(root);
  if (rootIndex === -1) return [];

  const intervals = SCALE_INTERVALS[type];
  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTES_SHARP[noteIndex];
  });
};
