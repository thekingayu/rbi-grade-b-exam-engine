import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useSubject } from '../context/SubjectContext';
import { 
  Camera, Mail, Target, Check, AlertCircle, Save, Sparkles, 
  ArrowLeft, LogOut, KeyRound, Download, RefreshCw, Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateDaysRemaining } from '../utils/date';
import { FuturisticSpinner } from '../components/FuturisticLoader';
import { OfficerLanyardPass, downloadOfficerPassSVG } from '../components/SignatureGraphics';
import { motion, AnimatePresence } from 'motion/react';
import {
  MotionPage,
  MotionSection,
  AnimatedNumber,
  SPRING_SNAPPY,
  EASE_OUT_EXPO,
} from '../components/MotionPrimitives';

// 6 Curated High-Fidelity RBI Officer Avatars
const PRESET_AVATARS = [
  {
    id: 'avatar_officer_formal',
    name: 'Executive Cadre Officer',
    badge: 'Phase 1 & 2',
    bgClass: 'bg-[#0D47FF] text-white',
    iconText: '🏛️'
  },
  {
    id: 'avatar_economist',
    name: 'DEPR Lead Economist',
    badge: 'Economic Policy',
    bgClass: 'bg-[#ECD5FF] text-[#141413]',
    iconText: '📈'
  },
  {
    id: 'avatar_quant',
    name: 'DSIM Quant Specialist',
    badge: 'Data Science',
    bgClass: 'bg-[#FFD426] text-[#141413]',
    iconText: '📊'
  },
  {
    id: 'avatar_banker',
    name: 'Monetary Policy Analyst',
    badge: 'Banking & FM',
    bgClass: 'bg-[#141413] text-[#FAF8EC]',
    iconText: '🏦'
  },
  {
    id: 'avatar_governor',
    name: 'Senior Cadre Aspirant',
    badge: 'Central Banking',
    bgClass: 'bg-[#D8B8F8] text-[#141413]',
    iconText: '⚖️'
  },
  {
    id: 'avatar_cyber',
    name: 'Financial Stability Lead',
    badge: 'Gov & Audit',
    bgClass: 'bg-emerald-500 text-[#141413]',
    iconText: '🛡️'
  }
];

export function Profile({ user }: { user: User }) {
  const { 
    userProfile, 
    updateUserProfile, 
    targetExamDate, 
    targetScoreGoal, 
    mistakes,
    syncStatus,
    lastSyncedAt,
    refreshSync
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
  const [photoSyncState, setPhotoSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [refreshingSync, setRefreshingSync] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastHydratedTsRef = useRef<number | null>(null);
  const photoSyncTimerRef = useRef<number | null>(null);

  const passNumber = useMemo(() => {
    const uidSlice = (user.uid || '0389').slice(-4);
    let num = 0;
    for (let i = 0; i < uidSlice.length; i++) num += uidSlice.charCodeAt(i) * (i + 7);
    return String(num % 9000 + 1000).slice(0, 4);
  }, [user.uid]);

  useEffect(() => {
    if (!userProfile) return;
    const incomingTs = typeof userProfile.updatedAt === 'number' ? userProfile.updatedAt : 0;
    if (lastHydratedTsRef.current !== null && lastHydratedTsRef.current === incomingTs) {
      return;
    }
    lastHydratedTsRef.current = incomingTs;

    setDisplayName(userProfile.displayName || user.displayName || user.email?.split('@')[0] || 'Cadre Officer');
    setPhotoURL(userProfile.photoURL !== undefined ? (userProfile.photoURL || '') : (user.photoURL || ''));
    setStream(userProfile.stream || 'General');
    setCategory(userProfile.category || 'General');
    setAttemptCount(userProfile.attemptCount || '1st Attempt');
    setDailyStudyHours(Number(userProfile.dailyStudyHours) || 4);
    setEducationBackground(userProfile.educationBackground ?? 'Commerce / Economics');
    setBio(userProfile.bio ?? 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2 examination');
    setPhone(userProfile.phone ?? '');
  }, [userProfile, user.displayName, user.email, user.photoURL]);

  useEffect(() => {
    setTempExamDate(targetExamDate);
  }, [targetExamDate]);

  useEffect(() => {
    setTempScoreGoal(targetScoreGoal);
  }, [targetScoreGoal]);

  const daysRemaining = calculateDaysRemaining(tempExamDate);

  const isDirty = useMemo(() => {
    const baseName = (userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Cadre Officer').trim();
    const basePhoto = userProfile?.photoURL || user.photoURL || '';
    const baseStream = userProfile?.stream || 'General';
    const baseCategory = userProfile?.category || 'General';
    const baseAttempt = userProfile?.attemptCount || '1st Attempt';
    const baseHours = Number(userProfile?.dailyStudyHours || 4);
    const baseEdu = (userProfile?.educationBackground || 'Commerce / Economics').trim();
    const baseBio = (userProfile?.bio || 'Aspiring RBI Grade B Officer · Preparing for Phase 1 & Phase 2 examination').trim();
    const basePhone = (userProfile?.phone || '').trim();
    const baseDate = targetExamDate;
    const baseGoal = targetScoreGoal;

    return (
      displayName.trim() !== baseName ||
      (photoURL || '') !== basePhoto ||
      stream !== baseStream ||
      category !== baseCategory ||
      attemptCount !== baseAttempt ||
      Number(dailyStudyHours) !== baseHours ||
      educationBackground.trim() !== baseEdu ||
      bio.trim() !== baseBio ||
      phone.trim() !== basePhone ||
      tempExamDate !== baseDate ||
      tempScoreGoal !== baseGoal
    );
  }, [
    displayName, photoURL, stream, category, attemptCount,
    dailyStudyHours, educationBackground, bio, phone,
    tempExamDate, tempScoreGoal, userProfile, user,
    targetExamDate, targetScoreGoal
  ]);

  useEffect(() => {
    return () => {
      if (photoSyncTimerRef.current) {
        window.clearTimeout(photoSyncTimerRef.current);
      }
    };
  }, []);

  const commitPhotoChange = async (nextPhotoURL: string) => {
    setPhotoURL(nextPhotoURL);
    setErrorMsg(null);
    setPhotoSyncState('syncing');
    if (photoSyncTimerRef.current) {
      window.clearTimeout(photoSyncTimerRef.current);
    }
    try {
      await updateUserProfile({ photoURL: nextPhotoURL });
      setPhotoSyncState('synced');
      photoSyncTimerRef.current = window.setTimeout(() => {
        setPhotoSyncState('idle');
      }, 3000);
    } catch (err: any) {
      console.error('Error syncing avatar:', err);
      setPhotoSyncState('idle');
      setErrorMsg(err?.message || 'Could not sync profile picture to cloud. Please try again.');
    }
  };

  const compressImageForFirestore = (img: HTMLImageElement): string | null => {
    const maxBytesChars = 180_000;
    const dimensions = [256, 192, 144];
    const qualities = [0.82, 0.68, 0.52];

    for (const maxDim of dimensions) {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (!width || !height) return null;

      if (width > height) {
        if (width > maxDim) {
          height = Math.max(1, Math.round((height * maxDim) / width));
          width = maxDim;
        }
      } else if (height > maxDim) {
        width = Math.max(1, Math.round((width * maxDim) / height));
        height = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      for (const quality of qualities) {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length <= maxBytesChars) {
          return compressed;
        }
      }
    }

    return null;
  };

  // Handle custom image upload with progressive canvas compression & instant cloud sync
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size must be under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg('Could not read image file. Please try another image.');
    };
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onerror = () => {
        setErrorMsg('Invalid image file format.');
      };
      img.onload = () => {
        try {
          const compressed = compressImageForFirestore(img);
          if (!compressed) {
            setErrorMsg('Could not compress image under 180 KB for cross-device sync. Please choose a smaller photo.');
            return;
          }
          void commitPhotoChange(compressed);
        } catch {
          setErrorMsg('Could not process image in browser. Please try a standard JPG or PNG.');
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleManualRefreshSync = async () => {
    setRefreshingSync(true);
    setErrorMsg(null);
    try {
      await refreshSync();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to refresh cloud sync.');
    } finally {
      setRefreshingSync(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      await updateUserProfile({
        displayName: displayName.trim() || 'Cadre Officer',
        photoURL: photoURL || '',
        stream,
        category,
        attemptCount,
        dailyStudyHours: Number(dailyStudyHours) || 4,
        educationBackground: educationBackground.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        targetExamYear: '2026-27',
        targetExamDate: tempExamDate,
        targetScoreGoal: tempScoreGoal
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Failed to update profile. Please try again.');
      setErrorMsg(msg);
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
    <MotionPage className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-12 sm:pb-16">
      
      {/* Top Breadcrumb & Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-[#66665E] dark:text-[#A3A399] hover:text-[#141413] dark:hover:text-[#FAF8EC] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Command Center</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-wider uppercase font-bold ${
            syncStatus === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : syncStatus === 'syncing'
                ? 'bg-[#FFD426]/25 border-[#141413]/30 text-[#141413] dark:text-[#FFD426]'
                : 'bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[#E5E1CE] dark:border-[#2E2E2A] text-[#66665E] dark:text-[#A3A399]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'error'
                ? 'bg-rose-500'
                : syncStatus === 'syncing'
                  ? 'bg-[#0D47FF] animate-pulse'
                  : 'bg-emerald-500'
            }`} />
            <span>
              {syncStatus === 'syncing'
                ? 'Syncing Cloud...'
                : syncStatus === 'error'
                  ? 'Sync Issue'
                  : lastSyncedAt
                    ? `Synced · ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Cloud Synced'}
            </span>
          </span>

          <button
            type="button"
            onClick={handleManualRefreshSync}
            disabled={refreshingSync || syncStatus === 'syncing'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A] hover:border-[#141413] dark:hover:border-[#ECD5FF] text-[10px] font-mono font-bold uppercase text-[#141413] dark:text-[#FAF8EC] transition-colors cursor-pointer disabled:opacity-60"
            title="Fetch latest profile and prep data from server"
          >
            <RefreshCw className={`w-3 h-3 ${refreshingSync ? 'animate-spin' : ''}`} />
            <span>Refresh Sync</span>
          </button>
        </div>
      </div>

      {/* Main Dossier + Hanging Lavender Pass Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left: Interactive Charcoal Officer Lanyard Showcase */}
        <div className="lg:col-span-5 rounded-3xl bg-[#141413] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] px-4 sm:px-6 pb-6 sm:pb-8 pt-0 flex flex-col items-center justify-between text-[#FAF8EC] overflow-hidden">
          <OfficerLanyardPass
            name={displayName}
            stream={stream}
            passNumber={passNumber}
            photoURL={photoURL}
            subtitle={`${category} · ${attemptCount}`}
          />

          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
            onClick={() => downloadOfficerPassSVG(displayName, stream, passNumber)}
            className="mt-5 min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#ECD5FF] hover:bg-[#DFBDFC] text-[#141413] border-[1.5px] border-[#141413] text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Official Pass (SVG)</span>
          </motion.button>
        </div>

        {/* Right: Main Profile Header Card */}
        <div className="lg:col-span-7 ink-card-featured rounded-3xl p-4 sm:p-8 flex flex-col justify-between gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Photo Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#FAF8EC] dark:bg-[#141413] border-[1.75px] border-[#141413] dark:border-[#ECD5FF] overflow-hidden flex items-center justify-center relative">
                  {photoURL ? (
                    photoURL.startsWith('http') || photoURL.startsWith('data:') ? (
                      <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">{photoURL}</span>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#141413] dark:text-[#FAF8EC] font-black text-2xl font-heading">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-[#141413]/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                    title="Upload profile photo"
                  >
                    <Camera className="w-5 h-5 mb-1 text-[#ECD5FF]" />
                    <span className="text-[10px] font-bold">Change</span>
                  </button>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] transition-colors cursor-pointer"
                  title="Upload new image from device"
                >
                  <Camera className="w-3.5 h-3.5" />
                </motion.button>

                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
              </div>

              {photoURL && (
                <button
                  type="button"
                  onClick={() => void commitPhotoChange('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] hover:border-rose-400 text-[10px] font-bold text-[#66665E] dark:text-[#A3A399] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}

              {photoSyncState !== 'idle' && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                  photoSyncState === 'syncing'
                    ? 'bg-[#FFD426]/30 text-[#141413] dark:text-[#FFD426]'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {photoSyncState === 'syncing' ? 'Syncing photo...' : 'Synced across devices ✓'}
                </span>
              )}
            </div>

            {/* Officer Details */}
            <div className="flex-1 text-center sm:text-left min-w-0 w-full">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0D47FF] dark:text-[#ECD5FF] mb-1">
                RBI GRADE B · {stream} STREAM · {category}
              </p>

              <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#141413] dark:text-[#FAF8EC] tracking-tight break-words">
                {displayName}
              </h1>

              <p className="text-xs sm:text-sm text-[#66665E] dark:text-[#A3A399] mt-1 flex items-center justify-center sm:justify-start gap-2">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>

              <p className="text-xs text-[#55554F] dark:text-[#A3A399] mt-3 leading-relaxed font-medium break-words">
                "{bio}"
              </p>
            </div>
          </div>

          {/* 4 Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4 border-t border-[#E5E1CE] dark:border-[#2E2E2A]">
            <div className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase block mb-0.5 font-bold">Exam Target</span>
              <span className="text-sm font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                <AnimatedNumber value={daysRemaining} suffix=" Days Left" />
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase block mb-0.5 font-bold">Cutoff Goal</span>
              <span className="text-sm font-black tabular-nums text-[#0D47FF] dark:text-[#ECD5FF]">
                <AnimatedNumber value={tempScoreGoal} suffix="% Score" />
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase block mb-0.5 font-bold">Daily Target</span>
              <span className="text-sm font-black tabular-nums text-[#141413] dark:text-[#FAF8EC]">
                <AnimatedNumber value={dailyStudyHours} suffix="h / Day" />
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8EC] dark:bg-[#141413] border border-[#E5E1CE] dark:border-[#2E2E2A]">
              <span className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] uppercase block mb-0.5 font-bold">Mistakes Queue</span>
              <span className="text-sm font-black tabular-nums text-rose-600 dark:text-rose-400">
                <AnimatedNumber value={mistakes.length} suffix=" Items" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Cadre Avatars Selector */}
      <MotionSection className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-4 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-heading font-bold text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Preset Officer Cadre Avatars</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-0.5">
              Selecting an emblem or uploading a custom photo syncs immediately across all devices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
          {PRESET_AVATARS.map((av) => {
            const isSelected = photoURL === av.iconText;
            return (
              <motion.button
                key={av.id}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING_SNAPPY}
                onClick={() => void commitPhotoChange(av.iconText)}
                className={`p-3 rounded-2xl border text-center transition-colors cursor-pointer flex flex-col items-center gap-2 ${
                  isSelected 
                    ? 'bg-[#ECD5FF] border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] text-[#141413]' 
                    : 'bg-[#FAF8EC] dark:bg-[#141413] border-[#E5E1CE] dark:border-[#2E2E2A] hover:border-[#141413] dark:hover:border-[#ECD5FF]'
                }`}
              >
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${av.bgClass} border border-[#141413] flex items-center justify-center text-2xl`}>
                  {av.iconText}
                </div>
                <div className="min-w-0 w-full">
                  <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#141413]' : 'text-[#141413] dark:text-[#FAF8EC]'}`}>
                    {av.name}
                  </p>
                  <span className={`text-[10px] font-mono block truncate ${isSelected ? 'text-[#141413]/75' : 'text-[#66665E] dark:text-[#A3A399]'}`}>
                    {av.badge}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </MotionSection>

      {/* Main Profile Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Identity & Preparation Parameters */}
        <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-4 sm:p-8 space-y-5 sm:space-y-6">
          <div className="border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-4">
            <h3 className="text-lg font-heading font-bold text-[#141413] dark:text-[#FAF8EC]">
              Cadre Identity & Background
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
              Updates synchronize across your Officer Lanyard Pass and all active devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Full Name / Officer Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Officer Ayush Raj"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Authentication Email
              </label>
              <input
                type="email"
                disabled
                value={user.email || ''}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#F3F0E0] dark:bg-[#242421] text-[#66665E] dark:text-[#A3A399] text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Curriculum Stream Focus
              </label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF]"
              >
                <option value="General">General (Phase 1 + Phase 2 ESI & FM)</option>
                <option value="DEPR">DEPR (Department of Economic & Policy Research)</option>
                <option value="DSIM">DSIM (Department of Statistics & Information Management)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Candidate Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF]"
              >
                <option value="General">General (UR)</option>
                <option value="EWS">Economically Weaker Section (EWS)</option>
                <option value="OBC">Other Backward Classes (OBC - NCL)</option>
                <option value="SC">Scheduled Caste (SC)</option>
                <option value="ST">Scheduled Tribe (ST)</option>
                <option value="PwBD">Person with Benchmark Disability (PwBD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Current Attempt
              </label>
              <select
                value={attemptCount}
                onChange={(e) => setAttemptCount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF]"
              >
                <option value="1st Attempt">1st Attempt</option>
                <option value="2nd Attempt">2nd Attempt</option>
                <option value="3rd Attempt">3rd Attempt</option>
                <option value="4th+ Attempt">4th+ Attempt</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Academic Background
              </label>
              <select
                value={educationBackground}
                onChange={(e) => setEducationBackground(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF]"
              >
                <option value="Commerce / Economics">Commerce / Economics / Finance</option>
                <option value="Engineering / Technology">Engineering / Technology</option>
                <option value="MBA / Management">MBA / Management</option>
                <option value="Arts / Humanities">Arts / Humanities / Law</option>
                <option value="Sciences / Others">Sciences / Mathematics / Others</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Officer Mission Statement / Preparation Motto
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write your focus statement or goals for the examination cycle..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF] leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Exam Goals & Sync */}
        <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1C1A] border border-[#E5E1CE] dark:border-[#2E2E2A] p-4 sm:p-8 space-y-5 sm:space-y-6">
          <div className="border-b border-[#E5E1CE] dark:border-[#2E2E2A] pb-4">
            <h3 className="text-lg font-heading font-bold text-[#141413] dark:text-[#FAF8EC] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#0D47FF] dark:text-[#ECD5FF]" />
              <span>Target Benchmarks & Exam Parameters</span>
            </h3>
            <p className="text-xs text-[#66665E] dark:text-[#A3A399] mt-1">
              These settings sync live across all your devices and drive the countdown timers and target metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Target Exam Date
              </label>
              <input
                type="date"
                value={tempExamDate}
                onChange={(e) => setTempExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF] font-mono"
              />
              <span className="text-[11px] text-[#0D47FF] dark:text-[#ECD5FF] font-bold mt-1 block">
                {daysRemaining} days remaining from today
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Benchmark Cutoff Goal (%)
              </label>
              <input
                type="number"
                min="40"
                max="99"
                value={tempScoreGoal}
                onChange={(e) => setTempScoreGoal(parseInt(e.target.value, 10) || 75)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF] font-mono"
              />
              <span className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-1 block">
                Recommended target: 70% - 80% for Phase 1 & 2
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#66665E] dark:text-[#A3A399] font-bold mb-1.5">
                Daily Study Target (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="16"
                value={dailyStudyHours}
                onChange={(e) => setDailyStudyHours(parseInt(e.target.value, 10) || 4)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FAF8EC] dark:bg-[#141413] text-[#141413] dark:text-[#FAF8EC] text-sm focus:outline-none focus:border-[#0D47FF] font-mono"
              />
              <span className="text-[11px] text-[#66665E] dark:text-[#A3A399] mt-1 block">
                Powers your Pomodoro study streak
              </span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {savedSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-bold"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>Profile and exam parameters saved successfully! Synced across all your devices.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <motion.button
            type="submit"
            disabled={!isDirty || saving}
            whileHover={isDirty && !saving ? { y: -2 } : undefined}
            whileTap={isDirty && !saving ? { scale: 0.97 } : undefined}
            transition={SPRING_SNAPPY}
            className={`w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-sm transition-colors ${
              isDirty && !saving
                ? 'bg-[#0D47FF] hover:bg-[#0936CC] text-white border-[1.5px] border-[#141413] shadow-[3px_3px_0px_#141413] cursor-pointer'
                : 'bg-[#F3F0E0] dark:bg-[#242421] text-[#8E8E85] border border-[#E5E1CE] dark:border-[#2E2E2A] cursor-not-allowed opacity-70'
            }`}
            title={isDirty ? 'Click to commit your profile changes' : 'No changes detected'}
          >
            {saving ? (
              <FuturisticSpinner size="sm" color="white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {saving 
                ? 'Saving Changes...' 
                : isDirty 
                  ? 'Save Profile Changes' 
                  : 'No Changes to Save'}
            </span>
          </motion.button>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSendPasswordReset}
              className="flex-1 sm:flex-initial min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A] text-xs font-bold text-[#141413] dark:text-[#FAF8EC] hover:bg-[#F3F0E0] dark:hover:bg-[#242421] transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>{resetSent ? 'Reset Link Sent' : 'Reset Password'}</span>
            </button>

            <button
              type="button"
              onClick={() => auth.signOut()}
              className="flex-1 sm:flex-initial min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      </form>

    </MotionPage>
  );
}
