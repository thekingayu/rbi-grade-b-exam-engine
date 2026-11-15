import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { TestAttempt } from '../types';
import { useSubject } from '../context/SubjectContext';
import { SubjectIcon } from '../components/dashboard/SubjectIcon';
import {
  ArrowLeft, Plus, TrendingUp, CheckCircle2,
  Target, BookOpen, FileText, Trash2,
  ArrowRight, ChevronRight, UploadCloud, RotateCcw
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { calculateDaysRemaining } from '../utils/date';
import { FuturisticScreenLoader } from '../components/FuturisticLoader';
import { motion } from 'motion/react';
import {
  MotionPage,
  MotionSection,
  MotionStaggerGrid,
  MotionStaggerItem,
  SPRING_SNAPPY,
} from '../components/MotionPrimitives';

export function SubjectDashboard({ user }: { user: User }) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { subjects, setActiveSubject, notes, addNote, deleteNote, mistakes, targetExamDate } = useSubject();
  
  const daysRemaining = calculateDaysRemaining(targetExamDate);
  
  const [tests, setTests] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScoreRange, setFilterScoreRange] = useState<string>('all');
  const [isUploadingNote, setIsUploadingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find subject
  const currentSubject = subjects.find(s => s.slug === slug) || subjects[0];

  useEffect(() => {
    if (currentSubject) {
      setActiveSubject(currentSubject);
    }
    return () => setActiveSubject(null);
  }, [currentSubject, setActiveSubject]);

  useEffect(() => {
    const q = query(
      collection(db, 'tests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTests = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as TestAttempt[];

      const scoped = allTests.filter(t => 
        t.subjectId === currentSubject.id || 
        t.subjectSlug === currentSubject.slug ||
        (!t.subjectId && currentSubject.slug === 'uncategorized')
      );
      scoped.sort((a, b) => b.createdAt - a.createdAt);
      setTests(scoped);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to subject tests:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid, currentSubject]);

  const completed = tests.filter(t => t.status === 'completed');
  const reversedTests = [...completed].reverse();

  // Scoped KPIs
  const testsTaken = completed.length;
  const scorePercentages = completed.map(t => {
    const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
    return Math.round(((t.totalScore || 0) / max) * 100);
  });
  const avgScore = testsTaken > 0 ? Math.round(scorePercentages.reduce((a, b) => a + b, 0) / testsTaken) : 0;
  const bestScore = testsTaken > 0 ? Math.max(...scorePercentages) : 0;

  let momentum = "—";
  if (scorePercentages.length >= 2) {
    const diff = scorePercentages[0] - scorePercentages[1];
    momentum = diff >= 0 ? `+${diff}%` : `${diff}%`;
  }

  // Avg time used percentage
  const avgTimePct = testsTaken > 0
    ? Math.round(completed.reduce((acc, t) => {
        const used = ((t.submittedAt || 0) - (t.startedAt || 0)) / 1000;
        const allotted = t.durationSeconds || 1;
        return acc + (used / allotted) * 100;
      }, 0) / testsTaken)
    : 0;

  // Topic Mastery Table stats
  const topicStats: Record<string, { attempts: number; correct: number; totalQuestions: number; avgTimeSec: number }> = {};
  
  // Seed all syllabus topics so the user can see everything in the curriculum
  (currentSubject.syllabusTopics || []).forEach(topic => {
    topicStats[topic] = { attempts: 0, correct: 0, totalQuestions: 0, avgTimeSec: 45 };
  });

  completed.forEach(t => {
    t.questions?.forEach(q => {
      const topic = q.topic || 'Core Principles';
      if (!topicStats[topic]) {
        topicStats[topic] = { attempts: 0, correct: 0, totalQuestions: 0, avgTimeSec: 45 };
      }
      topicStats[topic].totalQuestions += 1;
      topicStats[topic].attempts += 1;
      if (q.type === 'MCQ' && q.score && q.score > 0) {
        topicStats[topic].correct += 1;
      } else if (q.type === 'Descriptive') {
        const evalScore = t.evaluations?.[q.id || '']?.totalScore || 0;
        if (evalScore >= (q.maxMarks || 15) * 0.5) topicStats[topic].correct += 1;
      }
    });
  });

  const topicList = Object.entries(topicStats).map(([topic, stat]) => {
    const acc = stat.totalQuestions > 0 ? Math.round((stat.correct / stat.totalQuestions) * 100) : 0;
    let status: 'Weak' | 'Improving' | 'Strong' | 'Unattempted' = 'Unattempted';
    if (stat.totalQuestions > 0) {
      if (acc < 40) status = 'Weak';
      else if (acc <= 70) status = 'Improving';
      else status = 'Strong';
    }
    return {
      topic,
      attempts: stat.attempts,
      accuracy: acc,
      avgTime: stat.avgTimeSec,
      status
    };
  });

  // Chart data: Score Trend
  const scoreTrendData = reversedTests.map((t, idx) => {
    const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
    const pct = Math.round(((t.totalScore || 0) / max) * 100);
    return { name: `T${idx + 1}`, score: pct };
  });

  // Chart data: Topic Accuracy Bar
  const topicChartData = topicList.filter(t => t.attempts > 0).slice(0, 6).map(t => ({
    name: t.topic.length > 18 ? t.topic.substring(0, 16) + '…' : t.topic,
    accuracy: t.accuracy
  }));

  // Notes belonging to this subject
  const subjectNotes = notes.filter(n => n.subjectId === currentSubject.id || n.subjectSlug === currentSubject.slug);

  // Mistakes belonging to this subject
  const subjectMistakes = mistakes.filter(m => m.subjectId === currentSubject.id || m.subjectSlug === currentSubject.slug);

  // Filtered test history
  const filteredTests = completed.filter(t => {
    if (filterScoreRange === 'all') return true;
    const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
    const pct = Math.round(((t.totalScore || 0) / max) * 100);
    if (filterScoreRange === 'high') return pct >= 70;
    if (filterScoreRange === 'mid') return pct >= 40 && pct < 70;
    if (filterScoreRange === 'low') return pct < 40;
    return true;
  });

  // Note file upload handler with real text extraction for PDF, DOCX, TXT, and Images
  const handleNoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingNote(true);
    try {
      let text = '';
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        text = await file.text();
      } else {
        // Run chunked upload and Gemini OCR/extraction
        const uploadId = Date.now().toString() + Math.random().toString(36).substring(7);
        const chunkSize = 10 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
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
            body: formData
          });

          if (!chunkRes.ok) throw new Error('Chunk upload failed');
        }

        const res = await fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, mimeType: file.type || 'application/pdf' })
        });

        if (!res.ok) throw new Error('Failed to extract text from document');

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.textChunk) text += data.textChunk;
            } catch (e) {}
          }
        }
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.textChunk) text += data.textChunk;
          } catch (e) {}
        }
      }

      const finalText = text.trim() || `Uploaded note for ${currentSubject.name} (${file.name}).`;

      addNote({
        userId: user.uid,
        subjectId: currentSubject.id,
        subjectSlug: currentSubject.slug,
        fileName: file.name,
        extractedText: finalText,
        size: file.size
      });
    } catch (err: any) {
      console.error("Error uploading note:", err);
      setNoteError("Failed to extract note text: " + (err.message || String(err)));
    } finally {
      setIsUploadingNote(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <FuturisticScreenLoader 
          title={currentSubject.name}
          subtitle="INITIALIZING SUBJECT TELEMETRY..." 
          color="teal"
        />
      </div>
    );
  }

  return (
    <MotionPage className="space-y-8 max-w-7xl mx-auto pt-2 pb-16 relative z-10">
      
      {/* 1. Breadcrumb & Back Link */}
      <div className="flex items-center gap-2 text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
        <Link to="/" className="hover:text-[#0D47FF] dark:hover:text-[#ECD5FF] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-bold text-[#141413] dark:text-[#FAF8EC] uppercase tracking-wider truncate">
          {currentSubject.name}
        </span>
      </div>

      {/* 2. Subject Banner Header */}
      <div className="ink-card-featured rounded-3xl p-5 sm:p-8 bg-[#FAF8EC] dark:bg-[#1C1C1A] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: currentSubject.accentColor }}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10 pt-1">
          <div className="flex items-start gap-3.5 sm:gap-5 min-w-0">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border-[1.5px] border-[#141413]/20 dark:border-[#2E2E2A]"
              style={{
                backgroundColor: `color-mix(in srgb, ${currentSubject.accentColor} 15%, transparent)`,
                color: currentSubject.accentColor
              }}
            >
              <SubjectIcon name={currentSubject.icon} className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md border border-[#141413]/25 dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] text-[#141413] dark:text-[#ECD5FF]">
                  {currentSubject.phase}
                </span>
                <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] tabular-nums">
                  {currentSubject.totalMarks} Marks · {currentSubject.durationMinutes} Minutes · -{currentSubject.negativeMarking} Neg Marking
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#141413] px-2.5 py-0.5 rounded-md bg-[#FFD426] border border-[#141413] tabular-nums">
                  {daysRemaining}d to Exam ({targetExamDate})
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] tracking-tight">
                {currentSubject.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#40403B] dark:text-[#A3A399] mt-1.5 max-w-2xl leading-relaxed">
                {currentSubject.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to="/syllabus"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#FFFFFF] dark:bg-[#141413] hover:bg-[#ECD5FF] hover:text-[#141413] text-[#141413] dark:text-[#FAF8EC] border-[1.5px] border-[#141413] dark:border-[#ECD5FF]/60 px-5 py-3 rounded-xl font-bold transition-colors text-xs sm:text-sm cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF] shrink-0" />
              <span>Syllabus & PDF</span>
            </Link>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              onClick={() => navigate(`/new?subject=${currentSubject.slug}`)}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] px-4 sm:px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-center transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span>Start Exam in {currentSubject.name}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* 3. Scoped KPIs */}
      <MotionStaggerGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <MotionStaggerItem><KpiSubjectCard title="Tests Taken" value={testsTaken.toString()} sub="Completed mocks" /></MotionStaggerItem>
        <MotionStaggerItem><KpiSubjectCard title="Average Score" value={testsTaken > 0 ? `${avgScore}%` : '—'} sub="Overall accuracy" /></MotionStaggerItem>
        <MotionStaggerItem><KpiSubjectCard title="Best Score" value={testsTaken > 0 ? `${bestScore}%` : '—'} sub="Highest attempt" /></MotionStaggerItem>
        <MotionStaggerItem><KpiSubjectCard title="Momentum" value={momentum} sub="Last vs previous" /></MotionStaggerItem>
        <MotionStaggerItem><KpiSubjectCard title="Avg Time Used" value={testsTaken > 0 ? `${avgTimePct}%` : '—'} sub="Pacing efficiency" /></MotionStaggerItem>
        <MotionStaggerItem><KpiSubjectCard title="Saved Mistakes" value={subjectMistakes.length.toString()} sub="For spaced review" /></MotionStaggerItem>
      </MotionStaggerGrid>

      {/* 4. Subject Charts Row */}
      <MotionSection className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Score Trend */}
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col h-[300px] sm:h-[380px] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: currentSubject.accentColor }} />
                <span>Score Trajectory ({currentSubject.name})</span>
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399]">Score % across attempts in this paper</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            {scoreTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
                No completed tests for {currentSubject.name} yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                  <XAxis dataKey="name" stroke="#66665E" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#66665E" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#ECD5FF] shadow-lg text-xs space-y-1">
                            <p className="font-bold">{payload[0].payload.name}</p>
                            <p className="font-mono text-sm font-black text-[#FFD426]">{payload[0].payload.score}% Score</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={currentSubject.accentColor}
                    strokeWidth={3.5}
                    dot={{ r: 4, fill: '#FAF8EC', stroke: currentSubject.accentColor, strokeWidth: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Topic Accuracy Bar */}
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col h-[300px] sm:h-[380px] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: currentSubject.accentColor }} />
                <span>Accuracy by Topic</span>
              </h3>
              <p className="text-xs text-[#66665E] dark:text-[#A3A399]">Mastery breakdown per syllabus chapter</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            {topicChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[#66665E] dark:text-[#A3A399]">
                Attempt questions to reveal topic mastery breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicChartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
                  <XAxis type="number" stroke="#66665E" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" stroke="#66665E" fontSize={10} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="p-3 rounded-xl bg-[#141413] text-[#FAF8EC] border border-[#ECD5FF] shadow-lg text-xs space-y-1">
                            <p className="font-bold">{payload[0].payload.name}</p>
                            <p className="font-mono text-sm font-black text-[#ECD5FF]">{payload[0].payload.accuracy}% Accuracy</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="accuracy" fill={currentSubject.accentColor} radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </MotionSection>

      {/* 5. Topic Mastery Table */}
      <MotionSection className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: currentSubject.accentColor }} />
              <span>Topic Mastery Matrix</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Benchmark per chapter with quick launch practice drills
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">Weak &lt; 40%</span>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#FFD426] text-[#141413] border border-[#141413]">Improving 40-70%</span>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">Strong &gt; 70%</span>
          </div>
        </div>

        <div className="sm:hidden px-4 py-2 text-[11px] font-mono text-[#66665E] dark:text-[#A3A399] border-b border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC]/60 dark:bg-[#141413]/40">
          Swipe table horizontally →
        </div>

        <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-[#FAF8EC] dark:bg-[#141413] text-[#66665E] dark:text-[#A3A399] font-mono uppercase tracking-wider border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
              <tr>
                <th className="py-3 px-4 sm:px-6">Syllabus Topic</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Avg Pace</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A] font-medium">
              {topicList.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6 font-bold text-[#141413] dark:text-[#FAF8EC]">
                    {item.topic}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#66665E] dark:text-[#A3A399] tabular-nums">
                    {item.attempts}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
                    {item.attempts > 0 ? `${item.accuracy}%` : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#66665E] dark:text-[#A3A399] tabular-nums">
                    {item.attempts > 0 ? `${item.avgTime}s` : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusChip status={item.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => navigate(`/new?subject=${currentSubject.slug}&topic=${encodeURIComponent(item.topic)}`)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border border-[#141413] cursor-pointer inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Drill Topic</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MotionSection>

      {/* 6. Subject Notes & Mistake Notebook Row */}
      <MotionSection className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Subject Notes Panel */}
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
                  <span>Subject Notes Repository</span>
                </h3>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                  Notes cataloged for {currentSubject.name}
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleNoteUpload}
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingNote}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0D47FF] hover:bg-[#0936CC] text-white border border-[#141413] shadow-[2px_2px_0px_#141413] cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isUploadingNote ? 'Uploading...' : 'Add Note'}</span>
                </button>
              </div>
            </div>

            {noteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>{noteError}</span>
                <button onClick={() => setNoteError(null)} className="font-bold ml-2 cursor-pointer">✕</button>
              </div>
            )}

            {subjectNotes.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] rounded-2xl">
                <FileText className="w-8 h-8 text-[#66665E] dark:text-[#A3A399] mx-auto mb-2" />
                <p className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC]">No notes uploaded for {currentSubject.name}</p>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">Upload PDF, TXT or DOCX to generate instant focused exams.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {subjectNotes.map(note => (
                  <div key={note.id} className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-[#141413] dark:text-[#FAF8EC] truncate">{note.fileName}</p>
                      <p className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
                        {(note.size / 1024).toFixed(1)} KB · {format(note.uploadedAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate(`/new?subject=${currentSubject.slug}&noteId=${note.id}`)}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border border-[#141413] cursor-pointer transition-colors"
                      >
                        Generate Exam
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1.5 rounded-lg text-[#66665E] hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete note"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mistake Notebook Mini Widget */}
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Mistake Notebook ({currentSubject.name})</span>
                </h3>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
                  Leitner spaced repetition for flawed answers
                </p>
              </div>

              <Link
                to="/mistakes"
                className="text-xs font-bold text-[#0D47FF] dark:text-[#ECD5FF] hover:underline flex items-center gap-1"
              >
                <span>All Mistakes</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {subjectMistakes.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-[#0D47FF] dark:text-[#ECD5FF] mx-auto mb-2" />
                <p className="font-bold text-sm text-[#141413] dark:text-[#FAF8EC]">Zero active mistakes logged!</p>
                <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">Incorrect exam answers automatically appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {subjectMistakes.slice(0, 4).map(m => (
                  <div key={m.id} className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FFD426] text-[#141413] border border-[#141413] mr-2">
                        Box {m.leitnerBox}
                      </span>
                      <span className="font-bold text-xs text-[#141413] dark:text-[#FAF8EC] line-clamp-1">{m.text}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] shrink-0">
                      {m.topic}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {subjectMistakes.length > 0 && (
            <button
              onClick={() => navigate(`/new?subject=${currentSubject.slug}&retryMistakes=true`)}
              className="mt-4 w-full py-2.5 rounded-xl font-bold text-xs bg-[#ECD5FF] hover:bg-[#FFD426] text-[#141413] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry {subjectMistakes.length} Mistakes in {currentSubject.name}</span>
            </button>
          )}
        </div>

      </MotionSection>

      {/* 7. Scoped Test History */}
      <MotionSection className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E5E1CE] dark:border-[#2E2E2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#141413] dark:text-[#FAF8EC]">
              {currentSubject.name} Test History
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399]">
              Filtered archive of attempts logged in this subject
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#66665E] dark:text-[#A3A399] uppercase">Filter:</span>
            <select
              value={filterScoreRange}
              onChange={(e) => setFilterScoreRange(e.target.value)}
              className="min-h-[36px] text-xs font-bold px-3 py-1.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#141413] dark:text-[#FAF8EC] focus:outline-none focus:border-[#0D47FF] dark:focus:border-[#ECD5FF] cursor-pointer"
            >
              <option value="all">All Scores</option>
              <option value="high">Score &gt;= 70%</option>
              <option value="mid">Score 40% - 69%</option>
              <option value="low">Score &lt; 40%</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-[#E5E1CE] dark:divide-[#2E2E2A]">
          {filteredTests.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#66665E] dark:text-[#A3A399]">
              No matching tests found.
            </div>
          ) : (
            filteredTests.map(test => {
              const maxMarks = test.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
              const pct = Math.round(((test.totalScore || 0) / maxMarks) * 100);
              return (
                <div key={test.id} className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8EC]/60 dark:hover:bg-[#141413]/50 transition-colors">
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#141413] dark:text-[#FAF8EC] text-sm">
                      Exam Attempt · {format(test.createdAt, 'MMM d, yyyy · h:mm a')}
                    </h4>
                    <p className="text-xs text-[#66665E] dark:text-[#A3A399] font-mono mt-0.5">
                      {test.questions?.length} Questions · Mode: {test.mode || 'Standard'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <span className="text-lg font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] tabular-nums">
                      {pct}%
                    </span>
                    <Link
                      to={`/results/${test.id}`}
                      className="min-h-[36px] inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] hover:bg-[#0D47FF] hover:text-white hover:border-[#141413] text-[#141413] dark:text-[#FAF8EC] transition-colors"
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </MotionSection>

    </MotionPage>
  );
}

function KpiSubjectCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={SPRING_SNAPPY}
      className="h-full bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] rounded-2xl p-4 flex flex-col justify-between min-h-[100px] transition-colors"
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold truncate">
        {title}
      </span>
      <div>
        <p className="text-2xl font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-[10px] text-[#66665E] dark:text-[#A3A399] truncate mt-0.5">
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

function StatusChip({ status }: { status: 'Weak' | 'Improving' | 'Strong' | 'Unattempted' }) {
  if (status === 'Strong') {
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">Strong</span>;
  }
  if (status === 'Improving') {
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#FFD426] text-[#141413] border border-[#141413]">Improving</span>;
  }
  if (status === 'Weak') {
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">Weak</span>;
  }
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] border border-[#E5E1CE] dark:border-[#2E2E2A]">Unattempted</span>;
}
