# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Frétude** is a guitar fretboard and sight-reading training application built with React, TypeScript, and Tailwind CSS. It's an interactive learning tool where users practice identifying notes through multiple game modes:
- **Fretboard Training**: See a note on the fretboard, name it
- **Sight Reading**: See a note on musical staff notation, name it

The app features a gamified interface with difficulty levels, progress tracking, customizable guitar tunings, and support for various focus modes (all notes, naturals only, specific keys).

## Commands

### Development
- `npm run dev` - Start the development server on port 3000
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally

### Environment Setup
- Create `.env.local` file with `GEMINI_API_KEY` (used in vite.config.ts, though not actively called in current code)
- `npm install` - Install dependencies

## Architecture

### Core Application Structure

The app has five main states managed in `App.tsx:36`:
- **MENU** - Main menu with game mode selection and settings customization
- **PLAYING** - Fretboard game mode: see note on fretboard, name it
- **PLAYING_STAFF** - Sight reading game mode: see note on staff, name it
- **STUDY** - Non-competitive fretboard visualization with note/scale/chord selection
- **GAME_OVER** - Session summary screen

Game modes are tracked via `GameMode` enum for future omnidirectional support (fretboard ↔ staff ↔ note name).

### Key Components

**App.tsx** (Main component, ~1300 lines)
- Manages all game state, score tracking, health, timer, and powerup logic
- Handles localStorage persistence for game history, guitar profiles, and user preferences
- Contains game loop logic:
  - Fretboard mode: `generateNewNote()` and `checkAnswer()` callbacks
  - Staff mode: `generateNewStaffNote()` and `checkStaffAnswer()` callbacks
- Uses refs for timer intervals and powerup state to avoid closure issues
- Mobile detection hook (`useIsMobile`) determines horizontal vs. vertical layout

**Fretboard.tsx** (Interactive fretboard visualization)
- Renders a 6-string, configurable-fret guitar fretboard with proper string thicknesses
- Two modes:
  - **Game mode**: Shows active note highlight, handles powerup reveals
  - **Study mode**: Interactive sidebar for selecting notes, scales, chords, strings, and frets
- Orientation prop: `'horizontal'` (default) or `'vertical'` for mobile
- Note color coding based on chromatic position via `getNoteHue()`
- Fret markers at positions 3, 5, 7, 9, 12 with double dot at 12

**GuitarSettings.tsx**
- Modal for managing guitar profiles (create, edit, delete)
- Switch between preset tunings (Standard, Drop D, Open D, etc.)
- Set accidental preference (sharp/flat) affecting note display

**StatsChart.tsx**
- Displays score history in a chart using Recharts library

**Staff.tsx** (Sheet music notation rendering)
- Uses VexFlow 5.0 library for professional music notation rendering
- Renders a musical staff with treble/bass clef and optional note
- Props: `note` (StaffNote), `clef`, `width`, `height`, `feedbackState`, `accidentalPreference`
- Auto-styles SVG for dark theme (gray staff lines, colored notes)
- `StaffNote` type: `{ noteName: string, octave: number }` (e.g., `{ noteName: 'C', octave: 4 }` for middle C)

### State Management Patterns

**Game Configuration** (`App.tsx:66`)
- `gameConfig`: focusMode, keyRoot, keyScale, timeLimit, fretboard range
- `studyConfig`: root note, active chords, scale type, manually selected notes
- Persisted via localStorage under keys: `fretmaster_history`, `fretmaster_guitars`, `fretmaster_active_guitar`

**Performance Optimization**
- Uses refs (`timerIntervalRef`, `feedbackTimeoutRef`, `targetNoteRef`, `activePowerupRef`) to maintain references during async operations and avoid stale closures
- Refs prevent unnecessary re-renders and ensure correct state inside interval callbacks

**Dynamic Guitar Tuning**
- `GuitarProfile` includes array of offsets relative to E2 (0)
- Standard tuning: [0, 5, 10, 15, 19, 24] = [E2, A2, D3, G3, B3, E4]
- Fretboard calculates notes dynamically: `getNoteAtPosition(tuningOffset, fretIndex)`

### Constants & Utilities

**constants.ts**
- Note arrays: `NOTES_SHARP`, `NOTES_FLAT`, `NATURAL_NOTES`
- `getNoteAtPosition(offset, fret)`: Calculates note name from tuning and fret number
- `getDisplayNoteName()`: Handles accidental preference (sharp/flat) and key-context awareness
- `getNoteHue()`: Returns hue value for note color coding
- `getNoteColor()`: Generates background color for note dots
- `getScaleNotes()` / `getChordNotes()`: Returns arrays of notes in a given scale or chord
- Staff notation utilities:
  - `StaffNoteData`: Interface for note with octave `{ noteName, octave }`
  - `fretboardToStaffNote(offset, fret)`: Converts fretboard position to staff note with octave
  - `generateRandomStaffNote(min, max, focusMode, keyRoot, keyScale)`: Random note within guitar range
  - `getRecommendedClef(note)`: Returns 'treble' or 'bass' based on note octave

**types.ts**
- Enums: `GameState`, `GameMode`, `Difficulty`, `FocusMode`, `PowerupType`, `ScaleType`
- `GameMode` enum defines direction of note recognition (designed for future omnidirectional support):
  - `FRETBOARD_TO_NOTE`: See fretboard → name note (current)
  - `STAFF_TO_NOTE`: See staff → name note (current)
  - Future: `NOTE_TO_FRETBOARD`, `NOTE_TO_STAFF`, `STAFF_TO_FRETBOARD`, `FRETBOARD_TO_STAFF`
- Interfaces: `Note`, `GameConfig`, `StudyConfig`, `GuitarProfile`, `ScoreRecord`, `Feedback`, `PowerupState`
- `AccidentalStyle`: 'SHARP' | 'FLAT'

### Game Mechanics

**Powerups** (triggered at streaks: 5, 10, 15, etc.)
- `SUPER_REVEAL_ALL_NATURALS`: All natural notes revealed for 2 rounds
- `REVEAL_NATURALS_STRING`: Natural notes on random string revealed
- `REVEAL_FRET`: Notes at random fret revealed
- `FEWER_CHOICES`: 50/50 powerup (2 options instead of 5)

**Level Up System**
- Automatically unlocks new frets every 5 correct answers (configurable max fret cap)
- Starting fret range and max cap set in game settings

**Timer System**
- Configurable duration (3-30 seconds)
- Uses interval ref with 100ms tick for smooth bar animation
- Timeout handler decreases health and generates new note

**Difficulty Modes**
- **Easy**: Multiple choice with 4-5 options
- **Hard**: All chromatic notes shown (no multiple choice)
- 50/50 powerup reduces options to 2 regardless of difficulty

## Styling & Layout

- **Tailwind CSS** for all styling; no separate CSS files
- **Dark theme**: Gray-900 background with color-coded note indicators
- **Responsive design**:
  - Mobile (<768px): Vertical orientation, stacked layout, compact controls
  - Desktop: Horizontal orientation, side-by-side content
- **Color coding**: Notes use HSL values based on chromatic position (C=red, G=green, etc.)

## Data Flow

1. User selects settings (difficulty, focus mode, key, time limit) → stored in `gameConfig`
2. Click "Start Game" → initialize health/score/streak, set `gameState` to PLAYING
3. `generateNewNote()` callback runs → selects random valid note based on focus mode
4. Fretboard highlights active note; answer options displayed below
5. User clicks note → `checkAnswer()` evaluates correctness
6. Feedback shows, timers managed by refs, new note generated or game ended
7. Session saved to localStorage with score, difficulty, max fret reached

## Important Implementation Details

- **Refs in useEffect dependencies**: Be cautious when adding refs to useEffect dependencies; they should rarely be included to avoid unnecessary triggering
- **Mobile rendering**: Vertical orientation changes flex direction from `flex-col` to `flex-row` throughout Fretboard component; test both orientations
- **Note calculation**: Always use `getNoteAtPosition(tuningOffset, fretIndex)` when calculating notes; never hardcode note arrays for tuning support
- **Accidental display**: `getDisplayNoteName()` is context-aware—key context overrides user preference for correct scale representation
- **localStorage serialization**: Parse as JSON; watch for circular references or undefined values

## Common Patterns & Gotchas

- **Feedback timing**: Use `feedbackTimeoutRef` to clear feedback and trigger next note after delay; prevents race conditions
- **Processing state**: `isProcessing` flag blocks user input during feedback/transition phases; critical for preventing double-clicks
- **Scale/Chord visibility**: Study mode shows notes only if selected by note name, string, or fret; otherwise hidden
- **Tuning flexibility**: All guitar-related note calculations must respect the active guitar's tuning array, not assume standard tuning
