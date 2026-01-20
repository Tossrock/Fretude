import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';

// Note definitions with staff positions
// Position 0 = middle line of staff (B4 for treble, D3 for bass)
// Positive = above, Negative = below
interface NoteDefinition {
  name: string;
  octave: number;
  vexKey: string;
  // Ledger lines: negative = below staff, positive = above staff
  // 0 = on the staff (within the 5 lines)
  ledgerLines: number;
}

// Full guitar range notes for treble clef
// E2 is the lowest (open low E string)
// B5 is roughly the highest practical note
const TREBLE_NOTES: NoteDefinition[] = [
  { name: 'D', octave: 2, vexKey: 'd/2', ledgerLines: -5 },  // Drop D tuning low
  { name: 'E', octave: 2, vexKey: 'e/2', ledgerLines: -4 },  // Open low E
  { name: 'F', octave: 2, vexKey: 'f/2', ledgerLines: -4 },
  { name: 'G', octave: 2, vexKey: 'g/2', ledgerLines: -3 },
  { name: 'A', octave: 2, vexKey: 'a/2', ledgerLines: -3 },
  { name: 'B', octave: 2, vexKey: 'b/2', ledgerLines: -2 },
  { name: 'C', octave: 3, vexKey: 'c/3', ledgerLines: -2 },
  { name: 'D', octave: 3, vexKey: 'd/3', ledgerLines: -1 },  // Open D string
  { name: 'E', octave: 3, vexKey: 'e/3', ledgerLines: -1 },
  { name: 'F', octave: 3, vexKey: 'f/3', ledgerLines: 0 },
  { name: 'G', octave: 3, vexKey: 'g/3', ledgerLines: 0 },   // Open G string
  { name: 'A', octave: 3, vexKey: 'a/3', ledgerLines: 0 },
  { name: 'B', octave: 3, vexKey: 'b/3', ledgerLines: 0 },   // Open B string
  { name: 'C', octave: 4, vexKey: 'c/4', ledgerLines: -1 },  // Middle C (1 ledger below)
  { name: 'D', octave: 4, vexKey: 'd/4', ledgerLines: 0 },
  { name: 'E', octave: 4, vexKey: 'e/4', ledgerLines: 0 },   // Open high E string, bottom line
  { name: 'F', octave: 4, vexKey: 'f/4', ledgerLines: 0 },
  { name: 'G', octave: 4, vexKey: 'g/4', ledgerLines: 0 },
  { name: 'A', octave: 4, vexKey: 'a/4', ledgerLines: 0 },
  { name: 'B', octave: 4, vexKey: 'b/4', ledgerLines: 0 },   // Middle of staff
  { name: 'C', octave: 5, vexKey: 'c/5', ledgerLines: 0 },
  { name: 'D', octave: 5, vexKey: 'd/5', ledgerLines: 0 },
  { name: 'E', octave: 5, vexKey: 'e/5', ledgerLines: 1 },   // 12th fret high E
  { name: 'F', octave: 5, vexKey: 'f/5', ledgerLines: 1 },
  { name: 'G', octave: 5, vexKey: 'g/5', ledgerLines: 2 },
  { name: 'A', octave: 5, vexKey: 'a/5', ledgerLines: 2 },
  { name: 'B', octave: 5, vexKey: 'b/5', ledgerLines: 3 },   // Very high
];

// Simplified note range for the selector (just naturals for cleaner UI)
const SELECTOR_NOTES = TREBLE_NOTES.filter(n =>
  !n.name.includes('#') && !n.name.includes('b')
);

export interface NoteRange {
  lowNote: string;   // e.g., "E2"
  highNote: string;  // e.g., "E5"
}

interface StaffRangeSelectorProps {
  value: NoteRange;
  onChange: (range: NoteRange) => void;
  clef?: 'treble' | 'bass';
  octaveTransposition?: number; // Display notes transposed up by this many octaves
}

const noteToString = (note: NoteDefinition): string => `${note.name}${note.octave}`;
const stringToNote = (str: string): NoteDefinition | undefined => {
  return SELECTOR_NOTES.find(n => noteToString(n) === str);
};

const StaffRangeSelector: React.FC<StaffRangeSelectorProps> = ({
  value,
  onChange,
  clef = 'treble',
  octaveTransposition = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'low' | 'high' | null>(null);

  // Find indices for current values
  const lowIndex = SELECTOR_NOTES.findIndex(n => noteToString(n) === value.lowNote);
  const highIndex = SELECTOR_NOTES.findIndex(n => noteToString(n) === value.highNote);

  const renderStaff = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const width = 280;
    const height = 200;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      svg.style.background = 'transparent';
    }

    // Create stave
    const stave = new Stave(10, 50, width - 20);
    stave.addClef(clef);
    stave.setContext(context).draw();

    // Render low and high boundary notes
    const lowNote = SELECTOR_NOTES[lowIndex] || SELECTOR_NOTES[0];
    const highNote = SELECTOR_NOTES[highIndex] || SELECTOR_NOTES[SELECTOR_NOTES.length - 1];

    // Helper to get transposed vexKey
    const getTransposedVexKey = (note: NoteDefinition) => {
      const transposedOctave = note.octave + octaveTransposition;
      return `${note.name.toLowerCase()}/${transposedOctave}`;
    };

    const notes: StaveNote[] = [];

    // Low note (red/orange)
    const lowStaveNote = new StaveNote({
      keys: [getTransposedVexKey(lowNote)],
      duration: 'q',
      clef: clef,
    });
    lowStaveNote.setStyle({ fillStyle: '#f97316', strokeStyle: '#f97316' });
    notes.push(lowStaveNote);

    // High note (blue/purple)
    const highStaveNote = new StaveNote({
      keys: [getTransposedVexKey(highNote)],
      duration: 'q',
      clef: clef,
    });
    highStaveNote.setStyle({ fillStyle: '#8b5cf6', strokeStyle: '#8b5cf6' });
    notes.push(highStaveNote);

    const voice = new Voice({ num_beats: 2, beat_value: 4 });
    voice.setStrict(false);
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], width - 100);
    voice.draw(context, stave);

    // Style SVG for dark theme
    if (svg) {
      const paths = svg.querySelectorAll('path');
      paths.forEach(path => {
        const currentFill = path.getAttribute('fill');
        const currentStroke = path.getAttribute('stroke');
        const isNoteElement = currentFill === '#f97316' || currentFill === '#8b5cf6' ||
                             currentStroke === '#f97316' || currentStroke === '#8b5cf6';
        if (!isNoteElement) {
          if (currentFill === '#000000' || currentFill === 'black' || !currentFill) {
            path.setAttribute('fill', '#6b7280');
          }
          if (currentStroke === '#000000' || currentStroke === 'black' || !currentStroke) {
            path.setAttribute('stroke', '#6b7280');
          }
        }
      });
      const texts = svg.querySelectorAll('text');
      texts.forEach(text => text.setAttribute('fill', '#6b7280'));
      const rects = svg.querySelectorAll('rect');
      rects.forEach(rect => {
        const currentFill = rect.getAttribute('fill');
        if (currentFill === '#000000' || currentFill === 'black' || !currentFill) {
          rect.setAttribute('fill', '#6b7280');
        }
      });
    }
  }, [lowIndex, highIndex, clef, octaveTransposition]);

  useEffect(() => {
    renderStaff();
  }, [renderStaff]);

  const handleLowChange = (newIndex: number) => {
    const clampedIndex = Math.min(newIndex, highIndex - 1);
    const note = SELECTOR_NOTES[Math.max(0, clampedIndex)];
    if (note) {
      onChange({ ...value, lowNote: noteToString(note) });
    }
  };

  const handleHighChange = (newIndex: number) => {
    const clampedIndex = Math.max(newIndex, lowIndex + 1);
    const note = SELECTOR_NOTES[Math.min(SELECTOR_NOTES.length - 1, clampedIndex)];
    if (note) {
      onChange({ ...value, highNote: noteToString(note) });
    }
  };

  return (
    <div className="space-y-3">
      {/* Staff visualization */}
      <div ref={containerRef} className="mx-auto" style={{ width: 280, height: 200 }} />

      {/* Range sliders */}
      <div className="space-y-2 px-2">
        {/* Low note slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-orange-400 w-12">Low:</span>
          <input
            type="range"
            min={0}
            max={SELECTOR_NOTES.length - 2}
            value={lowIndex >= 0 ? lowIndex : 0}
            onChange={(e) => handleLowChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <span className="text-xs font-mono text-orange-300 w-8">{value.lowNote}</span>
        </div>

        {/* High note slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-purple-400 w-12">High:</span>
          <input
            type="range"
            min={1}
            max={SELECTOR_NOTES.length - 1}
            value={highIndex >= 0 ? highIndex : SELECTOR_NOTES.length - 1}
            onChange={(e) => handleHighChange(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <span className="text-xs font-mono text-purple-300 w-8">{value.highNote}</span>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 justify-center pt-2">
        <button
          onClick={() => onChange({ lowNote: 'E4', highNote: 'E5' })}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Treble Only
        </button>
        <button
          onClick={() => onChange({ lowNote: 'E2', highNote: 'E5' })}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Full Guitar
        </button>
        <button
          onClick={() => onChange({ lowNote: 'D2', highNote: 'B5' })}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Extended
        </button>
      </div>
    </div>
  );
};

export default StaffRangeSelector;
export { SELECTOR_NOTES, noteToString, stringToNote };
export type { NoteDefinition, NoteRange };
