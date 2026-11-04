import React, { useState, useEffect, useRef } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useSubject } from '../context/SubjectContext';
import { UserProfile } from '../types';
import { 
  User as UserIcon, Camera, Mail, Shield, Award, Calendar, 
  Target, Clock, BookOpen, Check, AlertCircle, Save, Sparkles, 
  RotateCcw, ArrowLeft, LogOut, KeyRound, ExternalLink, RefreshCw 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDaysRemaining } from '../utils/date';

// 6 Curated High-Fidelity RBI Officer Avatars
const PRESET_AVATARS = [
  {
    id: 'avatar_officer_formal',
    name: 'Executive Cadre Officer',
    badge: 'Phase 1 & 2',
    svgGradient: 'from-teal-600 to-cyan-700',
    iconText: '🏛️'
  },
  {
    id: 'avatar_economist',
    name: 'DEPR Lead Economist',
    badge: 'Economic Policy',
    svgGradient: 'from-indigo-600 to-blue-700',
    iconText: '📈'
  },
  {
    id: 'avatar_quant',
    name: 'DSIM Quant Specialist',
    badge: 'Data Science',
    svgGradient: 'from-emerald-600 to-teal-700',
    iconText: '📊'
  },
  {
    id: 'avatar_banker',
    name: 'Monetary Policy Analyst',
    badge: 'Banking & FM',
    svgGradient: 'from-amber-600 to-orange-700',
    iconText: '🏦'
  },
  {
    id: 'avatar_governor',
    name: 'Senior Cadre Aspirant',
    badge: 'Central Banking',
    svgGradient: 'from-purple-600 to-pink-700',
    iconText: '⚖️'
  },
  {
    id: 'avatar_cyber',
    name: 'Financial Stability Lead',
    badge: 'Gov & Audit',
    svgGradient: 'from-slate-700 to-slate-900',
    iconText: '🛡️'
  }
];

export function Profile({ user }: { user: User }) {
  const { 
    userProfile, 
    updateUserProfile, 
    targetExamDate, 
    setTargetExamDate, 
    targetScoreGoal, 
    setTargetScoreGoal,
    mistakes 
  } = useSubject();

  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Cadre Officer'
  );
  const [photoURL, setPhotoURL] = useState<string>(
    userProfile?.photoURL || user.photoURL || ''
  );
  const [stream, setStream] = useState<'General' | 'DEPR' | 'DSIM'>(
    userProfile?.stream || 'General'
  );
  const [category, setCategory] = useState<'General' | 'EWS' | 'OBC' | 'SC' | 'ST' | 'PwBD'>(
    userProfile?.category || 'General'
  );
  const [attemptCount, setAttemptCount] = useState(
    userProfile?.attemptCount || '1st Attempt'
  );
  const [dailyStudyHours, setDailyStudyHours] = useState<number>(
    userProfile?.dailyStudyHours || 4
  );
  const [educationBackground, setEducationBackground] = useState(
    userProfile?.educationBackground || 'Commerce / Economics'
  );
  const [bio, setBio] = useState(
    userProfile?.bio || 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2 examination'
  );
  const [phone, setPhone] = useState(
    userProfile?.phone || ''
  );

  const [tempExamDate, setTempExamDate] = useState(targetExamDate);
  const [tempScoreGoal, setTempScoreGoal] = useState(targetScoreGoal);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if remote profile updates
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName) setDisplayName(userProfile.displayName);
      if (userProfile.photoURL) setPhotoURL(userProfile.photoURL);
      if (userProfile.stream) setStream(userProfile.stream);
      if (userProfile.category) setCategory(userProfile.category);
      if (userProfile.attemptCount) setAttemptCount(userProfile.attemptCount);
      if (userProfile.dailyStudyHours) setDailyStudyHours(userProfile.dailyStudyHours);
      if (userProfile.educationBackground) setEducationBackground(userProfile.educationBackground);
      if (userProfile.bio) setBio(userProfile.bio);
      if (userProfile.phone) setPhone(userProfile.phone);
    }
  }, [userProfile]);

  useEffect(() => {
    setTempExamDate(targetExamDate);
  }, [targetExamDate]);

  useEffect(() => {
    setTempScoreGoal(targetScoreGoal);
  }, [targetScoreGoal]);

  const daysRemaining = calculateDaysRemaining(tempExamDate);

  // Handle custom image upload from computer / phone gallery
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoURL(result);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      // 1. Update Profile in Firestore & Firebase Auth
      await updateUserProfile({
        displayName,
        photoURL,
        stream,
        category,
        attemptCount,
        dailyStudyHours,
        educationBackground,
        bio,
        phone,
        targetExamYear: '2026-27'
      });

      // 2. Sync Exam Date & Score goal
      setTargetExamDate(tempExamDate);
      setTargetScoreGoal(tempScoreGoal);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setErrorMsg('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send password reset email.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
      
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Command Center</span>
        </Link>

        <span className="text-[10px] font-mono tracking-widest uppercase text-teal-700 dark:text-teal-300 font-bold px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
          OFFICER PROFILE TELEMETRY
        </span>
      </div>

      {/* Main Profile Header Card */}
      <div className="relative rounded-3xl bg-white/80 dark:bg-[#070B18]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
          
          {/* Profile Picture & Quick Upload Action */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-teal-500 via-cyan-400 to-indigo-500 shadow-xl shadow-teal-500/20">
              <div className="w-full h-full rounded-[22px] bg-slate-100 dark:bg-[#0A0F1C] overflow-hidden flex items-center justify-center relative">
                {photoURL ? (
                  photoURL.startsWith('http') || photoURL.startsWith('data:') ? (
                    <img 
                      src={photoURL} 
                      alt={displayName} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">{photoURL}</span>
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-teal-600 dark:text-teal-300 font-bold text-2xl font-serif">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Hover overlay to trigger file picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                  title="Upload profile photo"
                >
                  <Camera className="w-6 h-6 mb-1 text-teal-300" />
                  <span className="text-[10px] font-bold">Change</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
              title="Upload new image from device"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              className="hidden" 
            />
          </div>

          {/* Officer Details & Cadre Meta */}
          <div className="flex-1 text-center md:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25">
                RBI Grade B Candidate
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
                {stream} Stream
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                {category}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white tracking-tight">
              {displayName}
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user.email}</span>
            </p>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed max-w-2xl font-medium">
              "{bio}"
            </p>

            {/* Quick Metrics Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5 font-bold">Exam Target</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{daysRemaining} Days Left</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5 font-bold">Cutoff Goal</span>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{tempScoreGoal}% Score</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5 font-bold">Daily Target</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{dailyStudyHours}h / Day</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5 font-bold">Mistakes Queue</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{mistakes.length} Items</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Cadre Avatars Selector */}
      <div className="rounded-3xl bg-white/70 dark:bg-[#070B18]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-5 sm:p-7 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-serif font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Preset Officer Cadre Avatars</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose an official avatar theme or upload your custom picture above.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {PRESET_AVATARS.map((av) => {
            const isSelected = photoURL === av.iconText;
            return (
              <button
                key={av.id}
                type="button"
                onClick={() => setPhotoURL(av.iconText)}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  isSelected 
                    ? 'bg-teal-500/10 dark:bg-teal-500/20 border-teal-500 ring-2 ring-teal-500/30' 
                    : 'bg-white dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${av.svgGradient} text-white flex items-center justify-center text-2xl shadow-md`}>
                  {av.iconText}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{av.name}</p>
                  <span className="text-[10px] font-mono text-slate-400 block">{av.badge}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Profile Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Identity & Preparation Parameters */}
        <div className="rounded-3xl bg-white/70 dark:bg-[#070B18]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-lg space-y-6">
          <div className="border-b border-slate-200/80 dark:border-white/10 pb-4">
            <h3 className="text-lg font-serif font-black text-slate-900 dark:text-white">
              Cadre Identity & Background
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Personalize your officer credentials and target curriculum stream.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Full Name / Officer Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Officer Ayush Raj"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Authentication Email
              </label>
              <input
                type="email"
                disabled
                value={user.email || ''}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            {/* Preparation Stream */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Curriculum Stream Focus
              </label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="General">General (Phase 1 + Phase 2 ESI & FM)</option>
                <option value="DEPR">DEPR (Department of Economic & Policy Research)</option>
                <option value="DSIM">DSIM (Department of Statistics & Information Management)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Candidate Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="General">General (UR)</option>
                <option value="EWS">Economically Weaker Section (EWS)</option>
                <option value="OBC">Other Backward Classes (OBC - NCL)</option>
                <option value="SC">Scheduled Caste (SC)</option>
                <option value="ST">Scheduled Tribe (ST)</option>
                <option value="PwBD">Person with Benchmark Disability (PwBD)</option>
              </select>
            </div>

            {/* Attempt Count */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Current Attempt
              </label>
              <select
                value={attemptCount}
                onChange={(e) => setAttemptCount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="1st Attempt">1st Attempt</option>
                <option value="2nd Attempt">2nd Attempt</option>
                <option value="3rd Attempt">3rd Attempt</option>
                <option value="4th+ Attempt">4th+ Attempt</option>
              </select>
            </div>

            {/* Academic Background */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Academic Background
              </label>
              <select
                value={educationBackground}
                onChange={(e) => setEducationBackground(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="Commerce / Economics">Commerce / Economics / Finance</option>
                <option value="Engineering / Technology">Engineering / Technology</option>
                <option value="MBA / Management">MBA / Management</option>
                <option value="Arts / Humanities">Arts / Humanities / Law</option>
                <option value="Sciences / Others">Sciences / Mathematics / Others</option>
              </select>
            </div>

            {/* Preparation Motto / Bio */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Officer Mission Statement / Preparation Motto
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write your focus statement or goals for the 2026 examination cycle..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Exam Goals & Telemetry Sync */}
        <div className="rounded-3xl bg-white/70 dark:bg-[#070B18]/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-lg space-y-6">
          <div className="border-b border-slate-200/80 dark:border-white/10 pb-4">
            <h3 className="text-lg font-serif font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              <span>Target Benchmarks & Exam Parameters</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              These settings sync live across all your devices and drive the countdown timers and target metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Target Exam Date */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Target Exam Date
              </label>
              <input
                type="date"
                value={tempExamDate}
                onChange={(e) => setTempExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
              />
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold mt-1 block">
                {daysRemaining} days remaining from today
              </span>
            </div>

            {/* Cutoff Goal */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Benchmark Cutoff Goal (%)
              </label>
              <input
                type="number"
                min="40"
                max="99"
                value={tempScoreGoal}
                onChange={(e) => setTempScoreGoal(parseInt(e.target.value, 10) || 75)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Recommended target: 70% - 80% for Phase 1 & 2
              </span>
            </div>

            {/* Daily Study Hours */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold mb-1.5">
                Daily Study Target (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="16"
                value={dailyStudyHours}
                onChange={(e) => setDailyStudyHours(parseInt(e.target.value, 10) || 4)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Powers your Pomodoro study streak
              </span>
            </div>
          </div>
        </div>

        {/* Feedback / Error Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-xs font-bold animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>Profile and exam parameters saved successfully! Synced across all your devices.</span>
          </div>
        )}

        {/* Save CTA and Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:via-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendPasswordReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{resetSent ? 'Reset Link Sent to Email' : 'Reset Password'}</span>
            </button>

            <button
              type="button"
              onClick={() => auth.signOut()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
