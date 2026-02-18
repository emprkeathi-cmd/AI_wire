
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Settings as SettingsIcon, Menu, Plus, MoreVertical, Send, Mic, X, Trash2, Bot,
  Zap, Palette, ChevronLeft, ChevronUp, ChevronDown, Paperclip, Copy, Wifi,
  Calendar as CalendarIcon, MessageSquare, Layers, CalendarDays, ListTodo, FileText,
  Upload, Image as ImageIcon, GripVertical, Activity, Monitor, Sparkles, Terminal
} from 'lucide-react';
import { Chat, Message, ThemePalette, Category, AppStyle } from './types';
import { Logo } from './components/Logo';
import { sendMessageToN8N } from './services/n8nService';
import { BlueprintEngine } from './BlueprintEngine';
import { ChatEngine } from './ChatEngine';
import { CalendarEngine } from './CalendarEngine';
import { TodoEngine } from './TodoEngine';

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  
  // UI Aesthetic State
  const [appStyle, setAppStyle] = useState<AppStyle>('sleek');
  
  // Modal states needed for Engines (drilled down)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  const [todoNotes, setTodoNotes] = useState('');
  const [todoReminder, setTodoReminder] = useState(false);
  const [todoFilter, setTodoFilter] = useState<'ALL' | 'Active' | 'Done' | 'Deleted'>('Active');
  
  const [isTyping, setIsTyping] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('purple');
  const [isDoorConnected, setIsDoorConnected] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingColor, setReceivingColor] = useState('emerald');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
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

  const normalizeString = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');

  const processDoorMessage = useCallback((raw: string, chat: Chat): { additions: Message[], deletions: any[], debug: any } => {
    const additions: Message[] = [];
    const deletions: any[] = [];
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

    if (chat.mode === 'todo') {
      let jsonData: any = null;
      try { jsonData = JSON.parse(raw); } catch (e) {}
      if (jsonData && typeof jsonData === 'object') {
        const cmd = (jsonData.command || jsonData.WHAT || jsonData.what || '').toLowerCase();
        const catName = jsonData.category || jsonData.Category;
        const cat = findCategory(catName);
        const title = jsonData.title || jsonData.Title || jsonData.content || jsonData.Content || jsonData.appointment || jsonData.Appointment;
        if (cat && title) {
          if (cmd === 'save' || cmd === 'create') {
            additions.push({ id: `todo-j-${Date.now()}`, role: 'assistant', type: 'task', content: String(title), categoryId: cat.id, todoStatus: 'active', todoReminder: jsonData.reminder === 'positive' || jsonData.reminder === true, todoNotes: String(jsonData.notes || ''), timestamp: Date.now() });
            return { additions, deletions, debug: { ...debugInfo, interpreted: { type: 'todo_json_save', category: cat.name, title } } };
          } else if (cmd === 'delete') {
            deletions.push({ content: String(title), categoryId: cat.id, mode: 'todo' });
            return { additions, deletions, debug: { ...debugInfo, interpreted: { type: 'todo_json_delete', category: cat.name, title } } };
          } else if (cmd === 'done' || cmd === 'complete') {
            deletions.push({ content: String(title), categoryId: cat.id, mode: 'todo', newStatus: 'done' });
            return { additions, deletions, debug: { ...debugInfo, interpreted: { type: 'todo_json_done', category: cat.name, title } } };
          }
        }
      }
    }

    let data: any = null;
    try { data = JSON.parse(raw); } catch (e) {
      if (raw.includes('|')) {
        const parts = raw.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          const potentialDate = parseDate(parts[0]);
          const potentialCat = findCategory(parts[1]);
          if (potentialDate && potentialCat) {
            additions.push({ id: `sep-${Date.now()}`, role: 'assistant', content: parts.slice(2).join('|').trim(), date: potentialDate, categoryId: potentialCat.id, type: 'event', timestamp: Date.now() });
            return { additions, deletions, debug: { ...debugInfo, interpreted: { type: 'separator_format', category: potentialCat.name, date: potentialDate } } };
          }
        }
      }
    }

    if (data && typeof data === 'object') {
      const explicitDate = data.Date || data.date;
      if (explicitDate) dateStr = parseDate(String(explicitDate)) || dateStr;
      const explicitCatValue = data.Category || data.category || data.Classification || data.classification;
      const explicitContent = data.Appointment || data.appointment || data.Content || data.content || data.Text || data.text;
      const action = String(data.WHAT || data.what || 'create').toLowerCase();
      if (explicitCatValue && explicitContent) {
        const cat = findCategory(String(explicitCatValue));
        if (cat) {
          if (action === 'delete') deletions.push({ content: String(explicitContent), date: dateStr, categoryId: cat.id });
          else additions.push({ id: `expl-${Date.now()}`, role: 'assistant', content: String(explicitContent), date: dateStr, categoryId: cat.id, type: 'event', timestamp: Date.now() });
        }
      }
    }

    if (additions.length === 0 && deletions.length === 0 && raw.trim().length > 0) {
      additions.push({ id: `door-${Date.now()}`, role: 'assistant', content: raw, timestamp: Date.now() });
    }
    return { additions, deletions, debug: debugInfo };
  }, []);

  const initSSE = useCallback(() => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); setIsDoorConnected(false); }
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
          setReceivingColor('emerald');
          if (receivingTimeoutRef.current) window.clearTimeout(receivingTimeoutRef.current);
          receivingTimeoutRef.current = window.setTimeout(() => setIsReceiving(false), 2500);
          const { additions: newMessages, deletions, debug } = processDoorMessage(rawMsg, activeChat);
          setRecentSignals(prev => [{timestamp: Date.now(), raw: rawMsg, interpreted: debug.interpreted}, ...prev].slice(0, 5));
          if (deletions.length > 0) {
            setReceivingColor('rose');
            setChats(prev => prev.map(c => {
              if (c.id !== activeChatId) return c;
              let filteredMessages = [...c.messages];
              deletions.forEach(del => {
                const normDelContent = normalizeString(del.content);
                if (del.mode === 'todo') {
                  filteredMessages = filteredMessages.map(m => (m.type === 'task' && m.categoryId === del.categoryId && normalizeString(m.content) === normDelContent) ? { ...m, todoStatus: del.newStatus || 'deleted' } : m);
                } else {
                  filteredMessages = filteredMessages.filter(m => !(m.date === del.date && m.categoryId === del.categoryId && normalizeString(m.content) === normDelContent));
                }
              });
              return { ...c, messages: filteredMessages };
            }));
          }
          if (newMessages.length > 0) setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, ...newMessages] } : c));
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
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
    const savedStyle = localStorage.getItem('ai_wire_style') as AppStyle;
    if (savedStyle) setAppStyle(savedStyle);
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem('ai_wire_chats', JSON.stringify(chats));
    if (activeChatId) localStorage.setItem('ai_wire_last_active', activeChatId);
  }, [chats, activeChatId]);

  useEffect(() => { localStorage.setItem('ai_wire_palette', palette); }, [palette]);
  useEffect(() => { localStorage.setItem('ai_wire_style', appStyle); }, [appStyle]);

  const handleSendMessage = async (content?: string, type: any = 'text', extra?: any, blobToUse?: Blob, fileToUse?: File) => {
    if (!activeChat) return;
    const finalType = (activeChat.mode === 'calendar' && type === 'text') ? 'event' : (activeChat.mode === 'todo' && type === 'text') ? 'task' : type;
    const messageContent = content || inputText;
    const finalBlob = blobToUse || audioBlob;
    if (!messageContent && !finalBlob && finalType !== 'file' && !fileToUse && finalType !== 'blueprint') return;

    const getTodayLocalDateStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    let audioUrl = '';
    if (finalType === 'audio' && finalBlob) {
      audioUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(finalBlob);
      });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalType === 'audio' ? 'Voice Message' : finalType === 'file' ? (fileToUse?.name || String(messageContent)) : String(messageContent),
      type: finalType,
      title: extra?.title,
      assets: extra?.assets,
      date: extra?.date || (activeChat.mode === 'calendar' ? getTodayLocalDateStr() : undefined),
      categoryId: extra?.categoryId || (activeChat.mode !== 'chat' && activeChat.mode !== 'blueprint' ? activeChat.categories[0]?.id : undefined),
      timestamp: Date.now(),
      todoStatus: activeChat.mode === 'todo' ? 'active' : undefined,
      todoReminder: extra?.todoReminder,
      todoNotes: extra?.todoNotes,
      attachments: audioUrl ? [{ name: 'Voice Message', url: audioUrl, type: 'audio/webm' }] : undefined,
    };

    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, userMessage] } : c));
    if (type !== 'blueprint') { setInputText(''); setTodoNotes(''); setTodoReminder(false); }
    setIsEventModalOpen(false);
    setIsTodoModalOpen(false);

    if (activeChat?.webhookUrl) {
      setIsTyping(true);
      try {
        let payload: string | Blob = messageContent;
        let metadata: any = undefined;
        if (finalType === 'audio') payload = finalBlob!;
        else if (finalType === 'file' && fileToUse) { payload = fileToUse.name; metadata = { files: [{ blob: fileToUse, name: fileToUse.name }] }; }
        else if (finalType === 'event') metadata = { date: userMessage.date, categoryId: userMessage.categoryId, categoryName: activeChat.categories.find(c => c.id === userMessage.categoryId)?.name };
        else if (finalType === 'task') metadata = { todoStatus: userMessage.todoStatus, todoReminder: userMessage.todoReminder, todoNotes: userMessage.todoNotes, categoryId: userMessage.categoryId, categoryName: activeChat.categories.find(c => c.id === userMessage.categoryId)?.name };
        else if (finalType === 'blueprint') metadata = { title: extra.title, assets: extra.assets };
        const response = await sendMessageToN8N(activeChat.webhookUrl, payload, finalType, metadata);
        const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() };
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      } catch (err) { console.error(err); } finally { setIsTyping(false); }
    }
  };

  const handleUpdateBlueprint = (msgId: string, newContent: string) => { setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, content: newContent } : m) } : c)); };
  const handleDeleteMessage = (msgId: string) => { setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } : c)); };
  const handleReaction = async (message: Message, reaction: string) => {
    if (!activeChat) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.map(m => m.id === message.id ? { ...m, reacted: true } : m) } : c));
    if (activeChat.webhookUrl) try { await sendMessageToN8N(activeChat.webhookUrl, reaction, 'reaction', { originalContent: message.content }); if (navigator.vibrate) navigator.vibrate(30); } catch (err) { console.error(err); }
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; await handleSendMessage(files[0].name, 'file', undefined, undefined, files[0]); if (chatFileInputRef.current) chatFileInputRef.current.value = ''; };
  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !editingChat) return; const reader = new FileReader(); reader.onload = () => setEditingChat({ ...editingChat, icon: reader.result as string }); reader.readAsDataURL(file); };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); setAudioBlob(blob); stream.getTracks().forEach(track => track.stop()); };
      recorder.start(); setIsRecording(true); setRecordingDuration(0);
      durationIntervalRef.current = window.setInterval(() => setRecordingDuration(d => d + 1), 1000);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) { console.error(err); }
  };

  const stopRecording = (shouldSend = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (shouldSend) handleSendMessage(undefined, 'audio', undefined, blob);
        else setAudioBlob(blob);
        if (mediaRecorderRef.current?.stream) mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    setIsRecording(false);
  };

  const handleMicMouseDown = () => { setHoldProgress(1); const step = 100 / (1300 / 10); holdIntervalRef.current = window.setInterval(() => setHoldProgress(prev => (prev + step > 100 ? 100 : prev + step)), 10); longPressTimerRef.current = window.setTimeout(() => { clearInterval(holdIntervalRef.current!); setHoldProgress(0); startRecording(); }, 1300); };
  const handleMicMouseUp = () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); if (holdIntervalRef.current) clearInterval(holdIntervalRef.current); setHoldProgress(0); if (isRecording) stopRecording(true); };
  const cancelRecording = () => { if (isRecording) stopRecording(false); setAudioBlob(null); };

  const createNewAgent = (mode: 'chat' | 'calendar' | 'todo' | 'blueprint') => {
    const newId = Date.now().toString();
    const categories: Category[] = mode === 'todo' ? [{ id: 't1', name: 'Important', color: '#EF4444' }, { id: 't2', name: 'Today', color: '#FBBF24' }, { id: 't3', name: 'Coming up', color: '#10B981' }, { id: 't4', name: 'Goals', color: '#A855F7' }] : [{ id: '1', name: 'Obligations', color: '#F87171' }, { id: '2', name: 'Social Engagements', color: '#60A5FA' }, { id: '3', name: 'Administrative Tasks', color: '#FBBF24' }, { id: '4', name: 'Personal Development', color: '#34D399' }, { id: '5', name: 'Logistics', color: '#A78BFA' }];
    const modeNames = { chat: 'Neural Link', calendar: 'Temporal Node', todo: 'Task Grid', blueprint: 'Blueprint Hub' };
    const newChat: Chat = { id: newId, name: `${modeNames[mode]} ${chats.filter(c => c.mode === mode).length + 1}`, mode, webhookUrl: '', receiverId: `ai_wire_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`, categories, messages: [{ id: 'sys-' + Date.now(), role: 'system', content: `Protocol active. ${mode.toUpperCase()} node initialized.`, timestamp: Date.now() }], createdAt: Date.now() };
    setChats([newChat, ...chats]); setActiveChatId(newId); setIsDeployModalOpen(false); setIsSidebarOpen(false);
  };

  const onDragStart = (e: React.DragEvent, index: number) => { setDraggedIdx(index); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => { (e.target as HTMLElement).style.opacity = '0.4'; }, 0); };
  const onDragEnd = (e: React.DragEvent) => { (e.target as HTMLElement).style.opacity = '1'; setDraggedIdx(null); };
  const onDrop = (e: React.DragEvent, targetIdx: number) => { e.preventDefault(); if (draggedIdx === null || draggedIdx === targetIdx) return; const newChats = [...chats]; const item = newChats.splice(draggedIdx, 1)[0]; newChats.splice(targetIdx, 0, item); setChats(newChats); if (navigator.vibrate) navigator.vibrate(20); };

  const saveSettings = () => { if (!editingChat) return; setChats(prev => prev.map(c => c.id === editingChat.id ? editingChat : c)); setIsChatSettingsOpen(false); setEditingChat(null); };
  const deleteChat = (id: string) => { if (window.confirm('Are you sure you want to decommission this node?')) { setChats(prev => prev.filter(c => c.id !== id)); if (activeChatId === id) setActiveChatId(null); setIsChatSettingsOpen(false); setEditingChat(null); } };

  const renderChatIcon = (chat: Chat, size = 18) => {
    if (chat.icon && chat.icon.startsWith('data:image')) return (<div className="w-full h-full flex items-center justify-center overflow-hidden"><img src={chat.icon} className="w-full h-full object-cover" alt="Node Avatar" /></div>);
    if (chat.mode === 'calendar') return <CalendarIcon size={size} />;
    if (chat.mode === 'todo') return <ListTodo size={size} />;
    if (chat.mode === 'blueprint') return <FileText size={size} />;
    return <Bot size={size} />;
  };

  const toggleTaskStatus = (id: string, currentStatus: 'active' | 'done' | 'deleted') => {
    const nextStatus = currentStatus === 'active' ? 'done' : 'active';
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, todoStatus: nextStatus } : m) } : c));
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const deleteTask = (id: string) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, todoStatus: 'deleted' } : m) } : c));
  };

  return (
    <div className={`flex h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-hidden relative select-none ${appStyle === 'cyber' ? 'cyber-grid' : ''}`}>
      {appStyle === 'cyber' && <div className="fixed inset-0 scanlines pointer-events-none" />}
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><SettingsIcon size={20} /></button>
            <div className="flex items-center gap-2"><Logo size={32} color={currentTheme.hex} /><span className={`font-black text-xl tracking-tight text-white italic ${appStyle === 'cyber' ? 'glitch-text font-mono' : ''}`}>AI wire</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><ChevronLeft size={20} /></button>
          </div>
          <div className="p-4"><button onClick={() => setIsDeployModalOpen(true)} className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} hover:opacity-90 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xl active:scale-95 ${appStyle === 'cyber' ? 'cyber-border rounded-none uppercase font-mono' : ''}`}><Plus size={18} /> Deploy Agent</button></div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
            <div className="px-3 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={14} className={currentTheme.text} /> Nodes</div>
            {chats.map((chat, index) => (
              <div key={chat.id} className="relative group cursor-grab active:cursor-grabbing" draggable="true" onDragStart={(e) => onDragStart(e, index)} onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()} onDrop={(e) => onDrop(e, index)}>
                <button onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-3 mb-1 ${appStyle === 'cyber' ? 'rounded-none border-l-2 border-transparent hover:border-white/20' : ''} ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from}/30 ${currentTheme.to}/10 text-white ring-1 ${currentTheme.ring} ${appStyle === 'cyber' ? 'border-l-indigo-500 bg-slate-900 ring-0 shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]' : ''}` : 'hover:bg-slate-800/60 text-slate-400'}`}>
                  <div className={`p-0.5 rounded-xl overflow-hidden w-10 h-10 flex items-center justify-center shrink-0 ${activeChatId === chat.id ? `bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} text-white` : 'bg-slate-800'} ${appStyle === 'cyber' ? 'rounded-none' : ''}`}>{renderChatIcon(chat)}</div>
                  <div className="flex-1 truncate"><div className={`font-bold truncate text-sm flex items-center gap-1 ${appStyle === 'cyber' ? 'font-mono uppercase text-[12px]' : ''}`}>{chat.name}</div><div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">{chat.messages.length > 0 ? (chat.messages[chat.messages.length - 1].title || chat.messages[chat.messages.length - 1].content) : 'Ready'}</div></div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 shrink-0"><GripVertical size={16} /></div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-slate-950 min-w-0 overflow-hidden">
        <header className={`h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30 shrink-0 ${appStyle === 'cyber' ? 'border-b-indigo-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><Menu size={22} /></button>
            {activeChat && (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to} rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg overflow-hidden ${appStyle === 'cyber' ? 'rounded-none border border-white/10 shadow-none' : ''}`}>{renderChatIcon(activeChat, 20)}</div>
                <div className="flex flex-col min-w-0"><h2 className={`font-bold text-sm tracking-tight truncate flex items-center gap-2 text-white ${appStyle === 'cyber' ? 'font-mono uppercase' : ''}`}>{activeChat.name}{isReceiving && (<div className={`flex items-center gap-1 bg-${receivingColor}-500/10 px-1.5 py-0.5 rounded-md border border-${receivingColor}-500/20`}><Activity size={10} className={`text-${receivingColor}-500 animate-pulse`} /><span className={`text-[7px] font-black text-${receivingColor}-500 uppercase tracking-widest`}>{receivingColor === 'rose' ? 'Decommissioning' : 'Receiving'}</span></div>)}</h2></div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1"><button onClick={() => { setEditingChat(activeChat ? JSON.parse(JSON.stringify(activeChat)) : null); setIsChatSettingsOpen(true); }} className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"><MoreVertical size={20} /></button></div>
        </header>

        <div className="flex-1 overflow-hidden">
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 text-center"><Logo size={120} className="animate-pulse" color={currentTheme.hex} /><div><h3 className={`text-2xl font-black text-white italic tracking-tighter ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}>AI wire</h3><p className="max-w-[240px] mx-auto text-sm text-slate-500 mt-2 font-medium uppercase tracking-widest">Select Node for Sync</p></div></div>
          ) : activeChat?.mode === 'blueprint' ? (
            <BlueprintEngine activeChat={activeChat} onDeploy={(title, content, assets) => handleSendMessage(content, 'blueprint', { title, assets })} onUpdate={handleUpdateBlueprint} onDelete={handleDeleteMessage} />
          ) : activeChat?.mode === 'todo' ? (
            <TodoEngine activeChat={activeChat} currentTheme={currentTheme} palette={palette} isTodoModalOpen={isTodoModalOpen} setIsTodoModalOpen={setIsTodoModalOpen} todoFilter={todoFilter} setTodoFilter={setTodoFilter} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} inputText={inputText} setInputText={setInputText} todoNotes={todoNotes} setTodoNotes={setTodoNotes} todoReminder={todoReminder} setTodoReminder={setTodoReminder} onSendMessage={handleSendMessage} onToggleTaskStatus={toggleTaskStatus} onDeleteTask={deleteTask} />
          ) : activeChat?.mode === 'calendar' ? (
            <CalendarEngine activeChat={activeChat} currentTheme={currentTheme} palette={palette} currentCalendarDate={currentCalendarDate} setCurrentCalendarDate={setCurrentCalendarDate} selectedEventDate={selectedEventDate} setSelectedEventDate={setSelectedEventDate} isDayDetailOpen={isDayDetailOpen} setIsDayDetailOpen={setIsDayDetailOpen} isEventModalOpen={isEventModalOpen} setIsEventModalOpen={setIsEventModalOpen} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} inputText={inputText} setInputText={setInputText} onSendMessage={handleSendMessage} onDeleteMessage={handleDeleteMessage} />
          ) : (
            <ChatEngine activeChat={activeChat} currentTheme={currentTheme} palette={palette} isTyping={isTyping} inputText={inputText} setInputText={setInputText} isRecording={isRecording} recordingDuration={recordingDuration} audioBlob={audioBlob} holdProgress={holdProgress} lastAssistantMsgIndex={lastAssistantMsgIndex} onSendMessage={handleSendMessage} onReaction={handleReaction} onFileUpload={handleFileUpload} onMicMouseDown={handleMicMouseDown} onMicMouseUp={handleMicMouseUp} onCancelRecording={cancelRecording} onStopRecording={stopRecording} messagesEndRef={messagesEndRef} chatFileInputRef={chatFileInputRef} />
          )}
        </div>
      </main>

      {/* Deploy Choice Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsDeployModalOpen(false)} />
          <div className={`relative bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl p-6 sm:p-10 animate-in zoom-in-95 duration-200 ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
            <h3 className={`text-2xl sm:text-3xl font-black italic tracking-tighter mb-8 text-center text-white ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}>Protocol Deployment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { mode: 'chat', icon: <MessageSquare size={32} />, label: 'Neural Link', sub: 'Signal Hub', color: 'bg-purple-600' },
                { mode: 'calendar', icon: <CalendarDays size={32} />, label: 'Temporal Node', sub: 'Chronos Grid', color: 'bg-emerald-600' },
                { mode: 'todo', icon: <ListTodo size={32} />, label: 'Task Grid', sub: 'Protocol Sync', color: 'bg-amber-600' },
                { mode: 'blueprint', icon: <FileText size={32} />, label: 'Blueprint Hub', sub: 'Design Codex', color: 'bg-cyan-600' }
              ].map((item) => (
                <button 
                  key={item.mode}
                  onClick={() => createNewAgent(item.mode as any)} 
                  className={`flex flex-col items-center gap-4 p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-white/30 rounded-[2rem] transition-all group active:scale-95 shadow-xl ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/20' : ''}`}
                >
                  <div className={`p-4 ${item.color} rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform ${appStyle === 'cyber' ? 'rounded-none' : ''}`}>{item.icon}</div>
                  <div className="text-center">
                    <span className={`block font-black text-md uppercase tracking-tight text-white ${appStyle === 'cyber' ? 'font-mono' : ''}`}>{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Node Topology Modal */}
      {isChatSettingsOpen && editingChat && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => { setIsChatSettingsOpen(false); setEditingChat(null); }} />
          <div className={`relative bg-slate-900 w-full max-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-200 text-white ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar text-white">
              <div className="flex justify-between items-center mb-8"><div className="flex items-center gap-3"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl shadow-lg ${appStyle === 'cyber' ? 'rounded-none' : ''}`}><Layers size={24} /></div><h3 className={`text-xl font-black uppercase tracking-tight ${appStyle === 'cyber' ? 'font-mono' : ''}`}>Node Topology</h3></div><button onClick={() => { setIsChatSettingsOpen(false); setEditingChat(null); }} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button></div>
              <div className="space-y-8">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Neural Avatar</label><div className="flex flex-col gap-4"><div className="flex items-center gap-6"><div className={`w-24 h-24 rounded-3xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center relative shadow-inner ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/30 shadow-none' : ''}`}>{editingChat.icon && editingChat.icon.startsWith('data:image') ? (<img src={editingChat.icon} className="w-full h-full object-cover" alt="Node Icon" />) : (<ImageIcon className="text-slate-700" size={32} />)}<div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => iconInputRef.current?.click()}><Upload size={24} className="text-white" /></div></div><div className="flex-1 space-y-2"><input type="file" ref={iconInputRef} onChange={handleIconUpload} className="hidden" accept="image/*" /><button onClick={() => iconInputRef.current?.click()} className={`w-full py-3 px-4 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${appStyle === 'cyber' ? 'rounded-none font-mono border-indigo-500/30' : ''}`}><ImageIcon size={14} /> Upload Pattern</button><button onClick={() => setEditingChat({...editingChat, icon: undefined})} className="w-full py-2 text-slate-500 hover:text-red-500 text-[9px] font-black uppercase tracking-widest transition-all font-mono">Clear Avatar</button></div></div></div></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Node Alias</label><input type="text" value={editingChat.name} onChange={(e) => setEditingChat({...editingChat, name: e.target.value})} className={`w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-bold text-sm text-white ${appStyle === 'cyber' ? 'rounded-none font-mono border-indigo-500/30' : ''}`} /></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">n8n Neural Gateway</label><input type="url" value={editingChat.webhookUrl} onChange={(e) => setEditingChat({...editingChat, webhookUrl: e.target.value})} className={`w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-3.5 focus:outline-none font-mono text-[10px] text-white ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/30' : ''}`} placeholder="https://..." /></div>
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner"><label className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4"><Wifi size={14} /> Door Uplink</label><div className="relative group mb-3"><div className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-[9px] text-slate-400 select-all overflow-x-auto whitespace-nowrap scrollbar-hide ${appStyle === 'cyber' ? 'rounded-none' : ''}`}>{`https://ntfy.sh/${editingChat.receiverId}`}</div><button onClick={() => copyToClipboard(`https://ntfy.sh/${editingChat.receiverId}`)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><Copy size={14} /></button></div></div>
                <div className="flex flex-col gap-3 pt-4 pb-2"><button onClick={saveSettings} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all ${currentTheme.bg} text-white ${appStyle === 'cyber' ? 'rounded-none font-mono' : ''}`}>Commit Protocol Changes</button><button onClick={() => deleteChat(editingChat.id)} className={`w-full py-4 rounded-2xl bg-red-950/20 hover:bg-red-950/40 text-red-500 border border-red-900/20 transition-all text-[10px] font-black uppercase tracking-[0.2em] ${appStyle === 'cyber' ? 'rounded-none font-mono' : ''}`}>Sever Protocol</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parameters (Settings) Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSettingsModalOpen(false)} />
          <div className={`relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-white ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
            <h3 className={`text-2xl font-black italic tracking-tighter mb-10 flex items-center gap-3 ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}><SettingsIcon className={currentTheme.text} /> Parameters</h3>
            <div className="space-y-10">
              {/* Aesthetic Protocol */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-2"><Monitor size={14} /> Interface Style</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setAppStyle('sleek')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] transition-all ${appStyle === 'sleek' ? 'bg-white text-slate-950 border-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                  >
                    <Sparkles size={14} /> Sleek
                  </button>
                  <button 
                    onClick={() => setAppStyle('cyber')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] transition-all font-mono ${appStyle === 'cyber' ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                  >
                    <Terminal size={14} /> Cyber
                  </button>
                </div>
              </div>

              {/* Neural Hue (Color Palette) */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2"><Palette size={14} /> Neural Hue</label>
                <div className="flex flex-wrap gap-5 justify-center">
                  {(Object.keys(paletteConfigs) as ThemePalette[]).map((p) => (
                    <button 
                      key={p} 
                      onClick={() => setPalette(p)} 
                      className={`w-14 h-14 rounded-full transition-all flex items-center justify-center ring-offset-4 ring-offset-slate-900 ${appStyle === 'cyber' ? 'rounded-none' : ''} ${palette === p ? `ring-2 ${paletteConfigs[p].ring} scale-110 shadow-2xl shadow-${palette}-500/50` : 'hover:scale-110'}`} 
                      style={{ backgroundColor: paletteConfigs[p].hex }}
                    >
                      {palette === p && <Zap size={20} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
              
              <button onClick={() => setIsSettingsModalOpen(false)} className={`w-full py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95 shadow-lg ${appStyle === 'cyber' ? 'rounded-none font-mono glitch-text' : ''}`}>Finalize HUD</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); if (navigator.vibrate) navigator.vibrate(50); } catch (err) {} };

export default App;
