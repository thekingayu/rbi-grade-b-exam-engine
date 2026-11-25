import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type PanInfo
} from 'motion/react';
import {
  RotateCw,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shuffle,
  ArrowLeft,
  Flame,
  Target,
  RefreshCw,
  History,
  ChevronLeft,
  ChevronRight,
  Save,
  CloudCheck
} from 'lucide-react';
import {
  FlashcardDeck,
  FlashcardItem,
  FlashcardConfidence,
  FlashcardCardResult,
  FlashcardSession
} from '../../types';
import { saveFlashcardSessionToDb } from '../../utils/flashcardStorage';
import {
  MotionModal,
  AnimatedNumber,
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_BUTTERY
} from '../MotionPrimitives';

interface FlashcardStudyPlayerProps {
  user: User;
  deck: FlashcardDeck;
  accentColor: string;
  mode?: 'full' | 'weak-drill';
  subsetCardIds?: string[];
  onClose: () => void;
  onViewHistory: () => void;
  onSessionSaved?: (session: FlashcardSession) => void;
}

const RATING_WEIGHTS: Record<FlashcardConfidence, number> = {
  again: 0,
  hard: 45,
  good: 82,
  mastered: 100
};

const RATING_META: Array<{
  key: FlashcardConfidence;
  shortcut: string;
  label: string;
  sublabel: string;
  weight: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  pillClass: string;
}> = [
  {
    key: 'again',
    shortcut: '1',
    label: 'Again',
    sublabel: 'Re-Drill',
    weight: '0%',
    bgClass: 'bg-rose-500/12 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white',
    borderClass: 'border-rose-500/45 hover:border-[#141413]',
    dotClass: 'bg-rose-500',
    pillClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
  },
  {
    key: 'hard',
    shortcut: '2',
    label: 'Hard',
    sublabel: 'Partial',
    weight: '45%',
    bgClass: 'bg-amber-500/15 hover:bg-amber-500 text-amber-800 dark:text-amber-300 hover:text-[#141413]',
    borderClass: 'border-amber-500/45 hover:border-[#141413]',
    dotClass: 'bg-amber-400',
    pillClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40'
  },
  {
    key: 'good',
    shortcut: '3',
    label: 'Good',
    sublabel: 'Solid',
    weight: '82%',
    bgClass: 'bg-[#0D47FF]/12 hover:bg-[#0D47FF] text-[#0D47FF] dark:text-[#93C5FD] hover:text-white',
    borderClass: 'border-[#0D47FF]/40 hover:border-[#141413]',
    dotClass: 'bg-[#0D47FF]',
    pillClass: 'bg-[#0D47FF]/12 text-[#0D47FF] dark:text-[#93C5FD] border-[#0D47FF]/35'
  },
  {
    key: 'mastered',
    shortcut: '4',
    label: 'Mastered',
    sublabel: 'Instant',
    weight: '100%',
    bgClass: 'bg-emerald-500/14 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white',
    borderClass: 'border-emerald-500/45 hover:border-[#141413]',
    dotClass: 'bg-emerald-500',
    pillClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
  }
];

function computeCardEfficiency(rating: FlashcardConfidence, timeSpentSeconds: number, flipsCount: number): number {
  let score = RATING_WEIGHTS[rating];
  if (rating === 'good' && timeSpentSeconds <= 14 && flipsCount <= 1) {
    score = Math.min(92, score + 6);
  } else if (rating === 'mastered' && flipsCount > 2) {
    score = Math.max(88, score - 6);
  } else if (rating === 'hard' && timeSpentSeconds > 45) {
    score = Math.max(35, score - 5);
  }
  return score;
}

function getEfficiencyVerdict(score: number): {
  title: string;
  subtitle: string;
  badgeBg: string;
  ringColor: string;
} {
  if (score >= 85) {
    return {
      title: 'Cadre Mastery Achieved',
      subtitle: 'Sharp active recall and exam-ready conceptual retention across this deck.',
      badgeBg: 'bg-emerald-500 text-white',
      ringColor: '#10B981'
    };
  }
  if (score >= 70) {
    return {
      title: 'Strong Retention',
      subtitle: 'Solid conceptual grasp. One targeted weak-card drill will lock this to 90%+.',
      badgeBg: 'bg-[#0D47FF] text-white',
      ringColor: '#0D47FF'
    };
  }
  if (score >= 50) {
    return {
      title: 'Developing Recall',
      subtitle: 'Good foundation, but several concepts still require active retrieval practice.',
      badgeBg: 'bg-[#FFD426] text-[#141413]',
      ringColor: '#F59E0B'
    };
  }
  return {
    title: 'High-Priority Re-Drill',
    subtitle: 'Most cards are fresh in memory. Drill the flagged weak cards immediately to cement retention.',
    badgeBg: 'bg-rose-600 text-white',
    ringColor: '#E11D48'
  };
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Crazy-bouncy rubber jelly spring profiles (GPU transform-only)
const JELLY_SPRING = {
  type: 'spring' as const,
  stiffness: 290,
  damping: 11,
  mass: 0.72
};

const FLIP_JELLY_SPRING = {
  type: 'spring' as const,
  stiffness: 205,
  damping: 11.5,
  mass: 0.85
};

const TILT_SPRING_CONFIG = {
  stiffness: 250,
  damping: 12,
  mass: 0.55
};

interface BurstParticle {
  id: number;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  color: string;
  shape: 'circle' | 'diamond' | 'pill';
}

interface BurstEffect {
  id: number;
  label: string;
  badgeClass: string;
  particles: BurstParticle[];
}

function createParticleBurst(rating: FlashcardConfidence): BurstEffect {
  const palettes: Record<FlashcardConfidence, { label: string; badgeClass: string; colors: string[]; count: number }> = {
    mastered: {
      label: 'MASTERED! +100%',
      badgeClass: 'bg-emerald-500 text-white border-[#141413]',
      colors: ['#10B981', '#FFD426', '#ECD5FF', '#0D47FF', '#34D399'],
      count: 18
    },
    good: {
      label: 'SOLID RECALL! ⚡',
      badgeClass: 'bg-[#0D47FF] text-white border-[#141413]',
      colors: ['#0D47FF', '#ECD5FF', '#60A5FA', '#FFD426'],
      count: 12
    },
    hard: {
      label: 'PARTIAL · KEEP PUSHING',
      badgeClass: 'bg-[#FFD426] text-[#141413] border-[#141413]',
      colors: ['#F59E0B', '#FFD426', '#FBBF24'],
      count: 8
    },
    again: {
      label: 'FLAGGED FOR RE-DRILL 🔁',
      badgeClass: 'bg-rose-600 text-white border-[#141413]',
      colors: ['#F43F5E', '#FB7185', '#FDA4AF'],
      count: 8
    }
  };

  const cfg = palettes[rating];
  const shapes: Array<'circle' | 'diamond' | 'pill'> = ['circle', 'diamond', 'pill'];
  const particles: BurstParticle[] = Array.from({ length: cfg.count }, (_, idx) => {
    const angle = (Math.PI * 2 * idx) / cfg.count + (Math.random() - 0.5) * 0.35;
    const dist = 95 + Math.random() * 125;
    return {
      id: idx,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist - (rating === 'mastered' ? 40 : 12)),
      rotate: Math.round((Math.random() - 0.5) * 520),
      scale: Number((0.75 + Math.random() * 0.85).toFixed(2)),
      color: cfg.colors[idx % cfg.colors.length],
      shape: shapes[idx % shapes.length]
    };
  });

  return {
    id: Date.now() + Math.random(),
    label: cfg.label,
    badgeClass: cfg.badgeClass,
    particles
  };
}

type ExitCue = FlashcardConfidence | 'prev' | 'next' | null;

function getCardExitAnimation(cue: ExitCue) {
  if (cue === 'mastered') {
    return {
      opacity: 0,
      x: 220,
      y: -150,
      rotateZ: 26,
      scaleX: 1.12,
      scaleY: 0.84,
      transition: { duration: 0.34, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  if (cue === 'good') {
    return {
      opacity: 0,
      x: 240,
      y: -30,
      rotateZ: 16,
      scaleX: 1.08,
      scaleY: 0.9,
      transition: { duration: 0.3, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  if (cue === 'hard') {
    return {
      opacity: 0,
      x: [-12, 16, -8, 110],
      y: [0, -8, 6, 85],
      rotateZ: [-5, 7, -4, 12],
      scale: 0.86,
      transition: { duration: 0.34, ease: 'easeInOut' as const }
    };
  }
  if (cue === 'again') {
    return {
      opacity: 0,
      x: [12, -16, 8, -220],
      y: [0, -6, 10, 85],
      rotateZ: [5, -9, 6, -24],
      scale: 0.84,
      transition: { duration: 0.34, ease: 'easeInOut' as const }
    };
  }
  if (cue === 'prev') {
    return {
      opacity: 0,
      x: 150,
      y: 12,
      rotateZ: 9,
      scaleX: 0.9,
      scaleY: 1.06,
      transition: { duration: 0.24, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  if (cue === 'next') {
    return {
      opacity: 0,
      x: -150,
      y: 12,
      rotateZ: -9,
      scaleX: 0.9,
      scaleY: 1.06,
      transition: { duration: 0.24, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  return {
    opacity: 0,
    x: -110,
    scale: 0.88,
    rotateZ: -8,
    transition: { duration: 0.22 }
  };
}

export function FlashcardStudyPlayer({
  user,
  deck,
  accentColor,
  mode = 'full',
  subsetCardIds,
  onClose,
  onViewHistory,
  onSessionSaved
}: FlashcardStudyPlayerProps) {
  const initialCards = useMemo(() => {
    if (subsetCardIds && subsetCardIds.length > 0) {
      const idSet = new Set(subsetCardIds);
      const filtered = deck.cards.filter((c) => idSet.has(c.id));
      if (filtered.length > 0) return filtered;
    }
    return [...deck.cards];
  }, [deck.cards, subsetCardIds]);

  const [cardsQueue, setCardsQueue] = useState<FlashcardItem[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [flipsOnCurrent, setFlipsOnCurrent] = useState(0);

  // Store ratings keyed by cardId so navigating Previous / Next & re-rating never duplicates entries
  const [resultsByCardId, setResultsByCardId] = useState<Record<string, FlashcardCardResult>>({});
  const [lastExitCue, setLastExitCue] = useState<ExitCue>(null);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [flipBounceTick, setFlipBounceTick] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [activeBurst, setActiveBurst] = useState<BurstEffect | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completedSession, setCompletedSession] = useState<FlashcardSession | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [savedToCloud, setSavedToCloud] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'weak'>('all');
  const [activeMode, setActiveMode] = useState<'full' | 'weak-drill'>(mode);

  const sessionStartRef = useRef<number>(Date.now());
  const cardStartRef = useRef<number>(Date.now());
  const didDragRef = useRef<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cardElapsedSeconds, setCardElapsedSeconds] = useState(0);

  // Ordered results matching the deck queue
  const orderedResults = useMemo(() => {
    return cardsQueue
      .map((c) => resultsByCardId[c.id])
      .filter((r): r is FlashcardCardResult => Boolean(r));
  }, [cardsQueue, resultsByCardId]);

  const ratedCount = orderedResults.length;

  // Live magnetic 3D pointer tilt & rubber-band drag MotionValues (60fps GPU-only)
  const rawPointerX = useMotionValue(0);
  const rawPointerY = useMotionValue(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const smoothTiltX = useSpring(useTransform(rawPointerY, [-0.5, 0.5], [10, -10]), TILT_SPRING_CONFIG);
  const smoothTiltY = useSpring(useTransform(rawPointerX, [-0.5, 0.5], [-12, 12]), TILT_SPRING_CONFIG);
  const dragRotateZ = useSpring(useTransform(dragX, [-220, 0, 220], [-15, 0, 15]), TILT_SPRING_CONFIG);
  const dragStretchScale = useSpring(useTransform(dragX, [-220, 0, 220], [0.96, 1, 0.96]), TILT_SPRING_CONFIG);
  const sheenX = useSpring(useTransform(rawPointerX, [-0.5, 0.5], ['15%', '85%']), TILT_SPRING_CONFIG);
  const sheenY = useSpring(useTransform(rawPointerY, [-0.5, 0.5], ['15%', '85%']), TILT_SPRING_CONFIG);

  const swipeRightStampOpacity = useTransform(dragX, [35, 110], [0, 1]);
  const swipeLeftStampOpacity = useTransform(dragX, [-110, -35], [1, 0]);

  const handleCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      rawPointerX.set(nx);
      rawPointerY.set(ny);
    },
    [rawPointerX, rawPointerY]
  );

  const handleCardPointerLeave = useCallback(() => {
    rawPointerX.set(0);
    rawPointerY.set(0);
  }, [rawPointerX, rawPointerY]);

  // Live timers while studying
  useEffect(() => {
    if (completedSession) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - sessionStartRef.current) / 1000)));
      setCardElapsedSeconds(Math.max(0, Math.floor((now - cardStartRef.current) / 1000)));
    }, 500);
    return () => clearInterval(interval);
  }, [completedSession]);

  const currentCard = cardsQueue[currentIndex];
  const currentCardResult = currentCard ? resultsByCardId[currentCard.id] : undefined;

  const liveEfficiency = useMemo(() => {
    if (orderedResults.length === 0) return 0;
    const sum = orderedResults.reduce(
      (acc, r) => acc + computeCardEfficiency(r.rating, r.timeSpentSeconds, r.flipsCount),
      0
    );
    return Math.round(sum / orderedResults.length);
  }, [orderedResults]);

  const resetCardMotionValues = useCallback(() => {
    rawPointerX.set(0);
    rawPointerY.set(0);
    dragX.set(0);
    dragY.set(0);
  }, [dragX, dragY, rawPointerX, rawPointerY]);

  const handleFlip = useCallback(() => {
    if (completedSession || !currentCard) return;
    setFlipBounceTick((t) => t + 1);
    setIsFlipped((prev) => {
      if (!prev) {
        setFlipsOnCurrent((f) => f + 1);
      }
      return !prev;
    });
  }, [completedSession, currentCard]);

  // Navigate to any specific card index (Previous / Next / Page Dot jump)
  const navigateToCard = useCallback(
    (targetIndex: number, cue?: 'prev' | 'next') => {
      if (completedSession) return;
      const clamped = Math.max(0, Math.min(cardsQueue.length - 1, targetIndex));
      if (clamped === currentIndex) return;

      const direction: 1 | -1 = clamped < currentIndex ? -1 : 1;
      setNavDirection(direction);
      setLastExitCue(cue || (direction === -1 ? 'prev' : 'next'));
      resetCardMotionValues();
      setIsFlipped(false);
      setShowHint(false);
      setFlipsOnCurrent(0);
      setCurrentIndex(clamped);
      cardStartRef.current = Date.now();
      setCardElapsedSeconds(0);
    },
    [cardsQueue.length, completedSession, currentIndex, resetCardMotionValues]
  );

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      navigateToCard(currentIndex - 1, 'prev');
    }
  }, [currentIndex, navigateToCard]);

  const handleNextCard = useCallback(() => {
    if (currentIndex < cardsQueue.length - 1) {
      navigateToCard(currentIndex + 1, 'next');
    }
  }, [cardsQueue.length, currentIndex, navigateToCard]);

  const persistSessionPayload = useCallback(
    async (sessionPayload: FlashcardSession) => {
      setSavingSession(true);
      setSaveError(null);
      setSavedToCloud(false);
      try {
        await saveFlashcardSessionToDb(user, sessionPayload, deck);
        setSavedToCloud(true);
        onSessionSaved?.(sessionPayload);
      } catch (err) {
        console.error('Failed to save flashcard session:', err);
        setSaveError('Could not reach cloud database right now. Tap Retry Save below.');
      } finally {
        setSavingSession(false);
      }
    },
    [deck, onSessionSaved, user]
  );

  const finalizeSession = useCallback(
    async (finalResults: FlashcardCardResult[]) => {
      if (finalResults.length === 0) return;

      const completedAt = Date.now();
      const startedAt = sessionStartRef.current;
      const durationSeconds = Math.max(1, Math.round((completedAt - startedAt) / 1000));
      const totalCards = finalResults.length;

      const masteredCount = finalResults.filter((r) => r.rating === 'mastered').length;
      const goodCount = finalResults.filter((r) => r.rating === 'good').length;
      const hardCount = finalResults.filter((r) => r.rating === 'hard').length;
      const againCount = finalResults.filter((r) => r.rating === 'again').length;

      const efficiencySum = finalResults.reduce(
        (acc, r) => acc + computeCardEfficiency(r.rating, r.timeSpentSeconds, r.flipsCount),
        0
      );
      const efficiencyScore = totalCards > 0 ? Math.round(efficiencySum / totalCards) : 0;
      const retentionRatePct =
        totalCards > 0 ? Math.round(((masteredCount + goodCount) / totalCards) * 100) : 0;
      const avgSecondsPerCard =
        totalCards > 0
          ? Number(
              (
                finalResults.reduce((acc, r) => acc + r.timeSpentSeconds, 0) / totalCards
              ).toFixed(1)
            )
          : 0;

      const weakCardIds = finalResults
        .filter((r) => r.rating === 'again' || r.rating === 'hard')
        .map((r) => r.cardId);

      const sessionId = `fcs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sessionPayload: FlashcardSession = {
        id: sessionId,
        userId: user.uid,
        deckId: deck.id,
        deckTitle: deck.title,
        subjectId: deck.subjectId,
        subjectSlug: deck.subjectSlug,
        subjectName: deck.subjectName,
        topic: deck.topic,
        mode: activeMode,
        startedAt,
        completedAt,
        durationSeconds,
        totalCards,
        masteredCount,
        goodCount,
        hardCount,
        againCount,
        efficiencyScore,
        retentionRatePct,
        avgSecondsPerCard,
        weakCardIds,
        cardResults: finalResults
      };

      setCompletedSession(sessionPayload);
      // Immediately notify parent so history reflects it even before async finishes
      onSessionSaved?.(sessionPayload);
      await persistSessionPayload(sessionPayload);
    },
    [activeMode, deck, onSessionSaved, persistSessionPayload, user.uid]
  );

  const handleRate = useCallback(
    (rating: FlashcardConfidence) => {
      if (!currentCard || completedSession) return;
      const now = Date.now();
      const timeSpent = Math.max(1, Math.round((now - cardStartRef.current) / 1000));
      const existing = resultsByCardId[currentCard.id];

      const cardResult: FlashcardCardResult = {
        cardId: currentCard.id,
        front: currentCard.front,
        back: currentCard.back,
        conceptTag: currentCard.conceptTag,
        rating,
        timeSpentSeconds: timeSpent,
        flipsCount: Math.max(1, flipsOnCurrent),
        attemptsInSession: (existing?.attemptsInSession || 0) + 1
      };

      const nextMap: Record<string, FlashcardCardResult> = {
        ...resultsByCardId,
        [currentCard.id]: cardResult
      };
      setResultsByCardId(nextMap);
      setNavDirection(1);
      setLastExitCue(rating);

      // Fire crazy radial particle burst + comic pop label
      const burst = createParticleBurst(rating);
      setActiveBurst(burst);
      setTimeout(() => {
        setActiveBurst((curr) => (curr?.id === burst.id ? null : curr));
      }, 900);

      if (rating === 'mastered' || rating === 'good') {
        setStreakCount((s) => s + 1);
      } else {
        setStreakCount(0);
      }

      resetCardMotionValues();

      const nextOrderedResults = cardsQueue
        .map((c) => nextMap[c.id])
        .filter((r): r is FlashcardCardResult => Boolean(r));

      if (currentIndex + 1 >= cardsQueue.length) {
        finalizeSession(nextOrderedResults);
      } else {
        setIsFlipped(false);
        setShowHint(false);
        setFlipsOnCurrent(0);
        setCurrentIndex((idx) => idx + 1);
        cardStartRef.current = Date.now();
        setCardElapsedSeconds(0);
      }
    },
    [
      cardsQueue,
      completedSession,
      currentCard,
      currentIndex,
      finalizeSession,
      flipsOnCurrent,
      resetCardMotionValues,
      resultsByCardId
    ]
  );

  const handleCardDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const movedDistance = Math.hypot(info.offset.x, info.offset.y);
      if (movedDistance > 10) {
        didDragRef.current = true;
        setTimeout(() => {
          didDragRef.current = false;
        }, 120);
      }
      if (isFlipped) {
        if (info.offset.x > 115 || info.velocity.x > 620) {
          handleRate('mastered');
          return;
        }
        if (info.offset.x < -115 || info.velocity.x < -620) {
          handleRate('again');
          return;
        }
      }
    },
    [handleRate, isFlipped]
  );

  // Keyboard shortcuts: ArrowLeft/Right page nav, Space/Enter flip, H hint, 1/2/3/4 rate
  useEffect(() => {
    if (completedSession || showExitConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.key.toLowerCase() === 'h' && !isFlipped && currentCard?.hint) {
        e.preventDefault();
        setShowHint((prev) => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRate('again');
        else if (e.key === '2') handleRate('hard');
        else if (e.key === '3') handleRate('good');
        else if (e.key === '4') handleRate('mastered');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    completedSession,
    currentCard,
    handleFlip,
    handleNextCard,
    handlePrevCard,
    handleRate,
    isFlipped,
    showExitConfirm
  ]);

  const handleShuffleRemaining = () => {
    if (completedSession) return;
    const done = cardsQueue.slice(0, currentIndex);
    const remaining = [...cardsQueue.slice(currentIndex)];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    setCardsQueue([...done, ...remaining]);
    setIsFlipped(false);
    setShowHint(false);
    setFlipsOnCurrent(0);
    setIsShuffled(true);
    setShuffleTick((t) => t + 1);
    cardStartRef.current = Date.now();
  };

  const restartSession = (targetMode: 'full' | 'weak-drill', specificCardIds?: string[]) => {
    let nextQueue = [...deck.cards];
    if (specificCardIds && specificCardIds.length > 0) {
      const setIds = new Set(specificCardIds);
      const filtered = deck.cards.filter((c) => setIds.has(c.id));
      if (filtered.length > 0) nextQueue = filtered;
    }
    setActiveMode(targetMode);
    setCardsQueue(nextQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setFlipsOnCurrent(0);
    setResultsByCardId({});
    setStreakCount(0);
    setCompletedSession(null);
    setSavedToCloud(false);
    setReportFilter('all');
    setSaveError(null);
    sessionStartRef.current = Date.now();
    cardStartRef.current = Date.now();
    setElapsedSeconds(0);
    setCardElapsedSeconds(0);
  };

  // ============================================================================
  // POST-SESSION EFFICIENCY REPORT VIEW
  // ============================================================================
  if (completedSession) {
    const verdict = getEfficiencyVerdict(completedSession.efficiencyScore);
    const weakCount = completedSession.weakCardIds.length;
    const ringRadius = 56;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference * (1 - completedSession.efficiencyScore / 100);

    const visibleResults =
      reportFilter === 'weak'
        ? completedSession.cardResults.filter((r) => r.rating === 'again' || r.rating === 'hard')
        : completedSession.cardResults;

    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_BUTTERY}
        className="space-y-5 sm:space-y-6 pb-24 lg:pb-16"
      >
        {/* Top Hero Report Banner */}
        <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[5px_5px_0px_#141413] dark:shadow-[5px_5px_0px_#ECD5FF] p-4 sm:p-7 lg:p-8 overflow-hidden relative">
          <div
            className="absolute top-0 inset-x-0 h-1.5"
            style={{ backgroundColor: accentColor }}
          />

          <div className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-5 sm:gap-6">
            {/* Animated SVG Efficiency Ring */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full lg:w-auto">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 132 132">
                  <circle
                    cx="66"
                    cy="66"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    className="text-[#E5E1CE] dark:text-[#2E2E2A]"
                    strokeWidth="10"
                  />
                  <motion.circle
                    cx="66"
                    cy="66"
                    r={ringRadius}
                    fill="none"
                    stroke={verdict.ringColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    initial={{ strokeDashoffset: ringCircumference }}
                    animate={{ strokeDashoffset: ringOffset }}
                    transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-heading text-2xl sm:text-3xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums leading-none">
                    <AnimatedNumber value={completedSession.efficiencyScore} suffix="%" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] mt-1">
                    Efficiency
                  </span>
                </div>
              </div>

              <div className="text-center sm:text-left space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${verdict.badgeBg}`}>
                    {verdict.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                    {completedSession.subjectName} · {completedSession.mode === 'weak-drill' ? 'Weak Drill' : 'Full Deck'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight break-words">
                  {completedSession.deckTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] max-w-xl">
                  {verdict.subtitle}
                </p>

                {/* Live Database Persistence Status */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                  {savingSession && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#0D47FF] dark:text-[#ECD5FF]">
                      <Save className="w-3.5 h-3.5 animate-pulse" />
                      Saving session to database...
                    </span>
                  )}
                  {!savingSession && savedToCloud && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/12 border border-emerald-500/35 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      <CloudCheck className="w-3.5 h-3.5" />
                      Saved to Database History
                    </span>
                  )}
                  {!savingSession && saveError && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {saveError}
                      </span>
                      <button
                        type="button"
                        onClick={() => persistSessionPayload(completedSession)}
                        className="px-2.5 py-1 rounded-lg bg-[#0D47FF] text-white text-[11px] font-bold cursor-pointer"
                      >
                        Retry Save
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons (Full width stack on small mobile, inline row on tablet/desktop) */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center justify-center lg:justify-end gap-2.5 w-full lg:w-auto shrink-0">
              {weakCount > 0 && (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => restartSession('weak-drill', completedSession.weakCardIds)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD426] text-[#141413] text-xs font-bold ink-btn-hard cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  Drill {weakCount} Weak {weakCount === 1 ? 'Card' : 'Cards'}
                </motion.button>
              )}

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING_SNAPPY}
                onClick={() => restartSession('full')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Study Full Deck
              </motion.button>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING_SNAPPY}
                onClick={onViewHistory}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                Past Flashcards
              </motion.button>
            </div>
          </div>

          {/* 4 KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Retention Rate
              </p>
              <p className="font-heading text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {completedSession.retentionRatePct}%
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                {completedSession.masteredCount + completedSession.goodCount} of {completedSession.totalCards} recalled
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Avg Recall Speed
              </p>
              <p className="font-heading text-xl sm:text-2xl font-black text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums mt-1">
                {completedSession.avgSecondsPerCard}s
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                Total {formatSeconds(completedSession.durationSeconds)} session
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Instant Mastery
              </p>
              <p className="font-heading text-xl sm:text-2xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums mt-1">
                {completedSession.masteredCount}
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                {completedSession.goodCount} solid · {completedSession.hardCount} partial
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Weak Concepts
              </p>
              <p
                className={`font-heading text-xl sm:text-2xl font-black tabular-nums mt-1 ${
                  weakCount === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {weakCount}
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                {weakCount === 0 ? 'Zero blind spots!' : `${completedSession.againCount} missed · ${completedSession.hardCount} hard`}
              </p>
            </div>
          </div>

          {/* Mastery Distribution Bar */}
          <div className="mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] mb-2">
              <span className="uppercase tracking-wider font-bold">Recall Mastery Breakdown</span>
              <span className="tabular-nums">
                Mastered {completedSession.masteredCount} · Good {completedSession.goodCount} · Hard {completedSession.hardCount} · Again {completedSession.againCount}
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              {completedSession.masteredCount > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(completedSession.masteredCount / completedSession.totalCards) * 100}%` }}
                  className="bg-emerald-500 origin-left"
                />
              )}
              {completedSession.goodCount > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(completedSession.goodCount / completedSession.totalCards) * 100}%` }}
                  className="bg-[#0D47FF] origin-left"
                />
              )}
              {completedSession.hardCount > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.65, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(completedSession.hardCount / completedSession.totalCards) * 100}%` }}
                  className="bg-amber-400 origin-left"
                />
              )}
              {completedSession.againCount > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(completedSession.againCount / completedSession.totalCards) * 100}%` }}
                  className="bg-rose-500 origin-left"
                />
              )}
            </div>
          </div>
        </div>

        {/* Concept-by-Concept Recall Audit */}
        <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-heading text-base sm:text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                Card-by-Card Recall Breakdown
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                Inspect every concept tested, your self-rated mastery, and recall speed.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F3F0E0] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setReportFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  reportFilter === 'all'
                    ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413]'
                    : 'text-[#66665E] dark:text-[#A3A399]'
                }`}
              >
                All ({completedSession.cardResults.length})
              </button>
              <button
                type="button"
                onClick={() => setReportFilter('weak')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  reportFilter === 'weak'
                    ? 'bg-rose-600 text-white'
                    : 'text-[#66665E] dark:text-[#A3A399]'
                }`}
              >
                Weak Only ({weakCount})
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {visibleResults.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#66665E] dark:text-[#A3A399]">
                Zero weak cards in this session — outstanding recall!
              </div>
            ) : (
              visibleResults.map((item, idx) => {
                const ratingBadge =
                  item.rating === 'mastered'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                    : item.rating === 'good'
                      ? 'bg-[#0D47FF]/12 text-[#0D47FF] dark:text-[#93C5FD] border-[#0D47FF]/35'
                      : item.rating === 'hard'
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35';

                return (
                  <div
                    key={`${item.cardId}_${idx}`}
                    className="p-3.5 sm:p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          #{idx + 1} · {item.conceptTag}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#141413] dark:text-[#FAF8EC] leading-snug break-words">
                        {item.front}
                      </p>
                      <p className="text-xs text-[#66665E] dark:text-[#A3A399] leading-relaxed whitespace-pre-line break-words">
                        {item.back}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider ${ratingBadge}`}
                      >
                        {item.rating}
                      </span>
                      <span className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] tabular-nums flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.timeSpentSeconds}s
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-start">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Flashcards Studio
          </button>
        </div>
      </motion.div>
    );
  }

  // ============================================================================
  // ACTIVE 3D FLASHCARD STUDY THEATER (RESPONSIVE + PAGE-BY-PAGE ARROWS)
  // ============================================================================
  const progressPct =
    cardsQueue.length > 0 ? Math.round(((currentIndex + 1) / cardsQueue.length) * 100) : 0;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < cardsQueue.length - 1;
  const currentRatingMeta = currentCardResult
    ? RATING_META.find((m) => m.key === currentCardResult.rating)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_BUTTERY}
      className="max-w-5xl mx-auto space-y-4 sm:space-y-5 pb-24 lg:pb-24 overflow-x-clip"
    >
      {/* Top Study Session Header */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => (ratedCount > 0 ? setShowExitConfirm(true) : onClose())}
              className="w-9 h-9 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-center text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer shrink-0"
              aria-label="Exit study session"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] truncate">
                  {deck.subjectName} · {activeMode === 'weak-drill' ? 'Weak Drill' : 'Active Recall'}
                </span>
              </div>
              <h2 className="font-heading text-sm sm:text-base font-black text-[#141413] dark:text-[#FAF8EC] truncate">
                {deck.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap">
            {streakCount >= 2 && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING_BOUNCY}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFD426] text-[#141413] border border-[#141413] text-[10px] sm:text-[11px] font-mono font-bold tabular-nums"
              >
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {streakCount}
              </motion.div>
            )}

            <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[11px] sm:text-xs font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
              <Target className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF]" />
              {ratedCount > 0 ? `${liveEfficiency}%` : '—'}
            </div>

            <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[11px] sm:text-xs font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#66665E] dark:text-[#A3A399]" />
              {formatSeconds(elapsedSeconds)}
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleShuffleRemaining}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                isShuffled
                  ? 'bg-[#ECD5FF] text-[#141413] border-[#141413]'
                  : 'bg-[#FAF8EC] dark:bg-[#141413] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC]'
              }`}
              title="Shuffle remaining cards"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shuffle</span>
            </motion.button>

            {ratedCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => finalizeSession(orderedResults)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white border border-[#141413] text-[11px] sm:text-xs font-bold cursor-pointer"
                title="Save rated progress to database history"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save ({ratedCount})</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 flex items-center gap-2.5 sm:gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#F3F0E0] dark:bg-[#242421] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accentColor }}
              initial={false}
              animate={{ width: `${Math.max(4, progressPct)}%` }}
              transition={SPRING_SNAPPY}
            />
          </div>
          <span className="font-mono text-[10px] sm:text-[11px] font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums shrink-0">
            Page {currentIndex + 1} / {cardsQueue.length}
          </span>
        </div>
      </div>

      {/* Stage Row: Desktop Left Arrow + 3D Card Stage + Desktop Right Arrow */}
      <div className="flex items-center gap-2.5 md:gap-4 lg:gap-5">
        {/* Desktop Side Previous Arrow */}
        <motion.button
          type="button"
          disabled={!canGoPrev}
          onClick={handlePrevCard}
          whileHover={canGoPrev ? { scale: 1.12, x: -3, rotate: -6 } : undefined}
          whileTap={canGoPrev ? { scale: 0.88, x: -5 } : undefined}
          transition={JELLY_SPRING}
          aria-label="Previous flashcard"
          title="Previous Card (Left Arrow)"
          className={`hidden md:flex w-12 h-12 rounded-2xl border-[1.5px] items-center justify-center shrink-0 transition-all ${
            canGoPrev
              ? 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#141413] dark:border-[#FAF8EC]/75 text-[#141413] dark:text-[#FAF8EC] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] hover:bg-[#ECD5FF] hover:text-[#141413] cursor-pointer'
              : 'bg-[#F3F0E0]/60 dark:bg-[#1C1C1A]/40 border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E]/40 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
        </motion.button>

        {/* Physical Spring-Loaded Stacked Deck + Crazy Bouncy Jiggly 3D Flashcard Theater */}
        <div className="relative flex-1 min-w-0 pt-2 pb-3 sm:pt-3 sm:pb-4">
          {/* Radial Confetti Particle Burst & Comic Feedback Pop */}
          <AnimatePresence>
            {activeBurst && (
              <div
                key={activeBurst.id}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.4, y: 20, rotate: -8 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0.4, 1.16, 0.96, 1.06],
                    y: [16, -68, -84, -110],
                    rotate: [-8, 5, -2, 3]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                  className={`px-3.5 py-1.5 rounded-xl border-2 shadow-[4px_4px_0px_#141413] font-mono text-[11px] sm:text-xs font-black uppercase tracking-wider ${activeBurst.badgeClass}`}
                >
                  {activeBurst.label}
                </motion.div>

                {activeBurst.particles.map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{
                      x: p.dx,
                      y: p.dy,
                      scale: [0, p.scale * 1.25, p.scale, 0],
                      opacity: [1, 1, 0.85, 0],
                      rotate: p.rotate
                    }}
                    transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
                    style={{ backgroundColor: p.color }}
                    className={`absolute border border-[#141413]/40 ${
                      p.shape === 'circle'
                        ? 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full'
                        : p.shape === 'diamond'
                          ? 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm rotate-45'
                          : 'w-3.5 h-1.5 sm:w-4 sm:h-2 rounded-full'
                    }`}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Living Spring-Loaded Background Deck Cards */}
          {currentIndex + 2 < cardsQueue.length && (
            <motion.div
              key={`stack-back-2-${currentIndex}-${flipBounceTick}-${shuffleTick}`}
              aria-hidden="true"
              initial={{ y: 20, scale: 0.9, rotateZ: -3.2 }}
              animate={{ y: 16, scale: 0.93, rotateZ: isFlipped ? 2.2 : -2 }}
              transition={JELLY_SPRING}
              className="absolute inset-x-6 sm:inset-x-8 top-0 bottom-2 rounded-[26px] sm:rounded-[30px] bg-[#F3F0E0] dark:bg-[#1A1A18] border-[1.5px] border-[#141413]/20 dark:border-[#FAF8EC]/15 opacity-70 pointer-events-none"
            />
          )}
          {currentIndex + 1 < cardsQueue.length && (
            <motion.div
              key={`stack-back-1-${currentIndex}-${flipBounceTick}-${shuffleTick}`}
              aria-hidden="true"
              initial={{ y: 16, scale: 0.93, rotateZ: 2.8 }}
              animate={{ y: 8, scale: 0.968, rotateZ: isFlipped ? -1.6 : 1.5 }}
              transition={JELLY_SPRING}
              className="absolute inset-x-3 sm:inset-x-4 top-1 bottom-1 rounded-[26px] sm:rounded-[30px] bg-[#FAF8EC] dark:bg-[#22221F] border-[1.5px] border-[#141413]/30 dark:border-[#FAF8EC]/25 opacity-90 pointer-events-none shadow-[3px_3px_0px_rgba(20,20,19,0.12)]"
            />
          )}

          <AnimatePresence mode="popLayout" custom={lastExitCue}>
            {currentCard && (
              <motion.div
                key={`${currentCard.id}_${currentIndex}_${shuffleTick}`}
                custom={lastExitCue}
                initial={{
                  opacity: 0,
                  x: navDirection === -1 ? -110 : 0,
                  y: navDirection === -1 ? 16 : 48,
                  scaleX: 0.86,
                  scaleY: 1.1,
                  rotateZ: navDirection === -1 ? -6 : -4
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scaleX: 1,
                  scaleY: 1,
                  rotateZ: 0
                }}
                exit={getCardExitAnimation(lastExitCue)}
                transition={{
                  ...JELLY_SPRING,
                  opacity: { duration: 0.16 }
                }}
                className="fc-perspective relative z-10"
              >
                {/* Rubber-Band Draggable + Magnetic 3D Tilt Wrapper */}
                <motion.div
                  drag
                  dragSnapToOrigin
                  dragElastic={0.42}
                  dragTransition={{ bounceStiffness: 340, bounceDamping: 11 }}
                  onDragEnd={handleCardDragEnd}
                  onPointerMove={handleCardPointerMove}
                  onPointerLeave={handleCardPointerLeave}
                  style={{
                    x: dragX,
                    y: dragY,
                    rotateX: smoothTiltX,
                    rotateY: smoothTiltY,
                    rotateZ: dragRotateZ,
                    scale: dragStretchScale
                  }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scaleX: 1.025, scaleY: 0.97 }}
                  className="fc-perspective cursor-grab active:cursor-grabbing relative touch-pan-y"
                >
                  {/* Live Drag-to-Rate Floating Stamps */}
                  {isFlipped && (
                    <>
                      <motion.div
                        style={{ opacity: swipeRightStampOpacity }}
                        className="pointer-events-none absolute top-4 left-4 sm:top-6 sm:left-6 z-40 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-emerald-500 text-white border-2 border-[#141413] shadow-[3px_3px_0px_#141413] font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider -rotate-12"
                      >
                        MASTERED! ⚡
                      </motion.div>
                      <motion.div
                        style={{ opacity: swipeLeftStampOpacity }}
                        className="pointer-events-none absolute top-4 right-4 sm:top-6 sm:right-6 z-40 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-rose-600 text-white border-2 border-[#141413] shadow-[3px_3px_0px_#141413] font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider rotate-12"
                      >
                        AGAIN! 🔁
                      </motion.div>
                    </>
                  )}

                  {/* Squash-and-Stretch Rubber Jelly Pulse Layer on Flip */}
                  <motion.div
                    key={`jelly-pulse-${flipBounceTick}`}
                    initial={
                      flipBounceTick > 0
                        ? { scaleX: 1.08, scaleY: 0.92, y: -16, rotateZ: isFlipped ? -2.8 : 2.8 }
                        : false
                    }
                    animate={{ scaleX: 1, scaleY: 1, y: 0, rotateZ: 0 }}
                    transition={JELLY_SPRING}
                    className="fc-perspective"
                  >
                    {/* Spring-Driven 3D Flipping Card Body */}
                    <motion.div
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={FLIP_JELLY_SPRING}
                      onClick={() => {
                        if (didDragRef.current) return;
                        handleFlip();
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={
                        isFlipped
                          ? 'Flashcard answer side. Click to flip back.'
                          : 'Flashcard prompt side. Click to reveal answer.'
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleFlip();
                        }
                      }}
                      className="fc-preserve-3d relative w-full select-none min-h-[305px] sm:min-h-[385px] lg:min-h-[415px]"
                    >
                      {/* FRONT FACE (QUESTION / RECALL PROMPT) */}
                      <div className="fc-face absolute inset-0 rounded-[24px] sm:rounded-[28px] bg-[#FFFFFF] dark:bg-[#1C1C1A] border-2 border-[#141413] dark:border-[#FAF8EC]/80 shadow-[6px_6px_0px_#141413] sm:shadow-[7px_7px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] p-4 sm:p-7 lg:p-9 flex flex-col justify-between overflow-y-auto overflow-x-hidden">
                        {/* Dynamic Magnetic Light Sheen */}
                        <motion.div
                          aria-hidden="true"
                          style={{
                            left: sheenX,
                            top: sheenY
                          }}
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-60 sm:w-72 h-60 sm:h-72 rounded-full bg-gradient-to-br from-[#ECD5FF]/35 via-[#FFD426]/15 to-transparent dark:from-[#ECD5FF]/15 dark:via-[#0D47FF]/12 blur-2xl opacity-75"
                        />

                        <div
                          className="absolute top-0 inset-x-0 h-2 sm:h-2.5"
                          style={{ backgroundColor: accentColor }}
                        />

                        {/* Top metadata row */}
                        <div className="relative z-10 flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                            <span
                              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider border truncate max-w-[180px] sm:max-w-[260px]"
                              style={{
                                backgroundColor: `${accentColor}16`,
                                borderColor: `${accentColor}40`,
                                color: accentColor
                              }}
                            >
                              {currentCard.conceptTag}
                            </span>
                            <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                              {currentCard.difficulty}
                            </span>
                            {currentRatingMeta && (
                              <span
                                className={`px-2 py-0.5 rounded-md border font-mono text-[9px] font-bold uppercase ${currentRatingMeta.pillClass}`}
                              >
                                Rated: {currentRatingMeta.label}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] sm:text-[11px] font-bold text-[#66665E] dark:text-[#A3A399] tabular-nums shrink-0">
                            PROMPT · {cardElapsedSeconds}s
                          </span>
                        </div>

                        {/* Center Question Body */}
                        <div className="relative z-10 my-auto py-4 sm:py-6 text-center space-y-4">
                          <p className="font-heading text-lg sm:text-2xl lg:text-[26px] font-black text-[#141413] dark:text-[#FAF8EC] leading-snug tracking-tight max-w-2xl mx-auto break-words">
                            {currentCard.front}
                          </p>

                          {/* Optional Hint Accordion */}
                          {currentCard.hint && (
                            <div
                              className="flex flex-col items-center"
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              {!showHint ? (
                                <motion.button
                                  whileHover={{ scale: 1.07, rotate: -1.5 }}
                                  whileTap={{ scale: 0.9 }}
                                  transition={JELLY_SPRING}
                                  type="button"
                                  onClick={() => setShowHint(true)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] text-[11px] sm:text-xs font-bold text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] transition-colors cursor-pointer"
                                >
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                  Show Hint (H)
                                </motion.button>
                              ) : (
                                <motion.div
                                  initial={{ opacity: 0, y: 12, scaleX: 0.85, scaleY: 1.15 }}
                                  animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                                  transition={JELLY_SPRING}
                                  className="max-w-xl px-3.5 py-2 rounded-xl bg-[#FFD426]/25 dark:bg-[#FFD426]/12 border border-[#FFD426]/60 text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC] font-medium break-words"
                                >
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-[#FFD426] mr-1.5">
                                    Hint:
                                  </span>
                                  {currentCard.hint}
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Flip Cue */}
                        <div className="relative z-10 flex items-center justify-between gap-2 pt-2.5 sm:pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-[11px] sm:text-xs">
                          <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] truncate">
                            Drag or tap to flip
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#0D47FF] dark:text-[#ECD5FF] shrink-0">
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Tap / Space</span>
                          </span>
                        </div>
                      </div>

                      {/* BACK FACE (ANSWER + MEMORY ANCHOR) */}
                      <div className="fc-face-back absolute inset-0 rounded-[24px] sm:rounded-[28px] bg-[#FAF8EC] dark:bg-[#191917] border-2 border-[#0D47FF] dark:border-[#ECD5FF] shadow-[6px_6px_0px_#0D47FF] sm:shadow-[7px_7px_0px_#0D47FF] dark:shadow-[6px_6px_0px_#FFD426] p-4 sm:p-7 lg:p-9 flex flex-col justify-between overflow-y-auto overflow-x-hidden">
                        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF] truncate">
                              VERIFIED ANSWER · {currentCard.conceptTag}
                            </span>
                          </div>
                          <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] shrink-0">
                            Swipe L/R or tap
                          </span>
                        </div>

                        <div className="my-auto py-3 sm:py-4 space-y-3 sm:space-y-4">
                          <p className="text-sm sm:text-lg font-semibold text-[#141413] dark:text-[#FAF8EC] leading-relaxed whitespace-pre-line break-words">
                            {currentCard.back}
                          </p>

                          {currentCard.mnemonic && (
                            <motion.div
                              initial={{ scale: 0.92, rotate: -1 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={JELLY_SPRING}
                              className="p-3 sm:p-3.5 rounded-2xl bg-[#ECD5FF]/45 dark:bg-[#ECD5FF]/12 border border-[#141413]/20 dark:border-[#ECD5FF]/35 flex items-start gap-2.5"
                            >
                              <Sparkles className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0 mt-0.5" />
                              <div className="text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC] min-w-0 break-words">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider block text-[#0D47FF] dark:text-[#ECD5FF] mb-0.5">
                                  Memory Anchor
                                </span>
                                {currentCard.mnemonic}
                              </div>
                            </motion.div>
                          )}

                          {currentCard.sourceExcerpt && (
                            <p className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] italic border-l-2 border-[#0D47FF]/50 pl-3 break-words">
                              From notes: “{currentCard.sourceExcerpt}”
                            </p>
                          )}
                        </div>

                        <div className="pt-2.5 sm:pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
                          <span className="truncate">Swipe Right = Mastered · Left = Again</span>
                          <span className="tabular-nums shrink-0">{cardElapsedSeconds}s</span>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Side Next Arrow */}
        <motion.button
          type="button"
          disabled={!canGoNext}
          onClick={handleNextCard}
          whileHover={canGoNext ? { scale: 1.12, x: 3, rotate: 6 } : undefined}
          whileTap={canGoNext ? { scale: 0.88, x: 5 } : undefined}
          transition={JELLY_SPRING}
          aria-label="Next flashcard"
          title="Next Card (Right Arrow)"
          className={`hidden md:flex w-12 h-12 rounded-2xl border-[1.5px] items-center justify-center shrink-0 transition-all ${
            canGoNext
              ? 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#141413] dark:border-[#FAF8EC]/75 text-[#141413] dark:text-[#FAF8EC] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] hover:bg-[#ECD5FF] hover:text-[#141413] cursor-pointer'
              : 'bg-[#F3F0E0]/60 dark:bg-[#1C1C1A]/40 border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E]/40 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-6 h-6 stroke-[2.5]" />
        </motion.button>
      </div>

      {/* Responsive Page-by-Page Navigation Bar (Previous / Clickable Page Dots / Next or Finish) */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-2 sm:p-2.5 flex items-center justify-between gap-2 sm:gap-3">
        <motion.button
          type="button"
          disabled={!canGoPrev}
          onClick={handlePrevCard}
          whileHover={canGoPrev ? { scaleX: 1.05, scaleY: 0.95, x: -2 } : undefined}
          whileTap={canGoPrev ? { scaleX: 0.92, scaleY: 1.08 } : undefined}
          transition={JELLY_SPRING}
          className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 min-h-[40px] rounded-xl border-[1.5px] text-xs font-bold shrink-0 transition-all ${
            canGoPrev
              ? 'bg-[#FAF8EC] dark:bg-[#242421] border-[#141413] dark:border-[#FAF8EC]/60 text-[#141413] dark:text-[#FAF8EC] shadow-[2px_2px_0px_#141413] dark:shadow-[2px_2px_0px_#ECD5FF] hover:bg-[#ECD5FF] hover:text-[#141413] cursor-pointer'
              : 'bg-[#F3F0E0]/50 dark:bg-[#141413]/40 border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E]/45 cursor-not-allowed'
          }`}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Previous</span>
        </motion.button>

        {/* Scrollable Interactive Page Dots */}
        <div className="flex-1 min-w-0 flex items-center justify-center overflow-x-auto no-scrollbar py-1 px-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {cardsQueue.map((card, idx) => {
              const res = resultsByCardId[card.id];
              const meta = res ? RATING_META.find((m) => m.key === res.rating) : null;
              const isCurrent = idx === currentIndex;
              return (
                <motion.button
                  key={`${card.id}_dot_${idx}`}
                  type="button"
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => navigateToCard(idx)}
                  aria-label={`Jump to card ${idx + 1}`}
                  title={`Card ${idx + 1}${meta ? ` (${meta.label})` : ''}`}
                  className={`rounded-full transition-all cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'w-7 sm:w-8 h-3 bg-[#141413] dark:bg-[#ECD5FF] ring-2 ring-[#0D47FF]/40'
                      : meta
                        ? `w-3 h-3 ${meta.dotClass} opacity-90`
                        : 'w-2.5 h-2.5 bg-[#D8D3BE] dark:bg-[#3A3A35] hover:bg-[#141413]/60 dark:hover:bg-[#FAF8EC]/60'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {canGoNext ? (
          <motion.button
            type="button"
            onClick={handleNextCard}
            whileHover={{ scaleX: 1.05, scaleY: 0.95, x: 2 }}
            whileTap={{ scaleX: 0.92, scaleY: 1.08 }}
            transition={JELLY_SPRING}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 min-h-[40px] rounded-xl border-[1.5px] bg-[#FAF8EC] dark:bg-[#242421] border-[#141413] dark:border-[#FAF8EC]/60 text-[#141413] dark:text-[#FAF8EC] shadow-[2px_2px_0px_#141413] dark:shadow-[2px_2px_0px_#ECD5FF] hover:bg-[#ECD5FF] hover:text-[#141413] text-xs font-bold shrink-0 cursor-pointer"
            aria-label="Go to next page"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            disabled={ratedCount === 0}
            onClick={() => finalizeSession(orderedResults)}
            whileHover={ratedCount > 0 ? { scaleX: 1.05, scaleY: 0.95 } : undefined}
            whileTap={ratedCount > 0 ? { scaleX: 0.92, scaleY: 1.08 } : undefined}
            transition={JELLY_SPRING}
            className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 min-h-[40px] rounded-xl border-[1.5px] text-xs font-bold shrink-0 ${
              ratedCount > 0
                ? 'bg-emerald-600 border-[#141413] text-white shadow-[2px_2px_0px_#141413] cursor-pointer'
                : 'bg-[#F3F0E0]/50 dark:bg-[#141413]/40 border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E]/45 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Finish</span>
          </motion.button>
        )}
      </div>

      {/* Bottom Interactive Jiggly Jelly Rating Dock */}
      <div className="min-h-[104px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.button
              key="reveal-btn"
              initial={{ opacity: 0, y: 18, scaleX: 0.88, scaleY: 1.12 }}
              animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              transition={JELLY_SPRING}
              whileHover={{ y: -4, scaleX: 1.05, scaleY: 0.96, rotate: -1 }}
              whileTap={{ scaleX: 0.92, scaleY: 1.1, y: 2 }}
              onClick={handleFlip}
              className="w-full sm:w-auto min-w-[240px] sm:min-w-[270px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-[#0D47FF] text-white font-heading font-black text-sm sm:text-base ink-btn-hard flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              Flip & Check Answer
              <span className="hidden sm:inline font-mono text-[10px] px-2 py-0.5 rounded bg-white/20 uppercase">
                Space
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="rating-dock"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={JELLY_SPRING}
              className="w-full space-y-2"
            >
              <p className="text-center font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                Rate your recall accuracy to save efficiency
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {RATING_META.map((opt, idx) => {
                  const isPreviouslyPicked = currentCardResult?.rating === opt.key;
                  return (
                    <motion.button
                      key={opt.key}
                      initial={{ opacity: 0, y: 22, scaleX: 0.84, scaleY: 1.16 }}
                      animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                      transition={{ ...JELLY_SPRING, delay: idx * 0.04 }}
                      whileHover={{
                        y: -5,
                        scaleX: 1.06,
                        scaleY: 0.94,
                        rotate: idx % 2 === 0 ? -2 : 2
                      }}
                      whileTap={{ scaleX: 0.9, scaleY: 1.12, y: 2 }}
                      onClick={() => handleRate(opt.key)}
                      className={`p-3 sm:p-3.5 rounded-2xl border-[1.5px] text-left transition-colors cursor-pointer group min-h-[60px] ${opt.bgClass} ${opt.borderClass} ${
                        isPreviouslyPicked ? 'ring-2 ring-[#141413] dark:ring-[#ECD5FF]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-heading text-xs sm:text-sm font-black">
                          {opt.label}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                          {opt.shortcut}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] opacity-85">
                        <span>{opt.sublabel}</span>
                        <span className="font-mono font-bold tabular-nums">{opt.weight}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exit Confirmation Modal with Save Progress Option */}
      <MotionModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        maxWidthClass="max-w-md"
      >
        <div className="rounded-2xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                Save Your Flashcard Progress?
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
                You have rated {ratedCount} of {cardsQueue.length} cards ({liveEfficiency}% efficiency). You can save this session to your database history now or keep studying.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowExitConfirm(false)}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] cursor-pointer"
            >
              Keep Studying
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExitConfirm(false);
                finalizeSession(orderedResults);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold ink-btn-hard cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save to History
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExitConfirm(false);
                onClose();
              }}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-rose-600/12 text-rose-700 dark:text-rose-300 border border-rose-500/35 text-xs font-bold cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      </MotionModal>
    </motion.div>
  );
}
