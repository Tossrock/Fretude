

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const OPEN_STRING_NOTES = ['E', 'A', 'D', 'G', 'B', 'E']; // Low E (0) to High E (5)

// Semitone offset from Low E (E2) for each string
// E2=0, A2=5, D3=10, G3=15, B3=19, E4=24
export const STRING_PITCH_OFFSETS = [0, 5, 10, 15, 19, 24]; 

// Initial max fret for Level 1
export const INITIAL_MAX_FRET = 3;
export const TOTAL_FRETS = 12; // Focus on first octave for the app
export const MAX_HEALTH = 5;
export const TIME_LIMIT_MS = 10000; // 10 seconds per question

// Key Signatures that prefer Flats (Relative Major Roots)
// F (1b), A#/Bb (2b), D#/Eb (3b), G#/Ab (4b), C#/Db (5b), F#/Gb (6b)
const PREFER_FLATS_MAJOR = ['F', 'A#', 'D#', 'G#', 'C#', 'F#'];

// Offset of the mode from its Relative Major
const MODE_OFFSETS: Record<string, number> = {
  'MAJOR': 0,
  'DORIAN': 2,
  'PHRYGIAN': 4,
  'LYDIAN': 5,
  'MIXOLYDIAN': 7,
  'NATURAL_MINOR': 9,
  'LOCRIAN': 11
};

export const getDisplayNoteName = (noteName: string, keyRoot?: string | null, keyScale?: string | null): string => {
  if (!noteName.includes('#')) return noteName;

  const noteIndex = NOTES_SHARP.indexOf(noteName);
  if (noteIndex === -1) return noteName;

  // Determine accidental preference based on Key
  let useFlat = false;
  
  if (keyRoot && keyScale && MODE_OFFSETS.hasOwnProperty(keyScale)) {
    const rootIndex = NOTES_SHARP.indexOf(keyRoot);
    if (rootIndex !== -1) {
       const offset = MODE_OFFSETS[keyScale];
       // Calculate Relative Major Root Index
       // relativeMajor = (root - offset) % 12
       let relativeMajorIndex = (rootIndex - offset) % 12;
       if (relativeMajorIndex < 0) relativeMajorIndex += 12;
       
       const relativeMajorRoot = NOTES_SHARP[relativeMajorIndex];
       if (PREFER_FLATS_MAJOR.includes(relativeMajorRoot)) {
         useFlat = true;
       }
    }
  }

  if (useFlat) {
    // Replace ASCII 'b' with Unicode '♭'
    return NOTES_FLAT[noteIndex].replace('b', '♭');
  }

  // Default to Sharp: Replace ASCII '#' with Unicode '♯'
  return noteName.replace('#', '♯');
};

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
  NATURAL_MINOR: [0, 2, 3, 5, 7, 8, 10],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
  LYDIAN: [0, 2, 4, 6, 7, 9, 11],
  MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
  LOCRIAN: [0, 1, 3, 5, 6, 8, 10]
};

export const getScaleNotes = (root: string, type: 'MAJOR' | 'NATURAL_MINOR' | 'DORIAN' | 'PHRYGIAN' | 'LYDIAN' | 'MIXOLYDIAN' | 'LOCRIAN'): string[] => {
  const rootIndex = NOTES_SHARP.indexOf(root);
  if (rootIndex === -1) return [];

  const intervals = SCALE_INTERVALS[type] || SCALE_INTERVALS.MAJOR;
  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTES_SHARP[noteIndex];
  });
};

export const getChordNotes = (root: string, type: 'MAJOR' | 'NATURAL_MINOR'): string[] => {
  const rootIndex = NOTES_SHARP.indexOf(root);
  if (rootIndex === -1) return [];

  // Major: 0 (Root), 4 (Maj3), 7 (P5)
  // Minor: 0 (Root), 3 (Min3), 7 (P5)
  const intervals = type === 'MAJOR' ? [0, 4, 7] : [0, 3, 7];
  
  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTES_SHARP[noteIndex];
  });
};
