
import React from 'react';
import { Note, PowerupState, PowerupType, ScaleType } from '../types';
import { getNoteAtPosition, getNoteColor, getNoteHue, NOTES_SHARP } from '../constants';

interface FretboardProps {
  activeNote: Note | null;
  maxFret: number;
  activePowerup: PowerupState | null;
  
  // Study Mode Props
  highlightNotes?: string[]; // Note names to reveal (C, D#)
  highlightLocations?: { strings: number[], frets: number[] }; // Strings/Frets explicitly toggled
  scaleNotes?: string[]; // Notes belonging to selected key (for pulsing border)
  
  rootNote?: string | null;
  scaleType?: ScaleType;
  
  onNoteNameToggle?: (note: string) => void;
  onStringToggle?: (stringIdx: number) => void;
  onFretToggle?: (fretIdx: number) => void;
  onRootNoteSelect?: (note: string | null) => void;
  onScaleTypeSelect?: (type: ScaleType) => void;
  
  isStudyMode?: boolean;
}

const Fretboard: React.FC<FretboardProps> = ({ 
  activeNote, 
  maxFret, 
  activePowerup, 
  highlightNotes, 
  highlightLocations,
  scaleNotes,
  rootNote,
  scaleType,
  onNoteNameToggle,
  onStringToggle,
  onFretToggle,
  onRootNoteSelect,
  onScaleTypeSelect,
  isStudyMode = false
}) => {
  // Render strings visually Top to Bottom: High E (5) -> Low E (0)
  const strings = [5, 4, 3, 2, 1, 0]; 

  // Markers for standard guitar (3, 5, 7, 9, 12)
  const isMarker = (fret: number) => [3, 5, 7, 9, 12].includes(fret);

  const getStringStyle = (stringIndex: number) => {
    // 0(Low E) to 5(High E)
    const isWound = stringIndex <= 2;
    
    let height = 1.5;
    if (stringIndex === 0) height = 6;
    else if (stringIndex === 1) height = 5;
    else if (stringIndex === 2) height = 4;
    else if (stringIndex === 3) height = 2.5;
    else if (stringIndex === 4) height = 2;
    
    const colorClass = isWound ? 'bg-[#b8860b]' : 'bg-[#fffaf0] opacity-80';
    const shadowClass = isWound ? 'shadow-md shadow-black/40' : 'shadow-sm shadow-black/20';

    return {
      height: `${height}px`,
      className: `${colorClass} ${shadowClass} rounded-sm transition-all duration-300`
    };
  };

  const getDisplayedNote = (stringIdx: number, fretIdx: number): string | null => {
    const noteName = getNoteAtPosition(stringIdx, fretIdx);

    // Study Mode Logic
    if (isStudyMode && highlightNotes && highlightLocations) {
      // Show if: Note Name selected OR String Selected OR Fret Selected
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

  return (
    <div className="flex flex-row gap-6 w-full">
      
      {/* STUDY MODE: Left Sidebar (Controls) */}
      {isStudyMode && onNoteNameToggle && (
        <div className="flex flex-col gap-6 min-w-[9rem] shrink-0">
          
          {/* Note / Key Grid */}
          <div className="flex flex-col gap-1">
             {/* Header */}
             <div className="flex justify-between px-2 mb-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
               <span>Key</span>
               <span className="mr-3">Reveal</span>
             </div>
             {NOTES_SHARP.map((note) => {
               const hue = getNoteHue(note);
               const isSelected = highlightNotes?.includes(note);
               const isRoot = rootNote === note;
               
               return (
                 <div key={`sidebar-${note}`} className="flex items-center justify-between">
                   {/* Root Selection Radio */}
                   <button
                     onClick={() => onRootNoteSelect && onRootNoteSelect(isRoot ? null : note)}
                     className={`
                       w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200
                       ${isRoot ? 'scale-110 shadow-lg' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}
                     `}
                     style={{
                       borderColor: isRoot ? `hsl(${hue}, 70%, 50%)` : undefined,
                       backgroundColor: isRoot ? `hsl(${hue}, 70%, 20%)` : undefined
                     }}
                   >
                     {isRoot && (
                       <div 
                        className="w-2.5 h-2.5 rounded-full shadow-sm" 
                        style={{ backgroundColor: `hsl(${hue}, 90%, 60%)` }}
                       />
                     )}
                   </button>

                   {/* Note Visibility Toggle */}
                   <button
                     onClick={() => onNoteNameToggle(note)}
                     style={{
                        backgroundColor: isSelected ? `hsl(${hue}, 70%, 25%)` : 'transparent',
                        borderColor: `hsl(${hue}, 70%, 50%)`,
                        color: `hsl(${hue}, 90%, 80%)`,
                     }}
                     className={`
                       w-16 h-8 text-xs font-bold rounded border transition-all ml-3 shadow-sm
                       ${isSelected ? 'translate-x-1 shadow-md ring-1 ring-white/20' : 'hover:bg-gray-800 opacity-60 hover:opacity-100'}
                     `}
                   >
                     {note}
                   </button>
                 </div>
               );
            })}
          </div>

          {/* Scale Type Selector */}
          <div className="flex flex-col gap-3 p-3 bg-gray-800/80 rounded-lg border border-gray-700 shadow-lg">
             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">Scale Type</span>
             <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${scaleType === 'MAJOR' ? 'border-green-400' : 'border-gray-500'}`}>
                    {scaleType === 'MAJOR' && <div className="w-2 h-2 rounded-full bg-green-400" />}
                  </div>
                  <input 
                    type="radio" 
                    name="scaleType" 
                    className="hidden" 
                    checked={scaleType === 'MAJOR'} 
                    onChange={() => onScaleTypeSelect && onScaleTypeSelect('MAJOR')} 
                  />
                  <span className={`text-xs font-bold transition-colors ${scaleType === 'MAJOR' ? 'text-green-300' : 'text-gray-400 group-hover:text-gray-300'}`}>Major</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${scaleType === 'NATURAL_MINOR' ? 'border-blue-400' : 'border-gray-500'}`}>
                    {scaleType === 'NATURAL_MINOR' && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                  </div>
                  <input 
                    type="radio" 
                    name="scaleType" 
                    className="hidden" 
                    checked={scaleType === 'NATURAL_MINOR'} 
                    onChange={() => onScaleTypeSelect && onScaleTypeSelect('NATURAL_MINOR')} 
                  />
                  <span className={`text-xs font-bold transition-colors ${scaleType === 'NATURAL_MINOR' ? 'text-blue-300' : 'text-gray-400 group-hover:text-gray-300'}`}>Minor</span>
                </label>
             </div>
          </div>

        </div>
      )}

      {/* Main Fretboard Area */}
      <div className="flex-1 overflow-x-auto custom-scrollbar pb-6">
        <div className="flex flex-col min-w-[600px]">
          
          {/* Fretboard Row */}
          <div className="flex flex-row relative">
            {/* String Numbers Gutter */}
            {isStudyMode && (
              <div className="flex flex-col justify-between py-4 mr-2 h-48 md:h-64 shrink-0 w-8 items-center">
                {strings.map(stringIdx => {
                   const isSelected = highlightLocations?.strings.includes(stringIdx);
                   return (
                     <button
                       key={`gutter-string-${stringIdx}`}
                       onClick={() => onStringToggle && onStringToggle(stringIdx)}
                       className={`
                         w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all
                         ${isSelected ? 'bg-blue-600 text-white border-blue-400 scale-110' : 'bg-gray-800 text-gray-500 border-gray-600 hover:border-gray-400'}
                       `}
                     >
                       {stringIdx + 1}
                     </button>
                   );
                })}
              </div>
            )}

            {/* Fretboard Itself */}
            <div className={`flex-1 flex flex-row h-48 md:h-64 bg-[#3e2723] border-4 rounded-lg shadow-2xl select-none relative transition-colors duration-500 ${activePowerup ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'border-[#281b18]'}`}>
              
              {/* Nut (Fret 0) */}
              <div className="relative w-16 flex-shrink-0 border-r-4 border-gray-400 bg-[#281b18] flex flex-col justify-between py-4">
                 {strings.map((stringIdx) => {
                   const revealedNote = getDisplayedNote(stringIdx, 0);
                   const isInScale = scaleNotes && revealedNote && scaleNotes.includes(revealedNote);
                   const isActive = activeNote?.fretIndex === 0 && activeNote?.stringIndex === stringIdx;
                   
                   return (
                     <div key={`nut-${stringIdx}`} className="flex justify-center items-center h-full relative">
                       {isActive && (
                          <div className="absolute w-6 h-6 rounded-full bg-blue-500 border-2 border-white animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.8)] z-20 flex items-center justify-center">
                            {revealedNote && (
                              <span className="text-[9px] font-bold text-white drop-shadow-md">{revealedNote}</span>
                            )}
                          </div>
                       )}
                       {revealedNote && !isActive && (
                         <div 
                            className={`
                              absolute z-10 w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-full shadow-sm text-black animate-fade-in
                              ${isInScale ? 'ring-2 ring-white ring-offset-1 ring-offset-black animate-pulse-slow' : ''}
                            `}
                            style={{ backgroundColor: getNoteColor(revealedNote, stringIdx, 0) }}
                         >
                           {revealedNote}
                         </div>
                       )}
                     </div>
                   );
                 })}
                 <div className="absolute bottom-0 w-full text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Nut</div>
              </div>

              {/* Fretboard Body */}
              <div className="flex-1 flex flex-row relative">
                {/* Strings (Visual Lines) */}
                <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none z-10">
                   {strings.map((idx) => {
                     const style = getStringStyle(idx);
                     return (
                       <div key={`string-line-${idx}`} className="w-full relative h-full flex items-center">
                         <div 
                          className={`w-full ${style.className}`}
                          style={{ height: style.height }} 
                         />
                       </div>
                     );
                   })}
                </div>

                {/* Frets */}
                {Array.from({ length: maxFret }).map((_, i) => {
                  const fretNum = i + 1;
                  return (
                    <div 
                      key={`fret-${fretNum}`} 
                      className={`flex-1 border-r-2 border-gray-400/80 flex flex-col justify-between py-4 relative group ${isMarker(fretNum) ? 'bg-[#4e342e]' : ''}`}
                    >
                      {/* Dots */}
                      {isMarker(fretNum) && fretNum !== 12 && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-800/40 z-0" />
                      )}
                      {fretNum === 12 && (
                        <>
                          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-800/40 z-0" />
                          <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-800/40 z-0" />
                        </>
                      )}

                      {/* Notes */}
                      {strings.map((stringIdx) => {
                         const revealedNote = getDisplayedNote(stringIdx, fretNum);
                         const isActive = activeNote?.fretIndex === fretNum && activeNote?.stringIndex === stringIdx;
                         const isInScale = scaleNotes && revealedNote && scaleNotes.includes(revealedNote);

                         return (
                            <div key={`fret-${fretNum}-str-${stringIdx}`} className="flex-1 flex justify-center items-center z-20 relative">
                              {isActive && (
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-bounce z-30 flex items-center justify-center">
                                  {revealedNote && (
                                    <span className="text-[10px] font-bold text-white drop-shadow-md">{revealedNote}</span>
                                  )}
                                </div>
                              )}
                              
                              {revealedNote && !isActive && (
                                <div 
                                  className={`
                                    w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-black shadow-md animate-fade-in transition-all
                                    ${isInScale ? 'border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse-slow' : 'border border-white/20'}
                                  `}
                                  style={{ backgroundColor: getNoteColor(revealedNote, stringIdx, fretNum) }}
                                >
                                  {revealedNote}
                                </div>
                              )}
                            </div>
                         );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Bottom Buttons Row: Aligned with Fretboard */}
          <div className="flex flex-row mt-2">
            {/* Gutter Placeholder */}
             {isStudyMode && <div className="w-8 mr-2 shrink-0" />}

             {/* Buttons Container - Pad 4px to match Board Border thickness for alignment */}
             <div className="flex-1 flex flex-row px-[4px]">
               
               {/* 0 / Open String Button */}
               <div className="w-16 flex-shrink-0 flex justify-center">
                  <button
                    disabled={!isStudyMode}
                    onClick={() => onFretToggle && onFretToggle(0)}
                    className={`
                      w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all
                      ${!isStudyMode ? 'text-gray-500 opacity-0 cursor-default' : highlightLocations?.frets.includes(0) ? 'bg-blue-600 text-white scale-110' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
                    `}
                  >
                    0
                  </button>
               </div>

               {/* Fret Buttons 1-12 */}
               <div className="flex-1 flex flex-row">
                  {Array.from({ length: maxFret }).map((_, i) => {
                    const fretNum = i + 1;
                    const isSelected = highlightLocations?.frets.includes(fretNum);
                    return (
                      <div key={`fret-btn-${fretNum}`} className="flex-1 flex justify-center">
                        <button
                           disabled={!isStudyMode}
                           onClick={() => onFretToggle && onFretToggle(fretNum)}
                           className={`
                             w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all
                             ${!isStudyMode ? 'text-gray-500 cursor-default' : isSelected ? 'bg-blue-600 text-white scale-110' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
                           `}
                        >
                          {fretNum}
                        </button>
                      </div>
                    );
                  })}
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Fretboard;
