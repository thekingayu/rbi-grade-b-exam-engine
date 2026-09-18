import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UploadCloud, File, X, Settings2, Loader2, ChevronDown, ChevronUp, 
  FileText, ArrowLeft, Clock, Sparkles, SlidersHorizontal, CheckCircle2 
} from 'lucide-react';

const getShortFileName = (name: string, max = 16) => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [config, setConfig] = useState({
    mcqStatic: 10,
    mcqDynamic: 5,
    descStatic: 1,
    descDynamic: 1
  });

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
      // Reset the input value so the same file can be selected again if removed
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleGenerateTest = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setLoadingMessage("Analyzing your notes...");
    
    try {
      let combinedText = '';
      
      // Step 1: Extract Text
      for (const file of files) {
        const shortName = getShortFileName(file.name, 18);
        setLoadingMessage(`Preparing ${shortName}...`);
        
        // Use direct chunked upload to backend instead of Firebase Storage
        const uploadId = Date.now().toString() + Math.random().toString(36).substring(7);
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
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
            body: formData
          });

          if (!chunkRes.ok) {
            const errData = await chunkRes.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to upload chunk ${i + 1}`);
          }
        }
        
        setLoadingMessage(`Extracting text from ${shortName}...`);
        
        // 2. Call extraction which reads the assembled temp file
        const res = await fetch('/api/extract-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            uploadId, 
            mimeType: file.type || 'application/pdf'
          })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Extraction error:", errData);
          throw new Error(errData.error || "Failed to extract text");
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let extracted = '';
        let buffer = '';
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.status) setLoadingMessage(data.status);
              if (data.textChunk) extracted += data.textChunk;
              if (data.error) throw new Error(data.error);
            } catch (e) {
              console.error("Failed to parse NDJSON line:", line, e);
            }
          }
        }
        
        // Process any remaining buffer
        if (buffer.trim()) {
           try {
              const data = JSON.parse(buffer);
              if (data.textChunk) extracted += data.textChunk;
              if (data.error) throw new Error(data.error);
           } catch (e) {
              console.error("Failed to parse final NDJSON line:", buffer, e);
           }
        }
        
        combinedText += extracted + '\n\n';
      }
      
      const finalExtractedText = combinedText.trim();
      
      // Step 2: Generate questions
      setLoadingMessage("Generating custom exam questions...");
      
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText: finalExtractedText, config })
      });
      
      if (!res.ok) {
        let errStr = "Failed to generate test";
        try {
          const errData = await res.json();
          errStr = errData.error || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }
      const data = await res.json();
      
      // Calculate duration
      const totalMcq = config.mcqStatic + config.mcqDynamic;
      let duration = totalMcq * 45; // 45 sec per MCQ
      const totalWords = data.questions
        .filter((q: any) => q.type === 'Descriptive' && q.wordLimit)
        .reduce((acc: number, q: any) => acc + q.wordLimit, 0);
      duration += Math.floor(totalWords / 1.5); // 1.5 words per sec
      duration = Math.ceil(duration / 300) * 300; // Round to nearest 5 min (300s)

      const normalizedQuestions = (data.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: q.id || `q_${idx}`,
        maxMarks: q.type === 'MCQ' ? (typeof q.maxMarks === 'number' && q.maxMarks > 0 ? q.maxMarks : 1) : (q.maxMarks || 15)
      }));

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'tests'), {
        userId: user.uid,
        createdAt: Date.now(),
        status: 'setup',
        config,
        extractedNotesText: finalExtractedText,
        durationSeconds: duration,
        questions: normalizedQuestions
      });

      navigate(`/exam/${docRef.id}`);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || "Failed to generate test. Please try again."}`);
    } finally {
      setUploading(false);
      setLoadingMessage('');
    }
  };

  const totalQuestions = config.mcqStatic + config.mcqDynamic + config.descStatic + config.descDynamic;
  const isGenerateDisabled = uploading || totalQuestions === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Top Header with Back Button and Title */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 hover:border-[#9A7D3C]/60 dark:hover:border-[#9A7D3C]/60 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-sm hover:shadow group cursor-pointer text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400 group-hover:-translate-x-1 transition-transform cursor-pointer" />
            <span className="cursor-pointer">Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-xl text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#9A7D3C] animate-pulse"></span>
            <span>Step {step} of 2</span>
            <span className="hidden sm:inline">• {step === 1 ? 'Upload Notes' : 'Exam Settings'}</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Configure New Mock Exam
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Upload your notes and set your preferences to generate a custom test.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {step === 1 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 rounded-3xl p-5 sm:p-8 relative overflow-hidden">
              {/* Glass Top Highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9A7D3C]/40 to-transparent pointer-events-none" />
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 backdrop-blur-md mb-2">
                  Step 1 of 2
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">Upload your notes</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-xs sm:text-base">
                  PDF or image files. Extracted content is what the exam will be generated from — review it before generating.
                </p>
              </div>

              {uploadError && (
                <div className="mb-5 p-4 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 backdrop-blur-xl rounded-2xl flex items-start gap-3 shadow-sm">
                  <div className="w-5 h-5 shrink-0 text-red-500 mt-0.5"><X className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Upload restricted</h4>
                    <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-0.5">{uploadError}</p>
                  </div>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple 
                accept=".pdf,image/png,image/jpeg,image/jpg" 
                className="hidden" 
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group relative border-2 border-dashed border-slate-300/80 dark:border-white/15 rounded-2xl p-6 sm:p-14 text-center cursor-pointer hover:border-[#9A7D3C] dark:hover:border-[#9A7D3C]/70 bg-white/40 dark:bg-white/[0.02] hover:bg-white/70 dark:hover:bg-white/[0.05] backdrop-blur-xl transition-all duration-300 shadow-inner"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center text-[#9A7D3C] dark:text-[#d3c299] mx-auto mb-4 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#9A7D3C]/20 transition-all duration-300">
                  <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                  Drop files here, or <span className="text-[#9A7D3C] dark:text-[#d3c299] underline underline-offset-4">click to browse</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Supports PDF, PNG, JPG, JPEG (up to 200MB per file)
                </p>
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-3 pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Selected Files ({files.length})
                    </span>
                    <button 
                      onClick={() => setFiles([])}
                      className="text-xs text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-3 sm:p-4 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 shadow-sm hover:border-[#9A7D3C]/40 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/20 border border-[#9A7D3C]/20 flex items-center justify-center text-[#9A7D3C] dark:text-[#d3c299] shrink-0">
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate" title={f.name}>{f.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{Math.round(f.size / 1024)} KB</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFile(i)} 
                          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#9A7D3C] shrink-0 mt-0.5" />
                    <span>Gemini multimodal vision will extract diagrams, syllabus concepts, and regulations from your files.</span>
                  </p>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-white/40 dark:border-white/10 mt-6">
                    <button 
                      onClick={() => setFiles([])}
                      className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-2xl font-medium text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 border border-white/60 dark:border-white/10 transition-all cursor-pointer shadow-sm text-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setStep(2)}
                      className="w-full sm:w-auto bg-gradient-to-r from-[#9A7D3C] to-[#b39148] hover:from-[#886d33] hover:to-[#9A7D3C] text-white px-8 py-3 sm:py-2.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#9A7D3C]/25 hover:shadow-xl hover:shadow-[#9A7D3C]/35 cursor-pointer text-sm"
                    >
                      <span>Continue to Settings</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Step 2 Header Card */}
            <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9A7D3C]/40 to-transparent pointer-events-none" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 backdrop-blur-md mb-2">
                Step 2 of 2
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">Configure this test</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm sm:text-base">
                Set how many questions to draw from each portion of your notes.
              </p>
            </div>

            {/* 4 Liquid Glass Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
              {/* Card 1: MCQ Static */}
              <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/40 dark:shadow-black/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden hover:bg-white/80 dark:hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">MCQs — Static portion</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 shrink-0">
                    {config.mcqStatic} Qs
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 sm:min-h-[36px] leading-relaxed">
                  Core theory, definitions, acts and static content from your notes. 5 options per question.
                </p>
                <div className="relative">
                  <input 
                    type="number" min="0" max="30" value={config.mcqStatic}
                    onChange={(e) => setConfig({...config, mcqStatic: Math.max(0, parseInt(e.target.value) || 0)})}
                    className="w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-slate-900 dark:text-white font-semibold text-base sm:text-lg focus:ring-2 focus:ring-[#9A7D3C] focus:border-transparent outline-none backdrop-blur-md transition-all"
                  />
                </div>
              </div>

              {/* Card 2: MCQ Dynamic */}
              <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/40 dark:shadow-black/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden hover:bg-white/80 dark:hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">MCQs — Dynamic / current affairs</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 shrink-0">
                    {config.mcqDynamic} Qs
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 sm:min-h-[36px] leading-relaxed">
                  Topics in your notes tied to recent developments and circulars, validated with Gemini search grounding.
                </p>
                <div className="relative">
                  <input 
                    type="number" min="0" max="20" value={config.mcqDynamic}
                    onChange={(e) => setConfig({...config, mcqDynamic: Math.max(0, parseInt(e.target.value) || 0)})}
                    className="w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-slate-900 dark:text-white font-semibold text-base sm:text-lg focus:ring-2 focus:ring-[#9A7D3C] focus:border-transparent outline-none backdrop-blur-md transition-all"
                  />
                </div>
              </div>

              {/* Card 3: Descriptive Static */}
              <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/40 dark:shadow-black/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden hover:bg-white/80 dark:hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Descriptive — Static portion</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 shrink-0">
                    {config.descStatic} Qs
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 sm:min-h-[36px] leading-relaxed">
                  Long-form answers on core static concepts with strict word limit and comprehensive rubric evaluation.
                </p>
                <div className="relative">
                  <input 
                    type="number" min="0" max="5" value={config.descStatic}
                    onChange={(e) => setConfig({...config, descStatic: Math.max(0, parseInt(e.target.value) || 0)})}
                    className="w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-slate-900 dark:text-white font-semibold text-base sm:text-lg focus:ring-2 focus:ring-[#9A7D3C] focus:border-transparent outline-none backdrop-blur-md transition-all"
                  />
                </div>
              </div>

              {/* Card 4: Descriptive Dynamic */}
              <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-200/40 dark:shadow-black/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden hover:bg-white/80 dark:hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Descriptive — Dynamic / current affairs</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#9A7D3C]/10 text-[#9A7D3C] dark:bg-[#9A7D3C]/20 dark:text-[#d3c299] border border-[#9A7D3C]/30 shrink-0">
                    {config.descDynamic} Qs
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 sm:min-h-[36px] leading-relaxed">
                  Essay/opinion-style prompts tied to current developments from your notes' topics.
                </p>
                <div className="relative">
                  <input 
                    type="number" min="0" max="5" value={config.descDynamic}
                    onChange={(e) => setConfig({...config, descDynamic: Math.max(0, parseInt(e.target.value) || 0)})}
                    className="w-full bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-slate-900 dark:text-white font-semibold text-base sm:text-lg focus:ring-2 focus:ring-[#9A7D3C] focus:border-transparent outline-none backdrop-blur-md transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Estimated Duration Banner - Liquid Glass */}
            {(() => {
               const estimatedMins = (config.mcqStatic + config.mcqDynamic) * 1 + (config.descStatic + config.descDynamic) * 15;
               return (
                 <div className="bg-[#9A7D3C]/10 dark:bg-[#9A7D3C]/15 border border-[#9A7D3C]/30 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-[#9A7D3C]/5">
                   <div className="flex items-center gap-3.5">
                     <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#9A7D3C]/20 border border-[#9A7D3C]/30 flex items-center justify-center text-[#9A7D3C] dark:text-[#d3c299] shrink-0 shadow-sm">
                       <Clock className="w-5 h-5" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-slate-900 dark:text-white">Estimated Exam Duration</p>
                       <p className="text-xs text-slate-500 dark:text-slate-400">At RBI Grade B standard pacing (1 min/MCQ, 15 min/Descriptive)</p>
                     </div>
                   </div>
                   <div className="text-left sm:text-right">
                     <span className="text-2xl sm:text-3xl font-bold text-[#9A7D3C] dark:text-[#d3c299] font-serif">{estimatedMins} min</span>
                     <p className="text-xs text-slate-500 dark:text-slate-400">{totalQuestions} total questions</p>
                   </div>
                 </div>
               );
            })()}

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Each test is synthesized fresh by Gemini using your notes as the authoritative curriculum.
            </p>

            {/* Step 2 Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-4">
               <button 
                  onClick={() => setStep(1)}
                  disabled={uploading}
                  className="w-full sm:w-auto px-6 py-3 sm:py-3.5 rounded-2xl font-medium text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 text-sm shadow-sm"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Upload</span>
                  </span>
               </button>
               <button 
                  onClick={handleGenerateTest}
                  disabled={isGenerateDisabled}
                  className="w-full sm:w-auto min-h-[48px] bg-gradient-to-r from-[#9A7D3C] to-[#b39148] hover:from-[#886d33] hover:to-[#9A7D3C] text-white px-6 sm:px-9 py-3.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[#9A7D3C]/25 hover:shadow-xl hover:shadow-[#9A7D3C]/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                      <span className="text-center truncate max-w-[240px] sm:max-w-none text-xs sm:text-sm md:text-base">
                        {loadingMessage || 'Generating Exam...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 shrink-0" />
                      <span>Analyze Notes & Generate Questions</span>
                    </>
                  )}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
