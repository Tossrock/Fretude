
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Difficulty, Note, ScoreRecord, Feedback, PowerupState, PowerupType, StudyConfig, ScaleType, FocusMode, GameConfig, GuitarProfile, AccidentalStyle, NoteStatsMap, NoteStat, HeatmapMetric, NoteInteraction } from './types';
import { NOTES_SHARP, NATURAL_NOTES, INITIAL_MAX_FRET, TOTAL_FRETS, MAX_HEALTH, TIME_LIMIT_MS, getNoteAtPosition, getNoteHue, getScaleNotes, getDisplayNoteName, getChordNotes, STANDARD_TUNING_OFFSETS } from './constants';
import Fretboard from './components/Fretboard';
import StatsChart from './components/StatsChart';
import GuitarSettings from './components/GuitarSettings';

// Hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

const DEFAULT_GUITAR: GuitarProfile = {
  id: 'default',
  name: 'Classical Guitar',
  tuningName: 'Standard (EADGBE)',
  tuning: [...STANDARD_TUNING_OFFSETS]
};

const getHealthColorClass = (current: number, max: number) => {
  const percentage = (current / max) * 100;
  if (percentage > 60) return 'bg-green-500';
  if (percentage > 20) return 'bg-amber-500';
  return 'bg-red-500';
};

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
  
  // Guitar Config State
  const [guitarProfiles, setGuitarProfiles] = useState<GuitarProfile[]>([DEFAULT_GUITAR]);
  const [activeGuitarId, setActiveGuitarId] = useState<string>('default');
  const [showGuitarSettings, setShowGuitarSettings] = useState<boolean>(false);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalStyle>('SHARP');

  // Study Config State
  const [studyMaxFret, setStudyMaxFret] = useState<number>(12);

  // Stats / Adaptive State
  const [noteStats, setNoteStats] = useState<NoteStatsMap>({});
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>(HeatmapMetric.SPEED);
  const [statsTab, setStatsTab] = useState<'heatmap' | 'timeline'>('heatmap');
  
  // Timeline Scrubber State (indices of history)
  const [timelineWindow, setTimelineWindow] = useState<{start: number, end: number}>({start: 0, end: 0});

  // New state for blocking input and visual feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  
  const isMobile = useIsMobile();

  // Active Guitar Derived State
  const activeGuitar = guitarProfiles.find(p => p.id === activeGuitarId) || DEFAULT_GUITAR;

  // Game Configuration State
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    focusMode: FocusMode.ALL,
    keyRoot: 'C',
    keyScale: 'MAJOR',
    startingFret: INITIAL_MAX_FRET,
    maxFretCap: TOTAL_FRETS,
    timeLimit: 10,
    adaptiveLearning: true
  });

  // Study Mode State
  const [studyConfig, setStudyConfig] = useState<StudyConfig>({
    rootNote: null,
    activeChords: [],
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
  const noteStartTimeRef = useRef<number>(0);
  
  // Session tracking ref
  const sessionInteractionsRef = useRef<NoteInteraction[]>([]);

  useEffect(() => {
    activePowerupRef.current = activePowerup;
  }, [activePowerup]);

  useEffect(() => {
    targetNoteRef.current = targetNote;
  }, [targetNote]);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState !== GameState.PLAYING) {
      cleanupTimers();
    }
  }, [gameState]);

  // Load persistence
  useEffect(() => {
    const savedHistory = localStorage.getItem('fretmaster_history');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
        setTimelineWindow({ start: 0, end: parsedHistory.length > 0 ? parsedHistory.length - 1 : 0 });
        if (parsedHistory.length > 0) {
          const lastGame = parsedHistory[parsedHistory.length - 1];
          const smartStart = Math.max(lastGame.maxFret - 2, 3);
          setGameConfig(prev => ({
            ...prev,
            startingFret: smartStart,
            maxFretCap: TOTAL_FRETS 
          }));
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedGuitars = localStorage.getItem('fretmaster_guitars');
    if (savedGuitars) {
      try {
         const parsedGuitars = JSON.parse(savedGuitars);
         if (Array.isArray(parsedGuitars) && parsedGuitars.length > 0) {
           setGuitarProfiles(parsedGuitars);
         }
      } catch (e) { console.error("Failed to parse guitars", e); }
    }

    const savedActiveGuitarId = localStorage.getItem('fretmaster_active_guitar');
    if (savedActiveGuitarId) {
       setActiveGuitarId(savedActiveGuitarId);
    }
    
    const savedAccidentalPref = localStorage.getItem('fretmaster_accidental_pref');
    if (savedAccidentalPref === 'FLAT' || savedAccidentalPref === 'SHARP') {
      setAccidentalPreference(savedAccidentalPref as AccidentalStyle);
    }
    
    // Load Note Stats
    const savedStats = localStorage.getItem('fretmaster_note_stats');
    if (savedStats) {
       try {
         setNoteStats(JSON.parse(savedStats));
       } catch (e) { console.error("Failed to parse stats", e); }
    }
    
    // Load Config preferences
    const savedAdaptive = localStorage.getItem('fretmaster_adaptive_learning');
    if (savedAdaptive !== null) {
      setGameConfig(prev => ({ ...prev, adaptiveLearning: savedAdaptive === 'true' }));
    }

  }, []);

  const saveGuitars = (profiles: GuitarProfile[], activeId: string) => {
     setGuitarProfiles(profiles);
     setActiveGuitarId(activeId);
     localStorage.setItem('fretmaster_guitars', JSON.stringify(profiles));
     localStorage.setItem('fretmaster_active_guitar', activeId);
  };
  
  const saveAccidentalPreference = (pref: AccidentalStyle) => {
    setAccidentalPreference(pref);
    localStorage.setItem('fretmaster_accidental_pref', pref);
  };

  const saveNoteStats = (stats: NoteStatsMap) => {
    setNoteStats(stats);
    localStorage.setItem('fretmaster_note_stats', JSON.stringify(stats));
  };

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

  // --- STATS & ALGORITHM LOGIC ---

  const recordNoteResult = (note: Note, isCorrect: boolean, timeTaken: number, isTimeout: boolean = false) => {
     const tuningId = activeGuitar.tuningName; 
     const key = `${tuningId}-${note.stringIndex}-${note.fretIndex}`;
     
     // 1. Update Global Stats for Algo
     const currentStat = noteStats[key] || {
       correct: 0,
       incorrect: 0,
       timeouts: 0,
       totalTimeMs: 0,
       lastSeen: 0
     };

     const updatedStat: NoteStat = {
       correct: currentStat.correct + (isCorrect ? 1 : 0),
       incorrect: currentStat.incorrect + ((!isCorrect && !isTimeout) ? 1 : 0),
       timeouts: currentStat.timeouts + (isTimeout ? 1 : 0),
       totalTimeMs: currentStat.totalTimeMs + timeTaken,
       lastSeen: Date.now()
     };

     const newStats = { ...noteStats, [key]: updatedStat };
     saveNoteStats(newStats);
     
     // 2. Log Session Interaction
     sessionInteractionsRef.current.push({
       note,
       isCorrect,
       isTimeout,
       timeTakenMs: timeTaken,
       timestamp: Date.now()
     });
  };

  const getSmartNextNote = (validNotes: Note[]): Note => {
     // If not adaptive or no stats, return random
     if (!gameConfig.adaptiveLearning || Object.keys(noteStats).length === 0) {
        return validNotes[Math.floor(Math.random() * validNotes.length)];
     }

     const tuningId = activeGuitar.tuningName;
     const now = Date.now();
     
     const weightedNotes = validNotes.map(note => {
        const key = `${tuningId}-${note.stringIndex}-${note.fretIndex}`;
        const stat = noteStats[key];

        // Ensure we don't repeat the exact same note immediately if possible
        if (targetNoteRef.current && 
            targetNoteRef.current.stringIndex === note.stringIndex && 
            targetNoteRef.current.fretIndex === note.fretIndex &&
            validNotes.length > 1) {
            return { note, weight: 0 };
        }

        if (!stat) return { note, weight: 100 };

        const totalAttempts = stat.correct + stat.incorrect + stat.timeouts;
        if (totalAttempts === 0) return { note, weight: 100 };

        const accuracy = stat.correct / totalAttempts; 
        const avgTime = stat.totalTimeMs / totalAttempts; 
        const timeSinceLastSeen = now - stat.lastSeen;

        const accuracyWeight = (1 - accuracy) * 50; 
        const speedWeight = (Math.min(avgTime, 5000) / 5000) * 30;
        const recencyWeight = (Math.min(timeSinceLastSeen, 300000) / 300000) * 40;
        const baseWeight = 5; 

        return { note, weight: baseWeight + accuracyWeight + speedWeight + recencyWeight };
     });

     const totalWeight = weightedNotes.reduce((sum, item) => sum + item.weight, 0);
     let randomVal = Math.random() * totalWeight;
     
     for (const item of weightedNotes) {
        if (randomVal < item.weight) return item.note;
        randomVal -= item.weight;
     }

     return validNotes[validNotes.length - 1];
  };

  // Computes Stats dynamically from selected history window
  const getHeatmapData = () => {
     const data: Record<string, { color: string, label: string, textColor?: string }> = {};
     const tuningId = activeGuitar.tuningName;
     
     // Calculate stats on fly based on window
     let computedStats: NoteStatsMap = {};

     // Use global stats if window covers everything or no history, otherwise compute from history
     // Actually, simpler to just always use history if available for "Progression" fidelity? 
     // But global noteStats has "lastSeen" which persists across cleared local storage if we were using a real DB.
     // Here, we'll try to use history for the window.
     
     const relevantHistory = history.slice(timelineWindow.start, timelineWindow.end + 1);
     
     if (relevantHistory.length === 0) {
        // Fallback to global stats if no history selected or available
        computedStats = noteStats;
     } else {
        // Aggregate
        relevantHistory.forEach(record => {
           if (record.interactions) {
             record.interactions.forEach(interaction => {
                const key = `${tuningId}-${interaction.note.stringIndex}-${interaction.note.fretIndex}`;
                if (!computedStats[key]) {
                  computedStats[key] = { correct: 0, incorrect: 0, timeouts: 0, totalTimeMs: 0, lastSeen: 0 };
                }
                const stat = computedStats[key];
                if (interaction.isCorrect) stat.correct++;
                else if (interaction.isTimeout) stat.timeouts++;
                else stat.incorrect++;
                
                stat.totalTimeMs += interaction.timeTakenMs;
             });
           }
        });
     }

     for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= 12; f++) {
           const key = `${tuningId}-${s}-${f}`;
           const stat = computedStats[key];
           const mapKey = `${s}-${f}`;

           if (!stat) {
              data[mapKey] = { color: 'rgba(50,50,50,0.5)', label: '-', textColor: 'gray' };
              continue;
           }

           const total = stat.correct + stat.incorrect + stat.timeouts;
           if (total === 0) {
              data[mapKey] = { color: 'rgba(50,50,50,0.5)', label: '-', textColor: 'gray' };
              continue;
           }

           let color = '';
           let label = '';
           let textColor = 'white';

           // Reduced saturation and brightness for background to allow Note Badge to pop
           if (heatmapMetric === HeatmapMetric.ACCURACY) {
              const acc = stat.correct / total;
              const hue = acc * 120;
              color = `hsla(${hue}, 50%, 30%, 0.95)`;
              label = `${Math.round(acc * 100)}%`;
           } else if (heatmapMetric === HeatmapMetric.SPEED) {
              const avg = stat.totalTimeMs / total;
              const clamped = Math.max(1000, Math.min(5000, avg));
              const factor = 1 - ((clamped - 1000) / 4000); 
              const hue = factor * 120;
              color = `hsla(${hue}, 50%, 30%, 0.95)`;
              label = `${(avg/1000).toFixed(1)}s`;
           } else if (heatmapMetric === HeatmapMetric.FREQUENCY) {
              const factor = Math.min(total, 20) / 20; 
              const lightness = 20 + (factor * 25);
              color = `hsla(210, 50%, ${lightness}%, 0.95)`;
              label = `${total}`;
           }

           data[mapKey] = { color, label, textColor };
        }
     }
     return data;
  };

  // -----------------------------

  const triggerPowerup = (currentStreak: number): string | null => {
    let newPowerup: PowerupState | null = null;
    const duration = 2;
    let message = null;

    if (currentStreak > 0 && currentStreak % 10 === 0) {
      newPowerup = {
        type: PowerupType.SUPER_REVEAL_ALL_NATURALS,
        duration: duration,
        label: 'SUPER STREAK! ALL NATURALS REVEALED!'
      };
    } else if (currentStreak > 0 && currentStreak % 5 === 0) {
      const roll = Math.random();
      if (roll < 0.3) {
        newPowerup = {
          type: PowerupType.FEWER_CHOICES,
          duration: duration,
          label: '50/50 Choices Active!'
        };
      } else if (roll < 0.6) {
        const strIdx = Math.floor(Math.random() * 6);
        newPowerup = {
          type: PowerupType.REVEAL_NATURALS_STRING,
          value: strIdx,
          duration: duration,
          label: `Natural Notes on String ${strIdx + 1} Revealed!`
        };
      } else if (roll < 0.8) {
        const fret = Math.floor(Math.random() * currentMaxFret) + 1;
        newPowerup = {
          type: PowerupType.REVEAL_FRET,
          value: fret,
          duration: duration,
          label: `Notes at Fret ${fret} Revealed!`
        };
      } else {
        const target = NATURAL_NOTES[Math.floor(Math.random() * NATURAL_NOTES.length)];
        newPowerup = {
          type: PowerupType.REVEAL_ALL_NOTE_LOCATIONS,
          noteTarget: target,
          duration: duration,
          label: `All ${target}s Revealed!`
        };
      }
    }

    if (newPowerup) {
      setActivePowerup(newPowerup);
      message = newPowerup.label;
    }
    return message;
  };

  const getValidNotes = useCallback((): Note[] => {
    const validNotes: Note[] = [];
    const scaleNotes = gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale
      ? getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale)
      : [];
    
    // Use active guitar tuning
    const offsets = activeGuitar.tuning;

    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= currentMaxFret; f++) {
        // Dynamic note calculation based on tuning
        const name = getNoteAtPosition(offsets[s], f);
        
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
  }, [currentMaxFret, gameConfig, activeGuitar]);

  const generateNewNote = useCallback(() => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    
    // Clear processing blocking
    setIsProcessing(false);
    setSelectedAnswer(null);

    const currentPowerup = activePowerupRef.current;
    
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
      const fallbackNote = gameConfig.keyRoot || 'F';
      validNotes.push({ stringIndex: 0, fretIndex: 1, noteName: fallbackNote });
    }

    let nextNote: Note;
    
    if (gameConfig.adaptiveLearning) {
       let attempts = 0;
       do {
          nextNote = getSmartNextNote(validNotes);
          attempts++;
       } while (
         targetNoteRef.current && 
         nextNote.stringIndex === targetNoteRef.current.stringIndex && 
         nextNote.fretIndex === targetNoteRef.current.fretIndex && 
         attempts < 3
       );
    } else {
       let attempts = 0;
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
    }
    
    setTargetNote(nextNote);
    noteStartTimeRef.current = Date.now(); 
    
    const isFewerChoices = currentPowerup?.type === PowerupType.FEWER_CHOICES;

    if (difficulty === Difficulty.EASY) {
      let allowedDistractors = NOTES_SHARP;
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        allowedDistractors = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        allowedDistractors = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      }

      const possibleDistractors = allowedDistractors.filter(n => n !== nextNote.noteName);
      const numDistractors = isFewerChoices ? 1 : 4;
      const safeNumDistractors = Math.min(numDistractors, possibleDistractors.length);
      
      const distractors = possibleDistractors.sort(() => 0.5 - Math.random()).slice(0, safeNumDistractors);
      const options = [...distractors, nextNote.noteName].sort(() => 0.5 - Math.random());
      setAnswerOptions(options);
    } else {
      let pool = [];
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        pool = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        pool = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      } else {
        pool = NOTES_SHARP;
      }

      if (isFewerChoices) {
        const distractors = pool.filter(n => n !== nextNote.noteName);
        const randomDistractor = distractors[Math.floor(Math.random() * distractors.length)];
        const reducedOptions = randomDistractor 
          ? [nextNote.noteName, randomDistractor].sort(() => 0.5 - Math.random()) 
          : [nextNote.noteName];
        setAnswerOptions(reducedOptions);
      } else {
        setAnswerOptions(pool);
      }
    }

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
  }, [currentMaxFret, difficulty, getValidNotes, gameConfig, noteStats]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && !targetNote && !isProcessing) {
      generateNewNote();
    }
  }, [gameState, targetNote, isProcessing, generateNewNote]);

  const stopGame = useCallback(() => {
    cleanupTimers();
    setGameState(GameState.GAME_OVER);
    
    // Calculate Average Time
    const totalTime = sessionInteractionsRef.current.reduce((sum, item) => sum + item.timeTakenMs, 0);
    const count = sessionInteractionsRef.current.length;
    const avgTime = count > 0 ? (totalTime / count) / 1000 : 0;

    const newRecord: ScoreRecord = {
      date: new Date().toISOString(),
      score,
      difficulty,
      maxFret: currentMaxFret,
      focusMode: gameConfig.focusMode,
      interactions: [...sessionInteractionsRef.current],
      avgTimeSeconds: avgTime
    };
    
    const newHistory = [...history, newRecord];
    setHistory(newHistory);
    // Update timeline window to include new record
    setTimelineWindow({ start: 0, end: newHistory.length - 1 });
    
    localStorage.setItem('fretmaster_history', JSON.stringify(newHistory));
    
    // Reset session log
    sessionInteractionsRef.current = [];
  }, [score, difficulty, currentMaxFret, history, gameConfig]);

  const handleTimeout = () => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    if (targetNoteRef.current) {
       const timeTaken = Date.now() - noteStartTimeRef.current;
       recordNoteResult(targetNoteRef.current, false, timeTaken, true);
    }

    setIsProcessing(true);
    
    const correctNote = targetNoteRef.current?.noteName || '?';
    const displayCorrect = getDisplayNoteName(correctNote, 
      gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null,
      gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null,
      accidentalPreference
    );

    setFeedback({ status: 'incorrect', message: `Time up! It was ${displayCorrect}` });
    setStreak(0);
    setActivePowerup(null);
    
    setHealth(prev => {
      const newHealth = prev - 1;
      if (newHealth <= 0) {
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => {
          stopGame();
        }, 2000);
        return 0;
      }
      
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback({ status: 'neutral', message: '' });
        generateNewNote();
      }, 1500); 

      return newHealth;
    });
  };

  const checkAnswer = (selectedNote: string) => {
    if (!targetNote || isProcessing) return; 
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    setIsProcessing(true);
    setSelectedAnswer(selectedNote);

    const timeTaken = Date.now() - noteStartTimeRef.current;
    const isCorrect = selectedNote === targetNote.noteName;
    
    recordNoteResult(targetNote, isCorrect, timeTaken, false);

    if (isCorrect) {
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      
      let delay = 800;
      let feedbackMsg = 'Correct!';

      const powerupMsg = triggerPowerup(newStreak);
      if (powerupMsg) {
        feedbackMsg = powerupMsg;
        delay = 1500;
      }

      if (newScore > 0 && newScore % 5 === 0 && currentMaxFret < gameConfig.maxFretCap) {
        setCurrentMaxFret(prev => Math.min(prev + 1, gameConfig.maxFretCap));
        feedbackMsg = powerupMsg ? `${powerupMsg} + Level Up!` : 'Level Up! Fretboard Expanded!';
        delay = 1500;
      }
      
      setFeedback({ status: 'correct', message: feedbackMsg });

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
        const correctDisplay = getDisplayNoteName(targetNote.noteName, 
           gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null,
           gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null,
           accidentalPreference
        );
        setFeedback({ status: 'incorrect', message: `Wrong! It was ${correctDisplay}` });
        
        if (newHealth <= 0) {
           if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
           feedbackTimeoutRef.current = window.setTimeout(() => {
             stopGame();
           }, 2000);
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
    cleanupTimers();
    setScore(0);
    setStreak(0);
    setHealth(MAX_HEALTH);
    setActivePowerup(null);
    setCurrentMaxFret(gameConfig.startingFret);
    setFeedback({ status: 'neutral', message: '' });
    setTargetNote(null); 
    setGameState(GameState.PLAYING);
    setIsProcessing(false);
    setSelectedAnswer(null);
    targetNoteRef.current = null;
    activePowerupRef.current = null;
    gameStateRef.current = GameState.PLAYING;
    sessionInteractionsRef.current = [];
  };

  // ... Study Mode Handlers
  const toggleStudyNote = (note: string) => {
    setStudyConfig(prev => {
      const exists = prev.manuallySelectedNotes.includes(note);
      const newNotes = exists ? prev.manuallySelectedNotes.filter(n => n !== note) : [...prev.manuallySelectedNotes, note];
      return { ...prev, manuallySelectedNotes: newNotes };
    });
  };
  const toggleStudyString = (stringIdx: number) => {
    setStudyConfig(prev => {
      const exists = prev.activeStrings.includes(stringIdx);
      const newStrings = exists ? prev.activeStrings.filter(s => s !== stringIdx) : [...prev.activeStrings, stringIdx];
      return { ...prev, activeStrings: newStrings };
    });
  };
  const toggleStudyFret = (fretIdx: number) => {
    setStudyConfig(prev => {
      const exists = prev.activeFrets.includes(fretIdx);
      const newFrets = exists ? prev.activeFrets.filter(f => f !== fretIdx) : [...prev.activeFrets, fretIdx];
      return { ...prev, activeFrets: newFrets };
    });
  };
  const handleRootNoteSelect = (note: string | null) => {
    setStudyConfig(prev => ({ ...prev, rootNote: note, scaleType: note && !prev.scaleType ? 'MAJOR' : prev.scaleType }));
  };
  const handleScaleTypeSelect = (type: ScaleType) => {
    setStudyConfig(prev => ({ ...prev, scaleType: type }));
  };

  const toggleChord = (root: string, type: 'MAJOR' | 'NATURAL_MINOR') => {
    setStudyConfig(prev => {
      const existingChordIndex = prev.activeChords.findIndex(c => c.root === root);
      let newChords = [...prev.activeChords];

      if (existingChordIndex >= 0) {
        const existingChord = newChords[existingChordIndex];
        if (existingChord.type === type) {
          newChords.splice(existingChordIndex, 1);
        } else {
          newChords[existingChordIndex] = { root, type };
        }
      } else {
        newChords.push({ root, type });
      }
      return { ...prev, activeChords: newChords };
    });
  };
  
  const getActiveScaleNotes = () => studyConfig.rootNote && studyConfig.scaleType ? getScaleNotes(studyConfig.rootNote, studyConfig.scaleType) : [];
  
  const getActiveChordNotes = () => {
    return studyConfig.activeChords.flatMap(chord => 
      getChordNotes(chord.root, chord.type)
    );
  };
  
  const getVisibleNotesForStudy = () => {
    const scale = getActiveScaleNotes();
    const chord = getActiveChordNotes();
    const manual = studyConfig.manuallySelectedNotes;
    return Array.from(new Set([...scale, ...chord, ...manual]));
  };

  // Scrubber Helpers
  const handleTimelineChange = (isStart: boolean, val: string) => {
    const idx = parseInt(val, 10);
    setTimelineWindow(prev => {
      if (isStart) return { ...prev, start: Math.min(idx, prev.end) };
      return { ...prev, end: Math.max(idx, prev.start) };
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-900 text-white overflow-hidden select-none">
      {/* Settings Modal */}
      {showGuitarSettings && (
        <GuitarSettings
          profiles={guitarProfiles}
          activeProfileId={activeGuitarId}
          accidentalPreference={accidentalPreference}
          adaptiveLearning={gameConfig.adaptiveLearning}
          onProfileChange={(id) => saveGuitars(guitarProfiles, id)}
          onProfileUpdate={(updated) => {
             const newProfiles = guitarProfiles.map(p => p.id === updated.id ? updated : p);
             saveGuitars(newProfiles, activeGuitarId);
          }}
          onProfileCreate={(newProfile) => {
             const newProfiles = [...guitarProfiles, newProfile];
             saveGuitars(newProfiles, activeGuitarId);
          }}
          onAccidentalPreferenceChange={saveAccidentalPreference}
          onAdaptiveLearningChange={(enabled) => {
             setGameConfig(p => ({ ...p, adaptiveLearning: enabled }));
             localStorage.setItem('fretmaster_adaptive_learning', String(enabled));
          }}
          onClose={() => setShowGuitarSettings(false)}
        />
      )}

      {/* Header */}
      <header className="flex-none h-16 px-4 bg-gray-800 border-b border-gray-700 shadow-md flex items-center justify-between z-30 relative isolate">
        {/* Left: Logo */}
        <div className="w-1/3 flex justify-start">
          <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 cursor-pointer" onClick={() => setGameState(GameState.MENU)}>
            Frétude
          </h1>
        </div>

        {/* Center: Contextual Info */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center pointer-events-none w-full md:w-auto">
           {gameState === GameState.STUDY && (
              <span className="px-4 py-1.5 bg-blue-900 text-blue-200 rounded-full font-bold text-xs uppercase tracking-wider border border-blue-700/50 shadow-sm">Study Mode</span>
           )}
           {gameState === GameState.STATS && (
              <span className="px-4 py-1.5 bg-purple-900 text-purple-200 rounded-full font-bold text-xs uppercase tracking-wider border border-purple-700/50 shadow-sm">Performance Stats</span>
           )}
           {gameState === GameState.PLAYING && (
              <div className="flex flex-col items-center pointer-events-auto">
                <div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-700/50">
                   <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Streak</span>
                   <span className={`font-bold text-sm ${streak >= 5 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{streak} 🔥</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5 hidden md:block">
                   Range: 0-{currentMaxFret} • {gameConfig.focusMode === FocusMode.KEY ? `${gameConfig.keyRoot} ${gameConfig.keyScale}` : gameConfig.focusMode === FocusMode.NATURALS ? 'Naturals' : 'Chromatic'}
                </div>
              </div>
           )}
        </div>

        {/* Right: Guitar Config */}
        <div className="w-1/3 flex justify-end">
          <button 
            onClick={() => setShowGuitarSettings(true)}
            className="flex items-center gap-3 hover:bg-gray-700/50 px-2 py-1.5 rounded-lg transition-colors group"
          >
            <div className="flex flex-col items-end hidden md:flex">
              <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{activeGuitar.name}</span>
              <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">{activeGuitar.tuningName}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-700 group-hover:bg-blue-600/20 flex items-center justify-center border border-gray-600 group-hover:border-blue-500/50 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
               </svg>
            </div>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden isolate">
        
        {/* MENU SCREEN */}
        {gameState === GameState.MENU && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto p-4 md:p-6 flex flex-col items-center gap-6 mt-4 animate-fade-in">
              <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white">Master the Fretboard</h2>
                <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base">Train your memory, build speed, and track your progress.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full max-w-lg">
                  <button onClick={startGame} className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-lg shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-1">Start Game</button>
                  <button onClick={() => setStudyConfig({ rootNote: null, activeChords: [], scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] })} onClickCapture={() => setGameState(GameState.STUDY)} className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all border border-gray-600">Study Mode</button>
              </div>
              
              {/* Stats & Heatmap Entry */}
              <div className="w-full max-w-lg mt-2">
                 <button 
                   onClick={() => setGameState(GameState.STATS)}
                   className="w-full py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl flex items-center justify-center gap-2 group transition-all"
                 >
                   <span className="text-purple-400">📊</span>
                   <span className="font-bold text-gray-300 group-hover:text-white">View Performance Stats & Heatmap</span>
                 </button>
              </div>
              
              <div className="w-full max-w-3xl">
                <button onClick={() => setShowSettings(!showSettings)} className="mx-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
                  <span>{showSettings ? 'Hide' : 'Customize'} Game Settings</span>
                  <span className={`transform transition-transform ${showSettings ? 'rotate-180' : ''}`}>▼</span>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showSettings ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 shadow-xl backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Difficulty</label>
                            <div className="flex gap-2">
                                <button onClick={() => setDifficulty(Difficulty.EASY)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${difficulty === Difficulty.EASY ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>Easy (Choice)</button>
                                <button onClick={() => setDifficulty(Difficulty.HARD)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${difficulty === Difficulty.HARD ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>Hard (Recall)</button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Focus Mode</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                  <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.ALL} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.ALL }))} className="accent-blue-500" />
                                  <div><div className="font-bold text-sm">All Notes</div><div className="text-xs text-gray-500">Full chromatic scale</div></div>
                                </label>
                                <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                  <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.NATURALS} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.NATURALS }))} className="accent-green-500" />
                                  <div><div className="font-bold text-sm">Naturals Only</div><div className="text-xs text-gray-500">No sharps or flats</div></div>
                                </label>
                                <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700/50 transition-colors">
                                  <input type="radio" name="focusMode" checked={gameConfig.focusMode === FocusMode.KEY} onChange={() => setGameConfig(p => ({ ...p, focusMode: FocusMode.KEY }))} className="accent-purple-500" />
                                  <div><div className="font-bold text-sm">Specific Key</div><div className="text-xs text-gray-500">Focus on a scale</div></div>
                                </label>
                            </div>
                          </div>
                          <div className="space-y-2 pt-2 border-t border-gray-700">
                             <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider"><span>Timer Duration</span><span className="text-white">{gameConfig.timeLimit}s</span></div>
                             <input type="range" min="3" max="30" step="1" value={gameConfig.timeLimit} onChange={(e) => setGameConfig(p => ({ ...p, timeLimit: Number(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500" />
                          </div>
                      </div>
                      <div className="space-y-6">
                          <div className={`space-y-2 transition-opacity duration-300 ${gameConfig.focusMode === FocusMode.KEY ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Target Key</label>
                            <div className="flex gap-2">
                                <select value={gameConfig.keyRoot || 'C'} onChange={(e) => setGameConfig(p => ({ ...p, keyRoot: e.target.value }))} className="bg-gray-700 text-white rounded p-2 text-sm flex-1 outline-none border border-gray-600 focus:border-blue-500">
                                  {NOTES_SHARP.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <select value={gameConfig.keyScale || 'MAJOR'} onChange={(e) => setGameConfig(p => ({ ...p, keyScale: e.target.value as ScaleType }))} className="bg-gray-700 text-white rounded p-2 text-sm flex-1 outline-none border border-gray-600 focus:border-blue-500">
                                  <option value="MAJOR">Major</option>
                                  <option value="NATURAL_MINOR">Minor</option>
                                </select>
                            </div>
                          </div>
                          <div className="space-y-4 pt-2 border-t border-gray-700">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fret Range Config</label>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>Starting Size</span><span className="font-bold text-blue-400">0 - {gameConfig.startingFret}</span></div>
                                <input type="range" min="1" max={gameConfig.maxFretCap} value={gameConfig.startingFret} onChange={(e) => setGameConfig(p => ({ ...p, startingFret: Number(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>Max Cap (Level Up Limit)</span><span className="font-bold text-orange-400">0 - {gameConfig.maxFretCap}</span></div>
                                <input type="range" min={gameConfig.startingFret} max={TOTAL_FRETS} value={gameConfig.maxFretCap} onChange={(e) => setGameConfig(p => ({ ...p, maxFretCap: Number(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUDY MODE SCREEN */}
        {gameState === GameState.STUDY && (
           <div className="flex flex-col items-center h-full overflow-hidden">
             
             {/* Main Content (Fretboard + Sidebar) */}
             <div className="flex-1 w-full flex justify-center pb-2 pt-4 px-2 md:px-4 min-h-0">
               <div className="h-full w-full max-w-7xl">
                 <Fretboard 
                    isStudyMode={true}
                    activeNote={null} 
                    maxFret={studyMaxFret} 
                    activePowerup={null} 
                    highlightNotes={getVisibleNotesForStudy()}
                    scaleNotes={getActiveScaleNotes()}
                    highlightLocations={{ strings: studyConfig.activeStrings, frets: studyConfig.activeFrets }}
                    rootNote={studyConfig.rootNote}
                    activeChords={studyConfig.activeChords}
                    scaleType={studyConfig.scaleType}
                    onNoteNameToggle={toggleStudyNote}
                    onStringToggle={toggleStudyString}
                    onFretToggle={toggleStudyFret}
                    onRootNoteSelect={handleRootNoteSelect}
                    onChordToggle={toggleChord}
                    onScaleTypeSelect={handleScaleTypeSelect}
                    onClearSelection={() => setStudyConfig({ rootNote: null, activeChords: [], scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] })}
                    onBackToMenu={() => { setStudyConfig({ rootNote: null, activeChords: [], scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] }); setGameState(GameState.MENU); }}
                    orientation={isMobile ? 'vertical' : 'horizontal'}
                    tuningOffsets={activeGuitar.tuning}
                    accidentalPreference={accidentalPreference}
                    onMaxFretChange={(val) => setStudyMaxFret(val)}
                 />
               </div>
            </div>
           </div>
        )}
        
        {/* STATS MODE SCREEN */}
        {gameState === GameState.STATS && (
           <div className="flex flex-col items-center h-full overflow-hidden">
              <div className="w-full max-w-5xl px-4 py-2 flex flex-col gap-2">
                 
                 {/* Top Controls: Tabs & Back */}
                 <div className="flex justify-between items-center">
                   <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                      <button onClick={() => setStatsTab('heatmap')} className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${statsTab === 'heatmap' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Heatmap</button>
                      <button onClick={() => setStatsTab('timeline')} className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${statsTab === 'timeline' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Performance Timeline</button>
                   </div>
                   <button onClick={() => setGameState(GameState.MENU)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded-lg text-sm font-bold shadow transition-colors">
                      Exit Stats
                   </button>
                 </div>

                 {/* Heatmap Controls */}
                 {statsTab === 'heatmap' && (
                   <div className="flex flex-col gap-2 bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                     <div className="flex justify-between items-center">
                        <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider">Analysis Metric</h3>
                        <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                            <button onClick={() => setHeatmapMetric(HeatmapMetric.ACCURACY)} className={`px-3 py-1 text-xs font-bold rounded ${heatmapMetric === HeatmapMetric.ACCURACY ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Accuracy</button>
                            <button onClick={() => setHeatmapMetric(HeatmapMetric.SPEED)} className={`px-3 py-1 text-xs font-bold rounded ${heatmapMetric === HeatmapMetric.SPEED ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>Speed</button>
                            <button onClick={() => setHeatmapMetric(HeatmapMetric.FREQUENCY)} className={`px-3 py-1 text-xs font-bold rounded ${heatmapMetric === HeatmapMetric.FREQUENCY ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Plays</button>
                        </div>
                     </div>
                     
                     {/* Timeline Scrubber (Unified Dual Slider) */}
                     {history.length > 1 && (
                       <div className="mt-2 pt-2 border-t border-gray-700/50">
                         <div className="flex justify-between text-xs text-gray-400 mb-2">
                            <span>Window: <span className="text-white font-mono">{timelineWindow.start + 1}</span> - <span className="text-white font-mono">{timelineWindow.end + 1}</span> ({history.length} sessions)</span>
                            <button onClick={() => setTimelineWindow({start: 0, end: history.length - 1})} className="text-blue-400 hover:text-blue-300">Reset Full History</button>
                         </div>
                         
                         <div className="relative w-full h-6 flex items-center group">
                            {/* Track Background */}
                            <div className="absolute w-full h-1 bg-gray-700 rounded-lg"></div>
                            {/* Active Range Track */}
                            <div 
                                className="absolute h-1 bg-blue-500 rounded-lg"
                                style={{
                                    left: `${(timelineWindow.start / (history.length - 1)) * 100}%`,
                                    right: `${100 - (timelineWindow.end / (history.length - 1)) * 100}%`
                                }}
                            ></div>
                            
                            {/* Input 1 (Start) - Invisible but interactive */}
                            <input 
                              type="range" 
                              min="0" 
                              max={history.length - 1} 
                              value={timelineWindow.start} 
                              onChange={(e) => handleTimelineChange(true, e.target.value)}
                              className="absolute w-full h-full opacity-0 pointer-events-none appearance-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-none" 
                           />
                           
                           {/* Input 2 (End) - Invisible but interactive */}
                           <input 
                              type="range" 
                              min="0" 
                              max={history.length - 1} 
                              value={timelineWindow.end} 
                              onChange={(e) => handleTimelineChange(false, e.target.value)}
                              className="absolute w-full h-full opacity-0 pointer-events-none appearance-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none" 
                           />
                           
                           {/* Visual Thumbs (Since inputs are invisible) */}
                           <div 
                              className="absolute w-4 h-4 bg-blue-400 rounded-full shadow border border-white/50 pointer-events-none z-10"
                              style={{ left: `calc(${(timelineWindow.start / (history.length - 1)) * 100}% - 8px)` }}
                           />
                           <div 
                              className="absolute w-4 h-4 bg-white rounded-full shadow border border-gray-400 pointer-events-none z-10"
                              style={{ left: `calc(${(timelineWindow.end / (history.length - 1)) * 100}% - 8px)` }}
                           />
                         </div>
                       </div>
                     )}
                   </div>
                 )}
              </div>

              {/* Stats Content Area */}
              <div className="flex-1 w-full flex justify-center pb-2 pt-2 px-2 md:px-4 min-h-0">
               <div className="h-full w-full max-w-7xl relative">
                  {statsTab === 'heatmap' ? (
                    <Fretboard 
                        activeNote={null}
                        maxFret={12}
                        activePowerup={null}
                        isStudyMode={false} 
                        orientation={isMobile ? 'vertical' : 'horizontal'}
                        tuningOffsets={activeGuitar.tuning}
                        heatmapData={getHeatmapData()}
                        rootNote={gameConfig.keyRoot}
                        scaleType={gameConfig.keyScale}
                        accidentalPreference={accidentalPreference}
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-900/50 rounded-xl p-4 border border-gray-700 shadow-xl overflow-hidden">
                       <StatsChart history={history} />
                    </div>
                  )}
               </div>
              </div>
           </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === GameState.PLAYING && (
          <div className="flex flex-col items-center h-full justify-start pt-4 md:pt-10 px-2 overflow-hidden">
            
            {/* Top Stats Area - Fixed Height */}
            <div className="flex-none w-full max-w-4xl flex justify-between items-center mb-2 px-4 gap-4">
              {/* Left: Score */}
              <div className="flex items-center gap-2 w-1/3">
                 <span className="text-gray-400 uppercase text-xs font-bold tracking-wider hidden xs:inline">Score</span>
                 <span className="text-3xl font-mono text-amber-400">{score}</span>
              </div>

              {/* Center: Finish Button (Moved here) */}
              <div className="flex justify-center w-1/3">
                <button
                    onClick={stopGame}
                    disabled={isProcessing}
                    className="px-4 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 font-bold text-xs uppercase tracking-wider hover:text-white hover:border-gray-500 hover:bg-gray-700 transition-all shadow-sm"
                >
                    Finish
                </button>
              </div>

              {/* Right: Health Bar */}
              <div className="flex justify-end items-center gap-2 w-1/3">
                 <span className="text-gray-400 uppercase text-xs font-bold tracking-wider hidden sm:inline">HP</span>
                 <div className="w-24 md:w-32 h-3 bg-gray-800 rounded-full border border-gray-700 relative isolate" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${getHealthColorClass(health, MAX_HEALTH)}`}
                      style={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                    />
                 </div>
              </div>
            </div>

            {/* Powerup Banner - Fixed Height */}
            <div className="flex-none w-full max-w-4xl h-8 mb-2 flex items-center justify-center">
              {activePowerup && (
                 <div className="px-6 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400 flex items-center gap-2 animate-pulse">
                   <span className="text-xl">⚡</span>
                   <span className="font-bold text-white text-xs md:text-sm uppercase tracking-wider">{activePowerup.label}</span>
                 </div>
              )}
            </div>

            {/* Timer Bar - Fixed Height */}
            <div className="flex-none w-full max-w-4xl h-2 bg-gray-800 rounded-full mb-4 relative overflow-hidden isolate" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
               <div
                  className={`h-full rounded-full origin-left ${timer < 30 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ 
                    transform: `scaleX(${timer / 100})`, 
                    transition: 'transform 100ms linear',
                    willChange: 'transform'
                  }}
               />
            </div>

            {/* Game Board + Controls Container */}
            <div className="w-full flex flex-col md:flex-col relative min-h-0 md:justify-center flex-1">
               {/* Fretboard Section */}
               <div className="w-full px-2 flex flex-col items-center justify-center mb-4 flex-1 min-h-0"> 
                 <div className="w-full max-w-5xl h-full"> 
                    <Fretboard 
                        activeNote={targetNote} 
                        maxFret={currentMaxFret} 
                        activePowerup={activePowerup} 
                        orientation={isMobile ? 'vertical' : 'horizontal'}
                        rootNote={gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null}
                        scaleType={gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null}
                        tuningOffsets={activeGuitar.tuning}
                        accidentalPreference={accidentalPreference}
                    />
                 </div>
               </div>
               
               {/* Controls Section */}
               <div className="flex-none w-full flex flex-col items-center pb-8 md:pb-0">
                  <div className={`h-6 mb-2 font-bold text-lg transition-opacity ${feedback.message ? 'opacity-100' : 'opacity-0'} ${feedback.status === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                    {feedback.message}
                  </div>

                  <div className="w-full max-w-2xl flex flex-wrap justify-center gap-2 md:gap-4 px-4">
                    {answerOptions.map((note) => {
                      const hue = getNoteHue(note);
                      const displayNote = getDisplayNoteName(
                         note, 
                         gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null, 
                         gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null,
                         accidentalPreference
                      );
                      
                      const isSelected = note === selectedAnswer;
                      const processingStyle = isProcessing 
                         ? (isSelected ? 'opacity-100 ring-2 ring-white scale-105' : 'opacity-30 grayscale cursor-not-allowed scale-95 border-gray-700 bg-gray-900')
                         : 'hover:bg-gray-700 hover:shadow-lg active:scale-95';

                      return (
                        <button
                          key={note}
                          onClick={() => checkAnswer(note)}
                          disabled={isProcessing}
                          style={{ 
                             borderColor: isProcessing && !isSelected ? 'transparent' : `hsl(${hue}, 70%, 50%)`, 
                             color: isProcessing && !isSelected ? '#6b7280' : `hsl(${hue}, 90%, 75%)`, 
                             textShadow: isProcessing && !isSelected ? 'none' : `0 0 10px hsl(${hue}, 70%, 20%)` 
                          }}
                          className={`
                            min-w-[3.5rem] w-14 md:w-20 py-3 rounded-lg bg-gray-800 border-2 transition-all font-bold text-base md:text-lg shadow-md
                            ${processingStyle}
                          `}
                        >
                          {displayNote}
                        </button>
                      );
                    })}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameState === GameState.GAME_OVER && (
          <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in overflow-y-auto">
             <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full text-center">
               <h2 className="text-3xl font-bold mb-2 text-white">Session Complete</h2>
               <div className="text-6xl font-black text-amber-500 mb-6">{score}</div>
               <p className="text-gray-400 mb-8">
                 Difficulty: <span className="text-white font-bold">{difficulty}</span> <br/>
                 Max Fret Reached: <span className="text-white font-bold">{currentMaxFret}</span> <br/>
                 Focus: <span className="text-white font-bold">{gameConfig.focusMode}</span> <br />
                 Guitar: <span className="text-blue-400 font-bold">{activeGuitar.name}</span>
               </p>
               <div className="flex gap-4 justify-center">
                 <button onClick={() => setGameState(GameState.MENU)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">Main Menu</button>
                 <button onClick={startGame} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-lg transition-colors">Try Again</button>
               </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
