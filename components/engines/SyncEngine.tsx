import React, { useState } from 'react';
import { 
  Server, RefreshCw, Search, Activity, CheckCircle2, AlertCircle, 
  Wifi, Copy, ExternalLink, Shield, Zap
} from 'lucide-react';
import { Chat, Message } from '@/src/types';

interface SyncEngineProps {
  activeChat: Chat;
  currentTheme: any;
  onSendMessage: (content?: string, type?: any, extra?: any) => void;
  onCleanup?: () => void;
}

export const SyncEngine: React.FC<SyncEngineProps> = ({ activeChat, currentTheme, onSendMessage, onCleanup }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Trigger Neural Cleanup first to ensure we aren't syncing on top of garbage
      if (onCleanup) onCleanup();
      
      await onSendMessage("Link sync", 'text', { action: 'sync' });
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  const handleCleanup = () => {
    setIsCleaning(true);
    if (onCleanup) onCleanup();
    setTimeout(() => setIsCleaning(false), 1500);
  };

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      await onSendMessage("check_com", 'text', { action: 'check' });
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsChecking(false), 2000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const syncMessages = activeChat.messages.filter(m => m.role === 'assistant' && !m.content.includes('Protocol active'));

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#02040a] p-4 sm:p-10">
      <div className="max-w-2xl mx-auto space-y-12 pb-32">
        
        {/* Header Info */}
        <div className="text-center space-y-4">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
             <Shield size={12} className="text-indigo-400" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">Secure Sync Protocol v1.0</span>
           </div>
           <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">Neural Sync Engine</h2>
           <div className="flex flex-col items-center gap-2">
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Node ID: {activeChat.receiverId}</p>
             <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
               <code className="text-[9px] font-mono text-slate-400">https://ntfy.sh/{activeChat.receiverId}</code>
               <button onClick={() => copyToClipboard(`https://ntfy.sh/${activeChat.receiverId}`)} className="text-slate-600 hover:text-white transition-colors">
                 <Copy size={12} />
               </button>
             </div>
           </div>
        </div>

        {/* Main Controls */}
        <div className="flex flex-col items-center gap-8 py-10">
          <div className="relative group">
            <div className={`absolute inset-0 bg-indigo-600/20 blur-3xl rounded-full transition-all duration-500 ${isSyncing ? 'opacity-100 scale-150' : 'opacity-0 scale-100'}`} />
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 border-2 transition-all duration-500 shadow-2xl active:scale-95 ${
                isSyncing 
                ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500/50 hover:text-white'
              }`}
            >
              <Server size={48} className={isSyncing ? 'animate-bounce' : ''} />
              <span className="text-xs font-black uppercase tracking-[0.4em]">Sync</span>
              {isSyncing && <RefreshCw size={16} className="absolute bottom-10 animate-spin text-white/50" />}
            </button>
          </div>

          <button 
            onClick={handleCheck}
            disabled={isChecking}
            className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-95 ${
              isChecking 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
              : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            {isChecking ? <Activity size={16} className="animate-pulse" /> : <Search size={16} />}
            Check Communication
          </button>

          <button 
            onClick={handleCleanup}
            disabled={isCleaning}
            className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-95 ${
              isCleaning 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
              : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            {isCleaning ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
            Neural Cleanup
          </button>
        </div>

        {/* Sync Logs / Changes */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 italic">Sync Logs</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Uplink Active</span>
            </div>
          </div>

          <div className="space-y-4">
            {syncMessages.length > 0 ? (
              syncMessages.map((msg) => (
                <div key={msg.id} className="bg-[#0f121d] border border-slate-800/60 rounded-[2rem] p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 group-hover:border-indigo-500/30 transition-colors">
                      <Zap size={18} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">{new Date(msg.timestamp).toLocaleString()}</span>
                        <CheckCircle2 size={14} className="text-emerald-500/50" />
                      </div>
                      <p className="text-sm font-medium text-slate-300 leading-relaxed select-text">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-800 gap-4">
                <Activity size={48} className="opacity-10" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">No Sync Data Recorded</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
