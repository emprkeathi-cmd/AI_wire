import React, { useRef, useEffect } from 'react';
import { 
  Paperclip, Mic, Send, Trash2, Check, Paperclip as FileIcon 
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
    onSendMessage, onFileUpload, onMicMouseDown, onMicMouseUp, 
    onCancelRecording, onStopRecording, messagesEndRef, chatFileInputRef
  } = props;

  // RAW RENDERER: No filters. Just finds the string and displays it.
  const renderContent = (content: any) => {
    if (!content) return "";
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      // Priority keys from n8n
      return content.output || content.message || content.response || content.text || JSON.stringify(content);
    }
    return String(content);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeChat.messages.length, isTyping]);

  return (
    <div className="flex flex-col h-full selection:bg-indigo-500/30">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-8 max-w-4xl mx-auto w-full pt-4 pb-20">
          {activeChat.messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[75%] px-5 py-4 rounded-[2rem] shadow-2xl relative group transition-all select-text cursor-text ${msg.role === 'user' ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white rounded-tr-none` : 'bg-slate-900 border border-slate-800/50 text-slate-100 rounded-tl-none'}`}>
                
                {msg.type === 'file' && (
                  <div className="flex items-center gap-3 mb-2 p-3 bg-white/10 rounded-2xl border border-white/10 select-none">
                    <FileIcon size={18} className="text-white/60" />
                    <span className="text-xs font-bold truncate">{renderContent(msg.content)}</span>
                  </div>
                )}

                {msg.type === 'audio' && (
                  <div className="flex flex-col gap-1 mb-2 select-none">
                    <div className="flex items-center gap-3 p-3 bg-white/10 rounded-2xl border border-white/10">
                      <Mic size={18} className="text-white/60" />
                      <span className="text-xs font-bold">Neural Voice Transmission</span>
                    </div>
                    {msg.attachments?.[0]?.url && <AudioPlayer src={msg.attachments[0].url} />}
                  </div>
                )}

                <p className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">
                  {renderContent(msg.content)}
                </p>

                <div className={`text-[9px] mt-2 font-bold opacity-40 uppercase tracking-widest select-none ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-900/50 border border-slate-800/30 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5 animate-pulse">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Processing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-24 shrink-0" />
        </div>
      </div>

      <footer className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
          <div className="flex-1 relative">
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); } }} 
              placeholder="Transmit intent..." 
              className="w-full bg-slate-800 text-slate-100 rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none border border-slate-700/50 resize-none min-h-[56px] custom-scrollbar" 
              rows={1} 
            />
            <button onClick={() => onSendMessage()} disabled={!inputText.trim() || isTyping} className="absolute right-2 bottom-2 p-3 text-white">
                <Send size={20} className={inputText.trim() ? "text-indigo-400" : "text-slate-600"} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
