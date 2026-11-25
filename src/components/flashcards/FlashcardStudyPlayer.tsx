import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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
  Zap,
  Clock,
  Shuffle,
  ArrowLeft,
  Flame,
  Target,
  BarChart3,
  RefreshCw,
  BookOpen,
  History,
  X,
  ChevronRight
} from 'lucide-react';
import { db } from '../../firebase';
import {
  FlashcardDeck,
  FlashcardItem,
  FlashcardConfidence,
  FlashcardCardResult,
  FlashcardSession
} from '../../types';
import { sanitizeForFirestore, handleFirestoreError, OperationType } from '../../utils/firestore';
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
  textClass: string;
}> = [
  {
    key: 'again',
    shortcut: '1',
    label: 'Again',
    sublabel: 'Needs Re-Drill',
    weight: '0%',
    bgClass: 'bg-rose-500/12 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white',
    borderClass: 'border-rose-500/45 hover:border-[#141413]',
    textClass: 'text-rose-600 dark:text-rose-400'
  },
  {
    key: 'hard',
    shortcut: '2',
    label: 'Hard',
    sublabel: 'Partial Recall',
    weight: '45%',
    bgClass: 'bg-amber-500/15 hover:bg-amber-500 text-amber-800 dark:text-amber-300 hover:text-[#141413]',
    borderClass: 'border-amber-500/45 hover:border-[#141413]',
    textClass: 'text-amber-600 dark:text-amber-400'
  },
  {
    key: 'good',
    shortcut: '3',
    label: 'Good',
    sublabel: 'Solid Recall',
    weight: '82%',
    bgClass: 'bg-[#0D47FF]/12 hover:bg-[#0D47FF] text-[#0D47FF] dark:text-[#93C5FD] hover:text-white',
    borderClass: 'border-[#0D47FF]/40 hover:border-[#141413]',
    textClass: 'text-[#0D47FF] dark:text-[#93C5FD]'
  },
  {
    key: 'mastered',
    shortcut: '4',
    label: 'Mastered',
    sublabel: 'Instant Recall',
    weight: '100%',
    bgClass: 'bg-emerald-500/14 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white',
    borderClass: 'border-emerald-500/45 hover:border-[#141413]',
    textClass: 'text-emerald-600 dark:text-emerald-400'
  }
];

function computeCardEfficiency(rating: FlashcardConfidence, timeSpentSeconds: number, flipsCount: number): number {
  let score = RATING_WEIGHTS[rating];
  // Mild precision bonus/adjustment for clean single-flip rapid recall
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
    const dist = 110 + Math.random() * 140;
    return {
      id: idx,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist - (rating === 'mastered' ? 45 : 15)),
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

function getCardExitAnimation(rating: FlashcardConfidence | null) {
  if (rating === 'mastered') {
    return {
      opacity: 0,
      x: 240,
      y: -170,
      rotateZ: 28,
      scaleX: 1.12,
      scaleY: 0.84,
      transition: { duration: 0.34, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  if (rating === 'good') {
    return {
      opacity: 0,
      x: 280,
      y: -36,
      rotateZ: 17,
      scaleX: 1.08,
      scaleY: 0.9,
      transition: { duration: 0.3, ease: [0.32, 0, 0.24, 1] as const }
    };
  }
  if (rating === 'hard') {
    return {
      opacity: 0,
      x: [-14, 18, -10, 120],
      y: [0, -10, 6, 95],
      rotateZ: [-6, 8, -4, 14],
      scale: 0.86,
      transition: { duration: 0.36, ease: 'easeInOut' as const }
    };
  }
  if (rating === 'again') {
    return {
      opacity: 0,
      x: [14, -18, 10, -260],
      y: [0, -8, 12, 95],
      rotateZ: [6, -10, 7, -26],
      scale: 0.84,
      transition: { duration: 0.36, ease: 'easeInOut' as const }
    };
  }
  return {
    opacity: 0,
    x: -120,
    scale: 0.86,
    rotateZ: -10,
    transition: { duration: 0.24 }
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
  const [results, setResults] = useState<FlashcardCardResult[]>([]);
  const [lastExitRating, setLastExitRating] = useState<FlashcardConfidence | null>(null);
  const [flipBounceTick, setFlipBounceTick] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [activeBurst, setActiveBurst] = useState<BurstEffect | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completedSession, setCompletedSession] = useState<FlashcardSession | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'weak'>('all');
  const [activeMode, setActiveMode] = useState<'full' | 'weak-drill'>(mode);

  const sessionStartRef = useRef<number>(Date.now());
  const cardStartRef = useRef<number>(Date.now());
  const didDragRef = useRef<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cardElapsedSeconds, setCardElapsedSeconds] = useState(0);

  // Live magnetic 3D pointer tilt & rubber-band drag MotionValues (60fps GPU-only)
  const rawPointerX = useMotionValue(0);
  const rawPointerY = useMotionValue(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const smoothTiltX = useSpring(useTransform(rawPointerY, [-0.5, 0.5], [11, -11]), TILT_SPRING_CONFIG);
  const smoothTiltY = useSpring(useTransform(rawPointerX, [-0.5, 0.5], [-13, 13]), TILT_SPRING_CONFIG);
  const dragRotateZ = useSpring(useTransform(dragX, [-220, 0, 220], [-16, 0, 16]), TILT_SPRING_CONFIG);
  const dragStretchScale = useSpring(useTransform(dragX, [-220, 0, 220], [0.96, 1, 0.96]), TILT_SPRING_CONFIG);
  const sheenX = useSpring(useTransform(rawPointerX, [-0.5, 0.5], ['15%', '85%']), TILT_SPRING_CONFIG);
  const sheenY = useSpring(useTransform(rawPointerY, [-0.5, 0.5], ['15%', '85%']), TILT_SPRING_CONFIG);

  // Live swipe stamp opacity while dragging a flipped card
  const swipeRightStampOpacity = useTransform(dragX, [35, 115], [0, 1]);
  const swipeLeftStampOpacity = useTransform(dragX, [-115, -35], [1, 0]);

  const handleCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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

  const liveEfficiency = useMemo(() => {
    if (results.length === 0) return 0;
    const sum = results.reduce(
      (acc, r) => acc + computeCardEfficiency(r.rating, r.timeSpentSeconds, r.flipsCount),
      0
    );
    return Math.round(sum / results.length);
  }, [results]);

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

  const finalizeSession = useCallback(
    async (finalResults: FlashcardCardResult[]) => {
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
      setSavingSession(true);
      setSaveError(null);

      try {
        const { id: _ignoreId, ...firestoreSession } = sessionPayload;
        await setDoc(doc(db, 'flashcardSessions', sessionId), sanitizeForFirestore(firestoreSession));

        // Update deck aggregate stats
        try {
          const nextBest = Math.max(deck.bestEfficiency || 0, efficiencyScore);
          const nextTotal = (deck.totalSessions || 0) + 1;
          await updateDoc(doc(db, 'flashcardDecks', deck.id), {
            lastStudiedAt: completedAt,
            bestEfficiency: nextBest,
            totalSessions: nextTotal
          });
        } catch (deckUpdateErr) {
          console.warn('Could not update deck aggregate stats:', deckUpdateErr);
        }

        onSessionSaved?.(sessionPayload);
      } catch (err: any) {
        console.error('Failed to save flashcard session:', err);
        try {
          handleFirestoreError(err, OperationType.WRITE, `flashcardSessions/${sessionId}`, user);
        } catch {
          // logged
        }
        setSaveError('Session completed, but cloud sync had an issue. Your results are visible below.');
      } finally {
        setSavingSession(false);
      }
    },
    [activeMode, deck, onSessionSaved, user]
  );

  const handleRate = useCallback(
    (rating: FlashcardConfidence) => {
      if (!currentCard || completedSession) return;
      const now = Date.now();
      const timeSpent = Math.max(1, Math.round((now - cardStartRef.current) / 1000));

      const cardResult: FlashcardCardResult = {
        cardId: currentCard.id,
        front: currentCard.front,
        back: currentCard.back,
        conceptTag: currentCard.conceptTag,
        rating,
        timeSpentSeconds: timeSpent,
        flipsCount: Math.max(1, flipsOnCurrent),
        attemptsInSession: 1
      };

      const nextResults = [...results, cardResult];
      setResults(nextResults);
      setLastExitRating(rating);

      // Fire crazy radial particle burst + comic pop label!
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

      rawPointerX.set(0);
      rawPointerY.set(0);
      dragX.set(0);
      dragY.set(0);

      if (currentIndex + 1 >= cardsQueue.length) {
        finalizeSession(nextResults);
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
      cardsQueue.length,
      completedSession,
      currentCard,
      currentIndex,
      dragX,
      dragY,
      finalizeSession,
      flipsOnCurrent,
      rawPointerX,
      rawPointerY,
      results
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
      // Swipe-to-rate when answer is revealed (Right = Mastered, Left = Again)
      if (isFlipped) {
        if (info.offset.x > 125 || info.velocity.x > 650) {
          handleRate('mastered');
          return;
        }
        if (info.offset.x < -125 || info.velocity.x < -650) {
          handleRate('again');
          return;
        }
      }
    },
    [handleRate, isFlipped]
  );

  // Keyboard shortcuts: Space/Enter flip, H hint, 1/2/3/4 rate when flipped
  useEffect(() => {
    if (completedSession || showExitConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.key === 'Enter') {
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
  }, [completedSession, currentCard, handleFlip, handleRate, isFlipped, showExitConfirm]);

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
    setResults([]);
    setStreakCount(0);
    setCompletedSession(null);
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
        className="space-y-6 pb-8"
      >
        {/* Top Hero Report Banner */}
        <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[5px_5px_0px_#141413] dark:shadow-[5px_5px_0px_#ECD5FF] p-5 sm:p-8 overflow-hidden relative">
          <div
            className="absolute top-0 inset-x-0 h-1.5"
            style={{ backgroundColor: accentColor }}
          />

          <div className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-6">
            {/* Animated SVG Efficiency Ring */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 132 132">
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
                  <span className="font-heading text-3xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums leading-none">
                    <AnimatedNumber value={completedSession.efficiencyScore} suffix="%" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] mt-1">
                    Efficiency
                  </span>
                </div>
              </div>

              <div className="text-center sm:text-left space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${verdict.badgeBg}`}>
                    {verdict.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                    {completedSession.subjectName} · {completedSession.mode === 'weak-drill' ? 'Weak Drill' : 'Full Deck'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight">
                  {completedSession.deckTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] max-w-xl">
                  {verdict.subtitle}
                </p>
                {savingSession && (
                  <p className="text-[11px] font-mono text-[#0D47FF] dark:text-[#ECD5FF]">
                    Saving learning analytics to your Subject Archive...
                  </p>
                )}
                {saveError && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {saveError}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 shrink-0">
              {weakCount > 0 && (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => restartSession('weak-drill', completedSession.weakCardIds)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD426] text-[#141413] text-xs font-bold ink-btn-hard cursor-pointer"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Study Full Deck
              </motion.button>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING_SNAPPY}
                onClick={onViewHistory}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                Past Flashcards
              </motion.button>
            </div>
          </div>

          {/* 4 KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
            <div className="p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Retention Rate
              </p>
              <p className="font-heading text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {completedSession.retentionRatePct}%
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                {completedSession.masteredCount + completedSession.goodCount} of {completedSession.totalCards} recalled
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Avg Recall Speed
              </p>
              <p className="font-heading text-2xl font-black text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums mt-1">
                {completedSession.avgSecondsPerCard}s
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                Total {formatSeconds(completedSession.durationSeconds)} session
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Instant Mastery
              </p>
              <p className="font-heading text-2xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums mt-1">
                {completedSession.masteredCount}
              </p>
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">
                {completedSession.goodCount} solid · {completedSession.hardCount} partial
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                Weak Concepts
              </p>
              <p
                className={`font-heading text-2xl font-black tabular-nums mt-1 ${
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
            <div className="flex items-center justify-between text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] mb-2">
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
        <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                Card-by-Card Recall Breakdown
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                Inspect every concept tested, your self-rated mastery, and recall speed.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F3F0E0] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
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
                    className="p-4 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          #{idx + 1} · {item.conceptTag}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#141413] dark:text-[#FAF8EC] leading-snug">
                        {item.front}
                      </p>
                      <p className="text-xs text-[#66665E] dark:text-[#A3A399] leading-relaxed whitespace-pre-line">
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
  // ACTIVE 3D FLASHCARD STUDY THEATER
  // ============================================================================
  const progressPct = cardsQueue.length > 0 ? Math.round((currentIndex / cardsQueue.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_BUTTERY}
      className="max-w-4xl mx-auto space-y-5 pb-12"
    >
      {/* Top Study Session Header */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => (results.length > 0 ? setShowExitConfirm(true) : onClose())}
              className="w-9 h-9 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-center text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer shrink-0"
              aria-label="Exit study session"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                  {deck.subjectName} · {activeMode === 'weak-drill' ? 'Weak Cards Drill' : 'Active Recall'}
                </span>
              </div>
              <h2 className="font-heading text-sm sm:text-base font-black text-[#141413] dark:text-[#FAF8EC] truncate">
                {deck.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {streakCount >= 2 && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING_BOUNCY}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFD426] text-[#141413] border border-[#141413] text-[11px] font-mono font-bold tabular-nums"
              >
                <Flame className="w-3.5 h-3.5" />
                {streakCount} Streak
              </motion.div>
            )}

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
              <Target className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF]" />
              {results.length > 0 ? `${liveEfficiency}%` : '—'}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#66665E] dark:text-[#A3A399]" />
              {formatSeconds(elapsedSeconds)}
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleShuffleRemaining}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                isShuffled
                  ? 'bg-[#ECD5FF] text-[#141413] border-[#141413]'
                  : 'bg-[#FAF8EC] dark:bg-[#141413] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC]'
              }`}
              title="Shuffle remaining cards"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shuffle</span>
            </motion.button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#F3F0E0] dark:bg-[#242421] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accentColor }}
              initial={false}
              animate={{ width: `${Math.max(4, progressPct)}%` }}
              transition={SPRING_SNAPPY}
            />
          </div>
          <span className="font-mono text-[11px] font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums shrink-0">
            Card {currentIndex + 1} / {cardsQueue.length}
          </span>
        </div>
      </div>

      {/* Physical Spring-Loaded Stacked Deck + Crazy Bouncy Jiggly 3D Flashcard Theater */}
      <div className="relative pt-3 pb-4">
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
                  scale: [0.4, 1.18, 0.96, 1.08],
                  y: [16, -78, -94, -125],
                  rotate: [-8, 5, -2, 3]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className={`px-4 py-1.5 rounded-xl border-2 shadow-[4px_4px_0px_#141413] font-mono text-xs font-black uppercase tracking-wider ${activeBurst.badgeClass}`}
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
                      ? 'w-3 h-3 rounded-full'
                      : p.shape === 'diamond'
                        ? 'w-3 h-3 rounded-sm rotate-45'
                        : 'w-4 h-2 rounded-full'
                  }`}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Living Spring-Loaded Background Deck Cards (Hop & Jiggle on every flip/advance/shuffle!) */}
        {currentIndex + 2 < cardsQueue.length && (
          <motion.div
            key={`stack-back-2-${currentIndex}-${flipBounceTick}-${shuffleTick}`}
            aria-hidden="true"
            initial={{ y: 22, scale: 0.9, rotateZ: -3.5 }}
            animate={{ y: 18, scale: 0.93, rotateZ: isFlipped ? 2.4 : -2.2 }}
            transition={JELLY_SPRING}
            className="absolute inset-x-8 top-0 bottom-2 rounded-[30px] bg-[#F3F0E0] dark:bg-[#1A1A18] border-[1.5px] border-[#141413]/20 dark:border-[#FAF8EC]/15 opacity-70 pointer-events-none"
          />
        )}
        {currentIndex + 1 < cardsQueue.length && (
          <motion.div
            key={`stack-back-1-${currentIndex}-${flipBounceTick}-${shuffleTick}`}
            aria-hidden="true"
            initial={{ y: 18, scale: 0.93, rotateZ: 3 }}
            animate={{ y: 9, scale: 0.968, rotateZ: isFlipped ? -1.8 : 1.6 }}
            transition={JELLY_SPRING}
            className="absolute inset-x-4 top-1 bottom-1 rounded-[30px] bg-[#FAF8EC] dark:bg-[#22221F] border-[1.5px] border-[#141413]/30 dark:border-[#FAF8EC]/25 opacity-90 pointer-events-none shadow-[3px_3px_0px_rgba(20,20,19,0.12)]"
          />
        )}

        <AnimatePresence mode="popLayout" custom={lastExitRating}>
          {currentCard && (
            <motion.div
              key={`${currentCard.id}_${currentIndex}_${shuffleTick}`}
              custom={lastExitRating}
              initial={{
                opacity: 0,
                y: 54,
                scaleX: 0.84,
                scaleY: 1.12,
                rotateZ: -5
              }}
              animate={{
                opacity: 1,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotateZ: 0
              }}
              exit={getCardExitAnimation(lastExitRating)}
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
                dragElastic={0.44}
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
                whileHover={{ scale: 1.018 }}
                whileTap={{ scaleX: 1.03, scaleY: 0.965 }}
                className="fc-perspective cursor-grab active:cursor-grabbing relative"
              >
                {/* Live Drag-to-Rate Floating Stamps (Visible when dragging flipped card left/right) */}
                {isFlipped && (
                  <>
                    <motion.div
                      style={{ opacity: swipeRightStampOpacity }}
                      className="pointer-events-none absolute top-6 left-6 z-40 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white border-2 border-[#141413] shadow-[3px_3px_0px_#141413] font-mono text-xs font-black uppercase tracking-wider -rotate-12"
                    >
                      MASTERED! ⚡
                    </motion.div>
                    <motion.div
                      style={{ opacity: swipeLeftStampOpacity }}
                      className="pointer-events-none absolute top-6 right-6 z-40 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white border-2 border-[#141413] shadow-[3px_3px_0px_#141413] font-mono text-xs font-black uppercase tracking-wider rotate-12"
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
                      ? { scaleX: 1.09, scaleY: 0.91, y: -18, rotateZ: isFlipped ? -3 : 3 }
                      : false
                  }
                  animate={{ scaleX: 1, scaleY: 1, y: 0, rotateZ: 0 }}
                  transition={JELLY_SPRING}
                  className="fc-perspective"
                >
                  {/* Spring-Driven 3D Flipping Card Body (visibly overshoots 180deg with jelly bounce!) */}
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
                    className="fc-preserve-3d relative w-full select-none min-h-[365px] sm:min-h-[415px]"
                  >
                    {/* FRONT FACE (QUESTION / RECALL PROMPT) */}
                    <div className="fc-face absolute inset-0 rounded-[28px] bg-[#FFFFFF] dark:bg-[#1C1C1A] border-2 border-[#141413] dark:border-[#FAF8EC]/80 shadow-[7px_7px_0px_#141413] dark:shadow-[7px_7px_0px_#ECD5FF] p-6 sm:p-9 flex flex-col justify-between overflow-hidden">
                      {/* Dynamic Magnetic Light Sheen */}
                      <motion.div
                        aria-hidden="true"
                        style={{
                          left: sheenX,
                          top: sheenY
                        }}
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gradient-to-br from-[#ECD5FF]/35 via-[#FFD426]/15 to-transparent dark:from-[#ECD5FF]/15 dark:via-[#0D47FF]/12 blur-2xl opacity-75"
                      />

                      <div
                        className="absolute top-0 inset-x-0 h-2.5"
                        style={{ backgroundColor: accentColor }}
                      />

                      {/* Top metadata row */}
                      <div className="relative z-10 flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border"
                            style={{
                              backgroundColor: `${accentColor}16`,
                              borderColor: `${accentColor}40`,
                              color: accentColor
                            }}
                          >
                            {currentCard.conceptTag}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                            {currentCard.difficulty}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#66665E] dark:text-[#A3A399] tabular-nums">
                          PROMPT · {cardElapsedSeconds}s
                        </span>
                      </div>

                      {/* Center Question Body */}
                      <div className="relative z-10 my-auto py-6 text-center space-y-5">
                        <p className="font-heading text-xl sm:text-2xl lg:text-[26px] font-black text-[#141413] dark:text-[#FAF8EC] leading-snug tracking-tight max-w-2xl mx-auto">
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
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] text-xs font-bold text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] transition-colors cursor-pointer"
                              >
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                Show Retrieval Hint (H)
                              </motion.button>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0, y: 12, scaleX: 0.85, scaleY: 1.15 }}
                                animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                                transition={JELLY_SPRING}
                                className="max-w-xl px-4 py-2.5 rounded-xl bg-[#FFD426]/25 dark:bg-[#FFD426]/12 border border-[#FFD426]/60 text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC] font-medium"
                              >
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-[#FFD426] mr-2">
                                  Hint:
                                </span>
                                {currentCard.hint}
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Flip Cue */}
                      <div className="relative z-10 flex items-center justify-between pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          Wiggle, drag or tap to flip
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#0D47FF] dark:text-[#ECD5FF]">
                          <RotateCw className="w-3.5 h-3.5" />
                          Tap or press Space
                        </span>
                      </div>
                    </div>

                    {/* BACK FACE (ANSWER + MEMORY ANCHOR) */}
                    <div className="fc-face-back absolute inset-0 rounded-[28px] bg-[#FAF8EC] dark:bg-[#191917] border-2 border-[#0D47FF] dark:border-[#ECD5FF] shadow-[7px_7px_0px_#0D47FF] dark:shadow-[7px_7px_0px_#FFD426] p-6 sm:p-9 flex flex-col justify-between overflow-y-auto">
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                            VERIFIED ANSWER · {currentCard.conceptTag}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          Swipe L/R or tap to flip
                        </span>
                      </div>

                      <div className="my-auto py-4 space-y-4">
                        <p className="text-base sm:text-lg font-semibold text-[#141413] dark:text-[#FAF8EC] leading-relaxed whitespace-pre-line">
                          {currentCard.back}
                        </p>

                        {currentCard.mnemonic && (
                          <motion.div
                            initial={{ scale: 0.92, rotate: -1 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={JELLY_SPRING}
                            className="p-3.5 rounded-2xl bg-[#ECD5FF]/45 dark:bg-[#ECD5FF]/12 border border-[#141413]/20 dark:border-[#ECD5FF]/35 flex items-start gap-2.5"
                          >
                            <Sparkles className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0 mt-0.5" />
                            <div className="text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC]">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider block text-[#0D47FF] dark:text-[#ECD5FF] mb-0.5">
                                Memory Anchor
                              </span>
                              {currentCard.mnemonic}
                            </div>
                          </motion.div>
                        )}

                        {currentCard.sourceExcerpt && (
                          <p className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] italic border-l-2 border-[#0D47FF]/50 pl-3">
                            From notes: “{currentCard.sourceExcerpt}”
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
                        <span>Drag Right = Mastered · Drag Left = Again · Keys 1–4</span>
                        <span className="tabular-nums">{cardElapsedSeconds}s</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Interactive Jiggly Jelly Rating Dock */}
      <div className="min-h-[112px] flex items-center justify-center">
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
              className="w-full sm:w-auto min-w-[270px] px-8 py-4 rounded-2xl bg-[#0D47FF] text-white font-heading font-black text-sm sm:text-base ink-btn-hard flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              Flip & Check Answer
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/20 uppercase">
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
              className="w-full space-y-2.5"
            >
              <p className="text-center font-mono text-[10px] uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                How accurately did you recall this concept?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {RATING_META.map((opt, idx) => (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, y: 24, scaleX: 0.84, scaleY: 1.16 }}
                    animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                    transition={{ ...JELLY_SPRING, delay: idx * 0.045 }}
                    whileHover={{
                      y: -6,
                      scaleX: 1.07,
                      scaleY: 0.94,
                      rotate: idx % 2 === 0 ? -2.2 : 2.2
                    }}
                    whileTap={{ scaleX: 0.9, scaleY: 1.12, y: 2 }}
                    onClick={() => handleRate(opt.key)}
                    className={`p-3.5 rounded-2xl border-[1.5px] text-left transition-colors cursor-pointer group ${opt.bgClass} ${opt.borderClass}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-heading text-sm font-black">
                        {opt.label}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                        {opt.shortcut}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] opacity-85">
                      <span>{opt.sublabel}</span>
                      <span className="font-mono font-bold tabular-nums">{opt.weight}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Exit Confirmation Modal */}
      <MotionModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        maxWidthClass="max-w-md"
      >
        <div className="rounded-2xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                End Study Session Early?
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
                You have reviewed {results.length} of {cardsQueue.length} cards. Leaving now will not log a completed efficiency report.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowExitConfirm(false)}
              className="px-4 py-2 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] cursor-pointer"
            >
              Keep Studying
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExitConfirm(false);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold ink-btn-hard cursor-pointer"
            >
              Exit Session
            </button>
          </div>
        </div>
      </MotionModal>
    </motion.div>
  );
}
