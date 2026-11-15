import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Subject, TestAttempt } from '../../types';
import { SubjectIcon } from './SubjectIcon';
import { ReadinessRing } from './ReadinessRing';
import { ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EASE_OUT_EXPO, SPRING_BOUNCY, AnimatedNumber } from '../MotionPrimitives';

interface SubjectCardProps {
  key?: React.Key;
  subject: Subject;
  tests: TestAttempt[];
}

export function SubjectCard({ subject, tests }: SubjectCardProps) {
  // Filter attempts belonging to this subject
  const subjectTests = tests.filter(t => 
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
  const readiness = testsCount === 0 ? 0 : Math.round(
    avgScore * 0.5 + recentScore * 0.3 + volumeFactor * 0.2
  );

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

  const lastAttempt = completedTests.length > 0 ? completedTests[0].submittedAt || completedTests[0].createdAt : null;

  const sparklineData = scores.slice(0, 7).reverse();
  const sparklinePoints = sparklineData.length > 1
    ? sparklineData.map((s, idx) => {
        const x = (idx / (sparklineData.length - 1)) * 96 + 2;
        const y = 24 - (s / 100) * 20;
        return `${x},${y}`;
      }).join(' ')
    : '';

  return (
    <motion.div
      whileHover={{ y: -7, scale: 1.014 }}
      whileTap={{ scale: 0.968 }}
      transition={SPRING_BOUNCY}
      className="h-full will-change-transform"
    >
      <Link
        to={`/subject/${subject.slug}`}
        className="group relative h-full flex flex-col justify-between bg-[#FFFFFF] dark:bg-[#1C1C1A] rounded-2xl p-4 sm:p-6 border border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF] hover:shadow-[4px_4px_0px_#141413] dark:hover:shadow-[4px_4px_0px_#ECD5FF] transition-all duration-200 overflow-hidden cursor-pointer"
      >
        {/* Clean solid top color rule */}
        <div 
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: subject.accentColor || '#0D47FF' }}
        />

        {/* Top Header Row */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-[#141413]/15 dark:border-white/10 transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
                style={{
                  backgroundColor: `color-mix(in srgb, ${subject.accentColor || '#0D47FF'} 14%, transparent)`,
                  color: subject.accentColor || '#0D47FF'
                }}
              >
                <SubjectIcon name={subject.icon} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] truncate">
                  {subject.phase} · {subject.totalMarks}M · {subject.durationMinutes}m
                </div>
                <h3 className="font-heading font-extrabold text-lg text-[#141413] dark:text-[#FAF8EC] mt-0.5 group-hover:text-[#0D47FF] dark:group-hover:text-[#ECD5FF] transition-colors line-clamp-1">
                  {subject.name}
                </h3>
              </div>
            </div>

            <ReadinessRing 
              score={readiness} 
              color={subject.accentColor || '#0D47FF'} 
              size={54} 
              strokeWidth={5} 
            />
          </div>

          <p className="text-xs text-[#55554F] dark:text-[#A3A399] line-clamp-2 mb-4 leading-relaxed font-normal">
            {subject.description}
          </p>
        </div>

        {/* Metric Middle Row */}
        <div className="pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block mb-0.5">
                Attempts
              </span>
              <span className="text-lg font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                <AnimatedNumber value={testsCount} /> <span className="text-xs font-medium text-[#66665E] dark:text-[#A3A399]">tests</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] block mb-0.5">
                Avg. Score
              </span>
              <span className="text-lg font-heading font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                {testsCount > 0 ? <AnimatedNumber value={avgScore} suffix="%" /> : '—'}
              </span>
            </div>
          </div>

          {sparklinePoints && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase tracking-wider">
                Recent Trend
              </span>
              <svg className="w-24 h-6 overflow-visible" viewBox="0 0 100 26">
                <motion.polyline
                  fill="none"
                  stroke={subject.accentColor || '#0D47FF'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                  initial={{ pathLength: 0, opacity: 0.3 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 1.25, ease: EASE_OUT_EXPO }}
                />
              </svg>
            </div>
          )}

          <div className="flex flex-col gap-1 text-[11px] font-medium text-[#55554F] dark:text-[#A3A399]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#66665E] dark:text-[#8E8E85]">Priority Topic:</span>
              <span className="font-bold text-[#141413] dark:text-[#FAF8EC] truncate max-w-[140px] sm:max-w-[170px]" title={weakestTopic}>
                {weakestTopic}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#66665E] dark:text-[#A3A399]">
              <span>Last Attempt:</span>
              <span>{lastAttempt ? formatDistanceToNow(lastAttempt, { addSuffix: true }) : 'Never attempted'}</span>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="mt-4 pt-3 border-t border-[#E5E1CE] dark:border-[#2E2E2A] flex items-center justify-between text-xs font-bold text-[#141413] dark:text-[#FAF8EC] group-hover:text-[#0D47FF] dark:group-hover:text-[#ECD5FF] transition-colors">
          <span>Open Subject Workbench</span>
          <div className="w-7 h-7 rounded-lg bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A] group-hover:bg-[#0D47FF] group-hover:border-[#0D47FF] group-hover:text-white flex items-center justify-center transition-all">
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
