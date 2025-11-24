
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Difficulty, Note, ScoreRecord, Feedback, PowerupState, PowerupType, StudyConfig, ScaleType, FocusMode, GameConfig } from './types';
import { NOTES_SHARP, NATURAL_NOTES, OPEN_STRING_NOTES, INITIAL_MAX_FRET, TOTAL_FRETS, MAX_HEALTH, TIME_LIMIT_MS, getNoteAtPosition, getNoteHue, getScaleNotes } from './constants';
import Fretboard from './components/Fretboard';
import StatsChart from './components/StatsChart';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [currentMaxFret, setCurrentMaxFret] = useState<number>(INITIAL_MAX_FRET);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [health, setHealth] = useState<number>(MAX_HEALTH);
  const [targetNote, setTargetNote] = useState<Note | null>(null);
  const [answerOptions, setAnswerOptions] = useState<string[]>([]);
  const [timer, setTimer] = useState<number>(100); 
  const [feedback, setFeedback] = useState<Feedback>({ status: 'neutral', message: '' });
  const [history, setHistory] = useState<ScoreRecord[]>([]);
  const [activePowerup, setActivePowerup] = useState<PowerupState | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Game Configuration State
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    focusMode: FocusMode.ALL,
    keyRoot: 'C',
    keyScale: 'MAJOR',
    startingFret: INITIAL_MAX_FRET,
    maxFretCap: TOTAL_FRETS,
    timeLimit: 10 // Default 10 seconds
  });

  // Study Mode State
  const [studyConfig, setStudyConfig] = useState<StudyConfig>({
    rootNote: null,
    scaleType: null,
    manuallySelectedNotes: [],
    activeStrings: [],
    activeFrets: []
  });

  // Refs
  const timerIntervalRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const activePowerupRef = useRef<PowerupState | null>(null);
  const targetNoteRef = useRef<Note | null>(null);
  const gameStateRef = useRef<GameState>(GameState.MENU);

  // Sync ref with state
  useEffect(() => {
    activePowerupRef.current = activePowerup;
  }, [activePowerup]);

  useEffect(() => {
    targetNoteRef.current = targetNote;
  }, [targetNote]);

  useEffect(() => {
    gameStateRef.current = gameState;
    // Cleanup timers when leaving playing state
    if (gameState !== GameState.PLAYING) {
      cleanupTimers();
    }
  }, [gameState]);

  // --- Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem('fretmaster_history');
    if (saved) {
      try {
        const parsedHistory = JSON.parse(saved);
        setHistory(parsedHistory);
        
        // Smart Default: Set starting fret based on last game
        if (parsedHistory.length > 0) {
          const lastGame = parsedHistory[parsedHistory.length - 1];
          const smartStart = Math.max(lastGame.maxFret - 2, 3);
          setGameConfig(prev => ({
            ...prev,
            startingFret: smartStart
          }));
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // --- Helpers ---
  const cleanupTimers = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  };

  // --- Powerup Logic ---
  const triggerPowerup = (currentStreak: number) => {
    let newPowerup: PowerupState | null = null;
    const duration = 2; // Lasts 2 questions

    if (currentStreak > 0 && currentStreak % 10 === 0) {
      // SUPER POWERUP
      newPowerup = {
        type: PowerupType.SUPER_REVEAL_ALL_NATURALS,
        duration: duration,
        label: 'SUPER STREAK! ALL NATURALS REVEALED!'
      };
    } else if (currentStreak > 0 && currentStreak % 5 === 0) {
      // Standard Powerup (Random)
      const roll = Math.random();
      if (roll < 0.33) {
        newPowerup = {
          type: PowerupType.FEWER_CHOICES,
          duration: duration,
          label: '50/50 Choices Active!'
        };
      } else if (roll < 0.66) {
        // Random String 0-5
        const strIdx = Math.floor(Math.random() * 6);
        const strName = OPEN_STRING_NOTES[strIdx];
        newPowerup = {
          type: PowerupType.REVEAL_NATURALS_STRING,
          value: strIdx,
          duration: duration,
          label: `Natural Notes on ${strName} String Revealed!`
        };
      } else {
        // Random Fret 1-currentMaxFret
        const fret = Math.floor(Math.random() * currentMaxFret) + 1;
        newPowerup = {
          type: PowerupType.REVEAL_FRET,
          value: fret,
          duration: duration,
          label: `Notes at Fret ${fret} Revealed!`
        };
      }
    }

    if (newPowerup) {
      setActivePowerup(newPowerup);
      setFeedback({ status: 'correct', message: newPowerup.label });
    }
  };

  // --- Game Loop Helpers ---

  const getValidNotes = useCallback((): Note[] => {
    const validNotes: Note[] = [];
    const scaleNotes = gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale
      ? getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale)
      : [];

    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= currentMaxFret; f++) {
        const name = getNoteAtPosition(s, f);
        
        let isValid = true;
        if (gameConfig.focusMode === FocusMode.NATURALS) {
          if (name.includes('#')) isValid = false;
        } else if (gameConfig.focusMode === FocusMode.KEY) {
          if (!scaleNotes.includes(name)) isValid = false;
        }

        if (isValid) {
          validNotes.push({ stringIndex: s, fretIndex: f, noteName: name });
        }
      }
    }
    return validNotes;
  }, [currentMaxFret, gameConfig]);

  const generateNewNote = useCallback(() => {
    // Guard: Ensure we are still playing before modifying state
    if (gameStateRef.current !== GameState.PLAYING) return;

    const currentPowerup = activePowerupRef.current;
    
    // Decrement powerup duration
    if (currentPowerup) {
      const remaining = currentPowerup.duration - 1;
      if (remaining <= 0) {
        setActivePowerup(null);
      } else {
        setActivePowerup({ ...currentPowerup, duration: remaining });
      }
    }

    const validNotes = getValidNotes();
    if (validNotes.length === 0) {
      console.warn("No valid notes found with current config, falling back to basic random");
      validNotes.push({ stringIndex: 0, fretIndex: 1, noteName: 'F' });
    }

    let nextNote: Note;
    let attempts = 0;
    
    // Pick random note from valid pool, ensuring not same as last
    do {
      const idx = Math.floor(Math.random() * validNotes.length);
      nextNote = validNotes[idx];
      attempts++;
    } while (
      targetNoteRef.current && 
      nextNote.stringIndex === targetNoteRef.current.stringIndex && 
      nextNote.fretIndex === targetNoteRef.current.fretIndex && 
      attempts < 10
    );
    
    setTargetNote(nextNote);
    
    // Generate Answer Options
    if (difficulty === Difficulty.EASY) {
      // Determine valid distractors based on Focus Mode
      let allowedDistractors = NOTES_SHARP;
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        allowedDistractors = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        allowedDistractors = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      }

      const possibleDistractors = allowedDistractors.filter(n => n !== nextNote.noteName);
      
      const isFewerChoices = currentPowerup?.type === PowerupType.FEWER_CHOICES;
      // Default to 5 choices, or 2 if powerup
      const numDistractors = isFewerChoices ? 1 : 4;

      // If we don't have enough valid distractors, use what we have
      const safeNumDistractors = Math.min(numDistractors, possibleDistractors.length);
      
      const distractors = possibleDistractors.sort(() => 0.5 - Math.random()).slice(0, safeNumDistractors);
      const options = [...distractors, nextNote.noteName].sort(() => 0.5 - Math.random());
      setAnswerOptions(options);
    } else {
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        setAnswerOptions(NATURAL_NOTES);
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
         setAnswerOptions(getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale));
      } else {
        setAnswerOptions(NOTES_SHARP);
      }
    }

    // Reset Timer
    setTimer(100);
    startTimeRef.current = Date.now();
    
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    timerIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const limitMs = gameConfig.timeLimit * 1000;
      const remaining = Math.max(0, 100 - (elapsed / limitMs) * 100);
      setTimer(remaining);
      
      if (remaining === 0) {
        handleTimeout();
      }
    }, 100);
  }, [currentMaxFret, difficulty, getValidNotes, gameConfig]);

  const stopGame = useCallback(() => {
    cleanupTimers();
    setGameState(GameState.GAME_OVER);
    
    const newRecord: ScoreRecord = {
      date: new Date().toISOString(),
      score,
      difficulty,
      maxFret: currentMaxFret,
      focusMode: gameConfig.focusMode
    };
    
    const newHistory = [...history, newRecord];
    setHistory(newHistory);
    localStorage.setItem('fretmaster_history', JSON.stringify(newHistory));
  }, [score, difficulty, currentMaxFret, history, gameConfig]);

  const handleTimeout = () => {
    // Critical Guard: Don't execute timeout logic if we aren't playing
    if (gameStateRef.current !== GameState.PLAYING) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const correctNote = targetNoteRef.current?.noteName || '?';

    setFeedback({ status: 'incorrect', message: `Time up! It was ${correctNote}` });
    setStreak(0);
    setActivePowerup(null);
    
    setHealth(prev => {
      const newHealth = prev - 1;
      if (newHealth <= 0) {
        // Use a slight delay to allow the state to settle before stopping, 
        // but ensure we don't start a new note.
        stopGame();
        return 0;
      }
      
      // Schedule next note, keeping track of the timeout ID for cleanup
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback({ status: 'neutral', message: '' });
        generateNewNote();
      }, 1500); 

      return newHealth;
    });
  };

  const checkAnswer = (selectedNote: string) => {
    if (!targetNote) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (selectedNote === targetNote.noteName) {
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      
      let delay = 800;

      if (newStreak % 5 === 0) {
        triggerPowerup(newStreak);
        delay = 1500;
      } else {
        setFeedback({ status: 'correct', message: 'Correct!' });
        
        // Level Up Logic
        if (newScore > 0 && newScore % 5 === 0 && currentMaxFret < gameConfig.maxFretCap) {
          setCurrentMaxFret(prev => Math.min(prev + 1, gameConfig.maxFretCap));
          setFeedback({ status: 'correct', message: 'Level Up! Fretboard Expanded!' });
          delay = 1500;
        }
      }

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback({ status: 'neutral', message: '' });
        generateNewNote();
      }, delay);

    } else {
      setStreak(0);
      setActivePowerup(null);
      setHealth(prev => {
        const newHealth = prev - 1;
        setFeedback({ status: 'incorrect', message: `Wrong! It was ${targetNote.noteName}` });
        
        if (newHealth <= 0) {
           setTimeout(() => stopGame(), 1000);
           return 0;
        }
        
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback({ status: 'neutral', message: '' });
          generateNewNote();
        }, 1500);
        return newHealth;
      });
    }
  };

  const startGame = () => {
    cleanupTimers(); // Kill any zombie timers
    
    setScore(0);
    setStreak(0);
    setHealth(MAX_HEALTH);
    setActivePowerup(null);
    setCurrentMaxFret(gameConfig.startingFret);
    setFeedback({ status: 'neutral', message: '' }); // Clear old messages
    setTargetNote(null); 
    
    setGameState(GameState.PLAYING);
    
    // Reset Refs
    targetNoteRef.current = null;
    activePowerupRef.current = null;
    gameStateRef.current = GameState.PLAYING;
    
    // Use timeout to ensure state propagation, but track it just in case
    setTimeout(() => generateNewNote(), 0);
  };

  // --- Study Mode Handlers ---
  const toggleStudyNote = (note: string) => {
    setStudyConfig(prev => {
      const exists = prev.manuallySelectedNotes.includes(note);
      const newNotes = exists 
        ? prev.manuallySelectedNotes.filter(n => n !== note)
        : [...prev.manuallySelectedNotes, note];
      return { ...prev, manuallySelectedNotes: newNotes };
    });
  };

  const toggleStudyString = (stringIdx: number) => {
    setStudyConfig(prev => {
      const exists = prev.activeStrings.includes(stringIdx);
      const newStrings = exists
        ? prev.activeStrings.filter(s => s !== stringIdx)
        : [...prev.activeStrings, stringIdx];
      return { ...prev, activeStrings: newStrings };
    });
  };

  const toggleStudyFret = (fretIdx: number) => {
    setStudyConfig(prev => {
      const exists = prev.activeFrets.includes(fretIdx);
      const newFrets = exists
        ? prev.activeFrets.filter(f => f !== fretIdx)
        : [...prev.activeFrets, fretIdx];
      return { ...prev, activeFrets: newFrets };
    });
  };
  
  const handleRootNoteSelect = (note: string | null) => {
    setStudyConfig(prev => ({
      ...prev,
      rootNote: note,
      scaleType: note && !prev.scaleType ? 'MAJOR' : prev.scaleType
    }));
  };

  const handleScaleTypeSelect = (type: ScaleType) => {
    setStudyConfig(prev => ({ ...prev, scaleType: type }));
  };

  const getActiveScaleNotes = (): string[] => {
    if (studyConfig.rootNote && studyConfig.scaleType) {
      return getScaleNotes(studyConfig.rootNote, studyConfig.scaleType);
    }
    return [];
  };

  const getVisibleNotesForStudy = (): string[] => {
    const scaleNotes = getActiveScaleNotes();
    const manualNotes = studyConfig.manuallySelectedNotes;
    return Array.from(new Set([...scaleNotes, ...manualNotes]));
  };

  // --- Rendering ---

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-none p-4 bg-gray-800 border-b border-gray-700 shadow-md flex justify-between items-center z-30">
        <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 cursor-pointer" onClick={() => setGameState(GameState.MENU)}>
          Frétude
        </h1>
        <div className="flex items-center gap-4">
           {gameState === GameState.PLAYING && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400 font-mono">Streak</span>
                <span className={`font-bold text-lg ${streak >= 5 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                  {streak} 🔥
                </span>
              </div>
           )}
           <div className="text-sm text-gray-500 hidden md:block">
            {gameState === GameState.STUDY ? (
              <span className="font-mono text-blue-400">Study Mode</span>
            ) : gameState === GameState.PLAYING ? (
               <span className="font-mono">
                  Range: 0-{currentMaxFret} • {gameConfig.focusMode === FocusMode.KEY ? `${gameConfig.keyRoot} ${gameConfig.keyScale}` : gameConfig.focusMode}
               </span>
            ) : (
              <span>Classical Guitar • EADGBE</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        
        {/* MENU SCREEN */}
        {gameState === GameState.MENU && (
          <div className="max-w-4xl mx-auto p-4 md:p-6 flex flex-col items-center gap-6 mt-4 animate-fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">Master the Fretboard</h2>
              <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base">
                Train your memory, build speed, and track your progress.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-col md:flex-row gap-4 w-full max-w-lg">
                <button 
                   onClick={startGame}
                   className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-lg shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-1"
                 >
                   Start Game
                 </button>
                 <button 
                   onClick={() => setGameState(GameState.STUDY)}
                   className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all border border-gray-600"
                 >
                   Study Mode
                 </button>
            </div>

            {/* Collapsible Game Config */}
            <div className="w-full max-w-3xl">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="mx-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
              >
                <span>{showSettings ? 'Hide' : 'Customize'} Game Settings</span>
                <span className={`transform transition-transform ${showSettings ? 'rotate-180' : ''}`}>▼</span>
              </button>

              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showSettings ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 shadow-xl backdrop-blur-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Mode & Difficulty */}
                    <div className="space-y-6">
                        {/* Difficulty */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Difficulty</label>
                          <div className="flex gap-2">
                              <button 
                                onClick={() => setDifficulty(Difficulty.EASY)}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${difficulty === Difficulty.EASY ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                              >
                                Easy (Choice)
                              </button>
                              <button 
                                onClick={() => setDifficulty(Difficulty.HARD)}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${difficulty === Difficulty.HARD ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                              >
                                Hard (Recall)
                              </button>
                          </div>
                        </div>

                        {/* Focus Mode */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Focus Mode</label>
                          <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.ALL} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.ALL }))} className="accent-blue-500" />
                                <div>
                                  <div className="font-bold text-sm">All Notes</div>
                                  <div className="text-xs text-gray-500">Full chromatic scale</div>
                                </div>
                              </label>
                              <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.NATURALS} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.NATURALS }))} className="accent-green-500" />
                                <div>
                                  <div className="font-bold text-sm">Naturals Only</div>
                                  <div className="text-xs text-gray-500">No sharps or flats</div>
                                </div>
                              </label>
                              <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.KEY} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.KEY }))} className="accent-purple-500" />
                                <div>
                                  <div className="font-bold text-sm">Specific Key</div>
                                  <div className="text-xs text-gray-500">Focus on a scale</div>
                                </div>
                              </label>
                          </div>
                        </div>

                        {/* Timer Settings */}
                        <div className="space-y-2 pt-2 border-t border-gray-700">
                           <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                              <span>Timer Duration</span>
                              <span className="text-white">{gameConfig.timeLimit}s</span>
                           </div>
                           <input 
                              type="range" 
                              min="3" 
                              max="30" 
                              step="1"
                              value={gameConfig.timeLimit}
                              onChange={(e) => setGameConfig(p => ({ ...p, timeLimit: Number(e.target.value) }))}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                            />
                        </div>
                    </div>

                    {/* Right Column: Key Config & Range */}
                    <div className="space-y-6">
                        {/* Key Selection */}
                        <div className={`space-y-2 transition-opacity duration-300 ${gameConfig.focusMode === FocusMode.KEY ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Target Key</label>
                          <div className="flex gap-2">
                              <select 
                                value={gameConfig.keyRoot || 'C'} 
                                onChange={(e) => setGameConfig(p => ({ ...p, keyRoot: e.target.value }))}
                                className="bg-gray-700 text-white rounded p-2 text-sm flex-1 outline-none border border-gray-600 focus:border-blue-500"
                              >
                                {NOTES_SHARP.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <select 
                                value={gameConfig.keyScale || 'MAJOR'} 
                                onChange={(e) => setGameConfig(p => ({ ...p, keyScale: e.target.value as ScaleType }))}
                                className="bg-gray-700 text-white rounded p-2 text-sm flex-1 outline-none border border-gray-600 focus:border-blue-500"
                              >
                                <option value="MAJOR">Major</option>
                                <option value="NATURAL_MINOR">Minor</option>
                              </select>
                          </div>
                        </div>

                        {/* Fret Range */}
                        <div className="space-y-4 pt-2 border-t border-gray-700">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fret Range Config</label>
                          
                          <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Starting Size</span>
                                <span className="font-bold text-blue-400">0 - {gameConfig.startingFret}</span>
                              </div>
                              <input 
                                type="range" 
                                min="1" 
                                max={gameConfig.maxFretCap} 
                                value={gameConfig.startingFret}
                                onChange={(e) => setGameConfig(p => ({ ...p, startingFret: Number(e.target.value) }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                          </div>

                          <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Max Cap (Level Up Limit)</span>
                                <span className="font-bold text-orange-400">0 - {gameConfig.maxFretCap}</span>
                              </div>
                              <input 
                                type="range" 
                                min={gameConfig.startingFret} 
                                max={TOTAL_FRETS} 
                                value={gameConfig.maxFretCap}
                                onChange={(e) => setGameConfig(p => ({ ...p, maxFretCap: Number(e.target.value) }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                              />
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full mt-4">
               <StatsChart history={history} />
            </div>
          </div>
        )}

        {/* STUDY MODE SCREEN */}
        {gameState === GameState.STUDY && (
           <div className="flex flex-col items-center h-full pt-4 px-2">
             <div className="w-full max-w-6xl bg-gray-800 rounded-xl p-4 mb-4 shadow-lg border border-gray-700">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h2 className="text-xl font-bold text-blue-400">Fretboard Explorer</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setStudyConfig({ rootNote: null, scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] })}
                      className="px-3 py-1 bg-red-900/50 text-red-300 rounded text-xs hover:bg-red-900"
                    >
                      Clear All
                    </button>
                    <button 
                      onClick={() => {
                        setStudyConfig({ rootNote: null, scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] });
                        setGameState(GameState.MENU);
                      }}
                      className="px-4 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600"
                    >
                      Back to Menu
                    </button>
                  </div>
                </div>
             </div>

             {/* Fretboard with Highlights */}
             <div className="w-full flex justify-center pb-12 overflow-x-auto">
               <div className="min-w-[800px] w-full max-w-7xl px-4">
                 <Fretboard 
                    isStudyMode={true}
                    activeNote={null} 
                    maxFret={12} 
                    activePowerup={null} 
                    highlightNotes={getVisibleNotesForStudy()}
                    scaleNotes={getActiveScaleNotes()}
                    highlightLocations={{
                      strings: studyConfig.activeStrings,
                      frets: studyConfig.activeFrets
                    }}
                    rootNote={studyConfig.rootNote}
                    scaleType={studyConfig.scaleType}
                    onNoteNameToggle={toggleStudyNote}
                    onStringToggle={toggleStudyString}
                    onFretToggle={toggleStudyFret}
                    onRootNoteSelect={handleRootNoteSelect}
                    onScaleTypeSelect={handleScaleTypeSelect}
                 />
               </div>
            </div>
           </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === GameState.PLAYING && (
          <div className="flex flex-col items-center h-full justify-start pt-4 md:pt-10 px-2">
            
            {/* Status Bar */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-6 px-4">
              <div className="flex items-center gap-2">
                 <span className="text-gray-400 uppercase text-xs font-bold tracking-wider">Score</span>
                 <span className="text-3xl font-mono text-amber-400">{score}</span>
              </div>
              
              <div className="flex gap-1">
                {Array.from({ length: MAX_HEALTH }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 md:w-6 md:h-6 rounded-full transition-colors duration-300 ${i < health ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]' : 'bg-gray-800'}`} 
                  />
                ))}
              </div>
            </div>

            {/* Powerup Banner */}
            <div className={`w-full max-w-4xl h-10 mb-2 flex items-center justify-center transition-all duration-500 ${activePowerup ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}>
              {activePowerup && (
                 <div className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400 flex items-center gap-2 animate-pulse">
                   <span className="text-xl">⚡</span>
                   <span className="font-bold text-white text-sm md:text-base uppercase tracking-wider">{activePowerup.label}</span>
                 </div>
              )}
            </div>

            {/* Timer Bar */}
            <div className="w-full max-w-4xl h-2 bg-gray-800 rounded-full mb-8 overflow-hidden">
               <div 
                 className={`h-full transition-all duration-100 ease-linear ${timer < 30 ? 'bg-red-500' : 'bg-blue-500'}`}
                 style={{ width: `${timer}%` }}
               />
            </div>

            {/* Fretboard Visualization */}
            <div className="w-full flex justify-center mb-8 md:mb-12">
               <div className="w-full max-w-5xl overflow-x-auto">
                 <Fretboard activeNote={targetNote} maxFret={currentMaxFret} activePowerup={activePowerup} />
               </div>
            </div>

            {/* Feedback Overlay */}
            <div className={`h-8 mb-4 font-bold text-xl transition-opacity ${feedback.message ? 'opacity-100' : 'opacity-0'} ${feedback.status === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.message}
            </div>

            {/* Controls / Inputs */}
            <div className="w-full max-w-2xl flex flex-wrap justify-center gap-2 md:gap-4 px-4 pb-10">
               {answerOptions.map((note) => {
                 const hue = getNoteHue(note);
                 return (
                   <button
                     key={note}
                     onClick={() => checkAnswer(note)}
                     style={{ 
                       borderColor: `hsl(${hue}, 70%, 50%)`,
                       color: `hsl(${hue}, 90%, 75%)`,
                       textShadow: `0 0 10px hsl(${hue}, 70%, 20%)`
                     }}
                     className="min-w-[4rem] w-16 md:w-20 py-3 rounded-lg bg-gray-800 border-2 hover:bg-gray-700 transition-all font-bold text-lg active:scale-95 shadow-md hover:shadow-lg"
                   >
                     {note}
                   </button>
                 );
               })}
            </div>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameState === GameState.GAME_OVER && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 animate-fade-in">
             <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full text-center">
               <h2 className="text-3xl font-bold mb-2 text-white">Session Complete</h2>
               <div className="text-6xl font-black text-amber-500 mb-6">{score}</div>
               
               <p className="text-gray-400 mb-8">
                 Difficulty: <span className="text-white font-bold">{difficulty}</span> <br/>
                 Max Fret Reached: <span className="text-white font-bold">{currentMaxFret}</span> <br/>
                 Focus: <span className="text-white font-bold">{gameConfig.focusMode}</span>
               </p>

               <div className="flex gap-4 justify-center">
                 <button 
                   onClick={() => setGameState(GameState.MENU)}
                   className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
                 >
                   Main Menu
                 </button>
                 <button 
                   onClick={startGame}
                   className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-lg transition-colors"
                 >
                   Try Again
                 </button>
               </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;