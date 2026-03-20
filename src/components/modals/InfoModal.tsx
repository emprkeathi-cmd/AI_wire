import React from 'react';
import { X, Monitor, ChevronLeft } from 'lucide-react';
import { Chat } from '@/src/types';
import { getModuleDocumentation } from '@/src/constants/documentation';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChat: Chat;
  appStyle: 'sleek' | 'cyber';
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, activeChat, appStyle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[110] p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className={`relative bg-[#0a0c14] w-full max-w-2xl rounded-[3rem] border border-slate-800/60 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 sm:p-12 animate-in zoom-in-95 duration-300 max-h-[90dvh] overflow-y-auto custom-scrollbar ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1">
            <h3 className={`text-3xl font-black italic tracking-tighter text-white ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}>Protocol Documentation</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Module: {activeChat.mode || 'Neural Link'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Inbound Signal Format (n8n → App)</label>
            <div className="relative group">
              <pre className="w-full bg-slate-950 border border-slate-800/60 rounded-3xl p-6 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed shadow-inner">
                {getModuleDocumentation(activeChat.mode, activeChat.categories)}
              </pre>
              <div className="absolute right-4 top-4 text-[8px] font-black text-slate-700 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Select to Copy</div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Neural Training Resource</label>
            <a 
              href="https://youtu.be/Nn6Jq-AR80M" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center justify-between p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-[2rem] group transition-all ${appStyle === 'cyber' ? 'rounded-none' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Monitor size={24} />
                </div>
                <div>
                  <span className="block text-sm font-black text-white uppercase tracking-tight">Tutorial: {activeChat.mode || 'Neural Link'}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Video Protocol // External Link</span>
                </div>
              </div>
              <ChevronLeft size={20} className="text-slate-700 group-hover:text-indigo-400 transition-colors rotate-180" />
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.03]">
          <button 
            onClick={onClose} 
            className={`w-full py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95 shadow-lg ${appStyle === 'cyber' ? 'rounded-none font-mono' : ''}`}
          >
            Acknowledge Protocol
          </button>
        </div>
      </div>
    </div>
  );
};
