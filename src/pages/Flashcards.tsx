import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Layers,
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Play,
  Flame,
  History,
  BookOpen,
  Trash2,
  Eye,
  Clock,
  Target,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  RotateCw,
  FolderOpen,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../firebase';
import { useSubject } from '../context/SubjectContext';
import {
  FlashcardDeck,
  FlashcardSession,
  SubjectNote,
  Subject
} from '../types';
import {
  sanitizeForFirestore,
  isSyncDocument,
  handleFirestoreError,
  OperationType
} from '../utils/firestore';
import { getApiUrl } from '../utils/api';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { FlashcardStudyPlayer } from '../components/flashcards/FlashcardStudyPlayer';
import { FuturisticScreenLoader, FuturisticSpinner } from '../components/FuturisticLoader';
import {
  MotionPage,
  MotionSection,
  MotionStaggerGrid,
  MotionStaggerItem,
  MotionModal,
  AnimatedNumber,
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_BUTTERY
} from '../components/MotionPrimitives';

type ActiveTab = 'create' | 'decks' | 'history';

interface UploadedPreviewFile {
  id: string;
  file: File;
  previewUrl?: string;
  isImage: boolean;
  isPdf: boolean;
}

const ACCEPTED_MIME_EXT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,image/gif';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getEfficiencyBadgeStyle(score: number): string {
  if (score >= 85) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40';
  }
  if (score >= 70) {
    return 'bg-[#0D47FF]/12 text-[#0D47FF] dark:text-[#93C5FD] border-[#0D47FF]/35';
  }
  if (score >= 50) {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40';
  }
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40';
}

// Downscale large screenshots/camera note photos to crisp 1500px JPEG for 5-10x faster upload & multimodal OCR
async function compressImageForFastUpload(file: File): Promise<File> {
  const isCompressibleImage =
    file.type.startsWith('image/') &&
    file.type !== 'image/gif' &&
    file.size > 320 * 1024;
  if (!isCompressibleImage) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const MAX_DIM = 1500;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          resolve(file);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objUrl);
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.8
        );
      } catch {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(file);
    };
    img.src = objUrl;
  });
}

export function Flashcards({ user }: { user: User }) {
  const { subjects, activeSubject } = useSubject();
  const [searchParams, setSearchParams] = useSearchParams();

  const usableSubjects = useMemo(
    () => subjects.filter((s) => s.slug !== 'uncategorized'),
    [subjects]
  );

  // Tab state synced with URL ?tab=create|decks|history
  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialTabParam === 'history' || initialTabParam === 'decks' || initialTabParam === 'create'
      ? initialTabParam
      : 'create'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'history' || t === 'decks' || t === 'create') {
      setActiveTab(t);
    }
  }, [searchParams]);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Firestore real-time state
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [sessions, setSessions] = useState<FlashcardSession[]>([]);
  const [savedNotes, setSavedNotes] = useState<SubjectNote[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Create Studio state
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string>(
    searchParams.get('subject') || activeSubject?.slug || usableSubjects[0]?.slug || 'general-awareness'
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPreviewFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedSavedNoteIds, setSelectedSavedNoteIds] = useState<string[]>([]);
  const [extraNotesText, setExtraNotesText] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [cardCount, setCardCount] = useState<number>(12);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Moderate' | 'Hard'>('Moderate');
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Study Session state
  const [studyingState, setStudyingState] = useState<{
    deck: FlashcardDeck;
    mode: 'full' | 'weak-drill';
    subsetCardIds?: string[];
  } | null>(null);

  // Decks & History filters + modals
  const [decksSubjectFilter, setDecksSubjectFilter] = useState<string>('all');
  const [decksSearch, setDecksSearch] = useState('');
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [collapsedHistorySubjects, setCollapsedHistorySubjects] = useState<Record<string, boolean>>({});

  const [previewDeck, setPreviewDeck] = useState<FlashcardDeck | null>(null);
  const [inspectSession, setInspectSession] = useState<FlashcardSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'deck' | 'session';
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ensure valid default subject
  useEffect(() => {
    if (usableSubjects.length > 0 && !usableSubjects.some((s) => s.slug === selectedSubjectSlug)) {
      setSelectedSubjectSlug(usableSubjects[0].slug);
    }
  }, [usableSubjects, selectedSubjectSlug]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [uploadedFiles]);

  // Real-time Firestore subscriptions for Decks, Sessions, and Saved Notes
  useEffect(() => {
    let loadedDecks = false;
    let loadedSessions = false;

    const finishCheck = () => {
      if (loadedDecks && loadedSessions) {
        setLoadingData(false);
      }
    };

    const unsubDecks = onSnapshot(
      query(collection(db, 'flashcardDecks'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .filter((d) => !isSyncDocument(d.id, d.data()))
          .map((d) => ({ id: d.id, ...d.data() })) as FlashcardDeck[];
        list.sort((a, b) => (b.lastStudiedAt || b.createdAt) - (a.lastStudiedAt || a.createdAt));
        setDecks(list);
        loadedDecks = true;
        finishCheck();
      },
      (err) => {
        console.error('Error loading flashcard decks:', err);
        loadedDecks = true;
        finishCheck();
      }
    );

    const unsubSessions = onSnapshot(
      query(collection(db, 'flashcardSessions'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .filter((d) => !isSyncDocument(d.id, d.data()))
          .map((d) => ({ id: d.id, ...d.data() })) as FlashcardSession[];
        list.sort((a, b) => b.completedAt - a.completedAt);
        setSessions(list);
        loadedSessions = true;
        finishCheck();
      },
      (err) => {
        console.error('Error loading flashcard sessions:', err);
        loadedSessions = true;
        finishCheck();
      }
    );

    const unsubNotes = onSnapshot(
      query(collection(db, 'notes'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .filter((d) => !isSyncDocument(d.id, d.data()))
          .map((d) => ({ id: d.id, ...d.data() })) as SubjectNote[];
        list.sort((a, b) => b.uploadedAt - a.uploadedAt);
        setSavedNotes(list);
      },
      () => {}
    );

    return () => {
      unsubDecks();
      unsubSessions();
      unsubNotes();
    };
  }, [user.uid]);

  const subjectBySlug = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.slug, s));
    return map;
  }, [subjects]);

  const deckById = useMemo(() => {
    const map = new Map<string, FlashcardDeck>();
    decks.forEach((d) => map.set(d.id, d));
    return map;
  }, [decks]);

  const selectedSubject = useMemo(
    () => subjectBySlug.get(selectedSubjectSlug) || usableSubjects[0],
    [selectedSubjectSlug, subjectBySlug, usableSubjects]
  );

  const subjectSavedNotes = useMemo(
    () => savedNotes.filter((n) => n.subjectSlug === selectedSubject?.slug),
    [savedNotes, selectedSubject]
  );

  // Add files handler (PDF, PNG, JPG, WebP, GIF, TXT)
  const appendFiles = (fileList: FileList | File[]) => {
    setCreateError(null);
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const nextItems: UploadedPreviewFile[] = [];
    for (const file of incoming) {
      if (uploadedFiles.length + nextItems.length >= 8) {
        setCreateError('Maximum 8 note files can be combined per flashcard deck.');
        break;
      }
      if (file.size > 25 * 1024 * 1024) {
        setCreateError(`"${file.name}" exceeds the 25MB limit.`);
        continue;
      }
      const lower = file.name.toLowerCase();
      const isImage =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(lower);
      const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
      const isText = file.type.startsWith('text/') || /\.(txt|md)$/.test(lower);

      if (!isImage && !isPdf && !isText) {
        setCreateError(`"${file.name}" is not a supported format. Upload PDF, PNG, JPG, WebP, GIF, or TXT notes.`);
        continue;
      }

      nextItems.push({
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        isImage,
        isPdf
      });
    }

    if (nextItems.length > 0) {
      setUploadedFiles((prev) => [...prev, ...nextItems]);
    }
  };

  const removeUploadedFile = (id: string) => {
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Generate Flashcards from uploaded PDFs / Images / Notes
  const handleGenerateFlashcards = async () => {
    if (!selectedSubject || generating) return;

    const selectedNotesCombined = subjectSavedNotes
      .filter((n) => selectedSavedNoteIds.includes(n.id))
      .map((n) => `[Saved Note: ${n.fileName}]\n${n.extractedText}`)
      .join('\n\n');

    const fullTextContext = [selectedNotesCombined, extraNotesText.trim()]
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (uploadedFiles.length === 0 && fullTextContext.length < 20) {
      setCreateError('Upload at least one PDF or image note (PNG, JPG, WebP, GIF), pick a saved note, or paste study text.');
      return;
    }

    setGenerating(true);
    setCreateError(null);
    setGenerationStage('Optimizing notes for rapid analysis...');

    const stageTimer1 = setTimeout(
      () => setGenerationStage(`Synthesizing ${cardCount} active-recall flashcards...`),
      1200
    );
    const stageTimer2 = setTimeout(
      () => setGenerationStage('Finalizing your interactive 3D deck...'),
      3200
    );

    try {
      const optimizedFiles = await Promise.all(
        uploadedFiles.map(async (item) => {
          const prepared = item.isImage ? await compressImageForFastUpload(item.file) : item.file;
          return { file: prepared, originalName: item.file.name };
        })
      );

      const formData = new FormData();
      optimizedFiles.forEach(({ file }) => {
        formData.append('files', file, file.name);
      });
      formData.append('subjectName', selectedSubject.name);
      formData.append('subjectSlug', selectedSubject.slug);
      formData.append('topic', topicInput.trim());
      formData.append('cardCount', String(cardCount));
      formData.append('difficulty', difficulty);
      if (fullTextContext) {
        formData.append('extraNotesText', fullTextContext.slice(0, 28000));
      }

      const response = await fetch(getApiUrl('/api/generate-flashcards'), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate flashcards from your notes.');
      }

      if (!Array.isArray(data.cards) || data.cards.length === 0) {
        throw new Error('No flashcards could be extracted from these notes. Try clearer images or notes.');
      }

      const deckId = `fcd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sourceFileNames = [
        ...uploadedFiles.map((f) => f.file.name),
        ...subjectSavedNotes
          .filter((n) => selectedSavedNoteIds.includes(n.id))
          .map((n) => n.fileName)
      ];
      if (sourceFileNames.length === 0) {
        sourceFileNames.push('Pasted Study Notes');
      }

      const sourceFileTypes: string[] = Array.from(
        new Set<string>(
          uploadedFiles.map((f) => (f.isPdf ? 'PDF' : f.isImage ? 'IMAGE' : 'TEXT')).concat(
            selectedSavedNoteIds.length > 0 ? ['SAVED_NOTE'] : [],
            extraNotesText.trim() && uploadedFiles.length === 0 && selectedSavedNoteIds.length === 0
              ? ['TEXT']
              : []
          )
        )
      );

      const newDeck: FlashcardDeck = {
        id: deckId,
        userId: user.uid,
        subjectId: selectedSubject.id,
        subjectSlug: selectedSubject.slug,
        subjectName: selectedSubject.name,
        title: String(data.title || `${selectedSubject.name} Study Deck`).slice(0, 220),
        topic: String(data.topic || topicInput.trim() || selectedSubject.name).slice(0, 220),
        sourceFileNames: sourceFileNames.slice(0, 15),
        sourceFileTypes: sourceFileTypes.slice(0, 10),
        cardCount: data.cards.length,
        cards: data.cards,
        createdAt: Date.now(),
        totalSessions: 0,
        bestEfficiency: 0
      };

      // Persist deck asynchronously so the 3D Study Player opens instantaneously with zero extra wait
      const { id: _ignore, ...firestoreDeck } = newDeck;
      setDecks((prev) => [newDeck, ...prev]);
      setDoc(doc(db, 'flashcardDecks', deckId), sanitizeForFirestore(firestoreDeck)).catch((err) => {
        console.error('Background flashcard deck save failed:', err);
        try {
          handleFirestoreError(err, OperationType.WRITE, `flashcardDecks/${deckId}`, user);
        } catch {
          // logged
        }
      });

      // Clear upload staging & launch straight into 3D Study Player!
      uploadedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setUploadedFiles([]);
      setSelectedSavedNoteIds([]);
      setExtraNotesText('');
      setTopicInput('');

      setStudyingState({ deck: newDeck, mode: 'full' });
    } catch (err: any) {
      console.error('Flashcard generation failed:', err);
      try {
        if (err?.code) {
          handleFirestoreError(err, OperationType.WRITE, 'flashcardDecks', user);
        }
      } catch {
        // logged
      }
      setCreateError(err?.message || 'Unable to generate flashcards right now. Please try again.');
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setGenerating(false);
      setGenerationStage('');
    }
  };

  // Delete Deck or Session
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const colName = deleteTarget.kind === 'deck' ? 'flashcardDecks' : 'flashcardSessions';
      await deleteDoc(doc(db, colName, deleteTarget.id));
      if (deleteTarget.kind === 'deck') {
        setDecks((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete flashcard record:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Start re-study from a past session (uses saved deck or reconstructs cards from session cardResults!)
  const launchFromPastSession = (session: FlashcardSession, mode: 'full' | 'weak-drill') => {
    const existingDeck = deckById.get(session.deckId);
    const fallbackDeck: FlashcardDeck = existingDeck || {
      id: session.deckId,
      userId: session.userId,
      subjectId: session.subjectId,
      subjectSlug: session.subjectSlug,
      subjectName: session.subjectName,
      title: session.deckTitle,
      topic: session.topic,
      sourceFileNames: ['Archived Session'],
      sourceFileTypes: ['ARCHIVE'],
      cardCount: session.cardResults.length,
      cards: session.cardResults.map((cr) => ({
        id: cr.cardId,
        front: cr.front,
        back: cr.back,
        conceptTag: cr.conceptTag,
        difficulty: 'Moderate'
      })),
      createdAt: session.startedAt
    };

    setInspectSession(null);
    setStudyingState({
      deck: fallbackDeck,
      mode,
      subsetCardIds: mode === 'weak-drill' ? session.weakCardIds : undefined
    });
  };

  // Aggregate KPIs across all past sessions
  const globalStats = useMemo(() => {
    const totalSessions = sessions.length;
    const avgEfficiency =
      totalSessions > 0
        ? Math.round(sessions.reduce((acc, s) => acc + (s.efficiencyScore || 0), 0) / totalSessions)
        : 0;
    const totalMastered = sessions.reduce((acc, s) => acc + (s.masteredCount || 0), 0);
    const avgSpeed =
      totalSessions > 0
        ? Number(
            (
              sessions.reduce((acc, s) => acc + (s.avgSecondsPerCard || 0), 0) / totalSessions
            ).toFixed(1)
          )
        : 0;
    return { totalSessions, avgEfficiency, totalMastered, avgSpeed };
  }, [sessions]);

  // Subject-wise grouped decks
  const groupedDecks = useMemo(() => {
    const filtered = decks.filter((d) => {
      if (decksSubjectFilter !== 'all' && d.subjectSlug !== decksSubjectFilter) return false;
      if (decksSearch.trim()) {
        const q = decksSearch.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.topic.toLowerCase().includes(q) ||
          d.subjectName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const groups = new Map<
      string,
      {
        subjectSlug: string;
        subjectName: string;
        subject?: Subject;
        decks: FlashcardDeck[];
        totalCards: number;
        bestEfficiency: number;
      }
    >();

    filtered.forEach((deck) => {
      const sub = subjectBySlug.get(deck.subjectSlug);
      const existing = groups.get(deck.subjectSlug) || {
        subjectSlug: deck.subjectSlug,
        subjectName: sub?.name || deck.subjectName,
        subject: sub,
        decks: [],
        totalCards: 0,
        bestEfficiency: 0
      };
      existing.decks.push(deck);
      existing.totalCards += deck.cardCount || deck.cards?.length || 0;
      existing.bestEfficiency = Math.max(existing.bestEfficiency, deck.bestEfficiency || 0);
      groups.set(deck.subjectSlug, existing);
    });

    return Array.from(groups.values());
  }, [decks, decksSubjectFilter, decksSearch, subjectBySlug]);

  // Subject-wise grouped past sessions (History & Results)
  const groupedHistory = useMemo(() => {
    const filtered = sessions.filter((s) => {
      if (historySubjectFilter !== 'all' && s.subjectSlug !== historySubjectFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return (
          s.deckTitle.toLowerCase().includes(q) ||
          s.topic.toLowerCase().includes(q) ||
          s.subjectName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const groups = new Map<
      string,
      {
        subjectSlug: string;
        subjectName: string;
        subject?: Subject;
        sessions: FlashcardSession[];
        avgEfficiency: number;
        avgRetention: number;
        totalCardsReviewed: number;
      }
    >();

    filtered.forEach((sess) => {
      const sub = subjectBySlug.get(sess.subjectSlug);
      const existing = groups.get(sess.subjectSlug) || {
        subjectSlug: sess.subjectSlug,
        subjectName: sub?.name || sess.subjectName,
        subject: sub,
        sessions: [],
        avgEfficiency: 0,
        avgRetention: 0,
        totalCardsReviewed: 0
      };
      existing.sessions.push(sess);
      existing.totalCardsReviewed += sess.totalCards;
      groups.set(sess.subjectSlug, existing);
    });

    const result = Array.from(groups.values()).map((g) => {
      const count = g.sessions.length || 1;
      g.avgEfficiency = Math.round(
        g.sessions.reduce((acc, s) => acc + s.efficiencyScore, 0) / count
      );
      g.avgRetention = Math.round(
        g.sessions.reduce((acc, s) => acc + s.retentionRatePct, 0) / count
      );
      return g;
    });

    // Sort groups by most recent session activity
    result.sort(
      (a, b) => (b.sessions[0]?.completedAt || 0) - (a.sessions[0]?.completedAt || 0)
    );
    return result;
  }, [sessions, historySubjectFilter, historySearch, subjectBySlug]);

  // Subject-wise comparison chart data
  const subjectEfficiencyChartData = useMemo(() => {
    const map = new Map<
      string,
      { slug: string; name: string; color: string; effSum: number; retSum: number; count: number }
    >();
    sessions.forEach((s) => {
      const sub = subjectBySlug.get(s.subjectSlug);
      const shortLabel = (sub?.name || s.subjectName)
        .replace('Economic & Social Issues', 'ESI')
        .replace('Finance & Management', 'FM')
        .replace('General Awareness', 'GA')
        .replace('Quantitative Aptitude', 'Quant')
        .replace('Reasoning Aptitude', 'Reasoning')
        .replace('English Language', 'English')
        .replace('English Writing Skills', 'Eng Writing');

      const entry = map.get(s.subjectSlug) || {
        slug: s.subjectSlug,
        name: shortLabel,
        color: sub?.accentColor || '#0D47FF',
        effSum: 0,
        retSum: 0,
        count: 0
      };
      entry.effSum += s.efficiencyScore;
      entry.retSum += s.retentionRatePct;
      entry.count += 1;
      map.set(s.subjectSlug, entry);
    });

    return Array.from(map.values()).map((v) => ({
      name: v.name,
      efficiency: Math.round(v.effSum / v.count),
      retention: Math.round(v.retSum / v.count),
      sessions: v.count,
      color: v.color
    }));
  }, [sessions, subjectBySlug]);

  const exportHistoryCsv = () => {
    if (sessions.length === 0) return;
    const headers = [
      'Date',
      'Subject',
      'Deck Title',
      'Topic',
      'Mode',
      'Efficiency %',
      'Retention %',
      'Total Cards',
      'Mastered',
      'Good',
      'Hard',
      'Again',
      'Avg Sec/Card',
      'Duration (s)'
    ];
    const rows = sessions.map((s) => [
      format(new Date(s.completedAt), 'yyyy-MM-dd HH:mm'),
      `"${s.subjectName.replace(/"/g, '""')}"`,
      `"${s.deckTitle.replace(/"/g, '""')}"`,
      `"${s.topic.replace(/"/g, '""')}"`,
      s.mode,
      s.efficiencyScore,
      s.retentionRatePct,
      s.totalCards,
      s.masteredCount,
      s.goodCount,
      s.hardCount,
      s.againCount,
      s.avgSecondsPerCard,
      s.durationSeconds
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rbi-flashcards-efficiency-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadingData) {
    return (
      <div className="py-20 flex items-center justify-center">
        <FuturisticScreenLoader
          title="Flashcards Studio"
          subtitle="SYNCING SUBJECT DECKS & EFFICIENCY ARCHIVE..."
          color="cobalt"
        />
      </div>
    );
  }

  // Render full-focus 3D Study Player when active
  if (studyingState) {
    const studyAccent =
      subjectBySlug.get(studyingState.deck.subjectSlug)?.accentColor || '#0D47FF';

    return (
      <MotionPage className="max-w-6xl mx-auto pt-2 pb-16">
        <FlashcardStudyPlayer
          user={user}
          deck={studyingState.deck}
          accentColor={studyAccent}
          mode={studyingState.mode}
          subsetCardIds={studyingState.subsetCardIds}
          onClose={() => setStudyingState(null)}
          onViewHistory={() => {
            setStudyingState(null);
            switchTab('history');
          }}
        />
      </MotionPage>
    );
  }

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: 'create', label: 'Upload & Generate', icon: Sparkles },
    { id: 'decks', label: 'My Decks', icon: Layers, count: decks.length },
    { id: 'history', label: 'Past Flashcards & Results', icon: History, count: sessions.length }
  ];

  return (
    <MotionPage className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pt-1 sm:pt-2 pb-16 relative z-10">
      {/* 1. Editorial Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
        <div>
          <p className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399] mb-1.5">
            ACTIVE RECALL ENGINE · MULTIMODAL NOTES TO MEMORY MASTERY
          </p>
          <h1 className="text-3xl sm:text-5xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight leading-[1.06]">
            Flashcards{' '}
            <span className="font-editorial-italic text-[#0D47FF] dark:text-[#ECD5FF] font-normal">
              Studio.
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] mt-2 max-w-2xl">
            Upload handwritten or printed notes (PDF, PNG, JPG, WebP, GIF) to generate interactive 3D recall flashcards, measure your true learning efficiency, and track subject-wise retention over time.
          </p>
        </div>

        {/* Quick Global Efficiency Pill Summary */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
              Decks
            </span>
            <span className="font-heading text-xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums">
              <AnimatedNumber value={decks.length} />
            </span>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
              Avg Efficiency
            </span>
            <span className="font-heading text-xl font-black text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums">
              {globalStats.totalSessions > 0 ? (
                <AnimatedNumber value={globalStats.avgEfficiency} suffix="%" />
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
              Mastered
            </span>
            <span className="font-heading text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              <AnimatedNumber value={globalStats.totalMastered} />
            </span>
          </div>
        </div>
      </div>

      {/* 2. Animated Segmented Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#F3F0E0] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/50 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`relative flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#FAF8EC] dark:text-[#141413]'
                  : 'text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="flashcards-main-tab"
                  transition={SPRING_BOUNCY}
                  className="absolute inset-0 rounded-xl bg-[#141413] dark:bg-[#ECD5FF] shadow-sm"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-white/20 dark:bg-black/15'
                        : 'bg-[#E5E1CE] dark:bg-[#2E2E2A]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================
          TAB 1: UPLOAD NOTES (PDF / PNG / IMAGES) & GENERATE FLASHCARDS
      ======================================================================== */}
      <AnimatePresence mode="wait">
        {activeTab === 'create' && (
          <motion.div
            key="tab-create"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_BUTTERY}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left Column: Subject Selector + Multimodal File Upload Dropzone */}
            <div className="lg:col-span-7 space-y-5">
              {/* Step 1: Select Subject */}
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                      STEP 01 · SUBJECT CLASSIFICATION
                    </span>
                    <h2 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                      Choose RBI Grade B Subject
                    </h2>
                  </div>
                  {selectedSubject && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                      {selectedSubject.phase}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {usableSubjects.map((sub) => {
                    const isSelected = sub.slug === selectedSubject?.slug;
                    return (
                      <motion.button
                        key={sub.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING_SNAPPY}
                        onClick={() => {
                          setSelectedSubjectSlug(sub.slug);
                          setSelectedSavedNoteIds([]);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-[1.5px] text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FAF8EC] dark:bg-[#242421] border-[#141413] dark:border-[#ECD5FF] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#ECD5FF]'
                            : 'bg-[#FAF8EC]/50 dark:bg-[#141413]/60 border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413]/50'
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${sub.accentColor}18`,
                            borderColor: `${sub.accentColor}45`,
                            color: sub.accentColor
                          }}
                        >
                          <SubjectIcon name={sub.icon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-[#141413] dark:text-[#FAF8EC] truncate">
                            {sub.name}
                          </p>
                          <p className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399]">
                            {sub.phase} · {sub.totalMarks} Marks
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 shrink-0"
                            style={{ color: sub.accentColor }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Multimodal Notes Upload (PDF, PNG, JPG, WebP, GIF) */}
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-5 sm:p-6 space-y-4">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                    STEP 02 · UPLOAD STUDY MATERIAL
                  </span>
                  <h2 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                    Drop PDF Notes, Screenshots or Handwritten Photos
                  </h2>
                </div>

                {/* Drag & Drop Target */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files) appendFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`relative rounded-2xl border-2 border-dashed p-7 sm:p-9 text-center transition-all cursor-pointer ${
                    isDragOver
                      ? 'border-[#0D47FF] bg-[#0D47FF]/8 dark:bg-[#ECD5FF]/10 scale-[1.01]'
                      : 'border-[#141413]/35 dark:border-[#FAF8EC]/25 bg-[#FAF8EC] dark:bg-[#141413] hover:border-[#0D47FF] dark:hover:border-[#ECD5FF]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_MIME_EXT}
                    onChange={(e) => {
                      if (e.target.files) appendFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  <motion.div
                    animate={isDragOver ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
                    transition={SPRING_BOUNCY}
                    className="w-14 h-14 mx-auto rounded-2xl bg-[#ECD5FF] dark:bg-[#0D47FF] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 flex items-center justify-center text-[#141413] dark:text-white shadow-[3px_3px_0px_#141413] mb-3.5"
                  >
                    <Upload className="w-6 h-6" />
                  </motion.div>

                  <p className="font-heading text-base font-black text-[#141413] dark:text-[#FAF8EC]">
                    Click to browse or drag notes here
                  </p>
                  <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
                    Supports <strong className="text-[#141413] dark:text-[#FAF8EC]">PDF, PNG, JPG, JPEG, WebP, GIF, BMP, TXT</strong> · Up to 8 files (25MB each)
                  </p>
                </div>

                {/* Live Uploaded File Previews (Thumbnails for Images + Cards for PDFs) */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
                      <span className="uppercase tracking-wider font-bold">
                        Attached Files ({uploadedFiles.length}/8)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          uploadedFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
                          setUploadedFiles([]);
                        }}
                        className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer font-bold"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <AnimatePresence>
                        {uploadedFiles.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.92, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={SPRING_SNAPPY}
                            className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]"
                          >
                            {item.isImage && item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="w-12 h-12 rounded-xl object-cover border border-[#141413]/20 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-[#0D47FF]/12 text-[#0D47FF] dark:text-[#ECD5FF] flex items-center justify-center shrink-0 border border-[#0D47FF]/25">
                                {item.isPdf ? (
                                  <FileText className="w-5 h-5" />
                                ) : (
                                  <ImageIcon className="w-5 h-5" />
                                )}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] truncate">
                                {item.file.name}
                              </p>
                              <p className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399]">
                                {item.isPdf ? 'PDF' : item.isImage ? 'IMAGE' : 'TEXT'} ·{' '}
                                {formatBytes(item.file.size)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeUploadedFile(item.id)}
                              className="p-1.5 rounded-lg text-[#66665E] hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer shrink-0"
                              aria-label={`Remove ${item.file.name}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Optional: Attach existing saved Subject Notes from Firestore */}
                {subjectSavedNotes.length > 0 && (
                  <div className="pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                      Or Attach Saved {selectedSubject?.name} Notes ({subjectSavedNotes.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {subjectSavedNotes.slice(0, 6).map((note) => {
                        const checked = selectedSavedNoteIds.includes(note.id);
                        return (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() =>
                              setSelectedSavedNoteIds((prev) =>
                                prev.includes(note.id)
                                  ? prev.filter((id) => id !== note.id)
                                  : [...prev, note.id]
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                              checked
                                ? 'bg-[#0D47FF] text-white border-[#141413]'
                                : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413]'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[180px]">{note.fileName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Deck Calibration + Extra Notes + Launch CTA */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] p-5 sm:p-6 space-y-5">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                    STEP 03 · DECK CALIBRATION
                  </span>
                  <h2 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                    Customize Flashcards & Recall Depth
                  </h2>
                </div>

                {/* Focus Topic */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                    Chapter / Topic Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g., Basel III Norms, Monetary Policy Committee, BoP..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] focus:outline-none text-xs sm:text-sm text-[#141413] dark:text-[#FAF8EC]"
                  />
                </div>

                {/* Card Count Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                      Number of Flashcards
                    </label>
                    <span className="font-mono text-xs font-bold text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums">
                      {cardCount} Cards
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[8, 12, 16, 20].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setCardCount(cnt)}
                        className={`py-2.5 rounded-xl font-mono text-xs font-bold border-[1.5px] transition-all cursor-pointer tabular-nums ${
                          cardCount === cnt
                            ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413] border-[#141413] shadow-[2px_2px_0px_#0D47FF]'
                            : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#66665E] dark:text-[#A3A399] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-2">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                    Recall Rigor
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Easy', 'Moderate', 'Hard'] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`py-2.5 rounded-xl text-xs font-bold border-[1.5px] transition-all cursor-pointer ${
                          difficulty === diff
                            ? diff === 'Hard'
                              ? 'bg-[#FFD426] text-[#141413] border-[#141413] shadow-[2px_2px_0px_#141413]'
                              : 'bg-[#0D47FF] text-white border-[#141413] shadow-[2px_2px_0px_#141413]'
                            : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#66665E] dark:text-[#A3A399] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413]'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Paste Extra Notes */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                    Additional Typed / Pasted Notes (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={extraNotesText}
                    onChange={(e) => setExtraNotesText(e.target.value)}
                    placeholder="Paste key bullet points, RBI circular highlights, or formulas here (works alongside or without uploaded files)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] focus:outline-none text-xs text-[#141413] dark:text-[#FAF8EC] resize-none"
                  />
                </div>

                {/* Error Notice */}
                {createError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/35 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{createError}</span>
                  </motion.div>
                )}

                {/* Generate CTA */}
                <motion.button
                  whileHover={!generating ? { y: -2 } : undefined}
                  whileTap={!generating ? { scale: 0.97 } : undefined}
                  transition={SPRING_SNAPPY}
                  type="button"
                  disabled={generating}
                  onClick={handleGenerateFlashcards}
                  className="w-full py-4 px-5 rounded-2xl bg-[#0D47FF] disabled:opacity-75 text-white font-heading font-black text-sm sm:text-base ink-btn-hard flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {generating ? (
                    <>
                      <FuturisticSpinner size="sm" color="white" />
                      <span>{generationStage || 'Generating Flashcards...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate & Start 3D Flashcards</span>
                    </>
                  )}
                </motion.button>

                {/* How Efficiency Works Mini-Card */}
                <div className="p-3.5 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] space-y-1.5">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF8EC] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF]" />
                    Learning Efficiency Telemetry
                  </p>
                  <p className="text-[11px] text-[#66665E] dark:text-[#A3A399] leading-relaxed">
                    Every session computes your <strong className="text-[#141413] dark:text-[#FAF8EC]">Efficiency Score (0–100%)</strong> from active recall accuracy, recall latency, and flip count—automatically isolating weak cards for 1-click re-drills.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================================
            TAB 2: MY FLASHCARD DECKS (SUBJECT-WISE LIBRARY)
        ======================================================================== */}
        {activeTab === 'decks' && (
          <motion.div
            key="tab-decks"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_BUTTERY}
            className="space-y-6"
          >
            {/* Subject Filter Chips + Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setDecksSubjectFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                    decksSubjectFilter === 'all'
                      ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413] border-[#141413]'
                      : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#66665E] dark:text-[#A3A399] border-[#E5E1CE] dark:border-[#2E2E2A]'
                  }`}
                >
                  All Subjects ({decks.length})
                </button>
                {usableSubjects.map((sub) => {
                  const count = decks.filter((d) => d.subjectSlug === sub.slug).length;
                  if (count === 0) return null;
                  const active = decksSubjectFilter === sub.slug;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDecksSubjectFilter(sub.slug)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0D47FF] text-white border-[#141413]'
                          : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: active ? '#FFD426' : sub.accentColor }}
                      />
                      <span>{sub.name}</span>
                      <span className="font-mono text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-64 shrink-0">
                <Search className="w-4 h-4 text-[#66665E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={decksSearch}
                  onChange={(e) => setDecksSearch(e.target.value)}
                  placeholder="Search deck title or topic..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF]"
                />
              </div>
            </div>

            {groupedDecks.length === 0 ? (
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-dashed border-[#141413]/30 dark:border-[#FAF8EC]/25 p-12 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ECD5FF] dark:bg-[#242421] flex items-center justify-center text-[#141413] dark:text-[#ECD5FF]">
                  <Layers className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-black text-[#141413] dark:text-[#FAF8EC]">
                    No Flashcard Decks Yet
                  </h3>
                  <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] mt-1 max-w-md mx-auto">
                    Upload your first PDF or screenshot note to synthesize interactive flashcards organized by RBI Grade B subject.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => switchTab('create')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create First Flashcard Deck
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedDecks.map((group) => {
                  const accent = group.subject?.accentColor || '#0D47FF';
                  return (
                    <MotionSection key={group.subjectSlug} className="space-y-3.5">
                      {/* Subject Section Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border"
                            style={{
                              backgroundColor: `${accent}18`,
                              borderColor: `${accent}45`,
                              color: accent
                            }}
                          >
                            <SubjectIcon name={group.subject?.icon || 'BookOpen'} className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                              {group.subjectName}
                            </h3>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                              {group.decks.length} {group.decks.length === 1 ? 'Deck' : 'Decks'} · {group.totalCards} Total Cards
                            </p>
                          </div>
                        </div>

                        {group.bestEfficiency > 0 && (
                          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            Best Efficiency: {group.bestEfficiency}%
                          </span>
                        )}
                      </div>

                      {/* Subject's Deck Cards Grid */}
                      <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.decks.map((deck, deckIdx) => (
                          <MotionStaggerItem key={deck.id}>
                            <motion.div
                              whileHover={{
                                y: -8,
                                scaleX: 1.03,
                                scaleY: 0.975,
                                rotate: deckIdx % 2 === 0 ? -1.1 : 1.1,
                                transition: { type: 'spring', stiffness: 300, damping: 11, mass: 0.85 }
                              }}
                              whileTap={{
                                scaleX: 0.96,
                                scaleY: 1.04,
                                y: -2,
                                transition: { type: 'spring', stiffness: 520, damping: 14 }
                              }}
                              className="h-full rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] hover:shadow-[7px_8px_0px_#141413] dark:hover:shadow-[7px_8px_0px_#ECD5FF] p-5 flex flex-col justify-between relative overflow-hidden group transition-shadow will-change-transform"
                            >
                              <div
                                className="absolute top-0 inset-x-0 h-1.5"
                                style={{ backgroundColor: accent }}
                              />

                              <div className="space-y-3 pt-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                                    {deck.cardCount} Cards · {deck.totalSessions || 0} Runs
                                  </span>
                                  {(deck.bestEfficiency || 0) > 0 && (
                                    <span
                                      className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold tabular-nums ${getEfficiencyBadgeStyle(
                                        deck.bestEfficiency || 0
                                      )}`}
                                    >
                                      Peak {deck.bestEfficiency}%
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="font-heading text-base font-black text-[#141413] dark:text-[#FAF8EC] leading-snug line-clamp-2">
                                    {deck.title}
                                  </h4>
                                  <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1 line-clamp-1">
                                    Topic: {deck.topic}
                                  </p>
                                </div>

                                <div className="text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] flex items-center gap-1.5 truncate">
                                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">
                                    {deck.sourceFileNames?.join(', ') || 'Study Notes'}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-4 mt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between gap-2">
                                <motion.button
                                  whileHover={{
                                    scaleX: 1.07,
                                    scaleY: 0.92,
                                    y: -2,
                                    transition: { type: 'spring', stiffness: 460, damping: 12 }
                                  }}
                                  whileTap={{
                                    scaleX: 0.9,
                                    scaleY: 1.12,
                                    y: 2,
                                    transition: { type: 'spring', stiffness: 550, damping: 14 }
                                  }}
                                  type="button"
                                  onClick={() => setStudyingState({ deck, mode: 'full' })}
                                  className="fc-jello-hover flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  Study Deck
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.12, rotate: -6 }}
                                  whileTap={{ scale: 0.88, rotate: 6 }}
                                  transition={{ type: 'spring', stiffness: 450, damping: 12 }}
                                  type="button"
                                  onClick={() => setPreviewDeck(deck)}
                                  className="p-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer"
                                  title="Preview all cards"
                                  aria-label="Preview deck cards"
                                >
                                  <Eye className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.12, rotate: 6 }}
                                  whileTap={{ scale: 0.88, rotate: -6 }}
                                  transition={{ type: 'spring', stiffness: 450, damping: 12 }}
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: 'deck',
                                      id: deck.id,
                                      title: deck.title
                                    })
                                  }
                                  className="p-2.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] hover:text-rose-600 hover:border-rose-500/50 cursor-pointer"
                                  title="Delete deck"
                                  aria-label="Delete deck"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </motion.div>
                          </MotionStaggerItem>
                        ))}
                      </MotionStaggerGrid>
                    </MotionSection>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ========================================================================
            TAB 3: DEDICATED PAST FLASHCARDS & RESULTS ARCHIVE (SUBJECT-WISE)
        ======================================================================== */}
        {activeTab === 'history' && (
          <motion.div
            key="tab-history"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_BUTTERY}
            className="space-y-6"
          >
            {/* Top Efficiency Analytics KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                  Completed Sessions
                </span>
                <p className="font-heading text-3xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums mt-1">
                  <AnimatedNumber value={globalStats.totalSessions} />
                </p>
                <p className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-0.5">
                  Across {subjectEfficiencyChartData.length} subjects
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                  Avg Learning Efficiency
                </span>
                <p className="font-heading text-3xl font-black text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums mt-1">
                  <AnimatedNumber value={globalStats.avgEfficiency} suffix="%" />
                </p>
                <p className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-0.5">
                  Weighted recall & latency index
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                  Cards Mastered
                </span>
                <p className="font-heading text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                  <AnimatedNumber value={globalStats.totalMastered} />
                </p>
                <p className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-0.5">
                  Instant active-recall wins
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                  Avg Recall Speed
                </span>
                <p className="font-heading text-3xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums mt-1">
                  {globalStats.avgSpeed}s
                </p>
                <p className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-0.5">
                  Seconds per flashcard
                </p>
              </div>
            </div>

            {/* Subject-Wise Efficiency Chart */}
            {subjectEfficiencyChartData.length > 0 && (
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                      SUBJECT-WISE BENCHMARK
                    </span>
                    <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                      Learning Efficiency by Subject (%)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={exportHistoryCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] hover:border-[#141413] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectEfficiencyChartData}
                      margin={{ top: 8, right: 12, left: -18, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,120,0.18)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#66665E' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#66665E' }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 71, 255, 0.06)' }}
                        contentStyle={{
                          borderRadius: '14px',
                          border: '1.5px solid #141413',
                          backgroundColor: '#FAF8EC',
                          color: '#141413',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                      />
                      <Bar dataKey="efficiency" name="Efficiency %" radius={[10, 10, 0, 0]} maxBarSize={52}>
                        {subjectEfficiencyChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Subject Filter Bar + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setHistorySubjectFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                    historySubjectFilter === 'all'
                      ? 'bg-[#141413] text-[#FAF8EC] dark:bg-[#ECD5FF] dark:text-[#141413] border-[#141413]'
                      : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#66665E] dark:text-[#A3A399] border-[#E5E1CE] dark:border-[#2E2E2A]'
                  }`}
                >
                  All Subjects ({sessions.length})
                </button>
                {usableSubjects.map((sub) => {
                  const cnt = sessions.filter((s) => s.subjectSlug === sub.slug).length;
                  if (cnt === 0) return null;
                  const active = historySubjectFilter === sub.slug;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setHistorySubjectFilter(sub.slug)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0D47FF] text-white border-[#141413]'
                          : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] border-[#E5E1CE] dark:border-[#2E2E2A]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: active ? '#FFD426' : sub.accentColor }}
                      />
                      <span>{sub.name}</span>
                      <span className="font-mono text-[10px] opacity-75">({cnt})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-64 shrink-0">
                <Search className="w-4 h-4 text-[#66665E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter past sessions..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-xs text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF]"
                />
              </div>
            </div>

            {/* Subject-Wise Segregated Past Flashcards & Results */}
            {groupedHistory.length === 0 ? (
              <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-dashed border-[#141413]/30 dark:border-[#FAF8EC]/25 p-12 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFD426]/35 dark:bg-[#242421] flex items-center justify-center text-[#141413] dark:text-[#FFD426]">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-black text-[#141413] dark:text-[#FAF8EC]">
                    No Past Flashcard Results Yet
                  </h3>
                  <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] mt-1 max-w-md mx-auto">
                    Complete a flashcard study session to see your subject-wise efficiency reports, retention trends, and weak-card drills right here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => switchTab(decks.length > 0 ? 'decks' : 'create')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {decks.length > 0 ? 'Study a Saved Deck' : 'Upload Notes & Start'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedHistory.map((group) => {
                  const accent = group.subject?.accentColor || '#0D47FF';
                  const isCollapsed = Boolean(collapsedHistorySubjects[group.subjectSlug]);

                  return (
                    <MotionSection
                      key={group.subjectSlug}
                      className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/60 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] overflow-hidden"
                    >
                      {/* Subject Group Banner */}
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedHistorySubjects((prev) => ({
                            ...prev,
                            [group.subjectSlug]: !prev[group.subjectSlug]
                          }))
                        }
                        className="w-full p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-[#FAF8EC] dark:bg-[#141413] border-b border-[#E5E1CE] dark:border-[#2E2E2A] text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: `${accent}18`,
                              borderColor: `${accent}45`,
                              color: accent
                            }}
                          >
                            <SubjectIcon
                              name={group.subject?.icon || 'BookOpen'}
                              className="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC] truncate">
                                {group.subjectName}
                              </h3>
                              {group.subject?.phase && (
                                <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                                  · {group.subject.phase}
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-[#66665E] dark:text-[#A3A399] tabular-nums">
                              {group.sessions.length}{' '}
                              {group.sessions.length === 1 ? 'Session' : 'Sessions'} ·{' '}
                              {group.totalCardsReviewed} Cards Tested
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-5">
                          <div className="text-right">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                              Subject Avg Efficiency
                            </span>
                            <span
                              className="font-heading text-xl font-black tabular-nums"
                              style={{ color: accent }}
                            >
                              {group.avgEfficiency}%
                            </span>
                          </div>
                          <div className="hidden sm:block text-right">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                              Retention
                            </span>
                            <span className="font-heading text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {group.avgRetention}%
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-center text-[#66665E]">
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Chronological Session Rows inside this Subject */}
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.24 }}
                            className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A]"
                          >
                            {group.sessions.map((sess) => {
                              const weakLen = sess.weakCardIds?.length || 0;
                              return (
                                <div
                                  key={sess.id}
                                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50 transition-colors"
                                >
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`px-2.5 py-0.5 rounded-lg border font-mono text-[11px] font-black tabular-nums ${getEfficiencyBadgeStyle(
                                          sess.efficiencyScore
                                        )}`}
                                      >
                                        {sess.efficiencyScore}% Efficiency
                                      </span>
                                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                                        {sess.mode === 'weak-drill' ? 'Weak Drill' : 'Full Deck'} ·{' '}
                                        {format(new Date(sess.completedAt), 'dd MMM yyyy, hh:mm a')}
                                      </span>
                                    </div>

                                    <div>
                                      <h4 className="font-heading text-base font-black text-[#141413] dark:text-[#FAF8EC]">
                                        {sess.deckTitle}
                                      </h4>
                                      <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                                        Topic: {sess.topic} · {sess.totalCards} cards in{' '}
                                        {formatDuration(sess.durationSeconds)} ({sess.avgSecondsPerCard}s/card)
                                      </p>
                                    </div>

                                    {/* Mini Mastery Bar */}
                                    <div className="max-w-md space-y-1">
                                      <div className="h-2 rounded-full overflow-hidden flex bg-[#F3F0E0] dark:bg-[#242421]">
                                        {sess.masteredCount > 0 && (
                                          <div
                                            style={{
                                              width: `${(sess.masteredCount / sess.totalCards) * 100}%`
                                            }}
                                            className="bg-emerald-500"
                                          />
                                        )}
                                        {sess.goodCount > 0 && (
                                          <div
                                            style={{
                                              width: `${(sess.goodCount / sess.totalCards) * 100}%`
                                            }}
                                            className="bg-[#0D47FF]"
                                          />
                                        )}
                                        {sess.hardCount > 0 && (
                                          <div
                                            style={{
                                              width: `${(sess.hardCount / sess.totalCards) * 100}%`
                                            }}
                                            className="bg-amber-400"
                                          />
                                        )}
                                        {sess.againCount > 0 && (
                                          <div
                                            style={{
                                              width: `${(sess.againCount / sess.totalCards) * 100}%`
                                            }}
                                            className="bg-rose-500"
                                          />
                                        )}
                                      </div>
                                      <p className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399] tabular-nums">
                                        Mastered {sess.masteredCount} · Good {sess.goodCount} · Hard{' '}
                                        {sess.hardCount} · Again {sess.againCount}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Row Actions */}
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      type="button"
                                      onClick={() => setInspectSession(sess)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Inspect Result
                                    </motion.button>

                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      type="button"
                                      onClick={() => launchFromPastSession(sess, 'full')}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
                                    >
                                      <RotateCw className="w-3.5 h-3.5" />
                                      Re-Study
                                    </motion.button>

                                    {weakLen > 0 && (
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={() => launchFromPastSession(sess, 'weak-drill')}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFD426] text-[#141413] text-xs font-bold ink-btn-hard cursor-pointer"
                                      >
                                        <Flame className="w-3.5 h-3.5" />
                                        Drill {weakLen} Weak
                                      </motion.button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteTarget({
                                          kind: 'session',
                                          id: sess.id,
                                          title: `${sess.deckTitle} (${format(
                                            new Date(sess.completedAt),
                                            'dd MMM'
                                          )})`
                                        })
                                      }
                                      className="p-2 rounded-xl text-[#66665E] hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                      aria-label="Delete flashcard session"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </MotionSection>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================
          MODAL: PREVIEW ALL CARDS IN A DECK
      ======================================================================== */}
      <MotionModal
        isOpen={Boolean(previewDeck)}
        onClose={() => setPreviewDeck(null)}
        maxWidthClass="max-w-3xl"
      >
        {previewDeck && (
          <div className="rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-5 bg-[#FFFFFF] dark:bg-[#141413] border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF]">
                  {previewDeck.subjectName} · {previewDeck.cards.length} Cards
                </span>
                <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC] truncate">
                  {previewDeck.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewDeck;
                    setPreviewDeck(null);
                    setStudyingState({ deck: target, mode: 'full' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Study Now
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDeck(null)}
                  className="p-2 rounded-xl text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              data-lenis-prevent
              onWheel={(e) => e.stopPropagation()}
              className="p-5 overflow-y-auto overscroll-contain space-y-3"
            >
              {previewDeck.cards.map((card, idx) => (
                <div
                  key={card.id}
                  className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0D47FF] dark:text-[#ECD5FF]">
                      Card {idx + 1} · {card.conceptTag}
                    </span>
                    <span className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399]">
                      {card.difficulty}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#141413] dark:text-[#FAF8EC]">
                    Q: {card.front}
                  </p>
                  <p className="text-xs text-[#66665E] dark:text-[#A3A399] whitespace-pre-line leading-relaxed pt-1 border-t border-[#E5E1CE]/70 dark:border-[#2E2E2A]">
                    A: {card.back}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </MotionModal>

      {/* ========================================================================
          MODAL: INSPECT PAST SESSION EFFICIENCY RESULT
      ======================================================================== */}
      <MotionModal
        isOpen={Boolean(inspectSession)}
        onClose={() => setInspectSession(null)}
        maxWidthClass="max-w-3xl"
      >
        {inspectSession && (
          <div className="rounded-3xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-[#FFFFFF] dark:bg-[#141413] border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold tabular-nums ${getEfficiencyBadgeStyle(
                      inspectSession.efficiencyScore
                    )}`}
                  >
                    {inspectSession.efficiencyScore}% Efficiency
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                    {inspectSession.subjectName} ·{' '}
                    {format(new Date(inspectSession.completedAt), 'dd MMM yyyy, hh:mm a')}
                  </span>
                </div>
                <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                  {inspectSession.deckTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSession(null)}
                className="p-2 rounded-xl text-[#66665E] hover:text-[#141413] dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Close session report"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              data-lenis-prevent
              onWheel={(e) => e.stopPropagation()}
              className="p-5 overflow-y-auto overscroll-contain space-y-5"
            >
              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-mono text-[9px] uppercase text-[#66665E] dark:text-[#A3A399] block">
                    Retention
                  </span>
                  <span className="font-heading text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {inspectSession.retentionRatePct}%
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-mono text-[9px] uppercase text-[#66665E] dark:text-[#A3A399] block">
                    Avg Speed
                  </span>
                  <span className="font-heading text-xl font-black text-[#0D47FF] dark:text-[#ECD5FF] tabular-nums">
                    {inspectSession.avgSecondsPerCard}s
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-mono text-[9px] uppercase text-[#66665E] dark:text-[#A3A399] block">
                    Mastered / Good
                  </span>
                  <span className="font-heading text-xl font-black text-[#141413] dark:text-[#FAF8EC] tabular-nums">
                    {inspectSession.masteredCount + inspectSession.goodCount}/{inspectSession.totalCards}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-mono text-[9px] uppercase text-[#66665E] dark:text-[#A3A399] block">
                    Weak Cards
                  </span>
                  <span className="font-heading text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {inspectSession.weakCardIds.length}
                  </span>
                </div>
              </div>

              {/* Per-Card Results */}
              <div className="space-y-2.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#66665E] dark:text-[#A3A399]">
                  Card-by-Card Performance ({inspectSession.cardResults.length})
                </p>
                {inspectSession.cardResults.map((cr, idx) => {
                  const badge =
                    cr.rating === 'mastered'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                      : cr.rating === 'good'
                        ? 'bg-[#0D47FF]/12 text-[#0D47FF] dark:text-[#93C5FD] border-[#0D47FF]/35'
                        : cr.rating === 'hard'
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35';

                  return (
                    <div
                      key={`${cr.cardId}_${idx}`}
                      className="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                          #{idx + 1} · {cr.conceptTag}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-[#141413] dark:text-[#FAF8EC]">
                          {cr.front}
                        </p>
                        <p className="text-xs text-[#66665E] dark:text-[#A3A399] whitespace-pre-line">
                          {cr.back}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold uppercase ${badge}`}
                        >
                          {cr.rating}
                        </span>
                        <span className="font-mono text-[10px] text-[#66665E] dark:text-[#A3A399] tabular-nums">
                          {cr.timeSpentSeconds}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-[#FFFFFF] dark:bg-[#141413] border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              {inspectSession.weakCardIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => launchFromPastSession(inspectSession, 'weak-drill')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD426] text-[#141413] text-xs font-bold ink-btn-hard cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5" />
                  Drill {inspectSession.weakCardIds.length} Weak Cards
                </button>
              )}
              <button
                type="button"
                onClick={() => launchFromPastSession(inspectSession, 'full')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D47FF] text-white text-xs font-bold ink-btn-hard cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Re-Study Full Deck
              </button>
            </div>
          </div>
        )}
      </MotionModal>

      {/* ========================================================================
          MODAL: CONFIRM DELETE DECK OR SESSION
      ======================================================================== */}
      <MotionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="rounded-2xl bg-[#FAF8EC] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#FAF8EC]/70 shadow-[6px_6px_0px_#141413] dark:shadow-[6px_6px_0px_#ECD5FF] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-[#141413] dark:text-[#FAF8EC]">
                  Delete {deleteTarget.kind === 'deck' ? 'Flashcard Deck' : 'Session Result'}?
                </h3>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
                  “{deleteTarget.title}” will be permanently removed from your vault.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-[#F3F0E0] dark:bg-[#242421] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold ink-btn-hard cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </MotionModal>
    </MotionPage>
  );
}
