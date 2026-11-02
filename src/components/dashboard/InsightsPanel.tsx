import React from 'react';
import { Subject, TestAttempt } from '../../types';
import { 
  AlertTriangle, TrendingUp, Clock, Zap, Target, 
  CheckCircle2, Compass, Award 
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface InsightsPanelProps {
  subjects: Subject[];
  tests: TestAttempt[];
}

export function InsightsPanel({ subjects, tests }: InsightsPanelProps) {
  const completed = tests.filter(t => t.status === 'completed');

  // Compute insights
  const insights: {
    id: string;
    type: 'warning' | 'positive' | 'action' | 'neutral';
    icon: React.ReactNode;
    title: string;
    description: string;
    subjectSlug?: string;
  }[] = [];

  // 1. Weakest subject & Most improved subject
  const subjectScores: Record<string, { total: number; count: number; name: string; slug: string; history: number[] }> = {};
  
  subjects.forEach(s => {
    subjectScores[s.id] = { total: 0, count: 0, name: s.name, slug: s.slug, history: [] };
  });

  completed.forEach(t => {
    const sId = t.subjectId || 'sub_uncategorized';
    if (!subjectScores[sId]) {
      const match = subjects.find(s => s.slug === t.subjectSlug);
      if (match) {
        subjectScores[match.id].count += 1;
        const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
        const pct = Math.round(((t.totalScore || 0) / max) * 100);
        subjectScores[match.id].total += pct;
        subjectScores[match.id].history.push(pct);
        return;
      }
    } else {
      subjectScores[sId].count += 1;
      const max = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 1;
      const pct = Math.round(((t.totalScore || 0) / max) * 100);
      subjectScores[sId].total += pct;
      subjectScores[sId].history.push(pct);
    }
  });

  // Calculate averages
  let weakest = { name: '', slug: '', avg: 101 };
  let mostImproved = { name: '', slug: '', delta: -999 };

  Object.entries(subjectScores).forEach(([_, data]) => {
    if (data.count > 0) {
      const avg = data.total / data.count;
      if (avg < weakest.avg) {
        weakest = { name: data.name, slug: data.slug, avg };
      }
      if (data.history.length >= 2) {
        const delta = data.history[data.history.length - 1] - data.history[0];
        if (delta > mostImproved.delta) {
          mostImproved = { name: data.name, slug: data.slug, delta };
        }
      }
    }
  });

  if (weakest.avg <= 100 && weakest.name) {
    insights.push({
      id: 'weakest-subject',
      type: 'warning',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
      title: `Critical Focus: ${weakest.name}`,
      description: `Current average score is ${Math.round(weakest.avg)}%. Recommended for sectional revision drills.`,
      subjectSlug: weakest.slug
    });
  }

  if (mostImproved.delta > 5 && mostImproved.name) {
    insights.push({
      id: 'most-improved',
      type: 'positive',
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
      title: `Momentum Surge: ${mostImproved.name}`,
      description: `Up by +${Math.round(mostImproved.delta)}% across recent mock tests. Retention trajectory is strong!`,
      subjectSlug: mostImproved.slug
    });
  }

  // 2. Unattempted subjects or dormant subjects
  const now = new Date();
  subjects.slice(0, 7).forEach(s => {
    const sTests = completed.filter(t => t.subjectId === s.id || t.subjectSlug === s.slug);
    if (sTests.length === 0) {
      if (insights.length < 4) {
        insights.push({
          id: `unattempted-${s.id}`,
          type: 'action',
          icon: <Compass className="w-4 h-4 text-cyan-500" />,
          title: `Diagnostic Pending: ${s.name}`,
          description: `No attempts recorded yet. Take an initial diagnostic mock to benchmark baseline performance.`,
          subjectSlug: s.slug
        });
      }
    } else {
      const last = new Date(sTests[0].submittedAt || sTests[0].createdAt);
      const daysSince = differenceInDays(now, last);
      if (daysSince >= 7 && insights.length < 4) {
        insights.push({
          id: `dormant-${s.id}`,
          type: 'warning',
          icon: <Clock className="w-4 h-4 text-amber-500" />,
          title: `Recency Alert: ${s.name}`,
          description: `You haven't attempted a test in ${daysSince} days. Active recall is dropping below optimal curve.`,
          subjectSlug: s.slug
        });
      }
    }
  });

  // 3. Time efficiency check
  const slowTests = completed.filter(t => {
    const timeUsed = ((t.submittedAt || 0) - (t.startedAt || 0)) / 1000;
    return timeUsed >= (t.durationSeconds || 1) * 0.95;
  });
  if (slowTests.length >= 2 && insights.length < 4) {
    insights.push({
      id: 'time-caution',
      type: 'warning',
      icon: <Clock className="w-4 h-4 text-rose-500" />,
      title: 'Time Boundary Strain',
      description: `You utilized 95%+ of allotted time in ${slowTests.length} tests. Practice sectional 10-min speed drills.`,
    });
  }

  // Fallback defaults if few tests
  if (insights.length === 0) {
    insights.push(
      {
        id: 'start-smart',
        type: 'action',
        icon: <Zap className="w-4 h-4 text-teal-500" />,
        title: 'Phase 1 & Phase 2 Balance',
        description: 'Alternate daily between General Awareness static GK and ESI macro-policy descriptive writing.',
      },
      {
        id: 'mistake-discipline',
        type: 'positive',
        icon: <Target className="w-4 h-4 text-indigo-500" />,
        title: 'Leitner Spaced Repetition',
        description: 'Incorrect answers automatically sync into your Mistake Notebook with 5-stage Leitner spaced review.',
      }
    );
  }

  const typeStyles = {
    warning: 'border-rose-500/25 bg-rose-500/5 text-rose-900 dark:text-rose-100',
    positive: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    action: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-900 dark:text-cyan-100',
    neutral: 'border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-800 dark:text-slate-200'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.slice(0, 4).map(item => (
        <div
          key={item.id}
          className={`relative p-4 rounded-2xl border backdrop-blur-xl flex flex-col justify-between transition-all hover:-translate-y-0.5 shadow-sm ${typeStyles[item.type]}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0 shadow-xs">
              {item.icon}
            </div>
            <h4 className="font-bold text-xs sm:text-sm line-clamp-1">{item.title}</h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
