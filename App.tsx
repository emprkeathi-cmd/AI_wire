import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Menu, 
  Plus, 
  MoreVertical, 
  Send, 
  Mic, 
  X, 
  Trash2, 
  Bot,
  AudioLines,
  Zap,
  ChevronUp,
  ChevronDown,
  Upload,
  ImageIcon,
  Palette,
  ChevronLeft,
  ChevronRight,
  Check,
  Paperclip,
  FileText,
  Link as LinkIcon,
  Copy,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Chat, Message, ThemePalette } from './types';
import { Logo } from './components/Logo';
import { sendMessageToN8N } from './services/n8nService';

const HOLD_DURATION = 1700; 

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('purple');
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{name: string, blob: Blob, preview?: string}[]>([]);
  const [isDoorConnected, setIsDoorConnected] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparingRecord, setIsPreparingRecord] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const shouldDiscardRef = useRef(false);
  const agentIconInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const paletteConfigs = {
    purple: { from: 'from-purple-600', to: 'to-blue-600', text: 'text-purple-400', ring: 'ring-purple-500/40', bg: 'bg-purple-600', shadow: 'shadow-purple-500/20', hex: '#8B5CF6' },
    emerald: { from: 'from-emerald-500', to: 'to-teal-600', text: 'text-emerald-400', ring: 'ring-emerald-500/40', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20', hex: '#10B981' },
    amber: { from: 'from-amber-500', to: 'to-orange-600', text: 'text-amber-400', ring: 'ring-amber-500/40', bg: 'bg-amber-500', shadow: 'shadow-amber-500/20', hex: '#F59E0B' },
    rose: { from: 'from-rose-500', to: 'to-pink-600', text: 'text-rose-400', ring: 'ring-rose-500/40', bg: 'bg-rose-500', shadow: 'shadow-rose-500/20', hex: '#F43F5E' },
    cyan: { from: 'from-cyan-500', to: 'to-blue-500', text: 'text-cyan-400', ring: 'ring-cyan-500/40', bg: 'bg-cyan-500', shadow: 'shadow-cyan-500/20', hex: '#06B6D4' },
  };

  const currentTheme = paletteConfigs[palette];

  // Logic for the "Door" (SSE listener)
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsDoorConnected(false);
    }

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat || !activeChat.receiverId) return;

    // We use ntfy.sh as a public gateway "door"
    const url = `https://ntfy.sh/${activeChat.receiverId}/sse`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setIsDoorConnected(true);
    es.onerror = () => setIsDoorConnected(false);
    
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'message' && data.message) {
          const assistantMessage: Message = {
            id: 'door-' + Date.now(),
            role: 'assistant',
            content: data.message,
            timestamp: Date.now()
          };
          setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
          if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
      } catch (err) {
        // Silently ignore non-JSON or unrelated messages
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [activeChatId, chats]);

  useEffect(() => {
    const savedChats = localStorage.getItem('ai_wire_chats');
    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      // Migrate old chats to have receiverIds if missing
      const migrated = parsed.map((c: any) => ({
        ...c,
        receiverId: c.receiverId || `ai_wire_${Math.random().toString(36).substring(2, 15)}`
      }));
      setChats(migrated);
      if (migrated.length > 0) setActiveChatId(migrated[0].id);
    }
    const savedPalette = localStorage.getItem('ai_wire_palette') as ThemePalette;
    if (savedPalette) setPalette(savedPalette);
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_wire_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('ai_wire_palette', palette);
  }, [palette]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom('auto'), 50);
    return () => clearTimeout(timer);
  }, [activeChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const handleSendMessage = async (content?: string | Blob, type: 'text' | 'audio' | 'file' = 'text') => {
    const messageContent = content || inputText;
    if (!messageContent && pendingFiles.length === 0 && !activeChatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: type === 'audio' ? 'Voice Message' : (messageContent as string || 'Sent files'),
      type: pendingFiles.length > 0 ? 'file' : type,
      timestamp: Date.now(),
      attachments: pendingFiles.map(f => ({
        name: f.name,
        url: f.preview || '',
        type: f.blob.type
      }))
    };

    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
    setInputText('');
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    setIsTyping(true);

    try {
      const currentChat = chats.find(c => c.id === activeChatId);
      if (currentChat) {
        const response = await sendMessageToN8N(
          currentChat.webhookUrl, 
          messageContent as string, 
          filesToSend.length > 0 ? 'file' : type,
          { files: filesToSend }
        );
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      }
    } catch (error) {
       console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReaction = async (message: Message, reaction: 'check' | 'x') => {
    if (!activeChat) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      messages: c.messages.map(m => m.id === message.id ? { ...m, reacted: true } : m)
    } : c));
    setActiveReactionId(null);
    try {
      await sendMessageToN8N(activeChat.webhookUrl, reaction, 'reaction', { originalContent: message.content });
    } catch (error) {
      console.error("Failed to send reaction", error);
    }
  };

  const handleChatFiles = async (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    const processed = await Promise.all(newFiles.map(async (f) => {
      const preview = f.type.startsWith('image/') ? await new Promise<string>((r) => {
        const reader = new FileReader();
        reader.onload = (e) => r(e.target?.result as string);
        reader.readAsDataURL(f);
      }) : undefined;
      return { name: f.name, blob: f as Blob, preview };
    }));
    setPendingFiles(prev => [...prev, ...processed]);
  };

  const traverseFileTree = (item: any, path: string = ""): Promise<File[]> => {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file: File) => resolve([file]));
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        const readAllEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length > 0) {
              const filePromises = entries.map(entry => traverseFileTree(entry, path + item.name + "/"));
              const files = await Promise.all(filePromises);
              resolve(files.flat());
            } else {
              resolve([]);
            }
          });
        };
        readAllEntries();
      } else {
        resolve([]);
      }
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (items) {
      const entries = Array.from(items).map(item => item.webkitGetAsEntry()).filter(Boolean);
      const filePromises = entries.map(entry => traverseFileTree(entry));
      const allFiles = (await Promise.all(filePromises)).flat();
      if (allFiles.length > 0) handleChatFiles(allFiles);
    } else {
      handleChatFiles(e.dataTransfer.files);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      shouldDiscardRef.current = false;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        if (shouldDiscardRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleSendMessage(audioBlob, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (err) {
      console.error(err);
      setIsRecording(false);
      setIsPreparingRecord(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsPreparingRecord(false);
    setHoldProgress(0);
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
  };

  const cancelRecording = () => { shouldDiscardRef.current = true; stopRecording(); };

  const handleMicDown = (e: React.PointerEvent) => {
    if (!activeChatId || isRecording) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsPreparingRecord(true);
    setHoldProgress(0);
    const startTime = Date.now();
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
    }, 20);
    pressTimerRef.current = window.setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      setIsPreparingRecord(false);
      setHoldProgress(0);
      startRecording();
    }, HOLD_DURATION);
  };

  const handleMicUp = (e: React.PointerEvent) => {
    if (!activeChatId) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    if (!isRecording) { setIsPreparingRecord(false); setHoldProgress(0); }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateActiveChat = (updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, ...updates } : c));
  };

  const lastAssistantMessageId = [...(activeChat?.messages || [])].reverse().find(m => m.role === 'assistant')?.id;

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newChat: Chat = {
      id: newId,
      name: `Agent ${chats.length + 1}`,
      webhookUrl: '',
      receiverId: `ai_wire_${Math.random().toString(36).substring(2, 15)}`,
      messages: [{ id: 'sys-' + Date.now(), role: 'system', content: 'Protocol active. Awaiting uplink parameters.', timestamp: Date.now() }],
      createdAt: Date.now()
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newId);
    setIsSidebarOpen(false);
  };

  const moveChat = (index: number, direction: 'up' | 'down') => {
    const newChats = [...chats];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newChats.length) return;
    [newChats[index], newChats[targetIndex]] = [newChats[targetIndex], newChats[index]];
    setChats(newChats);
  };

  const deleteChat = (id: string) => {
    const updatedChats = chats.filter(c => c.id !== id);
    setChats(updatedChats);
    if (activeChatId === id) setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    setIsChatSettingsOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-hidden relative select-none" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><SettingsIcon size={20} /></button>
            <div className="flex items-center gap-2"><Logo size={32} color={currentTheme.hex} /><span className="font-black text-xl tracking-tight text-white italic">AI wire</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><ChevronLeft size={20} /></button>
          </div>
          <div className="p-4">
            <button onClick={createNewChat} className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} hover:opacity-90 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xl active:scale-95`}><Plus size={18} /> Deploy Agent</button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <div className="px-3 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className={currentTheme.text} /> Neural Links</div>
            {chats.map((chat, idx) => (
              <div key={chat.id} className="relative group">
                <button onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-3 mb-1 pr-12 ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from}/30 ${currentTheme.to}/10 text-white ring-1 ${currentTheme.ring}` : 'hover:bg-slate-800/60 text-slate-400'}`}>
                  <div className={`p-0.5 rounded-xl overflow-hidden w-10 h-10 flex items-center justify-center ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white` : 'bg-slate-800'}`}>{chat.icon ? <img src={chat.icon} className="w-full h-full object-cover rounded-lg" alt="" /> : <Bot size={20} />}</div>
                  <div className="flex-1 truncate"><div className="font-bold truncate text-sm">{chat.name}</div><div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">{chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : 'Awaiting sync'}</div></div>
                </button>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); moveChat(idx, 'up'); }} className="p-1 hover:bg-slate-700 rounded text-slate-500"><ChevronUp size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveChat(idx, 'down'); }} className="p-1 hover:bg-slate-700 rounded text-slate-500"><ChevronDown size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full bg-slate-950 min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"><Menu size={22} /></button>
            {activeChat && (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to} rounded-2xl flex items-center justify-center text-white font-black overflow-hidden shrink-0`}>{activeChat.icon ? <img src={activeChat.icon} className="w-full h-full object-cover" alt="" /> : <div>{activeChat.name.charAt(0)}</div>}</div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-bold text-sm tracking-tight truncate">{activeChat.name}</h2>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDoorConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{isDoorConnected ? 'Link Active' : 'Door Closed'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setIsChatSettingsOpen(true)} className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl"><MoreVertical size={20} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 text-center"><Logo size={120} className="animate-pulse" color={currentTheme.hex} /><div><h3 className="text-2xl font-black text-white italic tracking-tighter">AI wire</h3><p className="max-w-[240px] mx-auto text-sm text-slate-500 mt-2 font-medium uppercase tracking-widest">Neural Command Center</p></div></div>
          ) : (
            activeChat?.messages.map((msg) => {
              const isLastAssistantMessage = msg.id === lastAssistantMessageId;
              const canReact = isLastAssistantMessage && !msg.reacted;
              return (
                <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'system' ? (
                    <div className="w-full text-center py-3"><span className="bg-slate-900 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em] px-4 py-1.5 rounded-full border border-slate-800">{msg.content}</span></div>
                  ) : (
                    <>
                      <div className={`max-w-[85%] lg:max-w-[70%] px-5 py-4 rounded-[2rem] shadow-2xl relative group transition-all ${msg.role === 'user' ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white rounded-tr-none` : 'bg-slate-900 border border-slate-800/50 text-slate-100 rounded-tl-none'}`}>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {msg.attachments.map((at, i) => (
                              <div key={i} className="bg-black/20 p-2 rounded-xl flex items-center gap-2">
                                {at.url ? <img src={at.url} className="w-8 h-8 rounded object-cover" alt="" /> : <FileText size={16} />}
                                <span className="text-[10px] font-bold truncate max-w-[100px]">{at.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.type === 'audio' ? (
                          <div className="flex items-center gap-3"><div className="p-3 bg-white/10 rounded-2xl"><AudioLines size={24} className="text-white animate-pulse" /></div><div><span className="text-sm font-bold block">Encrypted Log</span><span className="text-[10px] opacity-70 uppercase tracking-widest font-bold">Secure Path</span></div></div>
                        ) : (
                          <p className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <div className={`text-[9px] mt-2 font-bold opacity-40 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>

                      {msg.role === 'assistant' && canReact && (
                        <div className="flex items-center gap-1 mb-2 animate-in fade-in slide-in-from-left-2 duration-300">
                          <button 
                            onClick={() => setActiveReactionId(activeReactionId === msg.id ? null : msg.id)} 
                            className={`p-2 rounded-xl transition-all flex items-center justify-center ${activeReactionId === msg.id ? currentTheme.bg + ' text-white scale-110 shadow-lg' : 'bg-slate-900 text-slate-600 hover:text-slate-300'}`}
                          >
                            <ChevronRight size={14} className={`transition-transform duration-300 ${activeReactionId === msg.id ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {activeReactionId === msg.id && (
                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-2xl animate-in slide-in-from-left-4 fade-in duration-300">
                              <button onClick={() => handleReaction(msg, 'x')} className="p-2 bg-red-950/40 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><X size={16} /></button>
                              <button onClick={() => handleReaction(msg, 'check')} className="p-2 bg-emerald-950/40 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={16} /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
          {isTyping && <div className="flex justify-start"><div className="bg-slate-900/50 border border-slate-800/30 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5"><span className={`w-2 h-2 ${currentTheme.bg} rounded-full animate-bounce [animation-duration:0.6s]`} /><span className={`w-2 h-2 ${currentTheme.bg} opacity-50 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]`} /></div></div>}
          <div ref={messagesEndRef} className="h-4" />
        </div>
        {activeChatId && (
          <footer className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-2xl">
            {pendingFiles.length > 0 && (
              <div className="max-w-4xl mx-auto mb-4 flex flex-wrap gap-2 animate-in slide-in-from-bottom-2 duration-300">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative group bg-slate-800 p-2 pr-8 rounded-xl border border-slate-700 flex items-center gap-2">
                    {f.preview ? <img src={f.preview} className="w-8 h-8 rounded object-cover" alt="" /> : <FileText size={16} />}
                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{f.name}</span>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
              {(isPreparingRecord || isRecording) && (
                <div className="absolute inset-0 bg-slate-900 z-50 flex items-center px-4 rounded-3xl border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
                  {isPreparingRecord && <div className={`absolute top-0 left-0 h-1 ${currentTheme.bg} transition-all duration-75`} style={{ width: `${holdProgress}%` }} />}
                  {isRecording && <button onClick={cancelRecording} className="p-3 mr-2 bg-slate-800 text-red-500 rounded-xl hover:bg-slate-700 border border-slate-700"><Trash2 size={20} /></button>}
                  <div className="flex flex-1 items-center gap-4">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${isRecording ? 'bg-red-500 animate-ping' : currentTheme.bg}`} />
                    <div className="flex flex-col"><span className="font-black text-[10px] uppercase tracking-widest text-slate-400">{isRecording ? 'Capturing Frequency' : 'Initiating Link...'}</span><span className="font-mono text-xl text-white font-bold">{isRecording ? formatTime(recordingTime) : `${((HOLD_DURATION - (holdProgress * HOLD_DURATION / 100)) / 1000).toFixed(1)}s`}</span></div>
                  </div>
                  {isRecording && <button onClick={stopRecording} className={`ml-auto px-5 py-2.5 bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2`}>Deploy <Send size={14} /></button>}
                </div>
              )}
              <input type="file" ref={chatFileInputRef} multiple onChange={(e) => e.target.files && handleChatFiles(e.target.files)} className="hidden" />
              <button onClick={() => chatFileInputRef.current?.click()} className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl active:scale-90 transition-all shrink-0"><Paperclip size={24} /></button>
              <button onPointerDown={handleMicDown} onPointerUp={handleMicUp} onPointerLeave={handleMicUp} className={`p-4 rounded-2xl transition-all duration-300 transform active:scale-90 touch-none shrink-0 ${isRecording ? `${currentTheme.bg} text-white scale-110 shadow-2xl` : isPreparingRecord ? `${currentTheme.bg} text-white scale-105 animate-pulse` : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {isRecording ? <AudioLines size={24} className="animate-pulse" /> : <Mic size={24} />}
              </button>
              <div className="flex-1 relative min-w-0">
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Transmit intent..." className="w-full bg-slate-800 text-slate-100 rounded-2xl px-5 py-4 pr-14 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-700 border border-slate-700/50 transition-all resize-none min-h-[56px] max-h-[160px] shadow-inner" rows={1} />
                <button onClick={() => handleSendMessage()} disabled={(!inputText.trim() && pendingFiles.length === 0) || isTyping} className={`absolute right-2 bottom-2 p-3 rounded-xl transition-all ${(inputText.trim() || pendingFiles.length > 0) && !isTyping ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white hover:scale-105 shadow-lg` : 'text-slate-600'}`}><Send size={20} /></button>
              </div>
            </div>
          </footer>
        )}
      </main>
      
      {isChatSettingsOpen && activeChat && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsChatSettingsOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl`}><Bot size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight">Agent Sync</h3></div>
                <button onClick={() => setIsChatSettingsOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Neural Door Section */}
                <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]"><Wifi size={14} /> Neural Door (Receiver)</label>
                    <div className={`w-2 h-2 rounded-full ${isDoorConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">This unique link allows external systems to send data DIRECTLY into this chat. It acts as an asynchronous door for your agent.</p>
                  <div className="relative group">
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-[9px] text-slate-300 truncate pr-10">
                      {`https://ntfy.sh/${activeChat.receiverId}`}
                    </div>
                    <button onClick={() => copyToClipboard(`https://ntfy.sh/${activeChat.receiverId}`)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all"><Copy size={14} /></button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Optical Scan Interface</label>
                  <input type="file" ref={agentIconInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => updateActiveChat({ icon: ev.target?.result as string }); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                  <div onClick={() => agentIconInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-slate-500 hover:bg-slate-800/50 transition-all cursor-pointer relative overflow-hidden group">
                    {activeChat.icon ? (
                      <><img src={activeChat.icon} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-20 transition-opacity" alt="" /><div className="relative z-10 flex flex-col items-center text-white"><Upload size={24} className="mb-1" /><span className="text-[10px] font-bold uppercase text-center px-4">Tap to Update Representation</span></div></>
                    ) : (
                      <><ImageIcon size={32} className="text-slate-600 group-hover:text-slate-400" /><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest group-hover:text-slate-300">Tap to Select Image</span></>
                    )}
                  </div>
                </div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Designation</label><input type="text" value={activeChat.name} onChange={(e) => updateActiveChat({ name: e.target.value })} className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-bold text-sm" /></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">n8n Uplink Webhook</label><input type="url" value={activeChat.webhookUrl} onChange={(e) => updateActiveChat({ webhookUrl: e.target.value })} className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-mono text-[10px] tracking-tight" /></div>
                <button onClick={() => deleteChat(activeChat.id)} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-red-950/20 hover:bg-red-950/40 text-red-500 border border-red-900/20 transition-all text-xs font-bold uppercase tracking-widest mt-4">Sever Link <Trash2 size={16} /></button>
              </div>
            </div>
            <div className="bg-slate-800/30 p-6 flex justify-end shrink-0"><button onClick={() => setIsChatSettingsOpen(false)} className={`px-8 py-3 ${currentTheme.bg} text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg`}>Save Sync Data</button></div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black italic tracking-tighter mb-8 flex items-center gap-3"><SettingsIcon className={currentTheme.text} /> AI wire settings</h3>
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2"><Palette size={14} /> Interface Color Palette</label>
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(paletteConfigs) as ThemePalette[]).map((p) => (
                    <button key={p} onClick={() => setPalette(p)} className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ring-offset-4 ring-offset-slate-900 ${palette === p ? `ring-2 ${paletteConfigs[p].ring} scale-110` : 'hover:scale-110'}`} style={{ backgroundColor: paletteConfigs[p].hex }}>{palette === p && <Zap size={16} className="text-white" />}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all">Apply Sync Parameters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;