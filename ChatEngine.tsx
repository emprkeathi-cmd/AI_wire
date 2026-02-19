
import React, { useRef, useEffect } from 'react';
import { 
  Paperclip, Mic, Send, Trash2, Bot, Check, Paperclip as FileIcon
} from 'lucide-react';
import { Chat, Message, ThemePalette } from './types';

interface ChatEngineProps {
  activeChat: Chat;
  currentTheme: any;
  palette: ThemePalette;
  isTyping: boolean;
  inputText: string;
  setInputText: (val: string) => void;
  isRecording: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  holdProgress: number;
  lastAssistantMsgIndex: number;
  onSendMessage: (content?: string, type?: any, extra?: any, blob?: Blob, file?: File) => void;
  onReaction: (msg: Message, reaction: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMicMouseDown: (e?: any) => void;
  onMicMouseUp: (e?: any) => void;
  onCancelRecording: () => void;
  onStopRecording: (send: boolean) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatFileInputRef: React.RefObject<HTMLInputElement>;
}

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3 mt-2 border border-white/5 group-hover:border-white/20 transition-all">
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all active:scale-90 text-white">
        {isPlaying ? <span className="w-3 h-3 bg-white rounded-sm" /> : <span className="border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-1" />}
      </button>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Neural Record</span>
        <span className="text-[9px] font-bold text-white/40">Relisten Transmission</span>
      </div>
    </div>
  );
};

export const ChatEngine: React.FC<ChatEngineProps> = (props) => {
  const { 
    activeChat, currentTheme, isTyping, inputText, setInputText, 
    isRecording, recordingDuration, audioBlob, holdProgress, 
    lastAssistantMsgIndex, onSendMessage, onReaction, onFileUpload,
    onMicMouseDown, onMicMouseUp, onCancelRecording, onStopRecording,
    messagesEndRef, chatFileInputRef
  } = props;

  // Bottom Lock implementation: Scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeChat.messages.length, isTyping, activeChat.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-8 max-w-4xl mx-auto w-full pt-4 pb-20">
          {activeChat.messages.map((msg, index) => (
            <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'system' ? (
                <div className="w-full text-center py-3"><span className="bg-slate-900 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em] px-4 py-1.5 rounded-full border border-slate-800">{msg.content}</span></div>
              ) : (
                <div className={`max-w-[85%] lg:max-w-[75%] px-5 py-4 rounded-[2rem] shadow-2xl relative group transition-all ${msg.role === 'user' ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white rounded-tr-none` : 'bg-slate-900 border border-slate-800/50 text-slate-100 rounded-tl-none'}`}>
                  {msg.type === 'file' && <div className="flex items-center gap-3 mb-2 p-3 bg-white/10 rounded-2xl border border-white/10"><FileIcon size={18} className="text-white/60" /><span className="text-xs font-bold truncate">{msg.content}</span></div>}
                  {msg.type === 'audio' && (
                    <div className="flex flex-col gap-1 mb-2">
                       <div className="flex items-center gap-3 p-3 bg-white/10 rounded-2xl border border-white/10">
                        <Mic size={18} className="text-white/60" />
                        <span className="text-xs font-bold">Neural Voice Transmission</span>
                      </div>
                      {msg.attachments?.[0]?.url && <AudioPlayer src={msg.attachments[0].url} />}
                    </div>
                  )}
                  <p className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`text-[9px] mt-2 font-bold opacity-40 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  {msg.role === 'assistant' && !msg.reacted && index === lastAssistantMsgIndex && (
                    <div className="absolute -bottom-10 left-0 flex gap-2 animate-in fade-in slide-in-from-top-1">
                      <button onClick={() => onReaction(msg, '✅')} className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-2 rounded-xl hover:bg-slate-700 hover:scale-110 active:scale-90 transition-all shadow-lg">✅</button>
                      <button onClick={() => onReaction(msg, '❌')} className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-2 rounded-xl hover:bg-slate-700 hover:scale-110 active:scale-90 transition-all shadow-lg">❌</button>
                    </div>
                  )}
                  {msg.reacted && (
                     <div className="absolute -bottom-2 -right-2 bg-slate-800 border border-slate-700 p-1 rounded-lg text-[10px] shadow-lg animate-in zoom-in-50">
                        <Check size={10} className="text-emerald-500" />
                     </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-900/50 border border-slate-800/30 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5">
                <span className={`w-2 h-2 ${currentTheme.bg} rounded-full animate-bounce [animation-duration:0.6s]`} />
                <span className={`w-2 h-2 ${currentTheme.bg} opacity-50 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]`} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-24 shrink-0" />
        </div>
      </div>

      <footer className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-2xl relative">
        {holdProgress > 0 && !isRecording && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden z-50">
            <div className={`h-full bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} transition-all duration-75`} style={{ width: `${holdProgress}%` }} />
          </div>
        )}
        <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
          {(isRecording || audioBlob) ? (
            <div className="flex-1 flex items-center justify-between p-2 rounded-2xl bg-slate-800 border border-slate-700 h-[56px] animate-in slide-in-from-bottom-2">
              <button onClick={onCancelRecording} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={24} /></button>
              <div className="flex items-center gap-3 px-4">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm font-black text-white">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic hidden sm:inline">Neural Capturing...</span>
              </div>
              <button onClick={() => onStopRecording(true)} className={`p-3 ${currentTheme.bg} text-white rounded-xl shadow-lg active:scale-95 transition-all`}><Send size={24} /></button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 shrink-0">
                <input type="file" ref={chatFileInputRef} onChange={onFileUpload} className="hidden" />
                <button onClick={() => chatFileInputRef.current?.click()} className="w-14 h-14 bg-slate-800 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-colors shrink-0">
                  <Paperclip size={24} />
                </button>
                <button 
                  onMouseDown={onMicMouseDown} 
                  onMouseUp={onMicMouseUp} 
                  onMouseLeave={onMicMouseUp}
                  onTouchStart={(e) => { e.preventDefault(); onMicMouseDown(); }}
                  onTouchEnd={(e) => { e.preventDefault(); onMicMouseUp(); }}
                  onContextMenu={(e) => e.preventDefault()} 
                  className={`w-14 h-14 bg-slate-800 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-95 ${holdProgress > 0 ? 'bg-slate-700 text-white' : ''}`}
                >
                  <Mic size={24} className={holdProgress > 0 ? 'animate-pulse' : ''} />
                </button>
              </div>
              <div className="flex-1 relative min-w-0">
                <textarea 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); } }} 
                  placeholder="Transmit intent..." 
                  className="w-full bg-slate-800 text-slate-100 rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none border border-slate-700/50 resize-none min-h-[56px] custom-scrollbar" 
                  rows={1} 
                />
                <button onClick={() => onSendMessage()} disabled={(!inputText.trim() && !audioBlob) || isTyping} className={`absolute right-2 bottom-2 p-3 rounded-xl transition-all ${inputText.trim() && !isTyping ? `${currentTheme.bg} text-white shadow-lg` : 'text-slate-600'}`}><Send size={20} /></button>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
