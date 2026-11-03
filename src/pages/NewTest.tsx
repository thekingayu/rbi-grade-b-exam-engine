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
import { Spinner } from 'sketchbook-ui';
import { SynthesisOverlay } from '../components/SynthesisOverlay';

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
    difficulty: 'Moderate' as 'Easy' | 'Moderate' | 'Hard',
    timerEnabled: true,
    negativeMarkingEnabled: true
  });

  // Load last-used subject config from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem(`rbi_cfg_${selectedSubject.slug}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    } else {
      // Set sensible defaults based on subject questionTypeMix
      const mix = selectedSubject.questionTypeMix;
      setConfig(prev => ({
        ...prev,
        mcqStatic: mix.mcq ? Math.ceil(mix.defaultMcqCount * 0.6) : 0,
        mcqDynamic: mix.mcq ? Math.floor(mix.defaultMcqCount * 0.4) : 0,
        descStatic: mix.descriptive ? Math.ceil(mix.defaultDescCount * 0.5) : 0,
        descDynamic: mix.descriptive ? Math.floor(mix.defaultDescCount * 0.5) : 0,
        negativeMarkingEnabled: selectedSubject.negativeMarking > 0
      }));
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

  const estimatedDurationMinutes = examMode === 'Quick 10-min' ? 10 :
                                   examMode === 'Topic Drill' ? 15 :
                                   Math.max(10, Math.ceil(((config.mcqStatic + config.mcqDynamic) * 45 + (config.descStatic + config.descDynamic) * 900) / 60));

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
            targetTopic: selectedTopic
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
        difficulty: config.difficulty,
        maxMarks: q.type === 'MCQ' ? 1 : (q.maxMarks || 15)
      }));

      const durationSeconds = estimatedDurationMinutes * 60;

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'tests'), {
        userId: user.uid,
        createdAt: Date.now(),
        status: 'setup',
        subjectId: selectedSubject.id,
        subjectSlug: selectedSubject.slug,
        subjectName: selectedSubject.name,
        mode: examMode,
        targetTopic: selectedTopic,
        config: {
          ...config,
          mode: examMode,
          targetTopic: selectedTopic
        },
        sourceNoteFileRefs: files.map(f => f.name),
        extractedNotesText: finalExtractedText.substring(0, 5000), // excerpt
        durationSeconds,
        negativeMarks: config.negativeMarkingEnabled ? selectedSubject.negativeMarking : 0,
        questions: normalizedQuestions
      });

      navigate(`/exam/${docRef.id}`);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setUploadError(err.message || "An unexpected error occurred while generating the examination.");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-2 pb-16 relative z-10 animate-in fade-in duration-500">
      
      {/* Top Breadcrumb & Step Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
            <Link to="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-900 dark:text-white uppercase">
              Step {step} of 3
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white">
            {step === 1 && "Choose Examination Subject"}
            {step === 2 && `Provide Source Material · ${selectedSubject.name}`}
            {step === 3 && `Configure & Launch · ${selectedSubject.name}`}
          </h1>
        </div>

        {/* 3-Step Animated Stepper */}
        <div className="flex items-center gap-2 bg-white/70 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-xs">
          {[
            { s: 1, label: 'Subject' },
            { s: 2, label: 'Source' },
            { s: 3, label: 'Settings' }
          ].map(item => (
            <button
              key={item.s}
              onClick={() => {
                if (item.s < step) setStep(item.s);
              }}
              disabled={item.s > step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                step === item.s 
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md' 
                  : item.s < step 
                    ? 'text-teal-600 dark:text-teal-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer'
                    : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {item.s < step ? <Check className="w-3 h-3 text-current" /> : item.s}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: CHOOSE SUBJECT */}
      {step === 1 && (
        <div className="space-y-6">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject, chapter, or phase (e.g. 'General Awareness', 'Monetary Policy', 'ESI')..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/80 dark:bg-[#070B19]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:border-teal-500 shadow-sm transition-all"
            />
          </div>

          {/* Phase 1 Subjects */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <h2 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Phase 1 Preliminary Examinations
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phase1List.map(s => (
                <SubjectPickerCard
                  key={s.id}
                  subject={s}
                  isSelected={selectedSubject.id === s.id}
                  notesCount={notes.filter(n => n.subjectId === s.id).length}
                  onSelect={() => {
                    setSelectedSubject(s);
                    setStep(2);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Phase 2 Subjects */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h2 className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Phase 2 Main Examinations
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {phase2List.map(s => (
                <SubjectPickerCard
                  key={s.id}
                  subject={s}
                  isSelected={selectedSubject.id === s.id}
                  notesCount={notes.filter(n => n.subjectId === s.id).length}
                  onSelect={() => {
                    setSelectedSubject(s);
                    setStep(2);
                  }}
                />
              ))}
            </div>
          </div>

        </div>
      )}

      {/* STEP 2: CHOOSE SOURCE / UPLOAD NOTES */}
      {step === 2 && (
        <div className="space-y-6">
          
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
                <button
                  key={tab.id}
                  onClick={() => setSourceMode(tab.id as any)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[95px] ${
                    isCurrent
                      ? 'bg-teal-500/10 dark:bg-teal-500/20 border-teal-500/50 shadow-md shadow-teal-500/10 text-teal-900 dark:text-teal-200'
                      : 'bg-white/70 dark:bg-[#070B19]/80 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 ${isCurrent ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                  <div>
                    <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{tab.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Source 1: Upload Documents */}
          {sourceMode === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-500/30 dark:border-teal-500/20 hover:border-teal-500 rounded-3xl p-8 sm:p-12 text-center bg-white/70 dark:bg-[#070B19]/80 backdrop-blur-2xl transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
                  Drop your study notes or images here or click to browse
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Supports PDF, DOCX, TXT, MD, and Images (PNG, JPG, JPEG, WEBP up to 200MB).
                </p>
              </div>

              {/* Uploaded File Chips */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Uploaded Files ({files.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 backdrop-blur-md"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {file.name}
                            </p>
                            <span className="text-[10px] font-mono text-slate-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
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
                <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02]">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No notes in {selectedSubject.name} repository yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Switch to 'Upload Document' to add your first PDF or circular.</p>
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
                            ? 'bg-teal-500/10 dark:bg-teal-500/20 border-teal-500 text-teal-900 dark:text-teal-100'
                            : 'bg-white/70 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm truncate text-slate-900 dark:text-white">{n.fileName}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{(n.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300 dark:border-white/20'
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
              <label className="text-xs font-mono uppercase tracking-wider text-slate-500 block">
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
                          ? 'bg-teal-500/15 dark:bg-teal-500/20 border-teal-500 text-teal-900 dark:text-teal-200'
                          : 'bg-white/70 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{t}</span>
                      {isSelected && <Check className="w-4 h-4 text-teal-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source 4: Retry Mistakes */}
          {sourceMode === 'mistakes' && (
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Retry {currentSubjectMistakes.length} Saved Mistakes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Questions you answered incorrectly or skipped in previous {selectedSubject.name} attempts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-white/10">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Subject</span>
            </button>

            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>Next: Configure Exam</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* STEP 3: CONFIGURE & LAUNCH */}
      {step === 3 && (
        <div className="space-y-6">
          
          {/* Exam Mode Selector */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-2">
              Examination Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['Full Mock', 'Sectional', 'Topic Drill', 'Quick 10-min'] as ExamMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setExamMode(mode);
                    if (mode === 'Quick 10-min') {
                      setConfig(prev => ({ ...prev, mcqStatic: 5, mcqDynamic: 5, descStatic: 0, descDynamic: 0 }));
                    } else if (mode === 'Full Mock') {
                      const mix = selectedSubject.questionTypeMix;
                      setConfig(prev => ({
                        ...prev,
                        mcqStatic: mix.mcq ? Math.ceil(mix.defaultMcqCount * 0.6) : 0,
                        mcqDynamic: mix.mcq ? Math.floor(mix.defaultMcqCount * 0.4) : 0,
                        descStatic: mix.descriptive ? Math.ceil(mix.defaultDescCount * 0.5) : 0,
                        descDynamic: mix.descriptive ? Math.floor(mix.defaultDescCount * 0.5) : 0
                      }));
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                    examMode === mode
                      ? 'bg-teal-500/15 dark:bg-teal-500/20 border-teal-500 text-teal-800 dark:text-teal-200 shadow-xs'
                      : 'bg-white/70 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard-Entering Question Breakdown Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* MCQs */}
            {selectedSubject.questionTypeMix.mcq && (
              <div className="p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10">
                  <span className="font-serif font-bold text-sm text-slate-900 dark:text-white">
                    Multiple Choice Questions
                  </span>
                  <span className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                    Total MCQ: {config.mcqStatic + config.mcqDynamic} Qs
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Static MCQs Number Input */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Static Theory MCQs</span>
                      <span className="text-[10px] text-slate-400">Core concepts & rules</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqStatic: Math.max(0, config.mcqStatic - 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={config.mcqStatic === 0 ? '0' : config.mcqStatic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, mcqStatic: isNaN(val) ? 0 : Math.max(0, Math.min(50, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqStatic: Math.min(50, config.mcqStatic + 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Dynamic MCQs Number Input */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Dynamic Current Affairs MCQs</span>
                      <span className="text-[10px] text-slate-400">Policy circulars & budget</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqDynamic: Math.max(0, config.mcqDynamic - 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={config.mcqDynamic === 0 ? '0' : config.mcqDynamic}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setConfig({ ...config, mcqDynamic: isNaN(val) ? 0 : Math.max(0, Math.min(50, val)) });
                        }}
                        className="w-16 h-9 text-center font-mono font-bold text-sm bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, mcqDynamic: Math.min(50, config.mcqDynamic + 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
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
              <div className="p-5 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/10">
                  <span className="font-serif font-bold text-sm text-slate-900 dark:text-white">
                    Phase 2 Analytical Descriptive
                  </span>
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    Total Desc: {config.descStatic + config.descDynamic} Qs
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Static Descriptive Number Input */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Static Analytical Essays</span>
                      <span className="text-[10px] text-slate-400">Theory & framework prompts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descStatic: Math.max(0, config.descStatic - 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
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
                        className="w-16 h-9 text-center font-mono font-bold text-sm bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descStatic: Math.min(10, config.descStatic + 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Descriptive Number Input */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Dynamic Policy Questions</span>
                      <span className="text-[10px] text-slate-400">Macroeconomic reforms</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descDynamic: Math.max(0, config.descDynamic - 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
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
                        className="w-16 h-9 text-center font-mono font-bold text-sm bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, descDynamic: Math.min(10, config.descDynamic + 1) })}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Difficulty & Rule Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Difficulty */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 block">
                Standard Benchmark
              </span>
              <div className="flex items-center gap-1.5">
                {(['Easy', 'Moderate', 'Hard'] as const).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setConfig({ ...config, difficulty: diff })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      config.difficulty === diff
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Toggle */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Enforce Exam Timer</span>
                <span className="text-[10px] text-slate-500">Simulate official clock</span>
              </div>
              <input
                type="checkbox"
                checked={config.timerEnabled}
                onChange={(e) => setConfig({ ...config, timerEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer"
              />
            </div>

            {/* Negative Marking Toggle */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#070B19]/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Negative Marking</span>
                <span className="text-[10px] text-slate-500">-{selectedSubject.negativeMarking} per wrong MCQ</span>
              </div>
              <input
                type="checkbox"
                checked={config.negativeMarkingEnabled}
                onChange={(e) => setConfig({ ...config, negativeMarkingEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer"
              />
            </div>

          </div>

          {/* Live Summary Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white border border-teal-500/30 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400">
                  EXAMINATION BLUEPRINT SUMMARY
                </span>
                <h3 className="text-xl font-serif font-black">{selectedSubject.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Mode: {examMode} · Topic: {selectedTopic}</p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Questions</span>
                  <span className="text-2xl font-serif font-black text-teal-300">{totalQuestions}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Duration</span>
                  <span className="text-2xl font-serif font-black text-cyan-300">{estimatedDurationMinutes}m</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Max Marks</span>
                  <span className="text-2xl font-serif font-black text-white">{totalCalculatedMarks}</span>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Back to Sources
              </button>

              <button
                onClick={handleGenerateExam}
                disabled={uploading || totalQuestions === 0}
                className="sketch-tactile-btn px-8 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:via-cyan-400 hover:to-indigo-500 text-white shadow-xl shadow-teal-500/30 cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Begin Examination</span>
              </button>
            </div>
          </div>

        </div>
      )}

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

    </div>
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
    <div
      onClick={onSelect}
      className={`p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[160px] group ${
        isSelected
          ? 'bg-white dark:bg-[#070B19] shadow-xl border-teal-500 ring-2 ring-teal-500/30'
          : 'bg-white/70 dark:bg-[#070B19]/70 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-1'
      }`}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: subject.accentColor }}
      />

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `color-mix(in srgb, ${subject.accentColor} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${subject.accentColor} 30%, transparent)`,
              color: subject.accentColor
            }}
          >
            <SubjectIcon name={subject.icon} className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block">
              {subject.phase}
            </span>
            <h3 className="font-serif font-black text-base text-slate-900 dark:text-white line-clamp-1">
              {subject.name}
            </h3>
          </div>
        </div>

        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3">
        {subject.description}
      </p>

      <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-slate-100 dark:border-white/5 text-slate-500">
        <span>{subject.totalMarks} Marks · {subject.durationMinutes}m</span>
        {notesCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
            {notesCount} Notes
          </span>
        )}
      </div>
    </div>
  );
}
