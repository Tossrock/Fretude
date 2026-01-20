
import { TuningPreset, AccidentalStyle } from "./types";

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Standard Tuning Offsets relative to E2 (0)
// E2=0, A2=5, D3=10, G3=15, B3=19, E4=24
export const STANDARD_TUNING_OFFSETS = [0, 5, 10, 15, 19, 24];

export const TUNING_PRESETS: TuningPreset[] = [
  { name: 'Standard (EADGBE)', offsets: [0, 5, 10, 15, 19, 24] },
  { name: 'Drop D (DADGBE)', offsets: [-2, 5, 10, 15, 19, 24] },
  { name: 'Double Drop D (DADGBD)', offsets: [-2, 5, 10, 15, 19, 22] },
  { name: 'DADGAD', offsets: [-2, 5, 10, 15, 17, 22] },
  { name: 'Open D (DADF#AD)', offsets: [-2, 5, 10, 14, 17, 22] },
  { name: 'Open G (DGDGBD)', offsets: [-2, 3, 10, 15, 19, 22] },
  { name: 'Open C (CGCGCE)', offsets: [-4, 3, 8, 15, 20, 24] },
  { name: 'Half Step Down', offsets: [-1, 4, 9, 14, 18, 23] },
  { name: 'Whole Step Down', offsets: [-2, 3, 8, 13, 17, 22] },
];

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

export const getDisplayNoteName = (
  noteName: string, 
  keyRoot?: string | null, 
  keyScale?: string | null, 
  accidentalPreference: AccidentalStyle = 'SHARP'
): string => {
  if (!noteName.includes('#')) return noteName;

  const noteIndex = NOTES_SHARP.indexOf(noteName);
  if (noteIndex === -1) return noteName;

  // Determine accidental preference based on Key
  let useFlat = false;
  let keyContextFound = false;
  
  if (keyRoot && keyScale && MODE_OFFSETS.hasOwnProperty(keyScale)) {
    keyContextFound = true;
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

  // If no authoritative key context overrides, use the global preference
  if (!keyContextFound) {
    if (accidentalPreference === 'FLAT') {
      useFlat = true;
    }
  }

  if (useFlat) {
    // Replace ASCII 'b' with Unicode '♭'
    return NOTES_FLAT[noteIndex].replace('b', '♭');
  }

  // Default to Sharp: Replace ASCII '#' with Unicode '♯'
  return noteName.replace('#', '♯');
};

/**
 * Calculates note name based on string tuning offset and fret.
 * @param stringOffset Semitones relative to E2 (0)
 * @param fretIndex Fret number
 */
export const getNoteAtPosition = (stringOffset: number, fretIndex: number): string => {
  // E is index 4 in NOTES_SHARP ['C', 'C#', 'D', 'D#', 'E'...]
  const baseIndex = 4; 
  let absoluteIndex = (baseIndex + stringOffset + fretIndex) % 12;
  if (absoluteIndex < 0) absoluteIndex += 12;
  return NOTES_SHARP[absoluteIndex];
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
 * @param stringOffset Semitones relative to E2 (0)
 * @param fretIndex Fret number
 */
export const getNoteColor = (noteName: string, stringOffset: number, fretIndex: number): string => {
  const hue = getNoteHue(noteName);
  
  // Calculate absolute semitone index relative to Low E (0)
  // Low E (Str 0, Fret 0) = 0
  const pitchIndex = stringOffset + fretIndex;
  
  // Saturation Logic:
  // Peak at Middle C (~ index 20).
  const distFromMiddleC = Math.abs(pitchIndex - 20);
  const saturation = Math.max(70, 95 - (distFromMiddleC * 1.2));

  // Lightness (Value) Logic:
  // Increase brightness as pitch goes higher.
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

export const getOffsetNoteName = (offset: number): string => {
  const baseIndex = 4; // E
  let absoluteIndex = (baseIndex + offset) % 12;
  if (absoluteIndex < 0) absoluteIndex += 12;
  return NOTES_SHARP[absoluteIndex];
};

// ============================================================================
// STAFF NOTATION UTILITIES
// ============================================================================

/**
 * Represents a note with its octave for staff notation
 */
export interface StaffNoteData {
  noteName: string;  // e.g., 'C', 'F#', 'Bb'
  octave: number;    // e.g., 4 for middle C
}

/**
 * Guitar standard tuning note ranges (open string to 12th fret):
 * - String 6 (Low E): E2 to E3
 * - String 5 (A): A2 to A3
 * - String 4 (D): D3 to D4
 * - String 3 (G): G3 to G4
 * - String 2 (B): B3 to B4
 * - String 1 (High E): E4 to E5
 *
 * Full range: E2 to E5 (roughly 3 octaves)
 */

// Treble clef comfortable range: C4 (middle C) to G5
// Bass clef comfortable range: E2 to C4
// We'll focus on treble clef for the main guitar range (strings 1-4)
// and bass clef for lower strings (5-6)

/**
 * Converts a fretboard position to a staff note with octave
 * @param stringOffset Semitones relative to E2 (0)
 * @param fretIndex Fret number (0-12)
 * @returns StaffNoteData with note name and octave
 */
export const fretboardToStaffNote = (stringOffset: number, fretIndex: number): StaffNoteData => {
  // E2 is our reference point (offset 0, fret 0)
  // E2 is MIDI note 40, which is E in octave 2
  const totalSemitones = stringOffset + fretIndex;

  // E is at index 4 in our notes array
  const E_INDEX = 4;
  const noteIndex = (E_INDEX + totalSemitones) % 12;
  const normalizedIndex = noteIndex < 0 ? noteIndex + 12 : noteIndex;

  // Calculate octave
  // E2 = offset 0 => octave 2
  // Each 12 semitones up = +1 octave
  // We need to track when we cross C (index 0)
  const baseOctave = 2;
  const semitonesFromE2 = totalSemitones;

  // Count how many times we've passed C since E2
  // E2 is index 4, so we need to go 8 more semitones to reach C3 (index 0)
  // Then every 12 semitones is another octave
  let octave = baseOctave;
  let semitoneCounter = semitonesFromE2;

  // Adjust for notes below E in the same "octave group"
  // Notes C, C#, D, D# come before E in the octave numbering
  if (normalizedIndex < E_INDEX) {
    // We've crossed into the next octave
    octave += Math.floor((semitonesFromE2 + (12 - E_INDEX)) / 12);
  } else {
    octave += Math.floor(semitonesFromE2 / 12);
  }

  return {
    noteName: NOTES_SHARP[normalizedIndex],
    octave
  };
};

/**
 * Generates a random staff note within the guitar's playable range
 * @param minOctave Minimum octave (default 2 for low E)
 * @param maxOctave Maximum octave (default 5 for high E at 12th fret)
 * @param focusMode Focus mode to filter notes
 * @param keyRoot Optional key root for KEY focus mode
 * @param keyScale Optional scale type for KEY focus mode
 */
export const generateRandomStaffNote = (
  minOctave: number = 2,
  maxOctave: number = 5,
  focusMode: 'ALL' | 'NATURALS' | 'KEY' = 'ALL',
  keyRoot?: string | null,
  keyScale?: string | null
): StaffNoteData => {
  let availableNotes: string[];

  switch (focusMode) {
    case 'NATURALS':
      availableNotes = NATURAL_NOTES;
      break;
    case 'KEY':
      if (keyRoot && keyScale) {
        availableNotes = getScaleNotes(keyRoot, keyScale as any);
      } else {
        availableNotes = NOTES_SHARP;
      }
      break;
    default:
      availableNotes = NOTES_SHARP;
  }

  // Generate random note
  const randomNoteIndex = Math.floor(Math.random() * availableNotes.length);
  const noteName = availableNotes[randomNoteIndex];

  // Generate random octave within range
  // Adjust max octave for notes - not all notes go to maxOctave
  // For guitar, E5 is the practical maximum
  let randomOctave = Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;

  // Clamp edge cases (e.g., don't allow E5# since guitar doesn't go that high)
  const noteIndex = NOTES_SHARP.indexOf(noteName.replace('♯', '#').replace('♭', 'b'));
  const E_INDEX = 4;

  // If at max octave and note comes after E, reduce octave
  if (randomOctave === maxOctave && noteIndex > E_INDEX) {
    randomOctave = maxOctave - 1;
  }

  // If at min octave and note comes before E, increase octave
  if (randomOctave === minOctave && noteIndex < E_INDEX) {
    randomOctave = minOctave + 1;
  }

  return {
    noteName,
    octave: randomOctave
  };
};

/**
 * Determines the best clef for a given note
 * Returns 'treble' for notes C4 and above, 'bass' for notes below C4
 */
export const getRecommendedClef = (note: StaffNoteData): 'treble' | 'bass' => {
  // Middle C (C4) is the dividing line
  if (note.octave > 4) return 'treble';
  if (note.octave < 4) return 'bass';

  // For octave 4, check the note
  const noteIndex = NOTES_SHARP.indexOf(note.noteName.replace('♯', '#').replace('♭', 'b'));
  // C is at index 0
  return noteIndex >= 0 ? 'treble' : 'bass';
};

/**
 * Formats a staff note for display (with unicode accidentals)
 */
export const formatStaffNoteDisplay = (
  note: StaffNoteData,
  accidentalPreference: AccidentalStyle = 'SHARP'
): string => {
  return getDisplayNoteName(note.noteName, null, null, accidentalPreference);
};

/**
 * Converts a note string like "E2" or "C#4" to a StaffNoteData object
 */
export const parseNoteString = (noteStr: string): StaffNoteData | null => {
  const match = noteStr.match(/^([A-Ga-g][#b]?)(\d)$/);
  if (!match) return null;
  return {
    noteName: match[1].toUpperCase(),
    octave: parseInt(match[2], 10)
  };
};

/**
 * Converts a StaffNoteData to a comparable number (semitones from C0)
 */
export const noteToSemitones = (note: StaffNoteData): number => {
  const noteIndex = NOTES_SHARP.indexOf(note.noteName.replace('♯', '#').replace('♭', 'b'));
  if (noteIndex === -1) {
    // Try flat version
    const flatIndex = NOTES_FLAT.indexOf(note.noteName.replace('♭', 'b'));
    if (flatIndex === -1) return 0;
    return note.octave * 12 + flatIndex;
  }
  return note.octave * 12 + noteIndex;
};

/**
 * Generates a random staff note within a specific note range (not just octave)
 * @param lowNote The lowest allowed note (e.g., "E2")
 * @param highNote The highest allowed note (e.g., "E5")
 * @param focusMode Focus mode to filter notes
 * @param keyRoot Optional key root for KEY focus mode
 * @param keyScale Optional scale type for KEY focus mode
 */
export const generateRandomStaffNoteInRange = (
  lowNote: string,
  highNote: string,
  focusMode: 'ALL' | 'NATURALS' | 'KEY' = 'ALL',
  keyRoot?: string | null,
  keyScale?: string | null
): StaffNoteData => {
  const lowParsed = parseNoteString(lowNote);
  const highParsed = parseNoteString(highNote);

  if (!lowParsed || !highParsed) {
    // Fallback to default range
    return generateRandomStaffNote(2, 5, focusMode, keyRoot, keyScale);
  }

  const lowSemitones = noteToSemitones(lowParsed);
  const highSemitones = noteToSemitones(highParsed);

  // Get allowed note names based on focus mode
  let allowedNoteNames: string[];
  switch (focusMode) {
    case 'NATURALS':
      allowedNoteNames = NATURAL_NOTES;
      break;
    case 'KEY':
      if (keyRoot && keyScale) {
        allowedNoteNames = getScaleNotes(keyRoot, keyScale as any);
      } else {
        allowedNoteNames = NOTES_SHARP;
      }
      break;
    default:
      allowedNoteNames = NOTES_SHARP;
  }

  // Build list of all valid notes in range
  const validNotes: StaffNoteData[] = [];

  for (let octave = lowParsed.octave; octave <= highParsed.octave; octave++) {
    for (const noteName of allowedNoteNames) {
      const note: StaffNoteData = { noteName, octave };
      const semitones = noteToSemitones(note);

      if (semitones >= lowSemitones && semitones <= highSemitones) {
        validNotes.push(note);
      }
    }
  }

  // If no valid notes found, return middle of range
  if (validNotes.length === 0) {
    return { noteName: 'C', octave: 4 };
  }

  // Pick random note from valid options
  const randomIndex = Math.floor(Math.random() * validNotes.length);
  return validNotes[randomIndex];
};