
import React, { useState } from 'react';
import { Note, PowerupState, PowerupType, ScaleType, AccidentalStyle } from '../types';
import { getNoteAtPosition, getNoteColor, getNoteHue, NOTES_SHARP, getDisplayNoteName, STANDARD_TUNING_OFFSETS } from '../constants';

interface FretboardProps {
  activeNote: Note | null;
  maxFret: number;
  activePowerup: PowerupState | null;
  
  // Study Mode Props
  highlightNotes?: string[];
  highlightLocations?: { strings: number[], frets: number[] };
  scaleNotes?: string[];
  
  rootNote?: string | null;
  activeChords?: { root: string; type: 'MAJOR' | 'NATURAL_MINOR' }[];
  scaleType?: ScaleType;
  
  onNoteNameToggle?: (note: string) => void;
  onStringToggle?: (stringIdx: number) => void;
  onFretToggle?: (fretIdx: number) => void;
  onRootNoteSelect?: (note: string | null) => void;
  onChordToggle?: (root: string, type: 'MAJOR' | 'NATURAL_MINOR') => void;
  onScaleTypeSelect?: (type: ScaleType) => void;
  onClearSelection?: () => void;
  onBackToMenu?: () => void;
  
  isStudyMode?: boolean;
  orientation?: 'horizontal' | 'vertical';
  
  // Tuning
  tuningOffsets?: number[]; // Array of offsets relative to E2
  accidentalPreference?: AccidentalStyle;
}

const Fretboard: React.FC<FretboardProps> = ({ 
  activeNote, 
  maxFret, 
  activePowerup, 
  highlightNotes, 
  highlightLocations,
  scaleNotes,
  rootNote,
  activeChords,
  scaleType,
  onNoteNameToggle,
  onStringToggle,
  onFretToggle,
  onRootNoteSelect,
  onChordToggle,
  onScaleTypeSelect,
  onClearSelection,
  onBackToMenu,
  isStudyMode = false,
  orientation = 'horizontal',
  tuningOffsets = STANDARD_TUNING_OFFSETS,
  accidentalPreference = 'SHARP'
}) => {
  const isVertical = orientation === 'vertical';
  const [showAdvancedScales, setShowAdvancedScales] = useState(false);

  // Strings:
  // Horizontal: Top (5/HighE) -> Bottom (0/LowE)
  // Vertical: Left (0/LowE) -> Right (5/HighE)
  const strings = isVertical ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];

  // Markers for standard guitar (3, 5, 7, 9, 12)
  const isMarker = (fret: number) => [3, 5, 7, 9, 12].includes(fret);

  const getStringStyle = (stringIndex: number) => {
    // 0(Low E) to 5(High E)
    const isWound = stringIndex <= 2;
    
    // Thickness logic
    let thickness = 1.5;
    if (stringIndex === 0) thickness = 6;
    else if (stringIndex === 1) thickness = 5;
    else if (stringIndex === 2) thickness = 4;
    else if (stringIndex === 3) thickness = 2.5;
    else if (stringIndex === 4) thickness = 2;
    
    const colorClass = isWound ? 'bg-[#b8860b]' : 'bg-[#fffaf0] opacity-80';
    const shadowClass = isWound ? 'shadow-md shadow-black/40' : 'shadow-sm shadow-black/20';

    return {
      style: isVertical ? { width: `${thickness}px`, height: '100%' } : { height: `${thickness}px`, width: '100%' },
      className: `${colorClass} ${shadowClass} rounded-sm transition-all duration-300`
    };
  };

  const getDisplayedNote = (stringIdx: number, fretIdx: number): string | null => {
    const offset = tuningOffsets[stringIdx];
    const noteName = getNoteAtPosition(offset, fretIdx);

    // Study Mode Logic
    if (isStudyMode && highlightNotes && highlightLocations) {
      const isNameSelected = highlightNotes.includes(noteName);
      const isStringSelected = highlightLocations.strings.includes(stringIdx);
      const isFretSelected = highlightLocations.frets.includes(fretIdx);
      
      if (isNameSelected || isStringSelected || isFretSelected) {
        return noteName;
      }
      return null;
    }

    // Powerup Logic
    if (activePowerup) {
      const isNatural = !noteName.includes('#');
      switch (activePowerup.type) {
        case PowerupType.SUPER_REVEAL_ALL_NATURALS:
          return isNatural ? noteName : null;
        case PowerupType.REVEAL_NATURALS_STRING:
          return (stringIdx === activePowerup.value && isNatural) ? noteName : null;
        case PowerupType.REVEAL_FRET:
          return fretIdx === activePowerup.value ? noteName : null;
        default:
          return null;
      }
    }

    return null;
  };

  // --- RENDER HELPERS ---

  const renderNoteContent = (stringIdx: number, fretIdx: number) => {
    const revealedNote = getDisplayedNote(stringIdx, fretIdx);
    const isActive = activeNote?.fretIndex === fretIdx && activeNote?.stringIndex === stringIdx;
    const tuningOffset = tuningOffsets[stringIdx];
    
    // Determine display name (accidental handling)
    const displayNote = revealedNote 
      ? getDisplayNoteName(revealedNote, rootNote, scaleType, accidentalPreference as AccidentalStyle)
      : null;
    
    // Sizing for dots
    const dotSize = isVertical ? 'w-6 h-6' : 'w-7 h-7 md:w-8 md:h-8';
    const fontSize = isVertical ? 'text-[9px]' : 'text-[10px]';

    return (
      <div className="relative z-20 flex items-center justify-center">
        {isActive && (
          <div className={`${dotSize} rounded-full bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-bounce z-30 flex items-center justify-center`}>
            {displayNote && (
              <span className={`${fontSize} font-bold text-white drop-shadow-md`}>{displayNote}</span>
            )}
          </div>
        )}
        
        {displayNote && !isActive && (
          <div 
            className={`
              ${dotSize} rounded-full flex items-center justify-center ${fontSize} font-bold text-black shadow-md animate-fade-in transition-all border border-white/20
            `}
            style={{ backgroundColor: getNoteColor(revealedNote!, tuningOffset, fretIdx) }}
          >
            {displayNote}
          </div>
        )}
      </div>
    );
  };

  const renderMarker = (fretNum: number) => {
    if (!isMarker(fretNum)) return null;
    if (fretNum === 12) {
      return (
        <>
          <div className={`absolute rounded-full bg-gray-800/40 z-0 ${isVertical ? 'w-3 h-3 left-1/3 top-1/2 -translate-y-1/2' : 'w-4 h-4 top-1/3 left-1/2 -translate-x-1/2'}`} />
          <div className={`absolute rounded-full bg-gray-800/40 z-0 ${isVertical ? 'w-3 h-3 right-1/3 top-1/2 -translate-y-1/2' : 'w-4 h-4 top-2/3 left-1/2 -translate-x-1/2'}`} />
        </>
      );
    }
    return (
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-800/40 z-0 ${isVertical ? 'w-3 h-3' : 'w-4 h-4'}`} />
    );
  };

  return (
    // Root container: Full height to allow scrolling sidebar and proper filling
    <div className={`flex flex-row ${isVertical ? 'h-full w-full gap-2' : 'gap-4 w-full h-full'} select-none`}>
      
      {/* STUDY MODE SIDEBAR */}
      {isStudyMode && onNoteNameToggle && (
        <div className={`flex flex-col custom-scrollbar ${isVertical ? 'w-[38%] min-w-[140px] overflow-y-auto pr-1 gap-4' : 'w-[16rem] shrink-0 gap-6 overflow-y-auto pr-2 pb-2 h-full'}`}>
          {/* Note Controls */}
           <div className="flex flex-col gap-1 shrink-0">
             <div className="flex flex-col mb-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center">
               <div className="grid grid-cols-4 px-1 gap-1">
                 <span className="col-span-1"></span>
                 <span className="col-span-2 border-b border-gray-700/50 pb-0.5 mb-0.5 text-[9px]">Chord</span>
                 <span className="col-span-1"></span>
               </div>
               <div className="grid grid-cols-4 px-1 gap-1">
                 <span>Key</span>
                 <span>Maj</span>
                 <span>Min</span>
                 <span>Note</span>
               </div>
             </div>
             {NOTES_SHARP.map((note) => {
               const hue = getNoteHue(note);
               const isSelected = highlightNotes?.includes(note);
               const isRoot = rootNote === note;
               
               const isMajorActive = activeChords?.some(c => c.root === note && c.type === 'MAJOR');
               const isMinorActive = activeChords?.some(c => c.root === note && c.type === 'NATURAL_MINOR');

               // Display name with current context
               const displayName = getDisplayNoteName(note, rootNote, scaleType, accidentalPreference as AccidentalStyle);

               return (
                 <div key={`sidebar-${note}`} className="grid grid-cols-4 items-center gap-1">
                   {/* Key/Scale Root Selector */}
                   <div className="flex justify-center">
                     <button
                       onClick={() => onRootNoteSelect && onRootNoteSelect(isRoot ? null : note)}
                       className={`rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isVertical ? 'w-5 h-5' : 'w-6 h-6'} ${isRoot ? 'scale-110 shadow-lg' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}`}
                       style={{ borderColor: isRoot ? `hsl(${hue}, 70%, 50%)` : undefined, backgroundColor: isRoot ? `hsl(${hue}, 70%, 20%)` : undefined }}
                     >
                       {isRoot && <div className={`${isVertical ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full shadow-sm`} style={{ backgroundColor: `hsl(${hue}, 90%, 60%)` }} />}
                     </button>
                   </div>
                   
                   {/* Major Chord Toggle */}
                   <div className="flex justify-center">
                     <button
                       onClick={() => onChordToggle && onChordToggle(note, 'MAJOR')}
                       className={`rounded border flex items-center justify-center transition-all duration-200 ${isVertical ? 'w-5 h-5' : 'w-6 h-6'} ${isMajorActive ? 'scale-110 shadow-lg' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}`}
                       style={{ borderColor: isMajorActive ? `hsl(${hue}, 90%, 60%)` : undefined, backgroundColor: isMajorActive ? `hsl(${hue}, 70%, 30%)` : undefined }}
                     >
                        {isMajorActive && <span className="text-[10px] font-bold text-white">M</span>}
                     </button>
                   </div>

                   {/* Minor Chord Toggle */}
                   <div className="flex justify-center">
                     <button
                       onClick={() => onChordToggle && onChordToggle(note, 'NATURAL_MINOR')}
                       className={`rounded border flex items-center justify-center transition-all duration-200 ${isVertical ? 'w-5 h-5' : 'w-6 h-6'} ${isMinorActive ? 'scale-110 shadow-lg' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}`}
                       style={{ borderColor: isMinorActive ? `hsl(${hue}, 90%, 60%)` : undefined, backgroundColor: isMinorActive ? `hsl(${hue}, 70%, 30%)` : undefined }}
                     >
                        {isMinorActive && <span className="text-[10px] font-bold text-white">m</span>}
                     </button>
                   </div>
                   
                   {/* Note Name Toggle */}
                   <div className="flex justify-center">
                     <button
                       onClick={() => onNoteNameToggle(note)}
                       style={{ backgroundColor: isSelected ? `hsl(${hue}, 70%, 25%)` : 'transparent', borderColor: `hsl(${hue}, 70%, 50%)`, color: `hsl(${hue}, 90%, 80%)` }}
                       className={`text-xs font-bold rounded border transition-all shadow-sm ${isVertical ? 'w-10 h-7 text-[9px]' : 'w-10 h-8'} ${isSelected ? 'shadow-md ring-1 ring-white/20' : 'hover:bg-gray-800 opacity-60 hover:opacity-100'}`}
                     >
                       {displayName}
                     </button>
                   </div>
                 </div>
               );
            })}
          </div>
          {/* Scale Type */}
          <div className={`flex flex-col gap-3 p-3 bg-gray-800/80 rounded-lg border border-gray-700 shadow-lg shrink-0 ${isVertical ? 'p-2' : 'p-3'} ${showAdvancedScales ? 'overflow-y-auto custom-scrollbar pr-2' : 'overflow-hidden'}`}>
             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center sticky top-0 bg-gray-800/95 z-10 py-1">Scale</span>
             <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scaleType === 'MAJOR' ? 'border-green-400' : 'border-gray-500'}`}>{scaleType === 'MAJOR' && <div className="w-2 h-2 rounded-full bg-green-400" />}</div>
                  <input type="radio" name="scaleType" className="hidden" checked={scaleType === 'MAJOR'} onChange={() => onScaleTypeSelect && onScaleTypeSelect('MAJOR')} />
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${scaleType === 'MAJOR' ? 'text-green-300' : 'text-gray-400'}`}>Major</span>
                    {showAdvancedScales && <span className="text-[9px] text-gray-500 font-mono">(Ionian)</span>}
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scaleType === 'NATURAL_MINOR' ? 'border-blue-400' : 'border-gray-500'}`}>{scaleType === 'NATURAL_MINOR' && <div className="w-2 h-2 rounded-full bg-blue-400" />}</div>
                  <input type="radio" name="scaleType" className="hidden" checked={scaleType === 'NATURAL_MINOR'} onChange={() => onScaleTypeSelect && onScaleTypeSelect('NATURAL_MINOR')} />
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${scaleType === 'NATURAL_MINOR' ? 'text-blue-300' : 'text-gray-400'}`}>Minor</span>
                    {showAdvancedScales && <span className="text-[9px] text-gray-500 font-mono">(Aeolian)</span>}
                  </div>
                </label>
                
                {/* Advanced Modes Toggle */}
                <button 
                  onClick={() => setShowAdvancedScales(!showAdvancedScales)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 mt-1 pb-1 border-b border-gray-700/50"
                >
                  <span>{showAdvancedScales ? 'Hide' : 'Advanced Modes'}</span>
                  <span className={`transform transition-transform ${showAdvancedScales ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Advanced Modes Options */}
                <div className={`flex flex-col gap-2 transition-all duration-300 ${showAdvancedScales ? 'opacity-100 mt-1' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  {['DORIAN', 'PHRYGIAN', 'LYDIAN', 'MIXOLYDIAN', 'LOCRIAN'].map((mode) => (
                    <label key={mode} className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scaleType === mode ? 'border-purple-400' : 'border-gray-500'}`}>{scaleType === mode && <div className="w-2 h-2 rounded-full bg-purple-400" />}</div>
                      <input type="radio" name="scaleType" className="hidden" checked={scaleType === mode} onChange={() => onScaleTypeSelect && onScaleTypeSelect(mode as ScaleType)} />
                      <span className={`text-xs font-bold capitalize ${scaleType === mode ? 'text-purple-300' : 'text-gray-400'}`}>{mode.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- RIGHT COLUMN (Fretboard + Buttons) --- */}
      <div className={`flex flex-col flex-1 min-w-0 ${isVertical ? 'h-full' : 'h-full'}`}>
        
        {/* Fretboard Layout (Wrapper around strings/board) */}
        <div className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} relative min-h-0`}>
          
          {/* Main Board Wrapper (Includes String Labels + Brown Box) */}
          <div className={`flex-1 flex ${isVertical ? 'flex-col' : 'flex-row'} relative`}>

            {/* String Labels (Integrated Gutter) */}
            {isStudyMode && (
              <div className={`
                flex z-10 flex-shrink-0
                ${isVertical ? 'flex-row px-4 pb-1 pl-0 h-8 items-end' : 'flex-col py-4 pr-2 w-8 items-end'}
              `}>
                {strings.map(stringIdx => {
                    const isSelected = highlightLocations?.strings.includes(stringIdx);
                    return (
                      <div key={`gutter-wrapper-${stringIdx}`} className={`flex-1 flex items-center justify-center ${isVertical ? 'w-full' : 'h-full'}`}>
                        <button 
                          onClick={() => onStringToggle && onStringToggle(stringIdx)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border hover:scale-110 transition-transform ${isSelected ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>
                          {stringIdx + 1}
                        </button>
                      </div>
                    );
                })}
              </div>
            )}

            {/* Main Fretboard Box */}
            <div className={`flex-1 flex ${isVertical ? 'flex-col' : 'flex-row'} bg-[#3e2723] border-4 rounded-lg shadow-2xl relative transition-colors duration-500 ${activePowerup ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'border-[#281b18]'}`}>
              
              {/* NUT (Fret 0) */}
              <div className={`
                relative flex-shrink-0 border-gray-400 bg-[#281b18] flex justify-between
                ${isVertical ? 'h-16 border-b-4 flex-row px-4 items-center' : 'w-16 border-r-4 flex-col py-4 items-center'}
              `}>
                {strings.map((stringIdx) => (
                  <div key={`nut-${stringIdx}`} className={`flex justify-center items-center relative ${isVertical ? 'w-full h-full' : 'h-full w-full'}`}>
                    {renderNoteContent(stringIdx, 0)}
                  </div>
                ))}
                <div className={`absolute text-[10px] text-gray-500 font-bold uppercase tracking-widest ${isVertical ? 'right-2 rotate-90 top-1/2 -translate-y-1/2' : 'bottom-0 w-full text-center mb-1'}`}>Nut</div>
              </div>

              {/* BOARD BODY (Frets 1+) */}
              <div className={`flex-1 flex ${isVertical ? 'flex-col' : 'flex-row'} relative`}>
                
                {/* Strings (Visual Lines Layer) */}
                <div className={`absolute inset-0 flex ${isVertical ? 'flex-row px-4' : 'flex-col py-4'} justify-between pointer-events-none z-10`}>
                    {strings.map((idx) => {
                      const { style, className } = getStringStyle(idx);
                      return (
                        <div key={`string-line-${idx}`} className={`relative flex items-center justify-center ${isVertical ? 'h-full w-full' : 'w-full h-full'}`}>
                          <div className={className} style={style} />
                        </div>
                      );
                    })}
                </div>

                {/* Frets Layer */}
                {Array.from({ length: maxFret }).map((_, i) => {
                  const fretNum = i + 1;
                  return (
                    <div 
                      key={`fret-${fretNum}`} 
                      className={`
                        flex-1 flex justify-between relative group
                        ${isVertical ? 'border-b-2 flex-row px-4 items-center' : 'border-r-2 flex-col py-4 items-center'}
                        border-gray-400/80 
                        ${isMarker(fretNum) ? 'bg-[#4e342e]' : ''}
                      `}
                    >
                      {/* Marker Dots */}
                      {renderMarker(fretNum)}

                      {/* Note Cells */}
                      {strings.map((stringIdx) => (
                          <div key={`fret-${fretNum}-str-${stringIdx}`} className="flex-1 flex justify-center items-center z-20 relative w-full h-full">
                            {renderNoteContent(stringIdx, fretNum)}
                          </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Fret Labels / Buttons */}
          <div className={`flex ${isVertical ? 'flex-col ml-1 py-[4px] w-6' : 'flex-row mt-1 px-[4px] h-8'}`}>
             {/* Spacer for String Labels alignment */}
             {isStudyMode && (
               <div className={`flex-shrink-0 ${isVertical ? 'h-8' : 'w-8'}`} />
             )}

             {/* Nut Button */}
             <div className={`flex-shrink-0 flex justify-center items-center ${isVertical ? 'h-16' : 'w-16'}`}>
                <button disabled={!isStudyMode} onClick={() => onFretToggle && onFretToggle(0)}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all ${!isStudyMode ? 'text-gray-500 opacity-0 cursor-default' : highlightLocations?.frets.includes(0) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    0
                </button>
             </div>
             {/* Fret Buttons */}
             <div className={`flex-1 flex ${isVertical ? 'flex-col' : 'flex-row'}`}>
                {Array.from({ length: maxFret }).map((_, i) => {
                   const fretNum = i + 1;
                   const isSelected = highlightLocations?.frets.includes(fretNum);
                   return (
                     <div key={`fret-btn-${fretNum}`} className="flex-1 flex justify-center items-center">
                       <button disabled={!isStudyMode} onClick={() => onFretToggle && onFretToggle(fretNum)}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all ${!isStudyMode ? 'text-gray-500 cursor-default' : isSelected ? 'bg-blue-600 text-white scale-110' : 'bg-gray-800 text-gray-400'}`}>
                          {fretNum}
                       </button>
                     </div>
                   );
                })}
             </div>
          </div>
        </div>

        {/* Study Control Buttons - Positioned ONLY under the fretboard/strings column */}
        {isStudyMode && (
          <div className="flex justify-center gap-4 mt-4 pb-2">
             <button onClick={onClearSelection} className="px-4 py-2 bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 border border-red-900/50 transition-colors text-sm font-bold shadow-lg">
               Clear Selection
             </button>
             <button onClick={onBackToMenu} className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors text-sm font-bold shadow-lg">
               Back to Menu
             </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default Fretboard;
