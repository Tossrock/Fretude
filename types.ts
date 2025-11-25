
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  STUDY = 'STUDY'
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
}

export interface Note {
  stringIndex: number; // 0 (Low E) to 5 (High E)
  fretIndex: number;
  noteName: string; // e.g., "C#"
}

export interface ScoreRecord {
  date: string;
  score: number;
  difficulty: Difficulty;
  maxFret: number;
  focusMode?: FocusMode;
}

export interface Feedback {
  status: 'correct' | 'incorrect' | 'neutral';
  message: string;
}

export enum PowerupType {
  REVEAL_NATURALS_STRING = 'REVEAL_NATURALS_STRING',
  REVEAL_FRET = 'REVEAL_FRET',
  FEWER_CHOICES = 'FEWER_CHOICES',
  SUPER_REVEAL_ALL_NATURALS = 'SUPER_REVEAL_ALL_NATURALS'
}

export interface PowerupState {
  type: PowerupType;
  value?: number; // stringIndex or fretIndex depending on type
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