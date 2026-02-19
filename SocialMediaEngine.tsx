import React, { useState } from 'react';
import { 
  Check, X, MessageSquare, Send, ImageIcon, 
  Clock, Share2, MoreHorizontal, Activity, Trash2
} from 'lucide-react';
import { Chat, Message } from './types';

interface SocialMediaEngineProps {
  activeChat: Chat;
  currentTheme: any;
  onSendMessage: (content?: string, type?: any, extra?: any) => void;
  onDeleteMessage: (msgId: string) => void;
}

export const SocialMediaEngine: React.FC<SocialMediaEngineProps> = ({ activeChat, currentTheme, onSendMessage, onDeleteMessage }) => {
  const [comments, setComments] = useState<Record<string, string>>({});

  const posts = activeChat.messages.filter(m => m.type === 'social_post' || (m.role === 'assistant' && (m.content.includes('http') || m.title)));

  const handleAction = (post: Message, reaction: '✅' | '❌') => {
    const comment = comments[post.id] || "";
    
    // 1. Send the data to n8n
    onSendMessage(`${reaction} Post Action`, 'reaction', {
      originalContent: post.content,
      reaction,
      comment,
      postId: post.id
    });

    // 2. Automatically wipe the post from the UI
    onDeleteMessage(post.id);

    // 3. Cleanup local comment state
    setComments(prev => {
      const next = { ...prev };
      delete next[post.id];
      return next;
    });

    if (navigator.vibrate) navigator.vibrate(40);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#02040a] p-4 sm:p-10">
      <div className="max-w-2xl mx-auto space-y-12 pb-32">
        <div className="text-center space-y-2">
           <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Social Management Hub</h2>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Node ID: {activeChat.receiverId}</p>
        </div>

        {posts.length > 0 ? (
          posts.map((post) => (
            <div key={post.id} className="bg-[#0f121d] border border-slate-800/60 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Card Header */}
              <div className="p-6 flex items-center justify-between border-b border-white/[0.03]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to} flex items-center justify-center text-white shadow-lg`}>
                    <Share2 size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white uppercase tracking-tight">{post.title || "Draft Publication"}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                       <Clock size={10} /> {new Date(post.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button onClick={() => onDeleteMessage(post.id)} className="p-2 text-slate-700 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Card Content */}
              <div className="p-6 sm:p-8 space-y-6">
                 <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium whitespace-pre-wrap select-text">
                   {post.content}
                 </p>
                 
                 {post.assets?.[0] && (
                   <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-inner group relative">
                      <img src={post.assets[0]} alt="Post Content" className="w-full h-auto object-cover max-h-[400px]" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                 )}
              </div>

              {/* Interaction Bar */}
              <div className="p-6 bg-slate-950/40 border-t border-white/[0.03] space-y-4">
                 <div className="relative">
                   <textarea 
                     value={comments[post.id] || ''}
                     onChange={(e) => setComments({ ...comments, [post.id]: e.target.value })}
                     placeholder="Add internal feedback..."
                     className="w-full bg-slate-900 border border-slate-800/80 rounded-2xl px-5 py-4 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/40 transition-all resize-none min-h-[80px] custom-scrollbar"
                   />
                   <div className="absolute right-4 bottom-4 text-[9px] font-black text-slate-700 uppercase tracking-widest">Optional</div>
                 </div>

                 <div className="flex gap-3">
                   <button 
                     onClick={() => handleAction(post, '✅')}
                     className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                   >
                     <Check size={16} /> Approve Post
                   </button>
                   <button 
                     onClick={() => handleAction(post, '❌')}
                     className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl shadow-xl shadow-rose-600/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                   >
                     <X size={16} /> Reject Post
                   </button>
                 </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-700 gap-4 italic">
            <Activity size={64} className="opacity-10" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Queue Clear // No Pending Posts</span>
          </div>
        )}
      </div>
    </div>
  );
};