import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, Volume2, Settings, X, Activity, 
  Loader2, Wifi, Power, AlertCircle
} from 'lucide-react';
import { Chat } from './types';

type CallStatus = 'idle' | 'listening' | 'recording' | 'processing' | 'playing';

interface CallEngineProps {
  activeChat: Chat;
  currentTheme: any;
  onUpdateSettings: (settings: { threshold: number; silenceTimeout: number }) => void;
  onSendMessage: (content?: string, type?: any, extra?: any, blob?: Blob) => void;
}

export const CallEngine: React.FC<CallEngineProps> = ({ activeChat, currentTheme, onUpdateSettings, onSendMessage }) => {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings
  const [threshold, setThreshold] = useState(activeChat.callSettings?.threshold || 45);
  const [silenceTimeout, setSilenceTimeout] = useState(activeChat.callSettings?.silenceTimeout || 1500);

  // Core Audio Refs
  const statusRef = useRef<CallStatus>('idle');
  const thresholdRef = useRef(threshold);
  const silenceTimeoutRef = useRef(silenceTimeout);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingAudioRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedMsgIdRef = useRef<string | null>(null);

  // VAD Internal State Refs
  const silenceTimerRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const [silenceProgress, setSilenceProgress] = useState(0);

  // Sync refs to avoid stale closures in the loop
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { silenceTimeoutRef.current = silenceTimeout; }, [silenceTimeout]);

  const cleanup = useCallback(() => {
    sessionActiveRef.current = false;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    silenceStartTimeRef.current = null;
    setSilenceProgress(0);
    setCurrentVolume(0);
    setStatus('idle');
  }, []);

  const analyze = useCallback(() => {
    if (!sessionActiveRef.current || !analyserRef.current) return;

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const currentStatus = statusRef.current;

    if (currentStatus === 'processing' || currentStatus === 'playing' || currentStatus === 'idle') {
      setCurrentVolume(0);
      animationFrameRef.current = requestAnimationFrame(analyze);
      return;
    }

    if (isPlayingAudioRef.current) {
      setCurrentVolume(0);
      animationFrameRef.current = requestAnimationFrame(analyze);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const average = sum / dataArray.length;
    const normalizedVolume = Math.round((average / 128) * 100);
    setCurrentVolume(normalizedVolume);

    const currentThreshold = thresholdRef.current;

    if (normalizedVolume > currentThreshold) {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      silenceStartTimeRef.current = null;
      setSilenceProgress(0);

      if (currentStatus === 'listening') {
        startRecordingAction();
      }
    } else {
      if (currentStatus === 'recording') {
        if (!silenceTimerRef.current) {
          silenceStartTimeRef.current = Date.now();
          silenceTimerRef.current = window.setTimeout(() => {
            stopRecordingAction();
          }, silenceTimeoutRef.current);
        }

        if (silenceStartTimeRef.current) {
          const elapsed = Date.now() - silenceStartTimeRef.current;
          setSilenceProgress(Math.min(elapsed / silenceTimeoutRef.current, 1));
        }
      }
    }

    if (sessionActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyze);
    }
  }, []);

  const startCallSession = async () => {
    try {
      setError(null);
      cleanup();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (!sessionActiveRef.current) return;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onSendMessage(undefined, 'audio', { mode: 'call' }, blob);
        chunksRef.current = [];
      };
      mediaRecorderRef.current = mediaRecorder;

      sessionActiveRef.current = true;
      setStatus('listening');
      animationFrameRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      console.error("System Hook Failed", err);
      setError("Microphone Unavailable");
      setStatus('idle');
      sessionActiveRef.current = false;
    }
  };

  const startRecordingAction = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      chunksRef.current = [];
      mediaRecorderRef.current.start();
      setStatus('recording');
    }
  };

  const stopRecordingAction = () => {
    setStatus('processing');
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    silenceStartTimeRef.current = null;
    setSilenceProgress(0);
    setCurrentVolume(0);
  };

  const handleAudioResponse = async (audioLink: string, shouldEnd: boolean) => {
    if (!sessionActiveRef.current) return;
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    setStatus('playing');
    isPlayingAudioRef.current = true;
    
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = false);
    }

    const audio = new Audio(audioLink);
    audioPlayerRef.current = audio;
    audio.crossOrigin = "anonymous"; 

    audio.onplay = () => {
      setStatus('playing');
      isPlayingAudioRef.current = true;
    };

    audio.onended = () => {
      audioPlayerRef.current = null;
      isPlayingAudioRef.current = false;
      if (shouldEnd) {
        cleanup();
      } else {
        resumeListening();
      }
    };

    audio.onerror = (e) => {
      console.error("External Link Error:", e);
      audioPlayerRef.current = null;
      isPlayingAudioRef.current = false;
      resumeListening();
    };

    try {
      await audio.play();
    } catch (e) {
      console.error("Playback failed", e);
      audioPlayerRef.current = null;
      isPlayingAudioRef.current = false;
      resumeListening();
    }
  };

  const resumeListening = () => {
    if (streamRef.current && sessionActiveRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      setStatus('listening');
    }
  };

  useEffect(() => {
    const lastMsg = activeChat.messages[activeChat.messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.id !== lastProcessedMsgIdRef.current) {
      lastProcessedMsgIdRef.current = lastMsg.id;
      
      try {
        let data = JSON.parse(lastMsg.content);
        if (Array.isArray(data)) data = data[0];
        
        if (data.call === true && statusRef.current === 'idle') {
          startCallSession();
        } else if (data.call === false) {
          cleanup();
          return;
        }

        if (data.audio && typeof data.audio === 'string' && data.audio.startsWith('http')) {
          handleAudioResponse(data.audio, data.signal === 'end');
        } else {
          if (statusRef.current === 'processing' && sessionActiveRef.current) {
            resumeListening();
          }
        }
      } catch (e) {
        if (statusRef.current === 'processing' && sessionActiveRef.current) {
          resumeListening();
        }
      }
    }
  }, [activeChat.messages.length]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  const remainingTime = (silenceTimeout * (1 - silenceProgress)) / 1000;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 h-full overflow-y-auto custom-scrollbar relative bg-[#02040a]">
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-3 rounded-2xl bg-slate-900 border border-slate-800 transition-all ${isSettingsOpen ? 'text-white' : 'text-slate-500'}`}
        >
          <Settings size={20} />
        </button>
      </div>

      {isSettingsOpen && (
        <div className="absolute top-20 right-4 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl z-50 animate-in slide-in-from-top-4">
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Signal Calibration</span>
                <button onClick={() => setIsSettingsOpen(false)}><X size={14} className="text-slate-700 hover:text-white" /></button>
              </div>
              <div className="space-y-3">
                <label className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Sensitivity</span>
                  <span className="text-indigo-400">{threshold}%</span>
                </label>
                <input type="range" min="5" max="95" value={threshold} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setThreshold(val);
                  onUpdateSettings({ threshold: val, silenceTimeout });
                }} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer" />
              </div>
              <div className="space-y-3">
                <label className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Gate Timeout</span>
                  <span className="text-emerald-400">{silenceTimeout}ms</span>
                </label>
                <input type="range" min="500" max="5000" step="100" value={silenceTimeout} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSilenceTimeout(val);
                  onUpdateSettings({ threshold, silenceTimeout: val });
                }} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer" />
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-2">
           {error ? (
             <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20 text-[10px] font-black uppercase tracking-widest italic">
               <AlertCircle size={14} /> {error}
             </div>
           ) : (
             <div className="px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${status !== 'idle' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-slate-700'}`} />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">
                 {status === 'idle' ? 'Link Standby' : 'Neural Uplink Active'}
               </span>
             </div>
           )}
           <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{status}</p>
        </div>

        <div className="relative">
           {status !== 'idle' && status !== 'processing' && status !== 'playing' && (
             <div className="absolute inset-0 -m-20 pointer-events-none">
                <div className="absolute inset-0 border-2 border-slate-800 rounded-full transition-all duration-75" style={{ transform: `scale(${1 + (currentVolume / 100)})`, opacity: currentVolume / 100 }} />
                <div className="absolute inset-0 border border-indigo-500/20 rounded-full transition-all duration-150" style={{ transform: `scale(${1.2 + (currentVolume / 80)})`, opacity: (currentVolume / 150) }} />
             </div>
           )}

           <button 
             onClick={status === 'idle' ? startCallSession : cleanup}
             className={`w-64 h-64 rounded-full flex flex-col items-center justify-center relative transition-all duration-500 shadow-[0_0_100px_rgba(0,0,0,1)] group ${
               status === 'idle' ? 'bg-slate-900 border border-slate-800 hover:border-slate-600' :
               status === 'listening' ? `bg-slate-950 border-2 border-indigo-500/40 shadow-[0_0_60px_rgba(99,102,241,0.2)]` :
               status === 'recording' ? `bg-slate-950 border-2 border-rose-500 shadow-[0_0_80px_rgba(244,63,94,0.4)] scale-105` :
               status === 'processing' ? `bg-indigo-900/20 border-2 border-white/20 animate-pulse` :
               `bg-emerald-900/20 border-2 border-emerald-500/40 shadow-[0_0_80px_rgba(16,185,129,0.3)]`
             }`}
           >
              {status === 'recording' && silenceProgress > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="50%" cy="50%" r="48%" fill="none" stroke="#f43f5e" strokeWidth="6" strokeDasharray="100%" strokeDashoffset={`${(1 - silenceProgress) * 100}%`} className="transition-all duration-150 ease-linear" />
                  </svg>
                </div>
              )}

              <div className={`absolute inset-0 rounded-full opacity-20 blur-3xl transition-colors duration-500 ${
                status === 'recording' ? 'bg-rose-600' : status === 'playing' ? 'bg-emerald-500' : status === 'listening' ? 'bg-indigo-600' : 'transparent'
              }`} />

              <div className="relative z-10 flex flex-col items-center gap-4">
                {status === 'idle' ? <Power size={44} className="text-slate-700 group-hover:text-indigo-400 transition-colors" /> :
                 status === 'listening' ? <Activity size={44} className="text-indigo-400" /> :
                 status === 'recording' ? (
                   silenceProgress > 0 ? (
                     <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-90 duration-300">
                       <span className="text-5xl font-mono font-black text-rose-500 drop-shadow-[0_0_10px_#f43f5e] animate-pulse">
                         {remainingTime.toFixed(1)}s
                       </span>
                       <span className="text-[7px] font-black uppercase tracking-[0.4em] text-rose-400 opacity-60">Committing...</span>
                     </div>
                   ) : (
                     <Mic size={44} className="text-rose-500 animate-bounce" />
                   )
                 ) :
                 status === 'processing' ? <Loader2 size={44} className="text-white animate-spin" /> :
                 <Volume2 size={44} className="text-emerald-400 animate-pulse" />}
                 
                <span className={`text-[11px] font-black uppercase tracking-[0.4em] transition-colors ${status === 'idle' ? 'text-slate-700' : 'text-white'}`}>
                  {status === 'idle' ? 'Initialize' : status}
                </span>
              </div>
           </button>
        </div>

        <div className="w-80 space-y-4">
           <div className="flex justify-between items-end px-2">
             <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest italic leading-none">Input Gain</span>
               <span className="text-[14px] font-mono font-bold text-white leading-none mt-1">{currentVolume}%</span>
             </div>
             <div className="flex flex-col items-end">
               <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest italic leading-none">VAD Gate</span>
               <span className={`text-[14px] font-mono font-bold leading-none mt-1 transition-colors ${currentVolume > threshold ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-indigo-400'}`}>{threshold}%</span>
             </div>
           </div>
           <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative border border-white/5">
              <div className={`absolute top-0 bottom-0 left-0 transition-all duration-75 ${currentVolume > threshold ? 'bg-cyan-400 shadow-[0_0_15px_#22d3ee]' : 'bg-indigo-500 shadow-[0_0_15px_#6366f1]'}`} style={{ width: `${currentVolume}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/40 shadow-xl" style={{ left: `${threshold}%` }} />
           </div>
        </div>

        <div className="text-center space-y-2 opacity-30">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic flex items-center justify-center gap-2">
             <Wifi size={12} /> Neural Stream v2.5
           </p>
           <p className="text-[8px] font-mono text-slate-600">
             Protocol: Audio Link Processing
           </p>
        </div>
      </div>
    </div>
  );
};
