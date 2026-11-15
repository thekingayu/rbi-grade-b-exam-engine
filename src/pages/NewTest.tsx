import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  UploadCloud, File, X, ChevronRight, ChevronLeft, Check, 
  Search, SlidersHorizontal, Clock, ShieldAlert, Sparkles,
  BookOpen, RotateCcw, Layers, ArrowLeft, ArrowRight,
  FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useSubject } from '../context/SubjectContext';
import { Subject, ExamMode } from '../types';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import { SynthesisOverlay } from '../components/SynthesisOverlay';
import { sanitizeForFirestore } from '../utils/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  MotionPage,
  MotionStaggerGrid,
  MotionStaggerItem,
  AnimatedNumber,
  SPRING_SNAPPY,
  SPRING_TACTILE,
  EASE_OUT_EXPO,
} from '../components/MotionPrimitives';

const getShortFileName = (name: string, max = 20) => {
  if (!name || name.length <= max) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex !== -1 && name.length - extIndex <= 5) {
    const ext = name.substring(extIndex);
    const base = name.substring(0, extIndex);
    return base.substring(0, Math.max(4, max - ext.length - 2)) + '…' + ext;
  }
  return name.substring(0, max - 1) + '…';
};

export function NewTest({ user }: { user: User }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subjects, notes, mistakes } = useSubject();

  // Wizard step: 1 = Choose Subject, 2 = Choose Source / Upload Notes, 3 = Configure & Launch
  const [step, setStep] = useState<number>(() => {
    if (searchParams.get('topic')) return 3;
    const initialSub = searchParams.get('subject');
    return initialSub ? 2 : 1;
  });

  // Selected Subject
  const [selectedSubject, setSelectedSubject] = useState<Subject>(() => {
    const paramSlug = searchParams.get('subject');
    if (paramSlug) {
      const found = subjects.find(s => s.slug === paramSlug);
      if (found) return found;
    }
    return subjects[0];
  });

  // Step 1 Search & Filter
  const [subjectSearch, setSubjectSearch] = useState('');

  // Step 2: Source selection ('upload' | 'existing_notes' | 'topic_only' | 'mistakes')
  const [sourceMode, setSourceMode] = useState<'upload' | 'existing_notes' | 'topic_only' | 'mistakes'>(() => {
    if (searchParams.get('retryMistakes') === 'true') return 'mistakes';
    if (searchParams.get('topic')) return 'topic_only';
    if (searchParams.get('noteId')) return 'existing_notes';
    return 'upload';
  });

  const [files, setFiles] = useState<File[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() => {
    const noteId = searchParams.get('noteId');
    return noteId ? [noteId] : [];
  });
  const [selectedTopic, setSelectedTopic] = useState<string>(() => {
    return searchParams.get('topic') || (selectedSubject.syllabusTopics[0] || 'General Theory');
  });

  // Step 3: Exam configuration
  const [examMode, setExamMode] = useState<ExamMode>('Sectional');
  const [config, setConfig] = useState({
    mcqStatic: 10,
    mcqDynamic: 5,
    descStatic: 1,
    descDynamic: 1,
    pyqCount: 2,
    difficulty: 'Moderate' as 'Easy' | 'Moderate' | 'Hard',
    timerEnabled: true,
    negativeMarkingEnabled: true
  });

  // Active subject question category descriptors and authentic RBI presets
  const categoryConfig = selectedSubject.questionCategories || {
    primaryMcqLabel: 'Core Curriculum Concept MCQs',
    primaryMcqSubtext: 'Fundamental syllabus theory & core rules',
    secondaryMcqLabel: 'Applied Analytical MCQs',
    secondaryMcqSubtext: 'Practical application & scenario-based problems',
    primaryDescLabel: 'Analytical Theory Essays',
    primaryDescSubtext: 'Syllabus framework prompts',
    secondaryDescLabel: 'Practical Case Studies',
    secondaryDescSubtext: 'Applied real-world scenarios',
    fullMock: { mcqStatic: 15, mcqDynamic: 15, descStatic: 1, descDynamic: 1, pyqCount: 2, durationMinutes: 45 },
    sectional: { mcqStatic: 8, mcqDynamic: 7, descStatic: 1, descDynamic: 0, pyqCount: 2, durationMinutes: 25 },
    topicDrill: { mcqStatic: 10, mcqDynamic: 0, descStatic: 0, descDynamic: 0, pyqCount: 0, durationMinutes: 15 }
  };

  // Load last-used subject config or initialize with authentic RBI Grade B sectional preset
  useEffect(() => {
    const saved = localStorage.getItem(`rbi_cfg_${selectedSubject.slug}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed, pyqCount: parsed.pyqCount ?? 2 }));
      } catch (e) {}
    } else {
      const preset = categoryConfig.sectional;
      setConfig({
        mcqStatic: preset.mcqStatic,
        mcqDynamic: preset.mcqDynamic,
        descStatic: preset.descStatic,
        descDynamic: preset.descDynamic,
        pyqCount: preset.pyqCount ?? 2,
        difficulty: 'Moderate',
        timerEnabled: true,
        negativeMarkingEnabled: selectedSubject.negativeMarking > 0
      });
    }
  }, [selectedSubject]);

  // Upload & Generation state
  const [uploading, setUploading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setLoadingMessage('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uploading) {
        handleCancelAnalysis();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploading]);

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      let errorFiles: string[] = [];
      const validFiles = newFiles.filter(f => {
        if (f.size > 200 * 1024 * 1024) {
          errorFiles.push(f.name);
          return false;
        }
        return true;
      });
      if (errorFiles.length > 0) {
        setUploadError(`File too large (Max 200MB): ${errorFiles.join(', ')}`);
      }
      setFiles(prev => [...prev, ...validFiles]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Filtered subjects for Step 1
  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return subjects;
    const term = subjectSearch.toLowerCase();
    return subjects.filter(s => 
      s.name.toLowerCase().includes(term) ||
      s.description.toLowerCase().includes(term) ||
      s.phase.toLowerCase().includes(term) ||
      s.syllabusTopics.some(t => t.toLowerCase().includes(term))
    );
  }, [subjects, subjectSearch]);

  const phase1List = filteredSubjects.filter(s => s.phase === 'Phase 1' && s.slug !== 'uncategorized');
  const phase2List = filteredSubjects.filter(s => s.phase === 'Phase 2');

  // Notes available for current subject
  const currentSubjectNotes = notes.filter(n => n.subjectId === selectedSubject.id || n.subjectSlug === selectedSubject.slug);
  const currentSubjectMistakes = mistakes.filter(m => m.subjectId === selectedSubject.id || m.subjectSlug === selectedSubject.slug);

  // Live Summary metrics
  const totalQuestions = (selectedSubject.questionTypeMix.mcq ? config.mcqStatic + config.mcqDynamic : 0) +
                         (selectedSubject.questionTypeMix.descriptive ? config.descStatic + config.descDynamic : 0);

  const totalCalculatedMarks = (config.mcqStatic + config.mcqDynamic) * 1 +
                               (config.descStatic + config.descDynamic) * 15;

  const estimatedDurationMinutes = useMemo(() => {
    if (examMode === 'Full Mock' && categoryConfig.fullMock?.durationMinutes) {
      return categoryConfig.fullMock.durationMinutes;
    }
    if (examMode === 'Sectional' && categoryConfig.sectional?.durationMinutes) {
      return categoryConfig.sectional.durationMinutes;
    }
    if (examMode === 'Topic Drill' && categoryConfig.topicDrill?.durationMinutes) {
      return categoryConfig.topicDrill.durationMinutes;
    }
    if (examMode === 'Quick 10-min') {
      return 10;
    }
    const totalMcqs = config.mcqStatic + config.mcqDynamic + (config.pyqCount || 0);
    const totalDesc = config.descStatic + config.descDynamic;
    const mcqMins = (totalMcqs * 45) / 60;
    const descMins = (totalDesc * 15 * 60) / 60;
    return Math.max(5, Math.ceil(mcqMins + descMins));
  }, [examMode, categoryConfig, config.mcqStatic, config.mcqDynamic, config.descStatic, config.descDynamic, config.pyqCount]);

  // GENERATE EXAM HANDLER
  const handleGenerateExam = async () => {
    // Validate sources
    if (sourceMode === 'upload' && files.length === 0) {
      setUploadError("Please upload at least one study note document or select 'Pick topics only'.");
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setUploading(true);
    setLoadingMessage("Synthesizing your exam curriculum...");

    try {
      let combinedText = '';

      if (sourceMode === 'upload') {
        for (const file of files) {
          const shortName = getShortFileName(file.name, 18);
          setLoadingMessage(`Preparing ${shortName}...`);
          
          const uploadId = Date.now().toString() + Math.random().toString(36).substring(7);
          const chunkSize = 10 * 1024 * 1024;
          const totalChunks = Math.ceil(file.size / chunkSize);

          for (let i = 0; i < totalChunks; i++) {
            if (abortController.signal.aborted) return;
            setLoadingMessage(`Uploading ${shortName} (${i + 1}/${totalChunks})...`);
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('uploadId', uploadId);
            formData.append('fileName', file.name);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('chunk', chunk);

            const chunkRes = await fetch('/api/upload-chunk', {
              method: 'POST',
              body: formData,
              signal: abortController.signal
            });

            if (!chunkRes.ok) {
              const errData = await chunkRes.json().catch(() => ({}));
              throw new Error(errData.error || `Failed to upload chunk ${i + 1}`);
            }
          }

          if (abortController.signal.aborted) return;
          setLoadingMessage(`Extracting text from ${shortName}...`);

          const res = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, mimeType: file.type || 'application/pdf' }),
            signal: abortController.signal
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to extract text");
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let extracted = '';
          let buffer = '';

          while (true) {
            if (abortController.signal.aborted) return;
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.status) setLoadingMessage(data.status);
                if (data.textChunk) extracted += data.textChunk;
                if (data.error) throw new Error(data.error);
              } catch (e) {}
            }
          }
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.textChunk) extracted += data.textChunk;
            } catch (e) {}
          }
          combinedText += extracted + '\n\n';
        }
      } else if (sourceMode === 'existing_notes') {
        const picked = notes.filter(n => selectedNoteIds.includes(n.id));
        combinedText = picked.map(n => n.extractedText).join('\n\n');
      } else if (sourceMode === 'mistakes') {
        const mistakeTexts = currentSubjectMistakes.map((m, idx) => `Mistake Question ${idx + 1}: ${m.text}\nExplanation: ${m.explanation || ''}`).join('\n\n');
        combinedText = `Curriculum based on past student mistakes in ${selectedSubject.name}:\n\n${mistakeTexts}`;
      } else {
        // Topic only
        combinedText = `Focus examination curriculum for RBI Grade B Subject: ${selectedSubject.name}, Topic: ${selectedTopic}.\nInclude key statutory rules, regulatory frameworks, empirical developments, and analytical problems.`;
      }

      if (abortController.signal.aborted) return;
      const finalExtractedText = combinedText.trim() || `RBI Grade B Subject Examination for ${selectedSubject.name}.`;

      setLoadingMessage("Generating custom exam questions...");

      // Save subject config to localStorage
      localStorage.setItem(`rbi_cfg_${selectedSubject.slug}`, JSON.stringify(config));

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedText: finalExtractedText,
          config: {
            ...config,
            subject: selectedSubject.name,
            subjectSlug: selectedSubject.slug,
            mode: examMode,
            targetTopic: selectedTopic,
            primaryMcqLabel: categoryConfig.primaryMcqLabel,
            secondaryMcqLabel: categoryConfig.secondaryMcqLabel,
            primaryDescLabel: categoryConfig.primaryDescLabel,
            secondaryDescLabel: categoryConfig.secondaryDescLabel
          }
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate exam questions");
      }
      const data = await res.json();

      const normalizedQuestions = (data.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: q.id || `q_${idx}`,
        subjectId: selectedSubject.id,
        topic: q.topic || selectedTopic || selectedSubject.syllabusTopics[0] || 'Core',
        difficulty: config.difficulty || 'Moderate',
        isPyq: Boolean(q.isPyq),
        pyqYear: q.pyqYear ? String(q.pyqYear) : (q.isPyq ? 'RBI Grade B' : null),
        maxMarks: q.type === 'MCQ' ? 1 : (Number(q.maxMarks) || 15)
      }));

      const durationSeconds = estimatedDurationMinutes * 60;

      // Deeply sanitize test payload to ensure ZERO undefined values reach Firestore addDoc
      const testPayload = sanitizeForFirestore({
        userId: user.uid,
        createdAt: Date.now(),
        status: 'setup',
        subjectId: selectedSubject.id,
        subjectSlug: selectedSubject.slug,
        subjectName: selectedSubject.name,
        mode: examMode,
        targetTopic: selectedTopic || 'General Curriculum',
        config: {
          ...config,
          mode: examMode,
          targetTopic: selectedTopic || 'General Curriculum'
        },
        sourceNoteFileRefs: files.map(f => f.name),
        extractedNotesText: (finalExtractedText || '').substring(0, 5000), // excerpt
        durationSeconds,
        negativeMarks: config.negativeMarkingEnabled ? selectedSubject.negativeMarking : 0,
        questions: normalizedQuestions
      });

      const docRef = await addDoc(collection(db, 'tests'), testPayload);

      navigate(`/exam/${docRef.id}`);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setUploadError(err.message || "An unexpected error occurred while generating the examination.");
      setUploading(false);
    }
  };

  return (
    <MotionPage className="max-w-5xl mx-auto space-y-6 pt-2 pb-16 relative z-10">
      
      {/* Top Breadcrumb & Step Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-[#66665E] dark:text-[#A3A399] mb-1">
            <Link to="/" className="hover:text-[#141413] dark:hover:text-[#FAF8EC] flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-[#141413] dark:text-[#FAF8EC] uppercase tabular-nums">
              Step {step} of 3
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.h1
              key={`step-heading-${step}-${selectedSubject.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="text-xl sm:text-3xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] leading-tight"
            >
              {step === 1 && "Choose Examination Subject"}
              {step === 2 && `Provide Source Material · ${selectedSubject.name}`}
              {step === 3 && `Configure & Launch · ${selectedSubject.name}`}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* 3-Step Editorial Stepper */}
        <div className="flex items-center justify-between sm:justify-start gap-1 bg-[#FFFFFF] dark:bg-[#1C1C1A] p-1.5 rounded-2xl border border-[#E5E1CE] dark:border-[#2E2E2A] w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0">
          {[
            { s: 1, label: 'Subject' },
            { s: 2, label: 'Source' },
            { s: 3, label: 'Settings' }
          ].map(item => {
            const isCurrent = step === item.s;
            return (
              <button
                key={item.s}
                type="button"
                onClick={() => {
                  if (item.s < step) setStep(item.s);
                }}
                disabled={item.s > step}
                className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 z-10 min-h-[38px] ${
                  isCurrent
                    ? 'text-white'
                    : item.s < step
                      ? 'text-[#0D47FF] dark:text-[#ECD5FF] hover:bg-[#FAF8EC] dark:hover:bg-[#141413] cursor-pointer'
                      : 'text-[#8E8E85] dark:text-[#66665E] cursor-not-allowed'
                }`}
              >
                {isCurrent && (
                  <motion.span
                    layoutId="wizard-step-pill"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-xl bg-[#0D47FF] border border-[#141413] -z-10"
                  />
                )}
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  isCurrent ? 'bg-white/20 text-white' : 'bg-[#F3F0E0] dark:bg-[#242421]'
                }`}>
                  {item.s < step ? <Check className="w-3 h-3 text-current" /> : item.s}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
      {/* STEP 1: CHOOSE SUBJECT */}
      {step === 1 && (
        <motion.div
          key="wizard-step-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          className="space-y-6"
        >
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#66665E] dark:text-[#A3A399] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject, chapter, or phase (e.g. 'General Awareness', 'Monetary Policy', 'ESI')..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              className="w-full min-h-[46px] pl-11 pr-4 py-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] placeholder:text-[#8E8E85] text-sm focus:outline-none focus:border-[#0D47FF] transition-colors"
            />
          </div>

          {/* Phase 1 Subjects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC]">
                Phase 1 Preliminary Examinations
              </h2>
              <span className="font-mono text-[10px] font-bold uppercase text-[#66665E] dark:text-[#A3A399]">4 Subjects</span>
            </div>
            <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phase1List.map(s => (
                <MotionStaggerItem key={s.id}>
                  <SubjectPickerCard
                    subject={s}
                    isSelected={selectedSubject.id === s.id}
                    notesCount={notes.filter(n => n.subjectId === s.id).length}
                    onSelect={() => {
                      setSelectedSubject(s);
                      setStep(2);
                    }}
                  />
                </MotionStaggerItem>
              ))}
            </MotionStaggerGrid>
          </div>

          {/* Phase 2 Subjects */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC]">
                Phase 2 Main Examinations
              </h2>
              <span className="font-mono text-[10px] font-bold uppercase text-[#66665E] dark:text-[#A3A399]">3 Papers</span>
            </div>
            <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {phase2List.map(s => (
                <MotionStaggerItem key={s.id}>
                  <SubjectPickerCard
                    subject={s}
                    isSelected={selectedSubject.id === s.id}
                    notesCount={notes.filter(n => n.subjectId === s.id).length}
                    onSelect={() => {
                      setSelectedSubject(s);
                      setStep(2);
                    }}
                  />
                </MotionStaggerItem>
              ))}
            </MotionStaggerGrid>
          </div>

        </motion.div>
      )}

      {/* STEP 2: CHOOSE SOURCE / UPLOAD NOTES */}
      {step === 2 && (
        <motion.div
          key="wizard-step-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          className="space-y-6"
        >
          
          {/* Source Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'upload', label: 'Upload Document', icon: UploadCloud, desc: 'PDF, DOCX, TXT' },
              { id: 'existing_notes', label: 'Saved Notes', icon: FileText, desc: `${currentSubjectNotes.length} files available` },
              { id: 'topic_only', label: 'Topic Drill Only', icon: BookOpen, desc: 'Pure syllabus test' },
              { id: 'mistakes', label: 'Retry Mistakes', icon: RotateCcw, desc: `${currentSubjectMistakes.length} flaws saved` }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isCurrent = sourceMode === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => setSourceMode(tab.id as any)}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[96px] ${
                    isCurrent
                      ? 'bg-[#ECD5FF] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] text-[#141413]'
                      : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#55554F] dark:text-[#A3A399] hover:border-[#141413] dark:hover:border-[#ECD5FF]'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 ${isCurrent ? 'text-[#141413]' : 'text-[#66665E] dark:text-[#A3A399]'}`} />
                  <div>
                    <p className={`font-bold text-xs sm:text-sm ${isCurrent ? 'text-[#141413]' : 'text-[#141413] dark:text-[#FAF8EC]'}`}>
                      {tab.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isCurrent ? 'text-[#141413]/75' : 'text-[#66665E] dark:text-[#A3A399]'}`}>
                      {tab.desc}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Source 1: Upload Documents */}
          {sourceMode === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#141413]/35 dark:border-[#ECD5FF]/35 hover:border-[#0D47FF] rounded-3xl p-5 sm:p-12 text-center bg-[#FFFFFF] dark:bg-[#1C1C1A] transition-colors cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#ECD5FF] text-[#141413] border-[1.5px] border-[#141413] flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="font-heading font-bold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC]">
                  Drop your study notes or images here or click to browse
                </h3>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1 max-w-md mx-auto">
                  Supports PDF, DOCX, TXT, MD, and Images (PNG, JPG, JPEG, WEBP up to 200MB).
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399]">
                    Uploaded Files ({files.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#141413] dark:text-[#FAF8EC] truncate">
                              {file.name}
                            </p>
                            <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="p-1 rounded-lg hover:bg-rose-500/10 text-[#66665E] hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source 2: Existing Saved Notes */}
          {sourceMode === 'existing_notes' && (
            <div className="space-y-3">
              {currentSubjectNotes.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A]">
                  <p className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC]">No notes in {selectedSubject.name} repository yet.</p>
                  <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">Switch to 'Upload Document' to add your first PDF or circular.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentSubjectNotes.map(n => {
                    const isChecked = selectedNoteIds.includes(n.id);
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          setSelectedNoteIds(prev =>
                            isChecked ? prev.filter(id => id !== n.id) : [...prev, n.id]
                          );
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-[#ECD5FF] border-[1.5px] border-[#141413] text-[#141413]'
                            : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`font-bold text-xs sm:text-sm truncate ${isChecked ? 'text-[#141413]' : 'text-[#141413] dark:text-[#FAF8EC]'}`}>
                            {n.fileName}
                          </p>
                          <p className={`text-[10px] font-mono mt-0.5 ${isChecked ? 'text-[#141413]/70' : 'text-[#66665E] dark:text-[#A3A399]'}`}>
                            {(n.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-[#0D47FF] text-white border-[#141413]' : 'border-[#E5E1CE] dark:border-[#2E2E2A]'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Source 3: Topic Drill Only */}
          {sourceMode === 'topic_only' && (
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                Choose Syllabus Chapter to Drill
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedSubject.syllabusTopics.map(t => {
                  const isSelected = selectedTopic === t;
                  return (
                    <div
                      key={t}
                      onClick={() => setSelectedTopic(t)}
                      className={`p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#ECD5FF] border-[1.5px] border-[#141413] text-[#141413]'
                          : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC]'
                      }`}
                    >
                      <span>{t}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#0D47FF]" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source 4: Retry Mistakes */}
          {sourceMode === 'mistakes' && (
            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/25 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC]">
                    Retry {currentSubjectMistakes.length} Saved Mistakes
                  </h3>
                  <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                    Questions you answered incorrectly or skipped in previous {selectedSubject.name} attempts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-bold text-[#55554F] dark:text-[#A3A399] hover:bg-[#F3F0E0] dark:hover:bg-[#242421] cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Subject</span>
            </button>

            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              onClick={() => setStep(3)}
              className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Next: Configure Exam</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>

        </motion.div>
      )}

      {/* STEP 3: CONFIGURE & LAUNCH */}
      {step === 3 && (
        <motion.div
          key="wizard-step-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          className="space-y-6"
        >
          
          {/* Exam Mode Selector */}
          <div>
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block mb-2">
              Examination Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['Full Mock', 'Sectional', 'Topic Drill', 'Quick 10-min'] as ExamMode[]).map(mode => (
                <motion.button
                  key={mode}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => {
                    setExamMode(mode);
                    if (mode === 'Full Mock' && categoryConfig.fullMock) {
                      setConfig(prev => ({
                        ...prev,
                        mcqStatic: categoryConfig.fullMock.mcqStatic,
                        mcqDynamic: categoryConfig.fullMock.mcqDynamic,
                        descStatic: categoryConfig.fullMock.descStatic,
                        descDynamic: categoryConfig.fullMock.descDynamic,
                        pyqCount: categoryConfig.fullMock.pyqCount ?? 2
                      }));
                    } else if (mode === 'Sectional' && categoryConfig.sectional) {
                      setConfig(prev => ({
                        ...prev,
                        mcqStatic: categoryConfig.sectional.mcqStatic,
                        mcqDynamic: categoryConfig.sectional.mcqDynamic,
                        descStatic: categoryConfig.sectional.descStatic,
                        descDynamic: categoryConfig.sectional.descDynamic,
                        pyqCount: categoryConfig.sectional.pyqCount ?? 2
                      }));
                    } else if (mode === 'Topic Drill' && categoryConfig.topicDrill) {
                      setConfig(prev => ({
                        ...prev,
                        mcqStatic: categoryConfig.topicDrill.mcqStatic,
                        mcqDynamic: categoryConfig.topicDrill.mcqDynamic,
                        descStatic: categoryConfig.topicDrill.descStatic,
                        descDynamic: categoryConfig.topicDrill.descDynamic,
                        pyqCount: categoryConfig.topicDrill.pyqCount ?? 0
                      }));
                    } else if (mode === 'Quick 10-min') {
                      setConfig(prev => ({
                        ...prev,
                        mcqStatic: selectedSubject.questionTypeMix.mcq ? 4 : 0,
                        mcqDynamic: selectedSubject.questionTypeMix.mcq ? 4 : 0,
                        descStatic: 0,
                        descDynamic: 0,
                        pyqCount: 2
                      }));
                    }
                  }}
                  className={`min-h-[44px] p-3.5 rounded-xl border-[1.5px] text-xs font-bold transition-colors cursor-pointer text-center ${
                    examMode === mode
                      ? 'bg-[#ECD5FF] border-[#141413] text-[#141413] shadow-[3px_3px_0px_#141413] dark:shadow-[3px_3px_0px_#0D47FF]'
                      : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#40403B] dark:text-[#D5D5C8] hover:border-[#141413] dark:hover:border-[#ECD5FF]/60'
                  }`}
                >
                  {mode}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Dual-Track RBI Grade B Blueprint Callout for GA, ESI, and FM */}
          {['general-awareness', 'esi', 'fm'].includes(selectedSubject.slug) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#ECD5FF]/35 dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#ECD5FF]/50 shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF]/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFD426] border border-[#141413]" />
                  <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#141413] dark:text-[#FAF8EC]">
                    RBI Grade B Dual-Track Architecture: Static PYQs & Dynamic Recent Events
                  </h4>
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-[#FFD426] text-[#141413] font-bold border border-[#141413]">
                  Cadre Benchmarking Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#40403B] dark:text-[#A3A399] leading-relaxed">
                In <strong className="text-[#141413] dark:text-[#FAF8EC]">{selectedSubject.name}</strong>, questions are divided into two distinct tracks:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#FFD426] dark:border-[#FFD426]/60 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#141413] dark:text-[#FFD426]">
                    <BookOpen className="w-3.5 h-3.5 text-[#141413] dark:text-[#FFD426]" />
                    <span>Track 1: Static Theory & PYQs</span>
                  </div>
                  <p className="text-[#40403B] dark:text-[#A3A399] text-[11px] leading-relaxed">
                    Statutory acts (RBI Act 1934, BR Act 1949, FEMA), formulas, historical models & authentic PYQ archetypes. Rigor equal to or harder than actual RBI Grade B papers.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#141413] border border-[#0D47FF] dark:border-[#ECD5FF]/60 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#0D47FF] dark:text-[#ECD5FF]">
                    <Sparkles className="w-3.5 h-3.5 text-[#0D47FF] dark:text-[#ECD5FF]" />
                    <span>Track 2: Dynamic Recent Events (2024–2026)</span>
                  </div>
                  <p className="text-[#40403B] dark:text-[#A3A399] text-[11px] leading-relaxed">
                    AI strictly searches recent events (last 6-8 months), 2024–2026 RBI Master Directions, Union Budget allocations, and Economic Survey analysis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Keyboard-Entering Question Breakdown Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* MCQs */}
            {selectedSubject.questionTypeMix.mcq && (
              <div className="p-3.5 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-heading font-extrabold text-sm text-[#141413] dark:text-[#FAF8EC]">
                    Multiple Choice Questions
                  </span>
                  <span className="text-xs font-mono text-[#141413] font-bold px-2.5 py-1 rounded-md bg-[#ECD5FF] border border-[#141413] tabular-nums shrink-0">
                    Total MCQ: {config.mcqStatic + config.mcqDynamic} Qs
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Primary / Core Section Number Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {['general-awareness', 'esi', 'fm'].includes(selectedSubject.slug) && (
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#FFD426]/30 text-[#141413] dark:text-[#FFD426] border border-[#141413]/30 dark:border-[#FFD426]/40">
                          Track 1 · Static PYQ Archetype
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">
                        {categoryConfig.primaryMcqLabel}
                      </span>
                      <span className="text-[11px] sm:text-[10px] text-[#66665E] dark:text-[#A3A399] block sm:line-clamp-1">
                        {categoryConfig.primaryMcqSubtext}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqStatic: Math.max(0, config.mcqStatic - 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={config.mcqStatic === 0 ? '0' : config.mcqStatic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, mcqStatic: isNaN(val) ? 0 : Math.max(0, Math.min(80, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm tabular-nums bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-lg text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqStatic: Math.min(80, config.mcqStatic + 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Secondary / Advanced Section Number Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                    <div className="min-w-0 space-y-0.5">
                      {['general-awareness', 'esi', 'fm'].includes(selectedSubject.slug) && (
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#ECD5FF]/60 dark:bg-[#ECD5FF]/15 text-[#141413] dark:text-[#ECD5FF] border border-[#141413]/25 dark:border-[#ECD5FF]/30">
                          Track 2 · Dynamic Recent Events (2024–2026)
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">
                        {categoryConfig.secondaryMcqLabel}
                      </span>
                      <span className="text-[11px] sm:text-[10px] text-[#66665E] dark:text-[#A3A399] block sm:line-clamp-1">
                        {categoryConfig.secondaryMcqSubtext}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqDynamic: Math.max(0, config.mcqDynamic - 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={config.mcqDynamic === 0 ? '0' : config.mcqDynamic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, mcqDynamic: isNaN(val) ? 0 : Math.max(0, Math.min(80, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm tabular-nums bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-lg text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqDynamic: Math.min(80, config.mcqDynamic + 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Descriptive */}
            {selectedSubject.questionTypeMix.descriptive && (
              <div className="p-3.5 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                  <span className="font-heading font-extrabold text-sm text-[#141413] dark:text-[#FAF8EC]">
                    Phase 2 Analytical Descriptive
                  </span>
                  <span className="text-xs font-mono text-[#FFFFFF] font-bold px-2.5 py-1 rounded-md bg-[#0D47FF] border border-[#141413] tabular-nums shrink-0">
                    Total Desc: {config.descStatic + config.descDynamic} Qs
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Static Descriptive Number Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {['general-awareness', 'esi', 'fm'].includes(selectedSubject.slug) && (
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#FFD426]/30 text-[#141413] dark:text-[#FFD426] border border-[#141413]/30 dark:border-[#FFD426]/40">
                          Track 1 · Static Theory (10 Marks / 400w)
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">
                        {categoryConfig.primaryDescLabel || 'Static Analytical Essays'}
                      </span>
                      <span className="text-[11px] sm:text-[10px] text-[#66665E] dark:text-[#A3A399] block sm:line-clamp-1">
                        {categoryConfig.primaryDescSubtext || 'Theory & framework prompts'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descStatic: Math.max(0, config.descStatic - 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={config.descStatic === 0 ? '0' : config.descStatic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, descStatic: isNaN(val) ? 0 : Math.max(0, Math.min(10, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm tabular-nums bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-lg text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descStatic: Math.min(10, config.descStatic + 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Descriptive Number Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
                    <div className="min-w-0 space-y-0.5">
                      {['general-awareness', 'esi', 'fm'].includes(selectedSubject.slug) && (
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#ECD5FF]/60 dark:bg-[#ECD5FF]/15 text-[#141413] dark:text-[#ECD5FF] border border-[#141413]/25 dark:border-[#ECD5FF]/30">
                          Track 2 · Dynamic Dilemma (15 Marks / 600w)
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">
                        {categoryConfig.secondaryDescLabel || 'Dynamic Policy Questions'}
                      </span>
                      <span className="text-[11px] sm:text-[10px] text-[#66665E] dark:text-[#A3A399] block sm:line-clamp-1">
                        {categoryConfig.secondaryDescSubtext || 'Contemporary dilemmas & policy roadmap'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descDynamic: Math.max(0, config.descDynamic - 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={config.descDynamic === 0 ? '0' : config.descDynamic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, descDynamic: isNaN(val) ? 0 : Math.max(0, Math.min(10, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm tabular-nums bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-lg text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descDynamic: Math.min(10, config.descDynamic + 1) })}
                        className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Authentic Previous Year Questions (PYQ) Section */}
            <div className={`p-3.5 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-4 ${
              selectedSubject.questionTypeMix.descriptive ? 'sm:col-span-2' : ''
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading font-extrabold text-sm text-[#141413] dark:text-[#FAF8EC]">
                    Authentic Previous Year Questions (PYQs)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FFD426] border border-[#E5E1CE] dark:border-[#2E2E2A] font-bold">
                    Official Papers 2018–2025
                  </span>
                </div>
                <span className="text-xs font-mono text-[#141413] font-bold px-2.5 py-1 rounded-md bg-[#FFD426] border border-[#141413] tabular-nums shrink-0">
                  Total PYQ: {config.pyqCount || 0} Qs
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">
                    Exact Previous Year Questions (PYQ)
                  </span>
                  <span className="text-[11px] sm:text-[10px] text-[#66665E] dark:text-[#A3A399] block sm:line-clamp-1">
                    Authentic questions asked in official RBI Grade B matching syllabus / notes with exact past difficulty
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, pyqCount: Math.max(0, (config.pyqCount || 0) - 1) })}
                    className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={config.pyqCount === 0 ? '0' : (config.pyqCount || 0)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setConfig({ ...config, pyqCount: isNaN(val) ? 0 : Math.max(0, Math.min(30, val)) });
                    }}
                    className="w-16 h-9 text-center font-mono font-bold text-sm tabular-nums bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-lg text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, pyqCount: Math.min(30, (config.pyqCount || 0) + 1) })}
                    className="w-8 h-8 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] font-bold hover:border-[#141413] dark:hover:border-[#ECD5FF] cursor-pointer flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Difficulty & Rule Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Difficulty */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
                Standard Benchmark
              </span>
              <div className="flex items-center gap-1.5">
                {(['Easy', 'Moderate', 'Hard'] as const).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setConfig({ ...config, difficulty: diff })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      config.difficulty === diff
                        ? 'bg-[#141413] dark:bg-[#ECD5FF] text-[#FAF8EC] dark:text-[#141413] border-[#141413] dark:border-[#ECD5FF]'
                        : 'bg-[#FAF8EC] dark:bg-[#141413] text-[#40403B] dark:text-[#A3A399] border-[#E5E1CE] dark:border-[#2E2E2A]'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Toggle */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">Enforce Exam Timer</span>
                <span className="text-[10px] text-[#66665E] dark:text-[#A3A399]">Simulate official clock</span>
              </div>
              <input
                type="checkbox"
                checked={config.timerEnabled}
                onChange={(e) => setConfig({ ...config, timerEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#0D47FF] cursor-pointer"
              />
            </div>

            {/* Negative Marking Toggle */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#141413] dark:text-[#FAF8EC] block">Negative Marking</span>
                <span className="text-[10px] text-[#66665E] dark:text-[#A3A399]">-{selectedSubject.negativeMarking} per wrong MCQ</span>
              </div>
              <input
                type="checkbox"
                checked={config.negativeMarkingEnabled}
                onChange={(e) => setConfig({ ...config, negativeMarkingEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#0D47FF] cursor-pointer"
              />
            </div>

          </div>

          {/* Live Summary Card */}
          <div className="p-4 sm:p-7 rounded-2xl bg-[#141413] text-[#FAF8EC] border-[2px] border-[#141413] dark:border-[#ECD5FF] shadow-[6px_6px_0px_#0D47FF] dark:shadow-[6px_6px_0px_#ECD5FF]/35 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-4">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFD426] font-bold block">
                  EXAMINATION BLUEPRINT SUMMARY
                </span>
                <h3 className="text-lg sm:text-xl font-heading font-extrabold truncate text-[#FAF8EC]">{selectedSubject.name}</h3>
                <p className="text-xs text-[#A3A399] mt-0.5 line-clamp-2">Mode: {examMode} · Topic: {selectedTopic}</p>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-5 text-center sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 shrink-0">
                <div className="p-2 sm:p-0 rounded-xl bg-white/5 sm:bg-transparent border sm:border-0 border-white/10">
                  <span className="text-[10px] font-mono uppercase text-[#A3A399] block tracking-wider">Questions</span>
                  <span className="text-xl sm:text-2xl font-heading font-extrabold tabular-nums text-[#ECD5FF]">
                    <AnimatedNumber value={totalQuestions} duration={0.45} />
                  </span>
                </div>
                <div className="p-2 sm:p-0 rounded-xl bg-white/5 sm:bg-transparent border sm:border-0 border-white/10">
                  <span className="text-[10px] font-mono uppercase text-[#A3A399] block tracking-wider">Duration</span>
                  <span className="text-xl sm:text-2xl font-heading font-extrabold tabular-nums text-[#FFD426]">
                    <AnimatedNumber value={estimatedDurationMinutes} suffix="m" duration={0.45} />
                  </span>
                </div>
                <div className="p-2 sm:p-0 rounded-xl bg-white/5 sm:bg-transparent border sm:border-0 border-white/10">
                  <span className="text-[10px] font-mono uppercase text-[#A3A399] block tracking-wider">Max Marks</span>
                  <span className="text-xl sm:text-2xl font-heading font-extrabold tabular-nums text-[#FAF8EC]">
                    <AnimatedNumber value={totalCalculatedMarks} duration={0.45} />
                  </span>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs flex items-start sm:items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-rose-300" />
                <span className="leading-relaxed break-words">{uploadError}</span>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold text-[#A3A399] hover:text-[#FAF8EC] bg-white/5 sm:bg-transparent hover:bg-white/10 transition-colors text-center cursor-pointer"
              >
                Back to Sources
              </button>

              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_SNAPPY}
                onClick={handleGenerateExam}
                disabled={uploading || totalQuestions === 0}
                className="w-full sm:w-auto min-h-[46px] px-8 py-3.5 rounded-xl font-bold text-sm bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#FAF8EC] shadow-[3px_3px_0px_#ECD5FF] transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Begin Examination</span>
              </motion.button>
            </div>
          </div>

        </motion.div>
      )}
      </AnimatePresence>

      {/* IMMERSIVE FULL-PAGE PROCESSING OVERLAY (RENDERED DIRECTLY INTO DOCUMENT.BODY VIA PORTAL) */}
      {createPortal(
        <SynthesisOverlay
          isOpen={uploading}
          onCancel={handleCancelAnalysis}
          loadingMessage={loadingMessage}
          subjectName={selectedSubject?.name || 'Curriculum'}
        />,
        document.body
      )}

    </MotionPage>
  );
}

function SubjectPickerCard({
  subject,
  isSelected,
  notesCount,
  onSelect
}: {
  key?: React.Key;
  subject: Subject;
  isSelected: boolean;
  notesCount: number;
  onSelect: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={SPRING_SNAPPY}
      onClick={onSelect}
      className={`p-5 rounded-2xl transition-colors cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[160px] group ${
        isSelected
          ? 'ink-card-featured bg-[#FFFFFF] dark:bg-[#1C1C1A]'
          : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] hover:shadow-[4px_4px_0px_#141413] dark:hover:shadow-[4px_4px_0px_#ECD5FF]'
      }`}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: subject.accentColor }}
      />

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#141413]/15 dark:border-[#2E2E2A]"
            style={{
              backgroundColor: `color-mix(in srgb, ${subject.accentColor} 14%, transparent)`,
              color: subject.accentColor
            }}
          >
            <SubjectIcon name={subject.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block">
              {subject.phase}
            </span>
            <h3 className="font-heading font-extrabold text-base text-[#141413] dark:text-[#FAF8EC] line-clamp-1">
              {subject.name}
            </h3>
          </div>
        </div>

        {isSelected && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING_TACTILE}
            className="w-6 h-6 rounded-full bg-[#0D47FF] text-white border border-[#141413] flex items-center justify-center shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
          </motion.div>
        )}
      </div>

      <p className="text-xs text-[#40403B] dark:text-[#A3A399] line-clamp-2 leading-relaxed mb-3">
        {subject.description}
      </p>

      <div className="flex items-center justify-between text-[10px] font-mono pt-2.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399] tabular-nums">
        <span>{subject.totalMarks} Marks · {subject.durationMinutes}m</span>
        {notesCount > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] font-bold border border-[#141413]">
            {notesCount} Notes
          </span>
        )}
      </div>
    </motion.div>
  );
}
