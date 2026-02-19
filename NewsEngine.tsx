import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, CheckCircle2, Circle, 
  BookOpen, Trash2, Activity, Check, X
} from 'lucide-react';
import { Chat, Message } from './types';

interface NewsEngineProps {
  activeChat: Chat;
  currentTheme: any;
  onUpdateMessage: (msgId: string, updates: Partial<Message>) => void;
  onDeleteMessage: (msgId: string) => void;
}

export const NewsEngine: React.FC<NewsEngineProps> = ({ activeChat, currentTheme, onUpdateMessage, onDeleteMessage }) => {
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const filteredPosts = useMemo(() => {
    return activeChat.messages.filter(m => m.type === 'post' && (activeTab === 'unread' ? !m.isRead : m.isRead));
  }, [activeChat.messages, activeTab]);

  const activePost = filteredPosts[activeIndex];

  const nextPost = () => {
    if (filteredPosts.length <= 1) return;
    setActiveIndex(prev => (prev + 1) % filteredPosts.length);
  };

  const prevPost = () => {
    if (filteredPosts.length <= 1) return;
    setActiveIndex(prev => (prev - 1 + filteredPosts.length) % filteredPosts.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = touchStart - currentTouch;

    if (diff > 50) {
      nextPost();
      setTouchStart(null);
    } else if (diff < -50) {
      prevPost();
      setTouchStart(null);
    }
  };

  const markAsRead = (post: Message) => {
    const quizComplete = !post.quiz || post.quiz.every(q => q.userAnswer !== undefined);
    if (!quizComplete) {
      if (navigator.vibrate) navigator.vibrate(50);
      alert("Neural sync required. Please complete all quiz segments.");
      return;
    }
    onUpdateMessage(post.id, { isRead: true });
    setActiveIndex(0);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleAnswer = (postId: string, questionId: string, answer: string) => {
    const post = activeChat.messages.find(m => m.id === postId);
    if (!post || !post.quiz) return;

    const newQuiz = post.quiz.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          userAnswer: answer,
          isCorrect: answer === q.correctAnswer
        };
      }
      return q;
    });

    onUpdateMessage(postId, { quiz: newQuiz });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  return (
    <div className="h-full flex flex-col bg-[#05060a]">
      {/* HUD HEADER */}
      <div className="shrink-0 p-4 border-b border-slate-800/40 bg-[#0a0d14]/60 backdrop-blur-xl flex items-center justify-center">
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
           <button 
             onClick={() => { setActiveTab('unread'); setActiveIndex(0); }}
             className={`px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'unread' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'}`}
           >
             Unread
           </button>
           <button 
             onClick={() => { setActiveTab('read'); setActiveIndex(0); }}
             className={`px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'read' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'}`}
           >
             Read
           </button>
        </div>
      </div>

      {/* CAROUSEL LAYER */}
      <div 
        className="flex-1 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {filteredPosts.length > 0 ? (
          <div className="h-full w-full flex items-center justify-center p-4 sm:p-10">
            {/* THE CARD */}
            <div className="w-full max-w-2xl h-full flex flex-col bg-[#0f121d] border border-slate-800/60 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Card Header */}
              <div className="p-8 sm:p-10 flex items-start justify-between bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/[0.02]">
                <div className="flex-1 pr-10">
                   <div className="flex items-center gap-3 mb-2">
                     <BookOpen size={16} className="text-indigo-400" />
                     <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">Node Signal // {activeIndex + 1} of {filteredPosts.length}</span>
                   </div>
                   <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase text-white leading-tight">{activePost.title}</h2>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => markAsRead(activePost)}
                    className={`p-4 rounded-2xl transition-all shadow-xl active:scale-90 ${activePost.isRead ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                  >
                    <CheckCircle2 size={24} />
                  </button>
                  <button onClick={() => onDeleteMessage(activePost.id)} className="p-3 text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex-1 overflow-y-auto p-8 sm:p-12 custom-scrollbar space-y-10">
                <div className="prose prose-invert max-w-none">
                  <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-medium whitespace-pre-wrap select-text">{activePost.content}</p>
                </div>

                {/* Quiz Section */}
                {activePost.quiz && activePost.quiz.length > 0 && (
                  <div className="pt-10 border-t border-slate-800/50 space-y-12">
                     <div className="flex items-center gap-3">
                        <Activity size={20} className="text-amber-500 animate-pulse" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Neural Validation Required</h4>
                     </div>
                     
                     {activePost.quiz.map((q, idx) => (
                       <div key={q.id} className="space-y-6">
                         <p className="text-white font-bold text-sm sm:text-md">Q{idx + 1}: {q.question}</p>
                         <div className="grid grid-cols-1 gap-3">
                           {q.options.map((opt) => {
                             const isSelected = q.userAnswer === opt;
                             const isRevealed = q.userAnswer !== undefined;
                             const isCorrect = opt === q.correctAnswer;

                             return (
                               <button 
                                 key={opt}
                                 disabled={isRevealed}
                                 onClick={() => handleAnswer(activePost.id, q.id, opt)}
                                 className={`w-full text-left p-4 rounded-[1.5rem] border text-xs font-bold transition-all flex items-center justify-between group ${
                                   isSelected 
                                    ? (isCorrect ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white') 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                 }`}
                               >
                                 <span className="truncate pr-4">{opt}</span>
                                 {isSelected && (isCorrect ? <Check size={16} /> : <X size={16} />)}
                                 {!isSelected && !isRevealed && <Circle size={14} className="opacity-0 group-hover:opacity-100" />}
                               </button>
                             );
                           })}
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </div>

              {/* Card Footer Progress */}
              {activePost.quiz && (
                <div className="h-2 bg-slate-950">
                  <div 
                    className={`h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]`}
                    style={{ width: `${(activePost.quiz.filter(q => q.userAnswer !== undefined).length / activePost.quiz.length) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 italic gap-4">
            <Activity size={64} className="opacity-10" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Frequency Clear // Node Idle</span>
          </div>
        )}
      </div>

      {/* Pagination Indicators & Nav Controls */}
      {filteredPosts.length > 1 && (
        <div className="p-6 flex items-center justify-center gap-6">
           <button 
             onClick={prevPost}
             className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all active:scale-90 shadow-lg"
           >
             <ChevronLeft size={24} />
           </button>

           <div className="flex gap-3">
              {filteredPosts.map((_, i) => (
                <div 
                  key={i} 
                  onClick={() => setActiveIndex(i)}
                  className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${i === activeIndex ? 'w-10 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'w-1.5 bg-slate-800'}`} 
                />
              ))}
           </div>

           <button 
             onClick={nextPost}
             className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all active:scale-90 shadow-lg"
           >
             <ChevronRight size={24} />
           </button>
        </div>
      )}
    </div>
  );
};