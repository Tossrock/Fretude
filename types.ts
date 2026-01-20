
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PLAYING_STAFF = 'PLAYING_STAFF',  // New: Staff => Note Name game mode
  GAME_OVER = 'GAME_OVER',
  STUDY = 'STUDY',
  STATS = 'STATS'
}

// Game mode types for future omnidirectional support
export enum GameMode {
  FRETBOARD_TO_NOTE = 'FRETBOARD_TO_NOTE',  // Original mode: see fretboard, name note
  STAFF_TO_NOTE = 'STAFF_TO_NOTE',          // New mode: see staff, name note
  // Future modes:
  // NOTE_TO_FRETBOARD = 'NOTE_TO_FRETBOARD',
  // NOTE_TO_STAFF = 'NOTE_TO_STAFF',
  // STAFF_TO_FRETBOARD = 'STAFF_TO_FRETBOARD',
  // FRETBOARD_TO_STAFF = 'FRETBOARD_TO_STAFF',
}

export enum Difficulty {
  EASY = 'EASY', // Multiple choice
  HARD = 'HARD'  // Self-recall (virtual keyboard)
}

export enum FocusMode {
  ALL = 'ALL',
  NATURALS = 'NATURALS',
  KEY = 'KEY'
}

export interface GameConfig {
  focusMode: FocusMode;
  keyRoot: string | null;
  keyScale: ScaleType;
  startingFret: number;
  maxFretCap: number;
  timeLimit: number;
  adaptiveLearning: boolean;
}

export interface Note {
  stringIndex: number; // 0 (Low E) to 5 (High E)
  fretIndex: number;
  noteName: string; // e.g., "C#"
}

export interface NoteInteraction {
  note: Note;
  isCorrect: boolean;
  timeTakenMs: number;
  isTimeout: boolean;
  timestamp: number;
}

export interface ScoreRecord {
  date: string;
  score: number;
  difficulty: Difficulty;
  maxFret: number;
  focusMode?: FocusMode;
  gameMode?: GameMode;
  interactions: NoteInteraction[];
  avgTimeSeconds: number;
  tuningName?: string;
}

export interface NoteStat {
  correct: number;
  incorrect: number;
  timeouts: number;
  totalTimeMs: number;
  lastSeen: number; // Timestamp
}

export type NoteStatsMap = Record<string, NoteStat>; // Key: "tuningId-stringIdx-fretIdx"

export enum HeatmapMetric {
  ACCURACY = 'ACCURACY',
  SPEED = 'SPEED',
  FREQUENCY = 'FREQUENCY'
}

export interface Feedback {
  status: 'correct' | 'incorrect' | 'neutral';
  message: string;
}

export enum PowerupType {
  REVEAL_NATURALS_STRING = 'REVEAL_NATURALS_STRING',
  REVEAL_FRET = 'REVEAL_FRET',
  FEWER_CHOICES = 'FEWER_CHOICES',
  SUPER_REVEAL_ALL_NATURALS = 'SUPER_REVEAL_ALL_NATURALS',
  REVEAL_ALL_NOTE_LOCATIONS = 'REVEAL_ALL_NOTE_LOCATIONS'
}

export interface PowerupState {
  type: PowerupType;
  value?: number; // stringIndex or fretIndex depending on type
  noteTarget?: string; // For REVEAL_ALL_NOTE_LOCATIONS
  duration: number; // questions remaining
  label: string;
}

export type ScaleType = 
  | 'MAJOR' 
  | 'NATURAL_MINOR' 
  | 'DORIAN' 
  | 'PHRYGIAN' 
  | 'LYDIAN' 
  | 'MIXOLYDIAN' 
  | 'LOCRIAN' 
  | null;

export interface StudyConfig {
  rootNote: string | null;
  activeChords: { root: string; type: 'MAJOR' | 'NATURAL_MINOR' }[];
  scaleType: ScaleType;
  manuallySelectedNotes: string[]; // Note names e.g. "C", "F#"
  activeStrings: number[]; // Indices 0-5
  activeFrets: number[]; // Indices 1-12
}

export interface GuitarProfile {
  id: string;
  name: string;
  tuningName: string; // e.g., "Standard", "Drop D"
  tuning: number[]; // Array of 6 integers. 0 = E2. -2 = D2. 5 = A2.
}

export interface TuningPreset {
  name: string;
  offsets: number[]; // Low String (0) to High String (5)
}

export type AccidentalStyle = 'SHARP' | 'FLAT';

// Clef preference for staff game mode
export type ClefPreference = 'treble' | 'bass' | 'random';

// Note duration types
export type NoteDurationType = 'w' | 'h' | 'q' | '8' | '16' | 'wd' | 'hd' | 'qd' | '8d';

// Note range for staff game
export interface NoteRange {
  lowNote: string;   // e.g., "E2"
  highNote: string;  // e.g., "E5"
}

// Staff game specific configuration
export interface StaffGameConfig {
  clefPreference: ClefPreference;           // Which clef(s) to use
  noteDurations: NoteDurationType[] | 'all'; // Which note durations to include, or 'all' for all types
  noteCount: number;                        // Number of notes per round (1 = single note, 2+ = multi-note)
  noteRange: NoteRange;                     // Low and high note boundaries
  useGuitarTransposition: boolean;          // If true, display notes an octave higher (standard guitar notation)
}