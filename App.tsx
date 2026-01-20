import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MessageSquare,
  CalendarDays,
  Activity,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  FileUp,
  History,
  Tag
} from 'lucide-react';
import { Chat, Message, ThemePalette, Category } from './types';
import { Logo } from './components/Logo';
import { sendMessageToN8N } from './services/n8nService';

const App: React.FC = () => {
  // --- STATE ---
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('shwortz_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const saved = localStorage.getItem('shwortz_chats');
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed[0].id : null;
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  
  const [inputText, setInputText] = useState('');
  const [eventInputText, setEventInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('purple');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  
  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const coreImportRef = useRef<HTMLInputElement>(null);

  // --- DERIVED ---
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) || null, [chats, activeChatId]);

  const paletteConfigs = {
    purple: { primary: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
    emerald: { primary: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    amber: { primary: 'bg-amber-600', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    rose: { primary: 'bg-rose-600', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
    cyan: { primary: 'bg-cyan-600', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  };

  const currentTheme = paletteConfigs[palette];

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('shwortz_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChat?.mode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages, activeChat?.mode]);

  // --- ACTIONS ---
  const handleCreateChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      name: 'New Node',
      mode: 'chat',
      webhookUrl: '',
      receiverId: 'user_1',
      messages: [],
      categories: [
        { id: '1', name: 'Obligations', color: '#EF4444' },
        { id: '2', name: 'Social', color: '#10B981' },
        { id: '3', name: 'Leisure', color: '#3B82F6' },
      ],
      createdAt: Date.now(),
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setEditingChat(newChat);
    setIsChatSettingsOpen(true);
  };

  const handleSendMessage = async (
    overrideContent?: string | Blob, 
    type: 'text' | 'audio' | 'reaction' | 'file' | 'event' = 'text',
    metadata?: any
  ) => {
    if (!activeChat) return;
    
    const content = overrideContent || inputText;
    if (!content && type !== 'audio') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: typeof content === 'string' ? content : 'Audio Signal',
      type: type,
      timestamp: Date.now(),
      date: metadata?.date,
      categoryId: metadata?.categoryId,
      attachments: metadata?.attachments
    };

    const updatedChats = chats.map(c => {
      if (c.id === activeChatId) {
        return { ...c, messages: [...c.messages, userMessage] };
      }
      return c;
    });
    setChats(updatedChats);
    setInputText('');
    
    if (type !== 'event') {
      setIsTyping(true);
      try {
        const response = await sendMessageToN8N(activeChat.webhookUrl, content, type, metadata);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        };
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      } catch (err) {
        console.error(err);
      } finally {
        setIsTyping(false);
      }
    }
  };

  // --- EVENT HANDLING ---
  const openEventModal = (dateStr: string) => {
    setSelectedEventDate(dateStr);
    setSelectedCategoryId(activeChat?.categories[0]?.id || null);
    setIsEventModalOpen(true);
  };

  const handleCommitEvent = () => {
    if (!eventInputText || !selectedEventDate || !selectedCategoryId) return;
    handleSendMessage(eventInputText, 'event', { date: selectedEventDate, categoryId: selectedCategoryId });
    setEventInputText('');
    setIsEventModalOpen(false);
  };

  // --- VOICE ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      durationIntervalRef.current = window.setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecordingAndSend = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      handleSendMessage(blob, 'audio');
    };
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
  };

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const getEventsForDate = (dateStr: string) => activeChat?.messages.filter(m => m.type === 'event' && m.date === dateStr) || [];

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans`}>
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8 px-2">
            <Logo size={32} color="#8B5CF6" />
            <span className="font-bold text-xl tracking-tight">AI wire</span>
          </div>

          <button onClick={handleCreateChat} className="flex items-center justify-center gap-2 w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 mb-6 group">
            <Plus size={20} className="text-purple-400 group-hover:rotate-90 transition-transform" />
            <span className="font-medium">New Neural Node</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {chats.map(chat => (
              <div 
                key={chat.id}
                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${activeChatId === chat.id ? `${currentTheme.border} bg-purple-500/10` : 'border-transparent hover:bg-slate-800'}`}
                onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-700">
                  {chat.icon ? <img src={chat.icon} className="w-full h-full object-cover" /> : <Bot size={20} className="text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold truncate">{chat.name}</div>
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    {chat.mode === 'calendar' ? <CalendarIcon size={10} /> : <MessageSquare size={10} />}
                    {chat.messages[chat.messages.length - 1]?.content || 'Offline Node'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button onClick={() => setIsSettingsModalOpen(true)} className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white transition-colors">
              <SettingsIcon size={20} />
              <span className="text-sm font-medium">Neural Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Header */}
      <header className="h-16 flex items-center justify-between px-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <Menu size={24} />
          </button>
          {activeChat && (
            <div className="flex flex-col">
              <h1 className="font-bold text-sm leading-none">{activeChat.name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Node Active</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeChat && (
            <>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 mr-2">
                <button 
                  onClick={() => setChats(chats.map(c => c.id === activeChat.id ? { ...c, mode: 'chat' } : c))}
                  className={`p-1.5 rounded-md transition-all ${activeChat.mode === 'chat' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                  <MessageSquare size={16} />
                </button>
                <button 
                  onClick={() => setChats(chats.map(c => c.id === activeChat.id ? { ...c, mode: 'calendar' } : c))}
                  className={`p-1.5 rounded-md transition-all ${activeChat.mode === 'calendar' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                  <CalendarIcon size={16} />
                </button>
              </div>
              <button onClick={() => { setEditingChat(activeChat); setIsChatSettingsOpen(true); }} className="p-2 text-slate-400 hover:text-white">
                <MoreVertical size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <Logo size={120} className="animate-pulse" />
            <h2 className="text-2xl font-bold">Initialize Node</h2>
            <button onClick={handleCreateChat} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-purple-500/20">
              Create Transmission Node
            </button>
          </div>
        ) : activeChat.mode === 'chat' ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar">
              {activeChat.messages.map((msg) => (
                <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    onClick={() => msg.role === 'assistant' && setReactionTargetId(reactionTargetId === msg.id ? null : msg.id)}
                    className={`relative max-w-[85%] px-4 py-3 rounded-2xl text-sm transition-all ${
                    msg.role === 'user' 
                      ? `${currentTheme.primary} text-white rounded-tr-none shadow-lg ${currentTheme.glow}` 
                      : 'bg-slate-900 border border-slate-800 rounded-tl-none hover:border-slate-700'
                  }`}
                  >
                    {msg.type === 'event' && (
                      <div className="flex items-center gap-2 mb-1.5 p-1 bg-black/20 rounded-lg text-[9px] uppercase font-bold tracking-widest text-white/80">
                        <CalendarDays size={10} /> Commited: {msg.date}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    
                    {msg.role === 'assistant' && reactionTargetId === msg.id && (
                      <div className="absolute -bottom-10 left-0 flex items-center gap-2 animate-in zoom-in duration-200 z-10">
                        <button onClick={(e) => { e.stopPropagation(); handleSendMessage('Approved', 'reaction', { originalContent: msg.content }); setReactionTargetId(null); }} className="p-2 bg-emerald-500 text-white rounded-full shadow-lg"><CheckCircle2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleSendMessage('Declined', 'reaction', { originalContent: msg.content }); setReactionTargetId(null); }} className="p-2 bg-rose-500 text-white rounded-full shadow-lg"><XCircle size={14} /></button>
                      </div>
                    )}
                    <div className={`text-[9px] mt-1 opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-slate-950 border-t border-slate-900">
              <div className="max-w-4xl mx-auto relative">
                {isRecording ? (
                  <div className="flex items-center gap-4 bg-purple-950/30 border border-purple-500/30 p-3 rounded-2xl animate-in slide-in-from-bottom-2">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-purple-400 tracking-widest uppercase">Transmitting Audio...</span>
                      <span className="text-xs font-mono">{recordingDuration}s</span>
                    </div>
                    <button onClick={stopRecordingAndSend} className="p-3 bg-purple-600 text-white rounded-xl"><Send size={20} /></button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 bg-slate-900/50 border border-slate-800 p-1.5 rounded-2xl focus-within:border-purple-500/50">
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Signal input..."
                      className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32 min-h-[44px]"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    />
                    <div className="flex items-center gap-1 pr-1 pb-1">
                      {inputText.trim() ? (
                        <button onClick={() => handleSendMessage()} className="p-3 rounded-xl bg-purple-600 text-white shadow-lg"><Send size={18} /></button>
                      ) : (
                        <button 
                          onMouseDown={startRecording}
                          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                          onMouseUp={stopRecordingAndSend}
                          onTouchEnd={stopRecordingAndSend}
                          className="p-3 text-purple-400 bg-purple-500/10 rounded-xl hover:bg-purple-600 hover:text-white transition-all"
                        >
                          <Mic size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col h-full bg-slate-950">
            {/* Calendar UI */}
            <div className="p-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/50 backdrop-blur-sm z-20 sticky top-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold">
                  {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5">
                  <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1)))} className="p-1 hover:text-white text-slate-500"><ChevronLeft size={18} /></button>
                  <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1)))} className="p-1 hover:text-white text-slate-500"><ChevronRight size={18} /></button>
                </div>
              </div>
              <button 
                onClick={() => openEventModal(formatDate(new Date()))}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/20"
              >
                <Plus size={14} /> New Event
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-7 gap-px bg-slate-900">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <div key={day} className="bg-slate-950 p-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900">{day}</div>
              ))}
              {getDaysInMonth(currentCalendarDate).map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="bg-slate-950/30" />;
                const dateStr = formatDate(day);
                const events = getEventsForDate(dateStr);
                const isToday = dateStr === formatDate(new Date());

                return (
                  <div 
                    key={dateStr}
                    onClick={() => { setSelectedEventDate(dateStr); setIsDayDetailOpen(true); }}
                    className={`bg-slate-950 min-h-[90px] p-2 flex flex-col gap-1 cursor-pointer transition-colors active:bg-slate-900 hover:bg-slate-900/40 relative group`}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-purple-400' : 'text-slate-500'}`}>{day.getDate()}</span>
                    <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                      {events.slice(0, 3).map(ev => {
                        const cat = activeChat.categories.find(c => c.id === ev.categoryId);
                        return <div key={ev.id} className="h-1 rounded-full w-full" style={{ backgroundColor: cat?.color || '#8b5cf6' }} />;
                      })}
                      {events.length > 3 && <div className="text-[8px] text-slate-600 font-bold">+{events.length - 3}</div>}
                    </div>
                    {events.length > 0 && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-purple-500 rounded-full blur-[2px] animate-pulse" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* Day Detail Modal */}
      {isDayDetailOpen && selectedEventDate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDayDetailOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Signal Snapshot</h3>
                <p className="text-xs text-slate-500 font-bold uppercase mt-1 tracking-widest">{selectedEventDate}</p>
              </div>
              <button onClick={() => setIsDayDetailOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              {getEventsForDate(selectedEventDate).length === 0 ? (
                <div className="py-12 text-center text-slate-600 space-y-4">
                  <Activity size={40} className="mx-auto opacity-20" />
                  <p className="text-sm font-medium">Temporal node is currently void.</p>
                </div>
              ) : (
                getEventsForDate(selectedEventDate).map(ev => {
                  const cat = activeChat?.categories.find(c => c.id === ev.categoryId);
                  return (
                    <div key={ev.id} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex gap-4">
                      <div className="w-1 rounded-full" style={{ backgroundColor: cat?.color }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat?.color }}>{cat?.name}</span>
                          <span className="text-[10px] text-slate-500">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{ev.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 bg-slate-800/20">
              <button onClick={() => { setIsDayDetailOpen(false); openEventModal(selectedEventDate); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                <Plus size={16} /> Add Signal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in zoom-in duration-200">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsEventModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold">Add Signal</h3>
              <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Target Date: {selectedEventDate}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {activeChat?.categories.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${selectedCategoryId === cat.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-slate-800 bg-slate-800/50 text-slate-500'}`}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-bold truncate uppercase tracking-widest">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Details</label>
                <textarea 
                  autoFocus
                  value={eventInputText}
                  onChange={(e) => setEventInputText(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-sm focus:border-purple-500 outline-none min-h-[120px] transition-all"
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-2">
              <button onClick={() => setIsEventModalOpen(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</button>
              <button onClick={handleCommitEvent} className="flex-[2] py-3 bg-purple-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest px-8">Commit Signal</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Settings Modal */}
      {isChatSettingsOpen && editingChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsChatSettingsOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold">Node Config</h3>
              <button onClick={() => setIsChatSettingsOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-20 h-20 bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-all overflow-hidden"
                  onClick={() => iconInputRef.current?.click()}
                >
                  {editingChat.icon ? <img src={editingChat.icon} className="w-full h-full object-cover" /> : <Upload size={20} className="text-slate-600" />}
                  <input type="file" ref={iconInputRef} className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setEditingChat({ ...editingChat, icon: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Identifier</label>
                  <input value={editingChat.name} onChange={(e) => setEditingChat({ ...editingChat, name: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">n8n Protocol</label>
                  <input value={editingChat.webhookUrl} onChange={(e) => setEditingChat({ ...editingChat, webhookUrl: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm focus:border-purple-500 outline-none font-mono" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Protocol Types (Categories)</label>
                {editingChat.categories.map((cat, idx) => (
                  <div key={cat.id} className="flex gap-2">
                    <input type="color" value={cat.color} onChange={(e) => {
                      const nc = [...editingChat.categories]; nc[idx].color = e.target.value; setEditingChat({...editingChat, categories: nc});
                    }} className="w-10 h-10 bg-transparent border-none rounded cursor-pointer" />
                    <input value={cat.name} onChange={(e) => {
                      const nc = [...editingChat.categories]; nc[idx].name = e.target.value; setEditingChat({...editingChat, categories: nc});
                    }} className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-3 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-2">
              <button onClick={() => { setChats(chats.filter(c => c.id !== editingChat.id)); setActiveChatId(null); setIsChatSettingsOpen(false); }} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl"><Trash2 size={20} /></button>
              <button onClick={() => { setChats(chats.map(c => c.id === editingChat.id ? editingChat : c)); setIsChatSettingsOpen(false); }} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest">Update Node</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold">Neural Core</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><History size={14} /> Backups</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {
                    const data = JSON.stringify(chats);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'neural_core.json'; a.click();
                  }} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-purple-500 transition-all">
                    <Download size={20} className="text-purple-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Export</span>
                  </button>
                  <button onClick={() => coreImportRef.current?.click()} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-emerald-500 transition-all">
                    <FileUp size={20} className="text-emerald-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Import</span>
                  </button>
                  <input type="file" ref={coreImportRef} className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader(); reader.onload = (ev) => setChats(JSON.parse(ev.target?.result as string)); reader.readAsText(file);
                  }} />
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button onClick={() => setIsSettingsModalOpen(false)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest">Dismiss Interface</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;