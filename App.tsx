import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Zap,
  Palette,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
  Paperclip,
  Copy,
  Wifi,
  Calendar as CalendarIcon,
  MessageSquare,
  Clock,
  Layers,
  Tag,
  CalendarDays,
  RefreshCw,
  Activity,
  Terminal,
  Info,
  History,
  Smile,
  Cpu,
  Globe,
  Lock,
  Hash,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { Chat, Message, ThemePalette, Category } from './types';
import { Logo } from './components/Logo';
import { sendMessageToN8N } from './services/n8nService';

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('purple');
  const [isDoorConnected, setIsDoorConnected] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);

  const [recentSignals, setRecentSignals] = useState<{timestamp: number, raw: string, interpreted?: any}[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const receivingTimeoutRef = useRef<number | null>(null);

  const paletteConfigs = {
    purple: { from: 'from-purple-600', to: 'to-blue-600', text: 'text-purple-400', ring: 'ring-purple-500/40', bg: 'bg-purple-600', shadow: 'shadow-purple-500/20', hex: '#8B5CF6' },
    emerald: { from: 'from-emerald-500', to: 'to-teal-600', text: 'text-emerald-400', ring: 'ring-emerald-500/40', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20', hex: '#10B981' },
    amber: { from: 'from-amber-500', to: 'to-orange-600', text: 'text-amber-400', ring: 'ring-amber-500/40', bg: 'bg-amber-500', shadow: 'shadow-amber-500/20', hex: '#F59E0B' },
    rose: { from: 'from-rose-500', to: 'to-pink-600', text: 'text-rose-400', ring: 'ring-rose-500/40', bg: 'bg-rose-500', shadow: 'shadow-rose-500/20', hex: '#F43F5E' },
    cyan: { from: 'from-cyan-500', to: 'to-blue-500', text: 'text-cyan-400', ring: 'ring-cyan-500/40', bg: 'bg-cyan-500', shadow: 'shadow-cyan-500/20', hex: '#06B6D4' },
  };

  const currentTheme = paletteConfigs[palette];
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const lastAssistantMsgIndex = useMemo(() => {
    if (!activeChat) return -1;
    for (let i = activeChat.messages.length - 1; i >= 0; i--) {
      if (activeChat.messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [activeChat?.messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (activeChatId) {
      setTimeout(scrollToBottom, 200);
    }
  }, [activeChatId, activeChat?.messages.length, scrollToBottom]);

  const normalizeString = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');

  const processDoorMessage = useCallback((raw: string, chat: Chat): { messages: Message[], debug: any } => {
    const messages: Message[] = [];
    // Helper to get local date string YYYY-MM-DD
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let dateStr = getLocalDateStr(new Date());
    let debugInfo: any = { raw };

    const parseDate = (input: string) => {
      try {
        const d = new Date(input);
        if (!isNaN(d.getTime())) return getLocalDateStr(d);
      } catch (e) {}
      return null;
    };

    const findCategory = (str: string) => {
      const norm = normalizeString(str);
      return chat.categories.find(c => normalizeString(c.name) === norm);
    };

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      // 1. Check for NEW SEPARATOR format: Date | Category | Content
      if (raw.includes('|')) {
        const parts = raw.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          const potentialDate = parseDate(parts[0]);
          const potentialCat = findCategory(parts[1]);
          if (potentialDate && potentialCat) {
            messages.push({ 
              id: `sep-${Date.now()}`, 
              role: 'assistant', 
              content: parts.slice(2).join('|').trim(), 
              date: potentialDate, 
              categoryId: potentialCat.id, 
              type: 'event', 
              timestamp: Date.now() 
            });
            debugInfo.interpreted = { type: 'separator_format', category: potentialCat.name, date: potentialDate };
            return { messages, debug: debugInfo };
          }
        }
      }

      // 2. Specific Regex Format (Month Day, Year Category Content)
      const specificRegex = /^([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})\s+([^\s]+)\s+(.+)$/;
      const match = raw.match(specificRegex);
      if (match) {
        const potentialDate = parseDate(match[1]);
        const potentialCat = findCategory(match[2]);
        if (potentialDate && potentialCat) {
          messages.push({ 
            id: `spec-${Date.now()}`, 
            role: 'assistant', 
            content: match[3].trim(), 
            date: potentialDate, 
            categoryId: potentialCat.id, 
            type: 'event', 
            timestamp: Date.now() 
          });
          debugInfo.interpreted = { type: 'specific_format', category: potentialCat.name, date: potentialDate };
          return { messages, debug: debugInfo };
        }
      }

      // 3. Robust Heuristic Parser (Find Date and Category anywhere in string)
      let foundDate: string | null = null;
      let foundCat: Category | undefined;
      let workingStr = raw;

      const words = workingStr.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        for (let len = 4; len >= 1; len--) {
          const attempt = words.slice(i, i + len).join(' ');
          const d = parseDate(attempt);
          if (d) {
            foundDate = d;
            words.splice(i, len);
            break;
          }
        }
        if (foundDate) break;
      }

      for (let i = 0; i < words.length; i++) {
        for (let len = 3; len >= 1; len--) {
          const attempt = words.slice(i, i + len).join(' ');
          const cat = findCategory(attempt);
          if (cat) {
            foundCat = cat;
            words.splice(i, len);
            break;
          }
        }
        if (foundCat) break;
      }

      if (foundCat && (foundDate || dateStr)) {
        const finalContent = words.join(' ').trim();
        if (finalContent) {
          messages.push({ 
            id: `heur-${Date.now()}`, 
            role: 'assistant', 
            content: finalContent, 
            date: foundDate || dateStr, 
            categoryId: foundCat.id, 
            type: 'event', 
            timestamp: Date.now() 
          });
          debugInfo.interpreted = { type: 'heuristic', category: foundCat.name, date: foundDate || dateStr, content: finalContent };
          return { messages, debug: debugInfo };
        }
      }
    }

    if (data && typeof data === 'object') {
      const explicitDate = data.Date || data.date;
      if (explicitDate) dateStr = parseDate(String(explicitDate)) || dateStr;
      const explicitCatValue = data.Category || data.category || data.Classification || data.classification;
      const explicitContent = data.Appointment || data.appointment || data.Content || data.content || data.Text || data.text;
      if (explicitCatValue && explicitContent) {
        const cat = findCategory(String(explicitCatValue));
        if (cat) {
          messages.push({ id: `expl-${Date.now()}`, role: 'assistant', content: String(explicitContent), date: dateStr, categoryId: cat.id, type: 'event', timestamp: Date.now() });
          debugInfo.interpreted = { type: 'explicit_json', category: cat.name, date: dateStr };
        }
      }
      Object.entries(data).forEach(([key, value]) => {
        const normKey = normalizeString(key);
        if (normKey === 'date' || normKey === 'category' || normKey === 'appointment' || normKey === 'content') return;
        const cat = findCategory(key);
        const valStr = String(value).trim();
        if (cat && valStr && !valStr.startsWith('{{')) {
          messages.push({ id: `key-${Date.now()}-${Math.random()}`, role: 'assistant', content: valStr, date: dateStr, categoryId: cat.id, type: 'event', timestamp: Date.now() });
          debugInfo.interpreted = { type: 'key_json', category: cat.name, date: dateStr };
        }
      });
    }

    if (messages.length === 0 && raw.trim().length > 0) {
      messages.push({ id: `door-${Date.now()}`, role: 'assistant', content: raw, timestamp: Date.now() });
      debugInfo.interpreted = { type: 'raw_text' };
    }
    return { messages, debug: debugInfo };
  }, []);

  const initSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsDoorConnected(false);
    }
    if (!activeChat || !activeChat.receiverId) return;
    const url = `https://ntfy.sh/${activeChat.receiverId}/sse`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.onopen = () => setIsDoorConnected(true);
    es.onerror = () => setIsDoorConnected(false);
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event === 'message' && payload.message) {
          const rawMsg = payload.message;
          setIsReceiving(true);
          if (receivingTimeoutRef.current) window.clearTimeout(receivingTimeoutRef.current);
          receivingTimeoutRef.current = window.setTimeout(() => setIsReceiving(false), 2500);
          const { messages: newMessages, debug } = processDoorMessage(rawMsg, activeChat);
          setRecentSignals(prev => [{timestamp: Date.now(), raw: rawMsg, interpreted: debug.interpreted}, ...prev].slice(0, 5));
          if (newMessages.length > 0) {
            setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, ...newMessages] } : c));
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
          }
        }
      } catch (err) {}
    };
  }, [activeChatId, activeChat, processDoorMessage]);

  useEffect(() => {
    initSSE();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [initSSE]);

  useEffect(() => {
    const savedChats = localStorage.getItem('ai_wire_chats');
    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChats(parsed);
      const lastId = localStorage.getItem('ai_wire_last_active');
      if (lastId && parsed.find((c: Chat) => c.id === lastId)) setActiveChatId(lastId);
    }
    const savedPalette = localStorage.getItem('ai_wire_palette') as ThemePalette;
    if (savedPalette) setPalette(savedPalette);
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem('ai_wire_chats', JSON.stringify(chats));
    if (activeChatId) localStorage.setItem('ai_wire_last_active', activeChatId);
  }, [chats, activeChatId]);

  useEffect(() => {
    localStorage.setItem('ai_wire_palette', palette);
  }, [palette]);

  const handleSendMessage = async (
    content?: string, 
    type: 'text' | 'audio' | 'event' | 'file' | 'reaction' = 'text', 
    eventData?: {date: string, categoryId: string}, 
    blobToUse?: Blob,
    fileToUse?: File
  ) => {
    if (!activeChat) return;
    
    const finalType = (activeChat.mode === 'calendar' && type === 'text') ? 'event' : type;
    const messageContent = content || inputText;
    const finalBlob = blobToUse || audioBlob;
    
    if (!messageContent && !finalBlob && finalType !== 'file' && !fileToUse) return;

    // Fixed default date logic to use local components instead of toISOString
    const getTodayLocalDateStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalType === 'audio' ? 'Voice Message' : finalType === 'file' ? (fileToUse?.name || String(messageContent)) : String(messageContent),
      type: finalType,
      date: eventData?.date || (activeChat.mode === 'calendar' ? getTodayLocalDateStr() : undefined),
      categoryId: eventData?.categoryId || (activeChat.mode === 'calendar' ? activeChat.categories[0]?.id : undefined),
      timestamp: Date.now()
    };

    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
    setInputText('');
    setAudioBlob(null);
    setIsEventModalOpen(false);

    if (activeChat?.webhookUrl) {
      setIsTyping(true);
      try {
        let payload: string | Blob = messageContent;
        let metadata: any = undefined;

        if (finalType === 'audio') {
          payload = finalBlob!;
        } else if (finalType === 'file' && fileToUse) {
          payload = fileToUse.name;
          metadata = { files: [{ blob: fileToUse, name: fileToUse.name }] };
        } else if (finalType === 'event') {
          metadata = { 
            date: userMessage.date, 
            categoryId: userMessage.categoryId,
            categoryName: activeChat.categories.find(c => c.id === userMessage.categoryId)?.name 
          };
        }

        const response = await sendMessageToN8N(activeChat.webhookUrl, payload, finalType, metadata);
        const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() };
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      } catch (error) {
        console.error("Transmission error:", error);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleReaction = async (message: Message, reaction: string) => {
    if (!activeChat) return;
    
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      messages: c.messages.map(m => m.id === message.id ? { ...m, reacted: true } : m)
    } : c));

    if (activeChat.webhookUrl) {
      try {
        await sendMessageToN8N(activeChat.webhookUrl, reaction, 'reaction', { originalContent: message.content });
        if (navigator.vibrate) navigator.vibrate(30);
      } catch (err) {
        console.error("Reaction failed to transmit", err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await handleSendMessage(file.name, 'file', undefined, undefined, file);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingChat) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditingChat({ ...editingChat, icon: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      durationIntervalRef.current = window.setInterval(() => setRecordingDuration(d => d + 1), 1000);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error("Recording failed", err);
    }
  };

  const stopRecording = (shouldSend = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (shouldSend) {
          handleSendMessage(undefined, 'audio', undefined, blob);
        } else {
          setAudioBlob(blob);
        }
        if (mediaRecorderRef.current?.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
    }
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    setIsRecording(false);
  };

  const handleMicMouseDown = (e?: React.MouseEvent | React.TouchEvent) => {
    setHoldProgress(1);
    const step = 100 / (1300 / 10);
    holdIntervalRef.current = window.setInterval(() => {
      setHoldProgress(prev => {
        const next = prev + step;
        return next > 100 ? 100 : next;
      });
    }, 10);

    longPressTimerRef.current = window.setTimeout(() => {
      clearInterval(holdIntervalRef.current!);
      setHoldProgress(0);
      startRecording();
    }, 1300);
  };

  const handleMicMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
    if (isRecording) {
      stopRecording(true);
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      stopRecording(false);
    }
    setAudioBlob(null);
  };

  const createNewAgent = (mode: 'chat' | 'calendar') => {
    const newId = Date.now().toString();
    const newChat: Chat = {
      id: newId,
      name: mode === 'chat' ? `Neural Link ${chats.length + 1}` : `Temporal Node ${chats.filter(c => c.mode === 'calendar').length + 1}`,
      mode,
      webhookUrl: '',
      receiverId: `ai_wire_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`,
      categories: [
        { id: '1', name: 'Obligations', color: '#F87171' },
        { id: '2', name: 'Social Engagements', color: '#60A5FA' },
        { id: '3', name: 'Administrative Tasks', color: '#FBBF24' },
        { id: '4', name: 'Personal Development', color: '#34D399' },
        { id: '5', name: 'Logistics', color: '#A78BFA' }
      ],
      messages: [{ id: 'sys-' + Date.now(), role: 'system', content: `Protocol active. ${mode === 'chat' ? 'Neural Link' : 'Temporal Node'} initialized.`, timestamp: Date.now() }],
      createdAt: Date.now()
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newId);
    setIsDeployModalOpen(false);
    setIsSidebarOpen(false);
  };

  const moveChat = (id: string, direction: 'up' | 'down') => {
    const idx = chats.findIndex(c => c.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === chats.length - 1)) return;
    const newChats = [...chats];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newChats[idx], newChats[targetIdx]] = [newChats[targetIdx], newChats[idx]];
    setChats(newChats);
  };

  const saveSettings = () => {
    if (!editingChat) return;
    setChats(prev => prev.map(c => c.id === editingChat.id ? editingChat : c));
    setIsChatSettingsOpen(false);
    setEditingChat(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {}
  };

  const deleteChat = (id: string) => {
    if (window.confirm('Are you sure you want to decommission this node?')) {
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) setActiveChatId(null);
      setIsChatSettingsOpen(false);
      setEditingChat(null);
    }
  };

  const calendarData = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentCalendarDate]);

  // Robust getEventsForDay using local date components to avoid timezone shifts
  const getEventsForDay = (date: Date) => {
    if (!activeChat) return [];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return activeChat.messages.filter(m => m.date === dateStr);
  };

  const renderChatIcon = (chat: Chat, size = 18) => {
    if (chat.icon && chat.icon.startsWith('data:image')) {
      return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img src={chat.icon} className="w-full h-full object-cover" alt="Node Avatar" />
        </div>
      );
    }
    return chat.mode === 'calendar' ? <CalendarIcon size={size} /> : <Bot size={size} />;
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-hidden relative select-none">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><SettingsIcon size={20} /></button>
            <div className="flex items-center gap-2"><Logo size={32} color={currentTheme.hex} /><span className="font-black text-xl tracking-tight text-white italic">AI wire</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><ChevronLeft size={20} /></button>
          </div>
          <div className="p-4">
            <button onClick={() => setIsDeployModalOpen(true)} className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} hover:opacity-90 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xl active:scale-95`}><Plus size={18} /> Deploy Agent</button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
            <div className="px-3 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={14} className={currentTheme.text} /> Nodes</div>
            {chats.map((chat) => (
              <div key={chat.id} className="relative group">
                <button onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-3 mb-1 ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from}/30 ${currentTheme.to}/10 text-white ring-1 ${currentTheme.ring}` : 'hover:bg-slate-800/60 text-slate-400'}`}>
                  <div className={`p-0.5 rounded-xl overflow-hidden w-10 h-10 flex items-center justify-center ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white` : 'bg-slate-800'}`}>
                    {renderChatIcon(chat)}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="font-bold truncate text-sm flex items-center gap-1">{chat.name}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">{chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : 'Ready'}</div>
                  </div>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveChat(chat.id, 'up')} className="p-1 hover:bg-slate-700 rounded-md text-slate-500 hover:text-white"><ChevronUp size={14} /></button>
                  <button onClick={() => moveChat(chat.id, 'down')} className="p-1 hover:bg-slate-700 rounded-md text-slate-500 hover:text-white"><ChevronDown size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-slate-950 min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><Menu size={22} /></button>
            {activeChat && (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to} rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg overflow-hidden`}>
                  {renderChatIcon(activeChat, 20)}
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-bold text-sm tracking-tight truncate flex items-center gap-2 text-white">
                    {activeChat.name}
                    {isReceiving && (
                      <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                        <Activity size={10} className="text-emerald-500 animate-pulse" />
                        <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Receiving</span>
                      </div>
                    )}
                  </h2>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDoorConnected ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-slate-600'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{activeChat.mode === 'calendar' ? 'Temporal Node' : 'Neural Link'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => initSSE()} className="p-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all" title="Force Sync Hub">
              <RefreshCw size={18} className={isReceiving ? 'animate-spin text-emerald-500' : ''} />
            </button>
            <button onClick={() => { setEditingChat(activeChat ? JSON.parse(JSON.stringify(activeChat)) : null); setIsChatSettingsOpen(true); }} className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"><MoreVertical size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar flex flex-col">
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 text-center"><Logo size={120} className="animate-pulse" color={currentTheme.hex} /><div><h3 className="text-2xl font-black text-white italic tracking-tighter">AI wire</h3><p className="max-w-[240px] mx-auto text-sm text-slate-500 mt-2 font-medium uppercase tracking-widest">Select Node for Sync</p></div></div>
          ) : activeChat?.mode === 'calendar' ? (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 w-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">{currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                  <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
                    <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1)))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
                    <button onClick={() => setCurrentCalendarDate(new Date())} className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Today</button>
                    <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1)))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronRight size={20} /></button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest pb-4">{d}</div>
                ))}
                {calendarData.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="min-h-[120px]" />;
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const isPast = day < today;
                  const isToday = day.getTime() === today.getTime();
                  const events = getEventsForDay(day);
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      onClick={() => { 
                        const year = day.getFullYear();
                        const month = String(day.getMonth() + 1).padStart(2, '0');
                        const date = String(day.getDate()).padStart(2, '0');
                        setSelectedEventDate(`${year}-${month}-${date}`); 
                        setIsDayDetailOpen(true); 
                      }}
                      className={`relative group min-h-[130px] p-3 rounded-2xl border transition-all cursor-pointer overflow-hidden ${isToday ? `bg-gradient-to-br ${currentTheme.from}/10 ${currentTheme.to}/5 border-${palette}-500/50 ring-1 ring-${palette}-500/20` : 'bg-slate-900 border-slate-800/50 hover:bg-slate-800/80'}`}
                    >
                      {isPast && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30">
                          <div className="w-[150%] h-[2px] bg-red-600 rotate-45 shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2 relative z-10">
                         <span className={`text-xs font-black ${isToday ? currentTheme.text : 'text-slate-400'}`}>{day.getDate()}</span>
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             const year = day.getFullYear();
                             const month = String(day.getMonth() + 1).padStart(2, '0');
                             const date = String(day.getDate()).padStart(2, '0');
                             setSelectedEventDate(`${year}-${month}-${date}`); 
                             setSelectedCategoryId(activeChat.categories[0]?.id || null);
                             setIsEventModalOpen(true); 
                           }} 
                           className="p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                         >
                           <Plus size={14} />
                         </button>
                      </div>
                      <div className="space-y-1 relative z-10">
                        {events.slice(0, 4).map(ev => {
                          const category = activeChat.categories.find(c => c.id === ev.categoryId);
                          return (
                            <div key={ev.id} className="text-[8px] font-black p-1 rounded bg-slate-950/60 truncate border border-slate-800/30 uppercase tracking-tighter" style={{ color: category?.color || '#94a3b8' }}>
                              • {ev.content}
                            </div>
                          );
                        })}
                        {events.length > 4 && <div className="text-[7px] font-black text-slate-600 px-1 uppercase">+{events.length - 4} Signals</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-4xl mx-auto w-full flex-1 pt-4 pb-20">
              {activeChat?.messages.map((msg, index) => (
                <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'system' ? (
                    <div className="w-full text-center py-3"><span className="bg-slate-900 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em] px-4 py-1.5 rounded-full border border-slate-800">{msg.content}</span></div>
                  ) : (
                    <div className={`max-w-[85%] lg:max-w-[75%] px-5 py-4 rounded-[2rem] shadow-2xl relative group transition-all ${msg.role === 'user' ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white rounded-tr-none` : 'bg-slate-900 border border-slate-800/50 text-slate-100 rounded-tl-none'}`}>
                      {msg.type === 'file' && <div className="flex items-center gap-3 mb-2 p-3 bg-white/10 rounded-2xl border border-white/10"><Paperclip size={18} className="text-white/60" /><span className="text-xs font-bold truncate">{msg.content}</span></div>}
                      {msg.type === 'audio' && <div className="flex items-center gap-3 mb-2 p-3 bg-white/10 rounded-2xl border border-white/10"><Mic size={18} className="text-white/60" /><span className="text-xs font-bold">Neural Voice Record</span></div>}
                      <p className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`text-[9px] mt-2 font-bold opacity-40 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      
                      {msg.role === 'assistant' && !msg.reacted && index === lastAssistantMsgIndex && (
                        <div className="absolute -bottom-10 left-0 flex gap-2 animate-in fade-in slide-in-from-top-1">
                          <button onClick={() => handleReaction(msg, '✅')} className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-2 rounded-xl hover:bg-slate-700 hover:scale-110 active:scale-90 transition-all shadow-lg">✅</button>
                          <button onClick={() => handleReaction(msg, '❌')} className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-2 rounded-xl hover:bg-slate-700 hover:scale-110 active:scale-90 transition-all shadow-lg">❌</button>
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
              {isTyping && <div className="flex justify-start"><div className="bg-slate-900/50 border border-slate-800/30 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5"><span className={`w-2 h-2 ${currentTheme.bg} rounded-full animate-bounce [animation-duration:0.6s]`} /><span className={`w-2 h-2 ${currentTheme.bg} opacity-50 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]`} /></div></div>}
              <div ref={messagesEndRef} className="h-24 shrink-0" />
            </div>
          )}
        </div>

        {activeChatId && (
          <footer className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-2xl relative">
            {holdProgress > 0 && !isRecording && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden z-50">
                <div className={`h-full bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} transition-all duration-75`} style={{ width: `${holdProgress}%` }} />
              </div>
            )}

            <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
              {(activeChat?.mode === 'chat') && (isRecording || audioBlob) ? (
                <div className={`flex-1 flex items-center justify-between p-2 rounded-2xl bg-slate-800 border border-slate-700 h-[56px] animate-in slide-in-from-bottom-2`}>
                  <button onClick={cancelRecording} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={24} /></button>
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-sm font-black text-white">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic hidden sm:inline">Neural Capturing...</span>
                  </div>
                  <button onClick={() => stopRecording(true)} className={`p-3 ${currentTheme.bg} text-white rounded-xl shadow-lg active:scale-95 transition-all`}><Send size={24} /></button>
                </div>
              ) : (
                <>
                  {activeChat?.mode === 'chat' && (
                    <div className="flex gap-2 shrink-0">
                      <input type="file" ref={chatFileInputRef} onChange={handleFileUpload} className="hidden" />
                      <button 
                        onClick={() => chatFileInputRef.current?.click()} 
                        className="w-14 h-14 bg-slate-800 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-colors shrink-0"
                      >
                        <Paperclip size={24} />
                      </button>
                      <button 
                        onMouseDown={handleMicMouseDown} 
                        onMouseUp={handleMicMouseUp} 
                        onMouseLeave={handleMicMouseUp}
                        onTouchStart={(e) => { e.preventDefault(); handleMicMouseDown(); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleMicMouseUp(); }}
                        onContextMenu={(e) => e.preventDefault()} 
                        className={`w-14 h-14 bg-slate-800 text-slate-400 hover:text-white rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-95 ${holdProgress > 0 ? 'bg-slate-700 text-white' : ''}`}
                      >
                        <Mic size={24} className={holdProgress > 0 ? 'animate-pulse' : ''} />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 relative min-w-0">
                    <textarea 
                      value={inputText} 
                      onChange={(e) => setInputText(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                      placeholder={activeChat?.mode === 'calendar' ? "Manual injection..." : "Transmit intent..."} 
                      className="w-full bg-slate-800 text-slate-100 rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none border border-slate-700/50 resize-none min-h-[56px] custom-scrollbar" 
                      rows={1} 
                    />
                    <button onClick={() => handleSendMessage()} disabled={(!inputText.trim() && !audioBlob) || isTyping} className={`absolute right-2 bottom-2 p-3 rounded-xl transition-all ${inputText.trim() && !isTyping ? `${currentTheme.bg} text-white shadow-lg` : 'text-slate-600'}`}><Send size={20} /></button>
                  </div>
                </>
              )}
            </div>
          </footer>
        )}
      </main>

      {/* Node Topology Modal */}
      {isChatSettingsOpen && editingChat && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => { setIsChatSettingsOpen(false); setEditingChat(null); }} />
          <div className="relative bg-slate-900 w-full max-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar text-white">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl shadow-lg`}><Layers size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight">Node Topology</h3></div>
                <button onClick={() => { setIsChatSettingsOpen(false); setEditingChat(null); }} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Node Alias</label>
                  <input type="text" value={editingChat.name} onChange={(e) => setEditingChat({...editingChat, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-bold text-sm text-white" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Neural Avatar</label>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-6">
                      <div className={`w-24 h-24 rounded-3xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center relative shadow-inner`}>
                         {editingChat.icon && editingChat.icon.startsWith('data:image') ? (
                           <img src={editingChat.icon} className="w-full h-full object-cover" alt="Node Icon" />
                         ) : (
                           <ImageIcon className="text-slate-700" size={32} />
                         )}
                         <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => iconInputRef.current?.click()}>
                           <Upload size={24} className="text-white" />
                         </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input type="file" ref={iconInputRef} onChange={handleIconUpload} className="hidden" accept="image/*" />
                        <button onClick={() => iconInputRef.current?.click()} className="w-full py-3 px-4 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                          <ImageIcon size={14} /> Upload Pattern
                        </button>
                        <button onClick={() => setEditingChat({...editingChat, icon: undefined})} className="w-full py-2 text-slate-500 hover:text-red-500 text-[9px] font-black uppercase tracking-widest transition-all">Clear Avatar</button>
                      </div>
                    </div>
                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Image will be perfectly fitted within the neural hex grid.</p>
                  </div>
                </div>

                {editingChat.mode === 'calendar' && (
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4"><Tag size={14} /> Grid Classifications</label>
                    <div className="space-y-3 mb-4">
                      {editingChat.categories.map((cat, idx) => (
                        <div key={cat.id} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                          <input type="color" value={cat.color} onChange={(e) => {
                            const newCats = [...editingChat.categories];
                            newCats[idx].color = e.target.value;
                            setEditingChat({...editingChat, categories: newCats});
                          }} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none p-0 overflow-hidden shadow-sm" />
                          <input type="text" value={cat.name} onChange={(e) => {
                            const newCats = [...editingChat.categories];
                            newCats[idx].name = e.target.value;
                            setEditingChat({...editingChat, categories: newCats});
                          }} className="bg-transparent border-none focus:outline-none font-bold text-sm text-white flex-1" />
                          <button onClick={() => {
                            if (editingChat.categories.length > 1) {
                              setEditingChat({...editingChat, categories: editingChat.categories.filter(c => c.id !== cat.id)});
                            }
                          }} className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => {
                      const newId = Date.now().toString();
                      setEditingChat({...editingChat, categories: [...editingChat.categories, { id: newId, name: 'Protocol Tag', color: paletteConfigs[palette].hex }] });
                    }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all flex items-center justify-center gap-2"><Plus size={14} /> Extend Labels</button>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">n8n Neural Gateway</label>
                  <input type="url" value={editingChat.webhookUrl} onChange={(e) => setEditingChat({...editingChat, webhookUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-mono text-[10px] text-white" placeholder="https://..." />
                </div>

                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                  <label className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4"><Wifi size={14} /> Door Uplink</label>
                  <div className="relative group mb-3">
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-[9px] text-slate-400 select-all overflow-x-auto whitespace-nowrap scrollbar-hide">
                      {`https://ntfy.sh/${editingChat.receiverId}`}
                    </div>
                    <button onClick={() => copyToClipboard(`https://ntfy.sh/${editingChat.receiverId}`)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><Copy size={14} /></button>
                  </div>
                  <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tight leading-relaxed">Generated secure frequency for external signal injection.</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-4"><Terminal size={14} /> Debug Log</label>
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-[9px] space-y-3 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {recentSignals.length === 0 ? (
                       <span className="text-slate-700 italic">Standby...</span>
                    ) : recentSignals.map((s, i) => (
                      <div key={i} className="border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between text-slate-500 mb-1">
                          <span>[{new Date(s.timestamp).toLocaleTimeString()}]</span>
                          <span className="text-emerald-500 font-bold">ACK</span>
                        </div>
                        <div className="text-slate-300 break-all bg-black/40 p-1.5 rounded border border-slate-900">{s.raw}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4 pb-2">
                  <button onClick={saveSettings} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all ${currentTheme.bg} text-white`}>Commit Protocol Changes</button>
                  <button onClick={() => deleteChat(editingChat.id)} className="w-full py-4 rounded-2xl bg-red-950/20 hover:bg-red-950/40 text-red-500 border border-red-900/20 transition-all text-[10px] font-black uppercase tracking-[0.2em]">Sever Protocol</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Choice Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsDeployModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl p-6 sm:p-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter mb-8 text-center text-white">Protocol Deployment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <button onClick={() => createNewAgent('chat')} className="flex flex-col items-center gap-4 sm:gap-6 p-6 sm:p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-purple-500/50 rounded-[2rem] sm:rounded-[2.5rem] transition-all group active:scale-95 shadow-xl">
                <div className="p-4 sm:p-6 bg-purple-600 rounded-[1.5rem] sm:rounded-[2rem] text-white shadow-xl shadow-purple-500/20 group-hover:scale-110 transition-transform"><MessageSquare size={32} /></div>
                <div className="text-center"><span className="block font-black text-md sm:text-lg uppercase tracking-tight text-white">Neural Link</span><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Signal Hub</span></div>
              </button>
              <button onClick={() => createNewAgent('calendar')} className="flex flex-col items-center gap-4 sm:gap-6 p-6 sm:p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 rounded-[2rem] sm:rounded-[2.5rem] transition-all group active:scale-95 shadow-xl">
                <div className="p-4 sm:p-6 bg-emerald-600 rounded-[1.5rem] sm:rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 group-hover:scale-110 transition-transform"><CalendarDays size={32} /></div>
                <div className="text-center"><span className="block font-black text-md sm:text-lg uppercase tracking-tight text-white">Temporal Node</span><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Chronos Grid</span></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Snapshot Modal - FIXED DATE DISPLAY */}
      {isDayDetailOpen && selectedEventDate && activeChat && (
        <div className="fixed inset-0 flex items-center justify-center z-[110] p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsDayDetailOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
               <div>
                 <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight italic text-white">
                   {/* Create local date object from YYYY-MM-DD to avoid timezone shifting */}
                   {(() => {
                     const [y, m, d] = selectedEventDate.split('-').map(Number);
                     return new Date(y, m - 1, d).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
                   })()}
                 </h3>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Signal Records</span>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => { setSelectedCategoryId(activeChat.categories[0]?.id || null); setIsEventModalOpen(true); }} className={`p-2 ${currentTheme.bg} text-white rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95`}><Plus size={20} /></button>
                 <button onClick={() => setIsDayDetailOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 custom-scrollbar text-white">
              {(() => {
                const [y, m, d] = selectedEventDate.split('-').map(Number);
                const localDate = new Date(y, m - 1, d);
                const events = getEventsForDay(localDate);
                
                return events.length > 0 ? (
                  events.map(ev => {
                    const category = activeChat.categories.find(c => c.id === ev.categoryId);
                    return (
                      <div key={ev.id} className="p-6 bg-slate-800/50 rounded-[2rem] border border-slate-700/50 relative overflow-hidden group hover:border-slate-500 transition-colors shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: category?.color }} />
                        <div className="flex items-center gap-2 mb-3">
                          <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-slate-900" style={{ color: category?.color }}>{category?.name || 'Protocol'}</div>
                          <span className="text-[9px] font-bold text-slate-500 ml-auto">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-100 whitespace-pre-wrap">{ev.content}</p>
                        <button onClick={() => setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.filter(m => m.id !== ev.id) } : c))} className="absolute right-4 top-4 p-2 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-3">
                    <Activity size={48} className="opacity-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-center">No signals recorded</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Manual Modal */}
      {isEventModalOpen && selectedEventDate && activeChat && (
        <div className="fixed inset-0 flex items-center justify-center z-[120] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsEventModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
               <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-white"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl`}><Plus size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight">Direct Entry</h3></div>
                <button onClick={() => setIsEventModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Frequency</label>
                  <div className="grid grid-cols-2 gap-2">
                    {activeChat.categories.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setSelectedCategoryId(cat.id)} 
                        className={`px-4 py-3 rounded-xl transition-all flex items-center gap-3 border ${selectedCategoryId === cat.id ? 'bg-slate-800 border-white shadow-lg' : 'bg-slate-900 border-slate-800/50 hover:border-slate-600'}`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[9px] font-black uppercase tracking-widest truncate text-white">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 text-white">Record Payload</label>
                  <textarea 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm focus:outline-none h-32 resize-none custom-scrollbar text-white shadow-inner" 
                    placeholder="Enter record..." 
                  />
                </div>
                <button 
                  onClick={() => handleSendMessage(inputText, 'event', { date: selectedEventDate, categoryId: selectedCategoryId || activeChat.categories[0].id })}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${inputText.trim() ? `${currentTheme.bg} text-white shadow-xl shadow-${palette}-500/20 active:scale-95` : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                >
                  Commit Signal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Interface Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-white">
            <h3 className="text-2xl font-black italic tracking-tighter mb-10 flex items-center gap-3"><SettingsIcon className={currentTheme.text} /> Parameters</h3>
            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2"><Palette size={14} /> Neural Hue</label>
                <div className="flex flex-wrap gap-5 justify-center">
                  {(Object.keys(paletteConfigs) as ThemePalette[]).map((p) => (
                    <button key={p} onClick={() => setPalette(p)} className={`w-14 h-14 rounded-full transition-all flex items-center justify-center ring-offset-4 ring-offset-slate-900 ${palette === p ? `ring-2 ${paletteConfigs[p].ring} scale-110 shadow-2xl shadow-${palette}-500/50` : 'hover:scale-110'}`} style={{ backgroundColor: paletteConfigs[p].hex }}>{palette === p && <Zap size={20} className="text-white" />}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95 shadow-lg">Finalize HUD</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
