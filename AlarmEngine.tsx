import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Timer as TimerIcon, Play, Pause, X, Bell, 
  Trash2, Power, Maximize2, Volume2, AlertCircle,
  GripVertical, Minimize2, RotateCcw, Octagon
} from 'lucide-react';
import { Chat, Alarm } from './types';

interface AlarmEngineProps {
  activeChat: Chat;
  currentTheme: any;
  onUpdateAlarms: (alarms: Alarm[]) => void;
}

export const AlarmEngine: React.FC<AlarmEngineProps> = ({ activeChat, currentTheme, onUpdateAlarms }) => {
  const [activeTab, setActiveTab] = useState<'alarm' | 'timer'>('alarm');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  
  // Floating Window State
  const [windowPos, setWindowPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: 220, h: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });

  // Center logic
  const centerPopup = () => {
    setWindowPos({
      x: (window.innerWidth / 2) - (windowSize.w / 2),
      y: (window.innerHeight / 2) - (windowSize.h / 2)
    });
  };

  // Trigger centering when popup opens
  useEffect(() => {
    if (isPopupOpen) {
      centerPopup();
    }
  }, [isPopupOpen]);
  
  // Alarm State
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  
  // Timer State (Local, transient)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInput, setTimerInput] = useState({ h: 0, m: 0, s: 0 });
  
  const timerIntervalRef = useRef<number | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Updated to raw GitHub links as requested
  const ALARM_SOUND = "https://raw.githubusercontent.com/emprkeathi-cmd/assets_Ai-Wire/main/alarm_sound.mp3";
  const TIMER_SOUND = "https://raw.githubusercontent.com/emprkeathi-cmd/assets_Ai-Wire/main/timer_finished.mp3";

  // Clock & Alarm Monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      activeChat.alarms?.forEach(alarm => {
        // Only trigger if active and time matches exactly (at the start of the minute)
        if (alarm.isActive && alarm.time === timeStr && now.getSeconds() === 0) {
          triggerAlarm(alarm);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeChat.alarms]);

  // Handle incoming n8n signals
  useEffect(() => {
    const lastMsg = activeChat.messages[activeChat.messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      try {
        const data = JSON.parse(lastMsg.content);
        if (data.timer_duration) {
          const duration = parseInt(data.timer_duration);
          setTimerSeconds(duration);
          if (data.start_timer) {
            setIsTimerRunning(true);
            setIsPopupOpen(true);
          }
        }
        if (data.alarm_time) {
          const alarms = activeChat.alarms || [];
          const exists = alarms.find(a => a.time === data.alarm_time);
          if (!exists) {
            const newAlarms = [...alarms, { 
              id: Date.now().toString(), 
              time: data.alarm_time, 
              label: 'Remote Protocol', 
              isActive: data.activate_alarm !== false 
            }];
            onUpdateAlarms(newAlarms);
          }
        }
      } catch (e) {}
    }
  }, [activeChat.messages.length]);

  // Timer Countdown Logic
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            triggerTimerDone();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [isTimerRunning, timerSeconds]);

  // Window Movement / Resizing Events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setWindowPos({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      }
      if (isResizing) {
        setWindowSize({
          w: Math.max(160, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
          h: Math.max(100, resizeStart.current.h + (e.clientY - resizeStart.current.y))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  const triggerAlarm = (alarm: Alarm) => {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.loop = true;
      alarmAudioRef.current.play().catch(e => console.error("Alarm audio play blocked:", e));
      setIsRinging(true);
    }
  };

  const triggerTimerDone = () => {
    setIsTimerRunning(false);
    if (timerAudioRef.current) {
      timerAudioRef.current.loop = true; 
      timerAudioRef.current.play().catch(e => console.error("Timer audio play blocked:", e));
      setIsRinging(true);
    }
    setIsPopupOpen(true);
  };

  const stopAllSounds = () => {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }
    if (timerAudioRef.current) {
      timerAudioRef.current.pause();
      timerAudioRef.current.currentTime = 0;
    }
    setIsRinging(false);
  };

  const startTimer = () => {
    const total = (timerInput.h * 3600) + (timerInput.m * 60) + timerInput.s;
    if (total > 0) {
      setTimerSeconds(total);
      setIsTimerRunning(true);
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setTimerInput({ h: 0, m: 0, s: 0 });
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const addAlarm = () => {
    const alarms = activeChat.alarms || [];
    const newAlarms = [...alarms, { id: Date.now().toString(), time: newAlarmTime, label: 'Standard Protocol', isActive: true }];
    onUpdateAlarms(newAlarms);
  };

  const toggleAlarm = (id: string) => {
    const newAlarms = (activeChat.alarms || []).map(a => a.id === id ? { ...a, isActive: !a.isActive } : a);
    onUpdateAlarms(newAlarms);
  };

  const deleteAlarm = (id: string) => {
    const newAlarms = (activeChat.alarms || []).filter(a => a.id !== id);
    onUpdateAlarms(newAlarms);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-8 sm:space-y-12 h-full overflow-y-auto custom-scrollbar relative">
      <audio ref={alarmAudioRef} src={ALARM_SOUND} preload="auto" />
      <audio ref={timerAudioRef} src={TIMER_SOUND} preload="auto" />

      {/* Ringing Overlay */}
      {isRinging && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="p-12 bg-slate-900 rounded-[4rem] border border-indigo-500/30 shadow-[0_0_100px_rgba(99,102,241,0.4)] flex flex-col items-center gap-8 text-center max-w-sm">
             <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center animate-ping">
               <Bell size={48} className="text-white" />
             </div>
             <div>
               <h3 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-2">Signal Alert</h3>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Temporal Threshold Reached</p>
             </div>
             <button 
               onClick={stopAllSounds}
               className="w-full py-6 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.4em] text-xs rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
             >
               <Octagon size={20} /> Dismiss Protocol
             </button>
          </div>
        </div>
      )}

      {/* Persistent Digital Clock */}
      <div className="text-center space-y-4 w-full">
        <div className="mx-auto max-w-[90%] sm:max-w-none text-6xl sm:text-9xl font-mono font-bold tracking-tighter text-white bg-slate-900/40 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] border border-slate-800 shadow-[0_0_80px_rgba(0,0,0,0.6)] relative overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center text-white font-mono">88:88:88</div>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        </div>
        <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.4em] sm:tracking-[0.6em] text-slate-600 italic">Temporal Master Node</p>
      </div>

      {/* Navigation */}
      <div className="flex bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <button 
          onClick={() => setActiveTab('alarm')}
          className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'alarm' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'}`}
        >
          <Bell size={14} /> Scheduled
        </button>
        <button 
          onClick={() => setActiveTab('timer')}
          className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'timer' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'}`}
        >
          <TimerIcon size={14} /> Transient
        </button>
      </div>

      {/* Main UI Content */}
      <div className="w-full max-w-lg space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
        {activeTab === 'alarm' ? (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Persistent Protocol</label>
                 <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase">
                   <Power size={10} /> Active
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="time" 
                  value={newAlarmTime}
                  onChange={(e) => setNewAlarmTime(e.target.value)}
                  className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-3xl font-mono font-bold text-white focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                />
                <button 
                  onClick={addAlarm}
                  className="w-full sm:w-auto sm:px-8 py-5 sm:py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Activate
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {(activeChat.alarms || []).map(alarm => (
                <div key={alarm.id} className="bg-slate-900/60 border border-slate-800/40 p-4 sm:p-6 rounded-[2rem] flex items-center justify-between group hover:border-slate-700 hover:bg-slate-900 transition-all shadow-lg">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className={`p-3 sm:p-4 rounded-2xl transition-colors ${alarm.isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-600'}`}>
                      <Bell size={20} />
                    </div>
                    <div>
                      <h4 className={`text-xl sm:text-2xl font-mono font-bold tracking-tight ${alarm.isActive ? 'text-white' : 'text-slate-600'}`}>{alarm.time}</h4>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{alarm.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleAlarm(alarm.id)}
                      className={`w-12 sm:w-14 h-6 sm:h-7 rounded-full transition-all relative ${alarm.isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-white transition-all ${alarm.isActive ? 'left-7 sm:left-8' : 'left-1'}`} />
                    </button>
                    <button onClick={() => deleteAlarm(alarm.id)} className="p-2 sm:p-3 text-slate-700 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
             <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-10 space-y-8 sm:space-y-10 shadow-2xl">
                {isTimerRunning || timerSeconds > 0 ? (
                  <div className="text-center space-y-4 py-4 animate-in fade-in duration-300">
                    <div className="text-6xl sm:text-8xl font-mono font-bold text-white tracking-tighter tabular-nums">
                      {formatTime(timerSeconds)}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Neural Countdown Active</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 sm:gap-6">
                    {['h', 'm', 's'].map(unit => (
                      <div key={unit} className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest text-center italic">{unit === 'h' ? 'Hrs' : unit === 'm' ? 'Min' : 'Sec'}</label>
                        <input 
                          type="number" 
                          min="0"
                          max={unit === 'h' ? '23' : '59'}
                          value={timerInput[unit as keyof typeof timerInput]}
                          onChange={(e) => setTimerInput({...timerInput, [unit]: parseInt(e.target.value) || 0})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl py-4 sm:py-6 text-center text-2xl sm:text-3xl font-mono font-bold text-white focus:outline-none focus:border-indigo-500/50 shadow-inner"
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-4">
                  {isTimerRunning ? (
                    <button 
                      onClick={() => setIsTimerRunning(false)}
                      className="flex-1 py-5 sm:py-6 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl sm:rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Pause size={18} /> Suspend Engine
                    </button>
                  ) : timerSeconds > 0 ? (
                    <button 
                      onClick={() => setIsTimerRunning(true)}
                      className="flex-1 py-5 sm:py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl sm:rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Play size={18} /> Resume Engine
                    </button>
                  ) : (
                    <button 
                      onClick={startTimer}
                      className="flex-1 py-5 sm:py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl sm:rounded-3xl shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                      Engage Neural Timer
                    </button>
                  )}

                  <div className="flex gap-2">
                    {timerSeconds > 0 && (
                      <button 
                        onClick={resetTimer}
                        className="flex-1 sm:flex-none sm:w-20 py-5 sm:py-0 bg-slate-800 text-slate-400 hover:text-white rounded-2xl sm:rounded-3xl transition-all border border-slate-700 active:scale-95 flex items-center justify-center"
                      >
                        <RotateCcw size={22} />
                      </button>
                    )}
                    <button 
                      onClick={() => setIsPopupOpen(true)}
                      className="flex-1 sm:flex-none sm:w-20 py-5 sm:py-0 bg-slate-800 text-slate-400 hover:text-white rounded-2xl sm:rounded-3xl transition-all border border-slate-700 active:scale-95 flex items-center justify-center"
                    >
                      <Maximize2 size={22} />
                    </button>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* MINI FLOATING TIMER POPUP */}
      {isPopupOpen && (
        <div 
          className={`fixed bg-[#0a0d16]/95 backdrop-blur-md border border-slate-800/90 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden z-[999] group/win animate-in zoom-in-95 duration-150 ${isDragging ? '' : 'transition-all duration-75'} ${isResizing ? '' : 'transition-all duration-75'}`}
          style={{ 
            left: windowPos.x, 
            top: windowPos.y, 
            width: windowSize.w, 
            height: windowSize.h 
          }}
        >
          {/* Compact Header */}
          <div 
            className="h-8 shrink-0 bg-slate-900/60 border-b border-slate-800/40 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              setIsDragging(true);
              dragOffset.current = { x: e.clientX - windowPos.x, y: e.clientY - windowPos.y };
            }}
          >
            <GripVertical size={12} className="text-slate-700" />
            <div className="flex items-center gap-1">
               <button onClick={() => setIsPopupOpen(false)} className="p-1 hover:bg-slate-800 rounded text-slate-600 hover:text-white transition-all"><Minimize2 size={12} /></button>
               <button onClick={() => { setIsPopupOpen(false); setTimerSeconds(0); setIsTimerRunning(false); }} className="p-1 hover:bg-red-500/10 rounded text-slate-600 hover:text-red-500 transition-all"><X size={14} /></button>
            </div>
          </div>

          {/* Compact Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-3 gap-2">
             <div className={`font-mono font-bold tracking-tight text-white leading-none ${isTimerRunning ? 'animate-pulse' : ''}`} 
                  style={{ fontSize: `${Math.min(windowSize.w / 6, windowSize.h / 3)}px` }}>
               {formatTime(timerSeconds)}
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-xl active:scale-90 ${isTimerRunning ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' : 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'}`}
                >
                  {isTimerRunning ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button 
                  onClick={resetTimer}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-90"
                >
                  <RotateCcw size={16} />
                </button>
             </div>
          </div>

          {/* Minimal Resize Handle */}
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-slate-800 hover:text-indigo-500"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              resizeStart.current = { w: windowSize.w, h: windowSize.h, x: e.clientX, y: e.clientY };
            }}
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-current opacity-50" />
          </div>
        </div>
      )}
    </div>
  );
};
