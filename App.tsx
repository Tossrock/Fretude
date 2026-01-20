
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameMode, Difficulty, Note, ScoreRecord, Feedback, PowerupState, PowerupType, StudyConfig, ScaleType, FocusMode, GameConfig, GuitarProfile, AccidentalStyle, StaffGameConfig, ClefPreference, NoteDurationType, NoteRange } from './types';
import { NOTES_SHARP, NATURAL_NOTES, INITIAL_MAX_FRET, TOTAL_FRETS, MAX_HEALTH, TIME_LIMIT_MS, getNoteAtPosition, getNoteHue, getScaleNotes, getDisplayNoteName, getChordNotes, STANDARD_TUNING_OFFSETS, generateRandomStaffNote, generateRandomStaffNoteInRange, StaffNoteData, getRecommendedClef } from './constants';
import Fretboard from './components/Fretboard';
import StatsChart from './components/StatsChart';
import GuitarSettings from './components/GuitarSettings';
import Staff, { NoteDuration, DURATION_NAMES } from './components/Staff';
import StaffRangeSelector from './components/StaffRangeSelector';

// All available note duration types
const ALL_NOTE_DURATIONS: NoteDurationType[] = ['w', 'h', 'q', '8', 'wd', 'hd', 'qd', '8d'];

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

  // New state for blocking input and visual feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Staff Game Mode State
  const [targetStaffNote, setTargetStaffNote] = useState<StaffNoteData | null>(null);
  const [targetStaffNotes, setTargetStaffNotes] = useState<StaffNoteData[]>([]); // For multi-note mode
  const [activeStaffNoteIndex, setActiveStaffNoteIndex] = useState<number>(0);  // Current note in sequence
  const [currentGameMode, setCurrentGameMode] = useState<GameMode>(GameMode.FRETBOARD_TO_NOTE);
  const [currentClef, setCurrentClef] = useState<'treble' | 'bass'>('treble'); // Active clef for current round

  // Menu State: selected mode before starting
  const [selectedMenuMode, setSelectedMenuMode] = useState<GameMode | null>(null);

  // Staff Game Configuration
  const [staffGameConfig, setStaffGameConfig] = useState<StaffGameConfig>({
    clefPreference: 'treble',
    noteDurations: 'all',  // Default to all note types
    noteCount: 1,
    noteRange: { lowNote: 'E2', highNote: 'E5' },  // Full standard guitar range
    useGuitarTransposition: true  // Standard guitar notation: display octave higher than sounding pitch
  });

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
    timeLimit: 10
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
  const targetStaffNoteRef = useRef<StaffNoteData | null>(null);
  const gameStateRef = useRef<GameState>(GameState.MENU);

  useEffect(() => {
    activePowerupRef.current = activePowerup;
  }, [activePowerup]);

  useEffect(() => {
    targetNoteRef.current = targetNote;
  }, [targetNote]);

  useEffect(() => {
    targetStaffNoteRef.current = targetStaffNote;
  }, [targetStaffNote]);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState !== GameState.PLAYING && gameState !== GameState.PLAYING_STAFF) {
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
      if (roll < 0.33) {
        newPowerup = {
          type: PowerupType.FEWER_CHOICES,
          duration: duration,
          label: '50/50 Choices Active!'
        };
      } else if (roll < 0.66) {
        const strIdx = Math.floor(Math.random() * 6);
        // Note: Using 'String X' instead of note name here as note name depends on tuning now
        newPowerup = {
          type: PowerupType.REVEAL_NATURALS_STRING,
          value: strIdx,
          duration: duration,
          label: `Natural Notes on String ${strIdx + 1} Revealed!`
        };
      } else {
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
      // Fallback to key root if available, otherwise F
      const fallbackNote = gameConfig.keyRoot || 'F';
      validNotes.push({ stringIndex: 0, fretIndex: 1, noteName: fallbackNote });
    }

    let nextNote: Note;
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
    
    setTargetNote(nextNote);
    
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
      // Hard Mode Logic
      let pool = [];
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        pool = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        pool = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      } else {
        pool = NOTES_SHARP;
      }

      if (isFewerChoices) {
        // 50/50 Logic for Hard Mode: Correct + 1 Distractor
        const distractors = pool.filter(n => n !== nextNote.noteName);
        const randomDistractor = distractors[Math.floor(Math.random() * distractors.length)];
        // If pool is small (e.g. key mode), handle gracefully
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
  }, [currentMaxFret, difficulty, getValidNotes, gameConfig]);

  // Effect to start the game loop only after state (like maxFret) has settled
  useEffect(() => {
    if (gameState === GameState.PLAYING && !targetNote && !isProcessing) {
      generateNewNote();
    }
  }, [gameState, targetNote, isProcessing, generateNewNote]);

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
    if (gameStateRef.current !== GameState.PLAYING) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    // Block Input
    setIsProcessing(true);
    
    // Format the note for feedback message
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
        // Wait for user to read feedback before stopping
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
    if (!targetNote || isProcessing) return; // Block if already processing
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    setIsProcessing(true);
    setSelectedAnswer(selectedNote);

    if (selectedNote === targetNote.noteName) {
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      
      let delay = 800;
      let feedbackMsg = 'Correct!';

      // Powerup Check
      const powerupMsg = triggerPowerup(newStreak);
      if (powerupMsg) {
        feedbackMsg = powerupMsg;
        delay = 1500;
      }

      // Level Up Check (Independent of Powerup)
      if (newScore > 0 && newScore % 5 === 0 && currentMaxFret < gameConfig.maxFretCap) {
        setCurrentMaxFret(prev => Math.min(prev + 1, gameConfig.maxFretCap));
        // Append Level Up message if Powerup already set a message, or replace 'Correct!'
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
           // Wait for user to read feedback before stopping
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
    setCurrentGameMode(GameMode.FRETBOARD_TO_NOTE);
    setIsProcessing(false);
    setSelectedAnswer(null);
    targetNoteRef.current = null;
    activePowerupRef.current = null;
    gameStateRef.current = GameState.PLAYING;
    // Removed direct call to generateNewNote() here.
    // It will be triggered by the useEffect once state settles.
  };

  // ==========================================================================
  // STAFF GAME MODE
  // ==========================================================================

  const generateNewStaffNote = useCallback(() => {
    if (gameStateRef.current !== GameState.PLAYING_STAFF) return;

    // Clear processing state
    setIsProcessing(false);
    setSelectedAnswer(null);
    setActiveStaffNoteIndex(0);

    // Get focus mode parameters
    const focusMode = gameConfig.focusMode === FocusMode.ALL ? 'ALL'
      : gameConfig.focusMode === FocusMode.NATURALS ? 'NATURALS'
      : 'KEY';

    // Determine clef based on preference
    let clef: 'treble' | 'bass';
    if (staffGameConfig.clefPreference === 'random') {
      clef = Math.random() < 0.5 ? 'treble' : 'bass';
    } else {
      clef = staffGameConfig.clefPreference;
    }
    setCurrentClef(clef);

    // Pick a random duration from enabled options
    const durations = staffGameConfig.noteDurations === 'all'
      ? ALL_NOTE_DURATIONS
      : staffGameConfig.noteDurations;
    const randomDuration = durations[
      Math.floor(Math.random() * durations.length)
    ] as NoteDuration;

    // Generate notes (single or multi-note mode)
    const notesToGenerate = staffGameConfig.noteCount;
    const generatedNotes: StaffNoteData[] = [];

    // Use the configured note range
    const { lowNote, highNote } = staffGameConfig.noteRange;

    for (let i = 0; i < notesToGenerate; i++) {
      let newNote: StaffNoteData;
      let attempts = 0;

      do {
        newNote = generateRandomStaffNoteInRange(
          lowNote,
          highNote,
          focusMode,
          gameConfig.keyRoot,
          gameConfig.keyScale
        );
        // Add duration to note
        (newNote as any).duration = randomDuration;
        attempts++;
      } while (
        // Avoid duplicates in sequence
        generatedNotes.some(n => n.noteName === newNote.noteName && n.octave === newNote.octave) &&
        attempts < 10
      );

      generatedNotes.push(newNote);
    }

    // Set state based on single or multi-note mode
    if (notesToGenerate === 1) {
      setTargetStaffNote(generatedNotes[0]);
      setTargetStaffNotes([]);
    } else {
      setTargetStaffNote(null);
      setTargetStaffNotes(generatedNotes);
    }

    // Generate answer options based on the first/current note
    const currentTargetNote = generatedNotes[0];

    if (difficulty === Difficulty.EASY) {
      let allowedDistractors = NOTES_SHARP;
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        allowedDistractors = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        allowedDistractors = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      }

      const possibleDistractors = allowedDistractors.filter(n => n !== currentTargetNote.noteName);
      const numDistractors = 4;
      const safeNumDistractors = Math.min(numDistractors, possibleDistractors.length);

      const distractors = possibleDistractors.sort(() => 0.5 - Math.random()).slice(0, safeNumDistractors);
      const options = [...distractors, currentTargetNote.noteName].sort(() => 0.5 - Math.random());
      setAnswerOptions(options);
    } else {
      // Hard mode - show all notes in the pool
      let pool: string[] = [];
      if (gameConfig.focusMode === FocusMode.NATURALS) {
        pool = NATURAL_NOTES;
      } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
        pool = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
      } else {
        pool = NOTES_SHARP;
      }
      setAnswerOptions(pool);
    }

    // Start timer (longer for multi-note mode)
    const timeMultiplier = notesToGenerate > 1 ? Math.min(notesToGenerate * 0.7, 3) : 1;
    setTimer(100);
    startTimeRef.current = Date.now();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const limitMs = gameConfig.timeLimit * 1000 * timeMultiplier;
      const remaining = Math.max(0, 100 - (elapsed / limitMs) * 100);
      setTimer(remaining);

      if (remaining === 0) {
        handleStaffTimeout();
      }
    }, 100);
  }, [gameConfig, difficulty, staffGameConfig]);

  const handleStaffTimeout = () => {
    if (gameStateRef.current !== GameState.PLAYING_STAFF) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setIsProcessing(true);

    const correctNote = targetStaffNoteRef.current?.noteName || '?';
    const displayCorrect = getDisplayNoteName(
      correctNote,
      gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null,
      gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null,
      accidentalPreference
    );

    setFeedback({ status: 'incorrect', message: `Time up! It was ${displayCorrect}` });
    setStreak(0);

    setHealth(prev => {
      const newHealth = prev - 1;
      if (newHealth <= 0) {
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => {
          stopStaffGame();
        }, 2000);
        return 0;
      }

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback({ status: 'neutral', message: '' });
        generateNewStaffNote();
      }, 1500);

      return newHealth;
    });
  };

  const checkStaffAnswer = (selectedNote: string) => {
    if (isProcessing) return;

    // Get the current target note (single or multi-note mode)
    const currentTarget = targetStaffNotes.length > 0
      ? targetStaffNotes[activeStaffNoteIndex]
      : targetStaffNote;

    if (!currentTarget) return;

    setSelectedAnswer(selectedNote);

    if (selectedNote === currentTarget.noteName) {
      // Correct answer
      const isMultiNoteMode = targetStaffNotes.length > 0;
      const isLastNote = isMultiNoteMode && activeStaffNoteIndex === targetStaffNotes.length - 1;
      const isSingleNote = !isMultiNoteMode;

      if (isSingleNote || isLastNote) {
        // Completed the round
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setIsProcessing(true);

        const newScore = score + (isMultiNoteMode ? targetStaffNotes.length : 1);
        const newStreak = streak + 1;
        setScore(newScore);
        setStreak(newStreak);

        let delay = 800;
        let feedbackMsg = isMultiNoteMode ? `All ${targetStaffNotes.length} correct!` : 'Correct!';

        if (newStreak > 0 && newStreak % 5 === 0) {
          feedbackMsg = `${newStreak} Streak! 🔥`;
          delay = 1200;
        }

        setFeedback({ status: 'correct', message: feedbackMsg });

        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback({ status: 'neutral', message: '' });
          generateNewStaffNote();
        }, delay);
      } else {
        // Move to next note in sequence
        const nextIndex = activeStaffNoteIndex + 1;
        setActiveStaffNoteIndex(nextIndex);
        setSelectedAnswer(null);

        // Update answer options for next note
        const nextNote = targetStaffNotes[nextIndex];
        if (difficulty === Difficulty.EASY) {
          let allowedDistractors = NOTES_SHARP;
          if (gameConfig.focusMode === FocusMode.NATURALS) {
            allowedDistractors = NATURAL_NOTES;
          } else if (gameConfig.focusMode === FocusMode.KEY && gameConfig.keyRoot && gameConfig.keyScale) {
            allowedDistractors = getScaleNotes(gameConfig.keyRoot, gameConfig.keyScale);
          }
          const possibleDistractors = allowedDistractors.filter(n => n !== nextNote.noteName);
          const distractors = possibleDistractors.sort(() => 0.5 - Math.random()).slice(0, 4);
          const options = [...distractors, nextNote.noteName].sort(() => 0.5 - Math.random());
          setAnswerOptions(options);
        }

        // Brief flash feedback
        setFeedback({ status: 'correct', message: `${nextIndex}/${targetStaffNotes.length}` });
        setTimeout(() => setFeedback({ status: 'neutral', message: '' }), 300);
      }
    } else {
      // Wrong answer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsProcessing(true);
      setStreak(0);

      setHealth(prev => {
        const newHealth = prev - 1;
        const correctDisplay = getDisplayNoteName(
          currentTarget.noteName,
          gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyRoot : null,
          gameConfig.focusMode === FocusMode.KEY ? gameConfig.keyScale : null,
          accidentalPreference
        );
        setFeedback({ status: 'incorrect', message: `Wrong! It was ${correctDisplay}` });

        if (newHealth <= 0) {
          if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
          feedbackTimeoutRef.current = window.setTimeout(() => {
            stopStaffGame();
          }, 2000);
          return 0;
        }

        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback({ status: 'neutral', message: '' });
          generateNewStaffNote();
        }, 1500);
        return newHealth;
      });
    }
  };

  const stopStaffGame = useCallback(() => {
    cleanupTimers();
    setGameState(GameState.GAME_OVER);

    const newRecord: ScoreRecord = {
      date: new Date().toISOString(),
      score,
      difficulty,
      maxFret: 0, // Not applicable for staff mode
      focusMode: gameConfig.focusMode,
      gameMode: GameMode.STAFF_TO_NOTE
    };

    const newHistory = [...history, newRecord];
    setHistory(newHistory);
    localStorage.setItem('fretmaster_history', JSON.stringify(newHistory));
  }, [score, difficulty, history, gameConfig]);

  const startStaffGame = () => {
    cleanupTimers();
    setScore(0);
    setStreak(0);
    setHealth(MAX_HEALTH);
    setFeedback({ status: 'neutral', message: '' });
    setTargetStaffNote(null);
    setGameState(GameState.PLAYING_STAFF);
    setCurrentGameMode(GameMode.STAFF_TO_NOTE);
    setIsProcessing(false);
    setSelectedAnswer(null);
    targetStaffNoteRef.current = null;
    gameStateRef.current = GameState.PLAYING_STAFF;
    // Note generation triggered by useEffect
  };

  // Effect to start staff game loop
  useEffect(() => {
    if (gameState === GameState.PLAYING_STAFF && !targetStaffNote && !isProcessing) {
      generateNewStaffNote();
    }
  }, [gameState, targetStaffNote, isProcessing, generateNewStaffNote]);

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

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-900 text-white overflow-hidden select-none">
      {/* Settings Modal */}
      {showGuitarSettings && (
        <GuitarSettings
          profiles={guitarProfiles}
          activeProfileId={activeGuitarId}
          accidentalPreference={accidentalPreference}
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
           {gameState === GameState.PLAYING_STAFF && (
              <div className="flex flex-col items-center pointer-events-auto">
                <div className="flex items-center gap-2 bg-purple-900/50 px-3 py-1 rounded-full border border-purple-700/50">
                   <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Sight Reading</span>
                   <span className={`font-bold text-sm ${streak >= 5 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{streak} 🔥</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5 hidden md:block">
                   {gameConfig.focusMode === FocusMode.KEY ? `${gameConfig.keyRoot} ${gameConfig.keyScale}` : gameConfig.focusMode === FocusMode.NATURALS ? 'Naturals' : 'Chromatic'}
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

              {/* Game Mode Selection */}
              <div className="w-full max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fretboard Game */}
                  <button
                    onClick={() => { setSelectedMenuMode(GameMode.FRETBOARD_TO_NOTE); setShowSettings(true); }}
                    className={`group relative p-6 rounded-2xl border transition-all transform hover:-translate-y-1 shadow-xl ${
                      selectedMenuMode === GameMode.FRETBOARD_TO_NOTE
                        ? 'bg-gradient-to-br from-blue-600/40 to-indigo-600/40 border-blue-400 ring-2 ring-blue-400/50'
                        : 'bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30 hover:border-blue-400/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg transition-transform ${selectedMenuMode === GameMode.FRETBOARD_TO_NOTE ? 'scale-110' : 'group-hover:scale-110'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-white">Fretboard Training</h3>
                        <p className="text-xs text-gray-400 mt-1">See a note on the fretboard, name it</p>
                      </div>
                    </div>
                    {selectedMenuMode === GameMode.FRETBOARD_TO_NOTE && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </button>

                  {/* Staff Reading Game */}
                  <button
                    onClick={() => { setSelectedMenuMode(GameMode.STAFF_TO_NOTE); setShowSettings(true); }}
                    className={`group relative p-6 rounded-2xl border transition-all transform hover:-translate-y-1 shadow-xl ${
                      selectedMenuMode === GameMode.STAFF_TO_NOTE
                        ? 'bg-gradient-to-br from-purple-600/40 to-pink-600/40 border-purple-400 ring-2 ring-purple-400/50'
                        : 'bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30 hover:border-purple-400/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg transition-transform ${selectedMenuMode === GameMode.STAFF_TO_NOTE ? 'scale-110' : 'group-hover:scale-110'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-white">Sight Reading</h3>
                        <p className="text-xs text-gray-400 mt-1">See a note on the staff, name it</p>
                      </div>
                    </div>
                    {selectedMenuMode === GameMode.STAFF_TO_NOTE && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </button>
                </div>

                {/* Study Mode Button */}
                <button
                  onClick={() => { setStudyConfig({ rootNote: null, activeChords: [], scaleType: null, manuallySelectedNotes: [], activeStrings: [], activeFrets: [] }); setGameState(GameState.STUDY); }}
                  className="w-full mt-4 py-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl font-bold transition-all border border-gray-600 text-gray-300 hover:text-white"
                >
                  Study Mode
                </button>
              </div>

              {/* Settings Panel - Expands when mode selected */}
              <div className={`w-full max-w-3xl overflow-hidden transition-all duration-500 ease-in-out ${selectedMenuMode && showSettings ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 shadow-xl backdrop-blur-sm">
                  {/* Start Game Button */}
                  <button
                    onClick={() => selectedMenuMode === GameMode.STAFF_TO_NOTE ? startStaffGame() : startGame()}
                    className={`w-full py-4 mb-6 rounded-xl font-bold text-lg shadow-xl transition-all transform hover:-translate-y-0.5 ${
                      selectedMenuMode === GameMode.STAFF_TO_NOTE
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/30'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/30'
                    }`}
                  >
                    Start {selectedMenuMode === GameMode.STAFF_TO_NOTE ? 'Sight Reading' : 'Fretboard Training'}
                  </button>

                  {/* Common Settings */}
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
                        <div className="space-y-2 pt-2 border-t border-gray-700">
                           <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider"><span>Timer Duration</span><span className="text-white">{gameConfig.timeLimit}s</span></div>
                           <input type="range" min="3" max="30" step="1" value={gameConfig.timeLimit} onChange={(e) => setGameConfig(p => ({ ...p, timeLimit: Number(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500" />
                        </div>
                    </div>
                    <div className="space-y-6">
                        {/* Fretboard-specific settings */}
                        {selectedMenuMode === GameMode.FRETBOARD_TO_NOTE && (
                          <div className="space-y-4">
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
                        )}

                        {/* Staff-specific settings */}
                        {selectedMenuMode === GameMode.STAFF_TO_NOTE && (
                          <div className="space-y-4">
                            {/* Clef Selection */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clef</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setStaffGameConfig(p => ({ ...p, clefPreference: 'treble' }))}
                                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${staffGameConfig.clefPreference === 'treble' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                  Treble
                                </button>
                                <button
                                  onClick={() => setStaffGameConfig(p => ({ ...p, clefPreference: 'bass' }))}
                                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${staffGameConfig.clefPreference === 'bass' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                  Bass
                                </button>
                                <button
                                  onClick={() => setStaffGameConfig(p => ({ ...p, clefPreference: 'random' }))}
                                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${staffGameConfig.clefPreference === 'random' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                  Random
                                </button>
                              </div>
                            </div>

                            {/* Guitar Transposition Toggle */}
                            <div className="space-y-2 pt-2 border-t border-gray-700">
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Guitar Notation</label>
                                  <p className="text-xs text-gray-500 mt-1">Standard guitar: written octave higher</p>
                                </div>
                                <button
                                  onClick={() => setStaffGameConfig(p => ({ ...p, useGuitarTransposition: !p.useGuitarTransposition }))}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    staffGameConfig.useGuitarTransposition ? 'bg-purple-600' : 'bg-gray-600'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      staffGameConfig.useGuitarTransposition ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Note Range Selector */}
                            <div className="space-y-2 pt-2 border-t border-gray-700">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Note Range</label>
                              <StaffRangeSelector
                                value={staffGameConfig.noteRange}
                                onChange={(range) => setStaffGameConfig(p => ({ ...p, noteRange: range }))}
                                clef={staffGameConfig.clefPreference === 'random' ? 'treble' : staffGameConfig.clefPreference}
                                octaveTransposition={staffGameConfig.useGuitarTransposition ? 1 : 0}
                              />
                            </div>

                            {/* Note Durations */}
                            <div className="space-y-2 pt-2 border-t border-gray-700">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Note Types</label>
                              {/* All Notes toggle */}
                              <button
                                onClick={() => setStaffGameConfig(p => ({ ...p, noteDurations: 'all' }))}
                                className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${
                                  staffGameConfig.noteDurations === 'all'
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                              >
                                All Note Types
                              </button>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(['w', 'h', 'q', '8'] as NoteDurationType[]).map(dur => {
                                  const isSelected = staffGameConfig.noteDurations === 'all' ||
                                    (Array.isArray(staffGameConfig.noteDurations) && staffGameConfig.noteDurations.includes(dur));
                                  return (
                                    <button
                                      key={dur}
                                      onClick={() => {
                                        setStaffGameConfig(p => {
                                          // If currently 'all', switch to just this one
                                          if (p.noteDurations === 'all') {
                                            return { ...p, noteDurations: [dur] };
                                          }
                                          const has = p.noteDurations.includes(dur);
                                          const newDurations = has
                                            ? p.noteDurations.filter(d => d !== dur)
                                            : [...p.noteDurations, dur];
                                          return { ...p, noteDurations: newDurations.length > 0 ? newDurations : [dur] };
                                        });
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isSelected
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                      }`}
                                    >
                                      {DURATION_NAMES[dur]}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(['wd', 'hd', 'qd', '8d'] as NoteDurationType[]).map(dur => {
                                  const isSelected = staffGameConfig.noteDurations === 'all' ||
                                    (Array.isArray(staffGameConfig.noteDurations) && staffGameConfig.noteDurations.includes(dur));
                                  return (
                                    <button
                                      key={dur}
                                      onClick={() => {
                                        setStaffGameConfig(p => {
                                          if (p.noteDurations === 'all') {
                                            return { ...p, noteDurations: [dur] };
                                          }
                                          const has = p.noteDurations.includes(dur);
                                          const newDurations = has
                                            ? p.noteDurations.filter(d => d !== dur)
                                            : [...p.noteDurations, dur];
                                          return { ...p, noteDurations: newDurations.length > 0 ? newDurations : [dur] };
                                        });
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isSelected
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                      }`}
                                    >
                                      {DURATION_NAMES[dur]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Note Count (multi-note mode) */}
                            <div className="space-y-2 pt-2 border-t border-gray-700">
                              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <span>Notes Per Round</span>
                                <span className="text-purple-400">{staffGameConfig.noteCount}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="8"
                                step="1"
                                value={staffGameConfig.noteCount}
                                onChange={(e) => setStaffGameConfig(p => ({ ...p, noteCount: Number(e.target.value) }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                              />
                              <p className="text-xs text-gray-500">
                                {staffGameConfig.noteCount === 1 ? 'Single note per question' : `Identify ${staffGameConfig.noteCount} notes in sequence`}
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full mt-4">
                 <StatsChart history={history} />
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
                    maxFret={12} 
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
                 />
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
                 <div className="w-24 md:w-32 h-3 bg-gray-800 rounded-full border border-gray-700 relative">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${getHealthColorClass(health, MAX_HEALTH)}`}
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
            <div className="flex-none w-full max-w-4xl h-2 bg-gray-800 rounded-full mb-4 relative">
               <div
                  className={`h-full rounded-full transition-[width] duration-100 ease-linear ${timer < 30 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${timer}%` }}
               />
            </div>

            {/* Game Board + Controls Container */}
            <div className="w-full flex flex-col md:flex-col relative min-h-0 md:justify-center flex-1">
               {/* Fretboard Section */}
               <div className="w-full px-2 flex flex-col items-center justify-center mb-4 flex-1 min-h-0"> {/* Added min-h-0 for nested flex scroll issues prevention, though likely not needed here, but good practice. Changed flex-initial to flex-1 */}
                 <div className="w-full max-w-5xl h-full"> {/* Removed md:h-auto */}
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
                      // Formatted note for display
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

        {/* PLAYING STAFF SCREEN */}
        {gameState === GameState.PLAYING_STAFF && (
          <div className="flex flex-col items-center h-full justify-start pt-4 md:pt-10 px-2 overflow-hidden">

            {/* Top Stats Area - Fixed Height */}
            <div className="flex-none w-full max-w-4xl flex justify-between items-center mb-2 px-4 gap-4">
              {/* Left: Score */}
              <div className="flex items-center gap-2 w-1/3">
                 <span className="text-gray-400 uppercase text-xs font-bold tracking-wider hidden xs:inline">Score</span>
                 <span className="text-3xl font-mono text-purple-400">{score}</span>
              </div>

              {/* Center: Finish Button */}
              <div className="flex justify-center w-1/3">
                <button
                    onClick={stopStaffGame}
                    disabled={isProcessing}
                    className="px-4 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 font-bold text-xs uppercase tracking-wider hover:text-white hover:border-gray-500 hover:bg-gray-700 transition-all shadow-sm"
                >
                    Finish
                </button>
              </div>

              {/* Right: Health Bar */}
              <div className="flex justify-end items-center gap-2 w-1/3">
                 <span className="text-gray-400 uppercase text-xs font-bold tracking-wider hidden sm:inline">HP</span>
                 <div className="w-24 md:w-32 h-3 bg-gray-800 rounded-full border border-gray-700 relative">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${getHealthColorClass(health, MAX_HEALTH)}`}
                      style={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                    />
                 </div>
              </div>
            </div>

            {/* Timer Bar - Fixed Height */}
            <div className="flex-none w-full max-w-4xl h-2 bg-gray-800 rounded-full mb-4 relative">
               <div
                  className={`h-full rounded-full transition-[width] duration-100 ease-linear ${timer < 30 ? 'bg-red-500' : 'bg-purple-500'}`}
                  style={{ width: `${timer}%` }}
               />
            </div>

            {/* Staff Display + Controls Container */}
            <div className="w-full flex flex-col items-center flex-1 min-h-0">
               {/* Multi-note progress indicator */}
               {targetStaffNotes.length > 1 && (
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-xs text-gray-500 uppercase tracking-wider">Note</span>
                   <div className="flex gap-1">
                     {targetStaffNotes.map((_, idx) => (
                       <div
                         key={idx}
                         className={`w-2 h-2 rounded-full transition-colors ${
                           idx < activeStaffNoteIndex
                             ? 'bg-green-500'
                             : idx === activeStaffNoteIndex
                             ? 'bg-purple-500 animate-pulse'
                             : 'bg-gray-600'
                         }`}
                       />
                     ))}
                   </div>
                   <span className="text-xs text-gray-400">{activeStaffNoteIndex + 1}/{targetStaffNotes.length}</span>
                 </div>
               )}

               {/* Staff Section */}
               <div className="w-full max-w-3xl flex justify-center items-center mb-8 px-4">
                 <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50 shadow-xl">
                   <Staff
                     note={targetStaffNotes.length === 0 ? targetStaffNote : undefined}
                     notes={targetStaffNotes.length > 0 ? targetStaffNotes : undefined}
                     activeNoteIndex={activeStaffNoteIndex}
                     clef={currentClef}
                     width={isMobile ? 300 : (targetStaffNotes.length > 1 ? Math.min(600, 200 + targetStaffNotes.length * 60) : 400)}
                     height={isMobile ? 150 : 180}
                     showClef={true}
                     feedbackState={feedback.status}
                     accidentalPreference={accidentalPreference}
                     animated={!isProcessing}
                     octaveTransposition={staffGameConfig.useGuitarTransposition ? 1 : 0}
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
                          onClick={() => checkStaffAnswer(note)}
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
               <div className={`text-6xl font-black mb-6 ${currentGameMode === GameMode.STAFF_TO_NOTE ? 'text-purple-400' : 'text-amber-500'}`}>{score}</div>
               <p className="text-gray-400 mb-8">
                 Mode: <span className={`font-bold ${currentGameMode === GameMode.STAFF_TO_NOTE ? 'text-purple-400' : 'text-blue-400'}`}>
                   {currentGameMode === GameMode.STAFF_TO_NOTE ? 'Sight Reading' : 'Fretboard Training'}
                 </span> <br/>
                 Difficulty: <span className="text-white font-bold">{difficulty}</span> <br/>
                 {currentGameMode === GameMode.FRETBOARD_TO_NOTE && (
                   <>Max Fret Reached: <span className="text-white font-bold">{currentMaxFret}</span> <br/></>
                 )}
                 Focus: <span className="text-white font-bold">{gameConfig.focusMode}</span>
                 {currentGameMode === GameMode.FRETBOARD_TO_NOTE && (
                   <><br />Guitar: <span className="text-blue-400 font-bold">{activeGuitar.name}</span></>
                 )}
               </p>
               <div className="flex gap-4 justify-center">
                 <button onClick={() => setGameState(GameState.MENU)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">Main Menu</button>
                 <button
                   onClick={currentGameMode === GameMode.STAFF_TO_NOTE ? startStaffGame : startGame}
                   className={`px-6 py-3 text-white rounded-lg font-bold shadow-lg transition-colors ${
                     currentGameMode === GameMode.STAFF_TO_NOTE
                       ? 'bg-purple-600 hover:bg-purple-500'
                       : 'bg-amber-600 hover:bg-amber-500'
                   }`}
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
