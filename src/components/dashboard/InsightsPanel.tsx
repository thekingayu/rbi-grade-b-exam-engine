import React from 'react';
import { motion } from 'motion/react';
import { Subject, TestAttempt } from '../../types';
import { 
  AlertTriangle, TrendingUp, Clock, Zap, Target, 
  Compass 
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { MotionStaggerGrid, MotionStaggerItem, SPRING_SNAPPY } from '../MotionPrimitives';

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
          icon: <Compass className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />,
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
        icon: <Zap className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />,
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

  const dotColor = {
    warning: 'bg-rose-500',
    positive: 'bg-emerald-500',
    action: 'bg-[#0D47FF]',
    neutral: 'bg-[#141413]'
  };

  return (
    <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.slice(0, 4).map(item => (
        <MotionStaggerItem key={item.id} className="h-full">
          <motion.div
            whileHover={{ y: -3 }}
            transition={SPRING_SNAPPY}
            className="relative h-full p-4 rounded-2xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A] text-[#141413] dark:text-[#FAF8EC] flex flex-col justify-between transition-colors hover:border-[#141413] dark:hover:border-[#ECD5FF] hover:shadow-[3px_3px_0px_#141413] dark:hover:shadow-[3px_3px_0px_#ECD5FF]"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm line-clamp-1">{item.title}</h4>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor[item.type]}`} />
              </div>
              <p className="text-xs text-[#55554F] dark:text-[#A3A399] line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>
          </motion.div>
        </MotionStaggerItem>
      ))}
    </MotionStaggerGrid>
  );
}
