import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Subject, TestAttempt } from '../../types';
import { SubjectIcon } from './SubjectIcon';
import { BookOpen, Play, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EASE_OUT_EXPO, AnimatedNumber } from '../MotionPrimitives';
import { Glass3DCard } from '../ui/Glass3DCard';

interface SubjectCardProps {
  key?: React.Key;
  subject: Subject;
  tests: TestAttempt[];
}

const ACCENT_PAIRINGS: Record<string, string> = {
  'general-awareness': '#14B8A6',
  reasoning: '#0EA5E9',
  quant: '#4F46E5',
  english: '#F43F5E',
  esi: '#EA580C',
  'english-writing': '#6366F1',
  fm: '#059669'
};

export function SubjectCard({ subject, tests }: SubjectCardProps) {
  const navigate = useNavigate();

  // Filter attempts belonging to this subject
  const subjectTests = tests.filter(
    t =>
      t.subjectId === subject.id ||
      t.subjectSlug === subject.slug ||
      (!t.subjectId && subject.slug === 'uncategorized')
  );

  const completedTests = subjectTests.filter(t => t.status === 'completed');
  const testsCount = completedTests.length;

  // Calculate scores
  const scores = completedTests.map(t => {
    const totalMax = t.questions?.reduce((sum, q) => sum + (q.maxMarks || 0), 0) || 0;
    return totalMax > 0 ? Math.round(((t.totalScore || 0) / totalMax) * 100) : 0;
  });

  const avgScore = testsCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / testsCount) : 0;

  // Compute readiness score
  const volumeFactor = Math.min(100, testsCount * 20);
  const recentScore = scores.length > 0 ? scores[0] : 0;
  const readiness =
    testsCount === 0 ? 0 : Math.round(avgScore * 0.5 + recentScore * 0.3 + volumeFactor * 0.2);

  // Weakest topic calculation
  const topicStats: Record<string, { total: number; correct: number }> = {};
  completedTests.forEach(t => {
    t.questions?.forEach(q => {
      const topic = q.topic || 'General Core';
      if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
      topicStats[topic].total += 1;
      if (q.type === 'MCQ' && q.score && q.score > 0) {
        topicStats[topic].correct += 1;
      } else if (q.type === 'Descriptive') {
        const evalScore = t.evaluations?.[q.id || '']?.totalScore || 0;
        if (evalScore >= (q.maxMarks || 15) * 0.5) topicStats[topic].correct += 1;
      }
    });
  });

  let weakestTopic = 'Syllabus Core';
  let lowestAcc = 101;
  Object.entries(topicStats).forEach(([t, stat]) => {
    if (stat.total >= 2) {
      const acc = (stat.correct / stat.total) * 100;
      if (acc < lowestAcc) {
        lowestAcc = acc;
        weakestTopic = t;
      }
    }
  });

  const lastAttempt =
    completedTests.length > 0 ? completedTests[0].submittedAt || completedTests[0].createdAt : null;

  const sparklineData = scores.slice(0, 7).reverse();
  const sparklinePoints =
    sparklineData.length > 1
      ? sparklineData
          .map((s, idx) => {
            const x = (idx / (sparklineData.length - 1)) * 96 + 2;
            const y = 22 - (s / 100) * 18;
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  const accentColor = subject.accentColor || '#0D47FF';
  const secondaryAccent = ACCENT_PAIRINGS[subject.slug] || accentColor;

  return (
    <Glass3DCard
      accentColor={accentColor}
      secondaryAccentColor={secondaryAccent}
      logoIcon={<SubjectIcon name={subject.icon} className="w-5 h-5" />}
      kicker={`${subject.phase} · ${subject.totalMarks}M · ${subject.durationMinutes}m`}
      title={subject.name}
      description={subject.description}
      ctaLabel="Workbench"
      onCardClick={() => navigate(`/subject/${subject.slug}`)}
      minHeightClass="min-h-[328px]"
      actions={[
        {
          label: `Start ${subject.name} Mock`,
          icon: <Play className="w-3.5 h-3.5 fill-current" />,
          onClick: () => navigate(`/new?subject=${subject.slug}`)
        },
        {
          label: `Inspect ${subject.name} Syllabus`,
          icon: <BookOpen className="w-3.5 h-3.5" />,
          onClick: () => navigate('/syllabus')
        },
        {
          label: `Review ${subject.name} Mistakes`,
          icon: <Target className="w-3.5 h-3.5" />,
          onClick: () => navigate('/mistakes')
        }
      ]}
    >
      {/* Clean Unboxed Telemetry Grid */}
      <div className="pt-3 border-t border-[#141413]/10 dark:border-[#FAF8EC]/10 space-y-3">
        <div className="grid grid-cols-3 gap-2 tabular-nums">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396] block">
              Attempts
            </span>
            <span className="text-base sm:text-lg font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
              <AnimatedNumber value={testsCount} />
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396] block">
              Avg Score
            </span>
            <span className="text-base sm:text-lg font-heading font-black text-[#141413] dark:text-[#FAF8EC]">
              {testsCount > 0 ? <AnimatedNumber value={avgScore} suffix="%" /> : '—'}
            </span>
          </div>

          <div className="min-w-0 text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5C5A52] dark:text-[#A8A396] block">
              Readiness
            </span>
            <span
              className="text-base sm:text-lg font-heading font-black"
              style={{ color: accentColor }}
            >
              <AnimatedNumber value={readiness} suffix="%" />
            </span>
          </div>
        </div>

        {/* Readiness Progress Hairline or Recent Sparkline */}
        {sparklinePoints ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-[#5C5A52] dark:text-[#A8A396] uppercase tracking-wider">
              Trend
            </span>
            <svg className="w-24 h-5 overflow-visible" viewBox="0 0 100 24">
              <motion.polyline
                fill="none"
                stroke={accentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
                initial={{ pathLength: 0, opacity: 0.3 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 1.1, ease: EASE_OUT_EXPO }}
              />
            </svg>
          </div>
        ) : (
          <div className="w-full h-1.5 rounded-full bg-[#141413]/10 dark:bg-[#FAF8EC]/10 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0.04, readiness / 100) }}
              transition={{ duration: 0.85, ease: EASE_OUT_EXPO }}
              className="h-full w-full rounded-full origin-left"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] text-[#5C5A52] dark:text-[#A8A396]">
          <span className="truncate font-semibold text-[#141413] dark:text-[#FAF8EC]" title={weakestTopic}>
            {weakestTopic}
          </span>
          <span className="text-[10px] font-mono shrink-0">
            {lastAttempt ? formatDistanceToNow(lastAttempt, { addSuffix: true }) : 'Ready to start'}
          </span>
        </div>
      </div>
    </Glass3DCard>
  );
}
