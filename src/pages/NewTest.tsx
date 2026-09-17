import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, X, Settings2, Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';

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
        setLoadingMessage(`Preparing ${file.name}...`);
        
        // Use direct chunked upload to backend instead of Firebase Storage
        const uploadId = Date.now().toString() + Math.random().toString(36).substring(7);
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          setLoadingMessage(`Uploading ${file.name} (Chunk ${i + 1}/${totalChunks})...`);
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
        
        setLoadingMessage(`Extracting text from ${file.name}...`);
        
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

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'tests'), {
        userId: user.uid,
        createdAt: Date.now(),
        status: 'setup',
        config,
        extractedNotesText: finalExtractedText,
        durationSeconds: duration,
        questions: data.questions
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Configure New Mock Exam</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Upload your notes and set your preferences to generate a custom test.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {step === 1 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Step 1 of 3</p>
              <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Upload your notes</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                PDF or image files. Extracted content is what the exam will be generated from — review it before generating.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              {uploadError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3">
                  <div className="w-5 h-5 shrink-0 text-red-500 mt-0.5"><X className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Upload restricted</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{uploadError}</p>
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
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center cursor-pointer hover:border-teal-500 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all"
              >
                <UploadCloud className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop files here, or click to choose PDF / JPG / PNG</p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <File className="w-5 h-5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {f.name} <span className="text-slate-400 ml-1">({Math.round(f.size / 1024)} KB)</span>
                        </span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 transition-colors">
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  <p className="text-xs text-slate-400 mt-4 mb-4">
                    The real build reads it with Gemini's multimodal input.
                  </p>

                  <div className="flex items-center justify-between pt-4">
                    <button 
                      onClick={() => setFiles([])}
                      className="px-6 py-2.5 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setStep(2)}
                      className="bg-[#9A7D3C] hover:bg-[#856930] text-white px-8 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Step 2 of 3</p>
              <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Configure this test</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Set how many questions to draw from each portion of your notes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">MCQs — Static portion</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Core theory, definitions, acts and static content from your notes.</p>
                <input 
                  type="number" min="0" max="30" value={config.mcqStatic}
                  onChange={(e) => setConfig({...config, mcqStatic: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#9A7D3C] outline-none"
                />
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">MCQs — Dynamic / current affairs</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Topics in your notes tied to recent developments — cross-checked against what's actually happened recently.</p>
                <input 
                  type="number" min="0" max="20" value={config.mcqDynamic}
                  onChange={(e) => setConfig({...config, mcqDynamic: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#9A7D3C] outline-none"
                />
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">Descriptive — Static portion</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Long-form answers on core static concepts, with a strict word limit.</p>
                <input 
                  type="number" min="0" max="5" value={config.descStatic}
                  onChange={(e) => setConfig({...config, descStatic: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#9A7D3C] outline-none"
                />
              </div>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">Descriptive — Dynamic / current affairs</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Essay/opinion-style prompts tied to current developments from your notes' topics.</p>
                <input 
                  type="number" min="0" max="5" value={config.descDynamic}
                  onChange={(e) => setConfig({...config, descDynamic: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg p-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#9A7D3C] outline-none"
                />
              </div>
            </div>

            {/* Estimated Duration Banner */}
            {(() => {
               const estimatedMins = (config.mcqStatic + config.mcqDynamic) * 1 + (config.descStatic + config.descDynamic) * 15;
               return (
                 <div className="bg-[#f0e8d1] dark:bg-[#383120] rounded-xl p-4 flex items-center justify-between mt-6">
                   <span className="text-[#655328] dark:text-[#d3c299] font-medium">Estimated duration at RBI Grade B pacing</span>
                   <span className="text-[#655328] dark:text-[#d3c299] font-bold">{estimatedMins} min</span>
                 </div>
               );
            })()}

            <p className="text-xs text-slate-400 mt-3 text-center">
              Demo caps counts to keep the sample bank readable — the live build has no such cap since Gemini generates fresh questions each time.
            </p>

            <div className="flex items-center justify-between pt-6">
               <button 
                  onClick={() => setStep(1)}
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Back
               </button>
               <button 
                  onClick={handleGenerateTest}
                  disabled={isGenerateDisabled}
                  className="bg-[#9A7D3C] hover:bg-[#856930] text-white px-8 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {uploading ? (loadingMessage || 'Processing...') : 'Analyze Notes & Generate Questions'}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
