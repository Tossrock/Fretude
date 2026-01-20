import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { AccidentalStyle } from '../types';

export type Clef = 'treble' | 'bass';
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | 'wd' | 'hd' | 'qd' | '8d'; // whole, half, quarter, eighth, sixteenth + dotted variants

export interface StaffNote {
  noteName: string;  // e.g., 'C', 'F#', 'Bb'
  octave: number;    // e.g., 4 for middle C
  duration?: NoteDuration; // note duration, defaults to 'w' (whole)
}

interface StaffProps {
  // Single note or array of notes for multi-note mode
  note?: StaffNote | null;
  notes?: StaffNote[];
  activeNoteIndex?: number; // For multi-note mode: which note is currently being identified

  clef?: Clef;
  width?: number;
  height?: number;
  showClef?: boolean;
  showTimeSignature?: boolean;
  timeSignature?: string;
  highlightColor?: string;
  noteColor?: string;
  accidentalPreference?: AccidentalStyle;
  onClick?: () => void;
  className?: string;
  animated?: boolean;
  feedbackState?: 'correct' | 'incorrect' | 'neutral';
  octaveTransposition?: number; // Shift display octave (e.g., 1 for guitar's standard octave-up notation)
}

// Map our duration codes to VexFlow duration strings
const DURATION_MAP: Record<NoteDuration, string> = {
  'w': 'w',    // whole
  'h': 'h',    // half
  'q': 'q',    // quarter
  '8': '8',    // eighth
  '16': '16',  // sixteenth
  'wd': 'wd',  // dotted whole
  'hd': 'hd',  // dotted half
  'qd': 'qd',  // dotted quarter
  '8d': '8d', // dotted eighth
};

// Duration display names for UI
export const DURATION_NAMES: Record<NoteDuration, string> = {
  'w': 'Whole',
  'h': 'Half',
  'q': 'Quarter',
  '8': 'Eighth',
  '16': 'Sixteenth',
  'wd': 'Dotted Whole',
  'hd': 'Dotted Half',
  'qd': 'Dotted Quarter',
  '8d': 'Dotted Eighth',
};

/**
 * Converts our note format to VexFlow note format
 * VexFlow uses: "c/4" for middle C, "f#/4" for F#4, "bb/3" for Bb3
 * @param note The note to convert
 * @param transposition Octave shift to apply (e.g., 1 for guitar notation)
 */
const toVexFlowNote = (note: StaffNote, transposition: number = 0): string => {
  let noteLetter = note.noteName[0].toLowerCase();
  let accidental = '';

  if (note.noteName.includes('#') || note.noteName.includes('♯')) {
    accidental = '#';
  } else if (note.noteName.includes('b') || note.noteName.includes('♭')) {
    accidental = 'b';
  }

  const displayOctave = note.octave + transposition;
  return `${noteLetter}${accidental}/${displayOctave}`;
};

/**
 * Gets the accidental string for VexFlow
 */
const getVexFlowAccidental = (noteName: string): string | null => {
  if (noteName.includes('#') || noteName.includes('♯')) return '#';
  if (noteName.includes('b') || noteName.includes('♭')) return 'b';
  return null;
};

/**
 * Gets the feedback color based on state
 */
const getFeedbackColor = (feedbackState?: 'correct' | 'incorrect' | 'neutral'): string | undefined => {
  switch (feedbackState) {
    case 'correct':
      return '#22c55e'; // green-500
    case 'incorrect':
      return '#ef4444'; // red-500
    default:
      return undefined;
  }
};

/**
 * Reusable Staff component that renders a musical staff with optional note(s)
 * Uses VexFlow for professional music notation rendering
 */
const Staff: React.FC<StaffProps> = ({
  note,
  notes,
  activeNoteIndex = 0,
  clef = 'treble',
  width = 200,
  height = 150,
  showClef = true,
  showTimeSignature = false,
  timeSignature = '4/4',
  highlightColor,
  noteColor = '#3b82f6', // blue-500
  accidentalPreference = 'SHARP',
  onClick,
  className = '',
  animated = false,
  feedbackState = 'neutral',
  octaveTransposition = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<InstanceType<typeof Renderer> | null>(null);

  // Calculate effective note color based on feedback state
  const effectiveNoteColor = useMemo(() => {
    const feedbackColor = getFeedbackColor(feedbackState);
    if (feedbackColor) return feedbackColor;
    if (highlightColor) return highlightColor;
    return noteColor;
  }, [feedbackState, highlightColor, noteColor]);

  // Determine which notes to render
  const notesToRender = useMemo(() => {
    if (notes && notes.length > 0) {
      return notes;
    }
    if (note) {
      return [note];
    }
    return [];
  }, [note, notes]);

  const renderStaff = useCallback(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create renderer
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    rendererRef.current = renderer;

    // Configure the rendering context
    renderer.resize(width, height);
    const context = renderer.getContext();

    // Set background to transparent (handled by container styling)
    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      svg.style.background = 'transparent';
    }

    // Calculate stave position (centered vertically)
    const staveY = height / 2 - 40;
    const staveX = 10;
    const staveWidth = width - 20;

    // Create the stave
    const stave = new Stave(staveX, staveY, staveWidth);

    if (showClef) {
      stave.addClef(clef);
    }

    if (showTimeSignature) {
      stave.addTimeSignature(timeSignature);
    }

    // Style the stave lines
    stave.setContext(context);

    // Draw the stave
    stave.draw();

    // If we have notes, render them
    if (notesToRender.length > 0) {
      const staveNotes: StaveNote[] = [];

      notesToRender.forEach((n, index) => {
        const vexNote = toVexFlowNote(n, octaveTransposition);
        const duration = DURATION_MAP[n.duration || 'w'];

        // Create the note
        const staveNote = new StaveNote({
          keys: [vexNote],
          duration: duration,
          clef: clef,
        });

        // Add accidental if needed
        const accidental = getVexFlowAccidental(n.noteName);
        if (accidental) {
          staveNote.addModifier(new Accidental(accidental));
        }

        // Determine color based on whether this is the active note
        const isActive = index === activeNoteIndex;
        const isCompleted = index < activeNoteIndex;

        let color: string;
        if (isActive) {
          color = effectiveNoteColor;
        } else if (isCompleted) {
          color = '#22c55e'; // green for completed
        } else {
          color = '#6b7280'; // gray for upcoming
        }

        // Apply note color
        staveNote.setStyle({
          fillStyle: color,
          strokeStyle: color
        });

        // Add a custom attribute to identify active notes for animation
        if (isActive && animated) {
          staveNote.setStyle({
            fillStyle: color,
            strokeStyle: color
          });
          // We'll add animation class after render
          (staveNote as any)._isAnimated = true;
        }

        staveNotes.push(staveNote);
      });

      // Create voice and add notes
      const voice = new Voice({ num_beats: 4, beat_value: 4 });
      voice.setStrict(false); // Allow any duration combination
      voice.addTickables(staveNotes);

      // Format and draw
      const formattingWidth = staveWidth - (showClef ? 60 : 20) - (showTimeSignature ? 40 : 0);
      new Formatter().joinVoices([voice]).format([voice], formattingWidth);
      voice.draw(context, stave);
    }

    // Style the SVG for dark theme
    if (svg) {
      // Make staff lines and symbols gray for dark background
      const paths = svg.querySelectorAll('path');
      paths.forEach((path, pathIndex) => {
        const currentFill = path.getAttribute('fill');
        const currentStroke = path.getAttribute('stroke');

        // Check if this is a note element (has our custom colors)
        const isNoteElement = currentFill === effectiveNoteColor ||
                             currentFill === '#22c55e' ||
                             currentFill === '#6b7280' ||
                             currentStroke === effectiveNoteColor ||
                             currentStroke === '#22c55e' ||
                             currentStroke === '#6b7280';

        if (!isNoteElement) {
          if (currentFill === '#000000' || currentFill === 'black' || !currentFill) {
            path.setAttribute('fill', '#9ca3af'); // gray-400
          }
          if (currentStroke === '#000000' || currentStroke === 'black' || !currentStroke) {
            path.setAttribute('stroke', '#9ca3af'); // gray-400
          }
        }
      });

      // Style text elements (clef, etc.)
      const texts = svg.querySelectorAll('text');
      texts.forEach(text => {
        text.setAttribute('fill', '#9ca3af');
      });

      // Style rect elements (ledger lines, etc.)
      const rects = svg.querySelectorAll('rect');
      rects.forEach(rect => {
        const currentFill = rect.getAttribute('fill');
        if (currentFill === '#000000' || currentFill === 'black' || !currentFill) {
          rect.setAttribute('fill', '#9ca3af');
        }
      });

      // Add animation to note elements if animated
      if (animated && notesToRender.length > 0) {
        // Find the note elements by their color (the active note)
        const allPaths = svg.querySelectorAll('path');
        allPaths.forEach(path => {
          const fill = path.getAttribute('fill');
          const stroke = path.getAttribute('stroke');
          if (fill === effectiveNoteColor || stroke === effectiveNoteColor) {
            path.classList.add('note-pulse');
          }
        });
      }
    }
  }, [notesToRender, activeNoteIndex, clef, width, height, showClef, showTimeSignature, timeSignature, effectiveNoteColor, animated, octaveTransposition]);

  useEffect(() => {
    renderStaff();
  }, [renderStaff]);

  // Feedback-based border styles
  const feedbackBorderClass = useMemo(() => {
    switch (feedbackState) {
      case 'correct':
        return 'ring-2 ring-green-500 ring-opacity-50';
      case 'incorrect':
        return 'ring-2 ring-red-500 ring-opacity-50';
      default:
        return '';
    }
  }, [feedbackState]);

  return (
    <>
      {/* CSS for note-only animation */}
      <style>{`
        @keyframes notePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .note-pulse {
          animation: notePulse 1.5s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>
      <div
        ref={containerRef}
        onClick={onClick}
        className={`
          staff-container rounded-lg transition-all duration-200
          ${onClick ? 'cursor-pointer hover:bg-gray-800/50' : ''}
          ${feedbackBorderClass}
          ${className}
        `}
        style={{ width, height }}
      />
    </>
  );
};

export default Staff;

// Re-export types for convenience
export type { StaffProps };
