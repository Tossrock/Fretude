
import React from 'react';
import { Note, PowerupState, PowerupType, ScaleType } from '../types';
import { getNoteAtPosition, getNoteColor, getNoteHue, NOTES_SHARP } from '../constants';

interface FretboardProps {
  activeNote: Note | null;
  maxFret: number;
  activePowerup: PowerupState | null;
  
  // Study Mode Props
  highlightNotes?: string[];
  highlightLocations?: { strings: number[], frets: number[] };
  scaleNotes?: string[];
  
  rootNote?: string | null;
  scaleType?: ScaleType;
  
  onNoteNameToggle?: (note: string) => void;
  onStringToggle?: (stringIdx: number) => void;
  onFretToggle?: (fretIdx: number) => void;
  onRootNoteSelect?: (note: string | null) => void;
  onScaleTypeSelect?: (type: ScaleType) => void;
  
  isStudyMode?: boolean;
  orientation?: 'horizontal' | 'vertical'; // New Prop
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
  isStudyMode = false,
  orientation = 'horizontal'
}) => {
  const isVertical = orientation === 'vertical';

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
    const noteName = getNoteAtPosition(stringIdx, fretIdx);

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
    const isInScale = scaleNotes && revealedNote && scaleNotes.includes(revealedNote);
    
    // Sizing for dots
    const dotSize = isVertical ? 'w-6 h-6' : 'w-7 h-7 md:w-8 md:h-8';
    const fontSize = isVertical ? 'text-[9px]' : 'text-[10px]';

    return (
      <div className="relative z-20 flex items-center justify-center">
        {isActive && (
          <div className={`${dotSize} rounded-full bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-bounce z-30 flex items-center justify-center`}>
            {revealedNote && (
              <span className={`${fontSize} font-bold text-white drop-shadow-md`}>{revealedNote}</span>
            )}
          </div>
        )}
        
        {revealedNote && !isActive && (
          <div 
            className={`
              ${dotSize} rounded-full flex items-center justify-center ${fontSize} font-bold text-black shadow-md animate-fade-in transition-all
              ${isInScale ? 'border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse-slow' : 'border border-white/20'}
            `}
            style={{ backgroundColor: getNoteColor(revealedNote, stringIdx, fretIdx) }}
          >
            {revealedNote}
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
    <div className={`flex ${isVertical ? 'flex-col h-full w-full' : 'flex-row gap-6 w-full h-full max-h-[300px] min-h-[160px]'} select-none`}>
      
      {/* STUDY MODE SIDEBAR (Desktop Only or Top on Mobile?) - Keeping simplistic for now, mostly Desktop driven */}
      {isStudyMode && onNoteNameToggle && !isVertical && (
        <div className="flex flex-col gap-6 min-w-[9rem] shrink-0">
          {/* Note Controls */}
           <div className="flex flex-col gap-1">
             <div className="flex justify-between px-2 mb-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
               <span>Key</span><span className="mr-3">Reveal</span>
             </div>
             {NOTES_SHARP.map((note) => {
               const hue = getNoteHue(note);
               const isSelected = highlightNotes?.includes(note);
               const isRoot = rootNote === note;
               return (
                 <div key={`sidebar-${note}`} className="flex items-center justify-between">
                   <button
                     onClick={() => onRootNoteSelect && onRootNoteSelect(isRoot ? null : note)}
                     className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isRoot ? 'scale-110 shadow-lg' : 'border-gray-600 hover:border-gray-400 bg-gray-800'}`}
                     style={{ borderColor: isRoot ? `hsl(${hue}, 70%, 50%)` : undefined, backgroundColor: isRoot ? `hsl(${hue}, 70%, 20%)` : undefined }}
                   >
                     {isRoot && <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: `hsl(${hue}, 90%, 60%)` }} />}
                   </button>
                   <button
                     onClick={() => onNoteNameToggle(note)}
                     style={{ backgroundColor: isSelected ? `hsl(${hue}, 70%, 25%)` : 'transparent', borderColor: `hsl(${hue}, 70%, 50%)`, color: `hsl(${hue}, 90%, 80%)` }}
                     className={`w-16 h-8 text-xs font-bold rounded border transition-all ml-3 shadow-sm ${isSelected ? 'translate-x-1 shadow-md ring-1 ring-white/20' : 'hover:bg-gray-800 opacity-60 hover:opacity-100'}`}
                   >
                     {note}
                   </button>
                 </div>
               );
            })}
          </div>
          {/* Scale Type */}
          <div className="flex flex-col gap-3 p-3 bg-gray-800/80 rounded-lg border border-gray-700 shadow-lg">
             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">Scale Type</span>
             <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scaleType === 'MAJOR' ? 'border-green-400' : 'border-gray-500'}`}>{scaleType === 'MAJOR' && <div className="w-2 h-2 rounded-full bg-green-400" />}</div>
                  <input type="radio" name="scaleType" className="hidden" checked={scaleType === 'MAJOR'} onChange={() => onScaleTypeSelect && onScaleTypeSelect('MAJOR')} />
                  <span className={`text-xs font-bold ${scaleType === 'MAJOR' ? 'text-green-300' : 'text-gray-400'}`}>Major</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-gray-700/50 rounded transition-colors">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scaleType === 'NATURAL_MINOR' ? 'border-blue-400' : 'border-gray-500'}`}>{scaleType === 'NATURAL_MINOR' && <div className="w-2 h-2 rounded-full bg-blue-400" />}</div>
                  <input type="radio" name="scaleType" className="hidden" checked={scaleType === 'NATURAL_MINOR'} onChange={() => onScaleTypeSelect && onScaleTypeSelect('NATURAL_MINOR')} />
                  <span className={`text-xs font-bold ${scaleType === 'NATURAL_MINOR' ? 'text-blue-300' : 'text-gray-400'}`}>Minor</span>
                </label>
             </div>
          </div>
        </div>
      )}

      {/* --- FRETBOARD LAYOUT --- */}
      <div className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} relative`}>
        
        {/* Container for the Board + Controls (Fret/String buttons) */}
        
        {/* 1. String Buttons (Gutter) */}
        {isStudyMode && !isVertical && (
            // Horizontal Gutter (Left Side)
            <div className="flex-1 flex flex-col justify-between py-4 mr-2 absolute -left-10 h-full z-20">
              {strings.map(stringIdx => {
                  const isSelected = highlightLocations?.strings.includes(stringIdx);
                  return (
                    <button key={`gutter-string-${stringIdx}`} onClick={() => onStringToggle && onStringToggle(stringIdx)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${isSelected ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>
                      {stringIdx + 1}
                    </button>
                  );
              })}
            </div>
        )}

        {/* 2. Main Fretboard Box */}
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

        {/* 3. Fret Labels / Buttons */}
        <div className={`flex ${isVertical ? 'flex-col mr-1 py-[4px] w-8' : 'flex-row mt-1 px-[4px] h-8'}`}>
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
    </div>
  );
};

export default Fretboard;
