import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Settings as SettingsIcon, Menu, Plus, MoreVertical, Send, Mic, X, Trash2, Bot,
  Zap, Palette, ChevronLeft, ChevronUp, ChevronDown, Paperclip, Copy, Wifi,
  Calendar as CalendarIcon, MessageSquare, Layers, CalendarDays, ListTodo, FileText,
  Upload, Image as ImageIcon, GripVertical, Activity, Monitor, Sparkles, Terminal,
  Clock as AlarmIcon, Phone, Newspaper, Instagram, Server, Info
} from 'lucide-react';
import { Tutorial, TutorialStep } from '@/src/components/Tutorial';
import { Chat, Message, ThemePalette, Category, AppStyle, Alarm } from '@/src/types';
import { Logo } from '@/components/Logo';
import { sendMessageToN8N } from '@/services/n8nService';
import { cleanAllChats } from '@/services/NeuralCleaner';
import { BlueprintEngine } from '@/components/engines/BlueprintEngine';
import { ChatEngine } from '@/components/engines/ChatEngine';
import { CalendarEngine } from '@/components/engines/CalendarEngine';
import { TodoEngine } from '@/components/engines/TodoEngine';
import { AlarmEngine } from '@/components/engines/AlarmEngine';
import { CallEngine } from '@/components/engines/CallEngine';
import { NewsEngine } from '@/components/engines/NewsEngine';
import { SocialMediaEngine } from '@/components/engines/SocialMediaEngine';
import { SyncEngine } from '@/components/engines/SyncEngine';
import { useChatEngine } from '@/src/hooks/useChatEngine';
import { useTodoEngine } from '@/src/hooks/useTodoEngine';
import { useCalendarEngine } from '@/src/hooks/useCalendarEngine';
import { useBlueprintEngine } from '@/src/hooks/useBlueprintEngine';
import { useAlarmEngine } from '@/src/hooks/useAlarmEngine';
import { useNewsEngine } from '@/src/hooks/useNewsEngine';
import { useSocialEngine } from '@/src/hooks/useSocialEngine';
import { useCallEngine } from '@/src/hooks/useCallEngine';
import { useSyncEngine } from '@/src/hooks/useSyncEngine';
import { useSignalProcessor } from '@/src/hooks/useSignalProcessor';
import { InfoModal } from '@/src/components/modals/InfoModal';
import { paletteConfigs } from '@/src/constants/palettes';
import { copyToClipboard } from '@/src/utils/clipboard';

db.version(1).stores({ chats: 'id' });
const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
  const [appStyle, setAppStyle] = useState<AppStyle>('sleek');
  
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('completed');
  
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [inputText, setInputText] = useState('');
  
  const [palette, setPalette] = useState<ThemePalette>('purple');
  const [isDoorConnected, setIsDoorConnected] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingColor, setReceivingColor] = useState('emerald');
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [recentSignals, setRecentSignals] = useState<{timestamp: number, raw: string, interpreted?: any}[]>([]);
  
  const iconInputRef = useRef<HTMLInputElement>(null);
  const eventSourcesRef = useRef<Record<string, EventSource>>({});
  const receivingTimeoutRef = useRef<number | null>(null);

  const currentTheme = paletteConfigs[palette];
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const {
    isDeployModalOpen,
    setIsDeployModalOpen,
    createNewAgent,
    handleUpdateBlueprint,
    handleDeleteMessage,
    processBlueprintMessage,
  } = useBlueprintEngine(chats, setChats, activeChatId, setActiveChatId, setIsSidebarOpen);

  const {
    updateAlarms,
    processAlarmMessage,
  } = useAlarmEngine(activeChatId, setChats);

  const {
    handleUpdateNewsMessage,
    processNewsMessage,
  } = useNewsEngine(activeChatId, setChats);

  const {
    processSocialMessage,
  } = useSocialEngine(activeChatId, setChats);

  const {
    isEventModalOpen,
    setIsEventModalOpen,
    isDayDetailOpen,
    setIsDayDetailOpen,
    selectedEventDate,
    setSelectedEventDate,
    selectedCategoryId,
    setSelectedCategoryId,
    currentCalendarDate,
    setCurrentCalendarDate,
    editCalendarEvent,
    deleteCalendarEvent,
    processCalendarMessage,
  } = useCalendarEngine(chats, activeChatId, setChats);

  const {
    todoNotes,
    setTodoNotes,
    todoReminder,
    setTodoReminder,
    todoFilter,
    setTodoFilter,
    isTodoModalOpen,
    setIsTodoModalOpen,
    toggleTaskStatus,
    deleteTask,
    editTask,
    processTodoMessage,
  } = useTodoEngine(chats, activeChatId, setChats);

  const {
    updateCallSettings,
    processCallMessage,
  } = useCallEngine(activeChatId, setChats);

  const {
    handleNeuralCleanup,
    processSyncMessage,
  } = useSyncEngine(setChats);

  const {
    isTyping,
    isRecording,
    recordingDuration,
    audioBlob,
    holdProgress,
    lastAssistantMsgIndex,
    messagesEndRef,
    chatFileInputRef,
    handleSendMessage,
    handleReaction,
    handleFileUpload,
    handleMicMouseDown,
    handleMicMouseUp,
    cancelRecording,
    stopRecording,
  } = useChatEngine(
    chats,
    setChats,
    activeChat,
    activeChatId,
    inputText,
    setInputText,
    setTodoNotes,
    setTodoReminder,
    setIsEventModalOpen,
    setIsTodoModalOpen
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]);

  const normalizeString = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');

  const { processDoorMessage } = useSignalProcessor(
    processSocialMessage,
    processNewsMessage,
    processSyncMessage,
    processBlueprintMessage,
    processAlarmMessage,
    processCallMessage,
    processTodoMessage,
    processCalendarMessage
  );

  const chatsRef = useRef<Chat[]>(chats);
  const activeChatIdRef = useRef<string | null>(activeChatId);
  const processDoorMessageRef = useRef(processDoorMessage);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    processDoorMessageRef.current = processDoorMessage;
  }, [processDoorMessage]);

  const initSSE = useCallback(() => {
    const currentChats = chatsRef.current;
    if (currentChats.length === 0) return;
    
    // Close connections for chats that no longer exist
    const currentChatIds = new Set(currentChats.map(c => c.id));
    Object.keys(eventSourcesRef.current).forEach(id => {
      if (!currentChatIds.has(id)) {
        eventSourcesRef.current[id].close();
        delete eventSourcesRef.current[id];
      }
    });

    // Open connections for chats
    currentChats.forEach(chat => {
      if (!chat.receiverId || eventSourcesRef.current[chat.id]) return;
      
      const es = new EventSource(`https://ntfy.sh/${chat.receiverId}/sse`);
      eventSourcesRef.current[chat.id] = es;
      
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
            
            // Use refs to get latest state and logic
            const latestChat = chatsRef.current.find(c => c.id === chat.id);
            if (!latestChat) return;

            const { additions: newMessages, deletions, updates, alarms: alarmUpdates, debug } = processDoorMessageRef.current(rawMsg, latestChat);
            
            if (newMessages.length > 0 && "Notification" in window && Notification.permission === "granted") {
              new Notification(`[${latestChat.name}] New Signal`, {
                body: rawMsg.length > 100 ? rawMsg.substring(0, 97) + "..." : rawMsg,
                icon: latestChat.icon || 'https://raw.githubusercontent.com/emprkeathi-cmd/assets_Ai-Wire/main/web-app-manifest-512x512.png'
              });
            }

            if (latestChat.id === activeChatIdRef.current) {
              setRecentSignals(prev => [{timestamp: Date.now(), raw: rawMsg, interpreted: debug.interpreted}, ...prev].slice(0, 5));
            }

            if (deletions.length > 0 || updates.length > 0 || alarmUpdates || newMessages.length > 0) {
              setReceivingColor(deletions.length > 0 ? 'rose' : (updates.length > 0 || alarmUpdates ? 'amber' : 'emerald'));
              setChats(prev => prev.map(c => {
                if (c.id !== latestChat.id) return c;
                let filteredMessages = [...c.messages];
                let currentAlarms = [...(c.alarms || [])];
                
                // Handle Updates
                updates.forEach(upd => {
                  filteredMessages = filteredMessages.map(m => {
                    if (upd.timestamp && m.timestamp === Number(upd.timestamp)) {
                      return { ...m, ...upd };
                    }
                    return m;
                  });
                });

                // Handle Alarms
                if (alarmUpdates) {
                  alarmUpdates.forEach(newAlarm => {
                    const exists = currentAlarms.find(a => a.time === newAlarm.time && a.date === newAlarm.date);
                    if (!exists) {
                      currentAlarms.push(newAlarm);
                    }
                  });
                }

                // Handle Deletions
                deletions.forEach(del => {
                  const normDelContent = normalizeString(del.content || '');
                  if (del.mode === 'todo') {
                    filteredMessages = filteredMessages.map(m => {
                      const timestampMatch = del.timestamp && m.timestamp === Number(del.timestamp);
                      const contentMatch = !del.timestamp && m.type === 'task' && m.categoryId === del.categoryId && normalizeString(m.content) === normDelContent;
                      return (timestampMatch || contentMatch) ? { ...m, todoStatus: del.newStatus || 'deleted' } : m;
                    });
                  } else {
                    filteredMessages = filteredMessages.filter(m => {
                      const timestampMatch = del.timestamp && m.timestamp === Number(del.timestamp);
                      const contentMatch = !del.timestamp && m.date === del.date && m.categoryId === del.categoryId && normalizeString(m.content) === normDelContent;
                      return !(timestampMatch || contentMatch);
                    });
                  }
                });

                // Handle Additions
                if (newMessages.length > 0) {
                  filteredMessages = [...filteredMessages, ...newMessages];
                }

                return { ...c, messages: filteredMessages, alarms: currentAlarms };
              }));
            }
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
          }
        } catch (err) {}
      };
    });
  }, [normalizeString]);

  useEffect(() => {
    initSSE();
  }, [initSSE, chats]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      (Object.values(eventSourcesRef.current) as EventSource[]).forEach(es => es.close());
      eventSourcesRef.current = {};
    };
  }, []);

  useEffect(() => { (async () => {
    // Request Notification Permissions on App Load
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

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

    // Tutorial Logic
    const tutorialCompleted = localStorage.getItem('ai_wire_tutorial_completed');
    const existingChats = savedChats ? JSON.parse(savedChats) : [];
    if (!tutorialCompleted && existingChats.length === 0) {
      setTutorialStep('welcome');
    }
  })(); }, []);

  useEffect(() => {
    if (activeChatId && tutorialStep === 'completed') {
      const chatTutorialSeen = localStorage.getItem('ai_wire_chat_tutorial_seen');
      if (!chatTutorialSeen) {
        setTutorialStep('chat_opened');
        localStorage.setItem('ai_wire_chat_tutorial_seen', 'true');
      }
    }
  }, [activeChatId]);

  const handleNextTutorial = () => {
    const steps: TutorialStep[] = ['welcome', 'settings', 'deploy', 'engines', 'github', 'completed'];
    const currentIndex = steps.indexOf(tutorialStep);
    if (currentIndex !== -1 && currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setTutorialStep(nextStep);
      if (nextStep === 'completed') {
        localStorage.setItem('ai_wire_tutorial_completed', 'true');
      }
    } else if (tutorialStep === 'chat_opened') {
      setTutorialStep('completed');
    }
  };

  useEffect(() => {
    if (chats.length > 0) {
      const chatsToSave = chats.map(chat => ({
        ...chat,
        messages: chat.messages.map(msg => ({
          ...msg,
          attachments: msg.type === 'audio' ? [] : msg.attachments
        }))
      }));
      localStorage.setItem('ai_wire_chats', JSON.stringify(chatsToSave));
    }
    if (activeChatId) localStorage.setItem('ai_wire_last_active', activeChatId);
  }, [chats, activeChatId]);

  useEffect(() => { localStorage.setItem('ai_wire_palette', palette); }, [palette]);
  useEffect(() => { localStorage.setItem('ai_wire_style', appStyle); }, [appStyle]);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !editingChat) return; const reader = new FileReader(); reader.onload = () => setEditingChat({ ...editingChat, icon: reader.result as string }); reader.readAsDataURL(file); };
  
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
    if (chat.mode === 'alarm') return <AlarmIcon size={size} />;
    if (chat.mode === 'call') return <Phone size={size} />;
    if (chat.mode === 'news') return <Newspaper size={size} />;
    if (chat.mode === 'social') return <Instagram size={size} />;
    if (chat.mode === 'sync') return <Server size={size} />;
    return <Bot size={size} />;
  };

  return (
    <div className={`flex h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-hidden relative select-none ${appStyle === 'cyber' ? 'cyber-grid' : ''}`}>
      {appStyle === 'cyber' && <div className="fixed inset-0 scanlines pointer-events-none" />}
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <button id="tutorial-settings" onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><SettingsIcon size={20} /></button>
            <div className="flex items-center gap-2"><Logo size={32} color={currentTheme.hex} /><span className={`font-black text-xl tracking-tight text-white italic ${appStyle === 'cyber' ? 'glitch-text font-mono' : ''}`}>AI wire</span></div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400"><ChevronLeft size={20} /></button>
          </div>
          <div className="p-4"><button id="tutorial-deploy" onClick={() => setIsDeployModalOpen(true)} className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} hover:opacity-90 text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xl active:scale-95 ${appStyle === 'cyber' ? 'cyber-border rounded-none uppercase font-mono' : ''}`}><Plus size={18} /> Deploy Agent</button></div>
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
          <div className="flex items-center gap-1">
            {activeChat && (
              <button 
                onClick={() => setIsInfoModalOpen(true)} 
                className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"
                title="Module Protocol Info"
              >
                <Info size={20} />
              </button>
            )}
            <button id="tutorial-chat-settings" onClick={() => { setEditingChat(activeChat ? JSON.parse(JSON.stringify(activeChat)) : null); setIsChatSettingsOpen(true); }} className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"><MoreVertical size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 text-center"><Logo size={120} className="animate-pulse" color={currentTheme.hex} /><div><h3 className={`text-2xl font-black text-white italic tracking-tighter ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}>AI wire</h3><p className="max-w-[240px] mx-auto text-sm text-slate-500 mt-2 font-medium uppercase tracking-widest">Select Node for Sync</p></div></div>
          ) : (
            <div className="h-full relative">
              {chats.map(chat => {
                const isChatActive = chat.id === activeChatId;
                return (
                  <div key={chat.id} className={isChatActive ? 'h-full' : 'hidden'}>
                    {chat.mode === 'blueprint' && (
                      <BlueprintEngine activeChat={chat} onDeploy={(title, content, assets) => handleSendMessage(content, 'blueprint', { title, assets }, undefined, undefined, chat.id)} onUpdate={(msgId, newContent) => handleUpdateBlueprint(msgId, newContent, chat.id)} onDelete={(msgId) => handleDeleteMessage(msgId, chat.id)} />
                    )}
                    {chat.mode === 'todo' && (
                      <TodoEngine activeChat={chat} currentTheme={currentTheme} palette={palette} isTodoModalOpen={isTodoModalOpen} setIsTodoModalOpen={setIsTodoModalOpen} todoFilter={todoFilter} setTodoFilter={setTodoFilter} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} inputText={inputText} setInputText={setInputText} todoNotes={todoNotes} setTodoNotes={setTodoNotes} todoReminder={todoReminder} setTodoReminder={setTodoReminder} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} onToggleTaskStatus={(id, status) => toggleTaskStatus(id, status, chat.id)} onDeleteTask={(id) => deleteTask(id, chat.id)} onEditTask={(id, updates) => editTask(id, updates, chat.id)} />
                    )}
                    {chat.mode === 'calendar' && (
                      <CalendarEngine activeChat={chat} currentTheme={currentTheme} palette={palette} currentCalendarDate={currentCalendarDate} setCurrentCalendarDate={setCurrentCalendarDate} selectedEventDate={selectedEventDate} setSelectedEventDate={setSelectedEventDate} isDayDetailOpen={isDayDetailOpen} setIsDayDetailOpen={setIsDayDetailOpen} isEventModalOpen={isEventModalOpen} setIsEventModalOpen={setIsEventModalOpen} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} inputText={inputText} setInputText={setInputText} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} onDeleteMessage={(msgId) => deleteCalendarEvent(msgId, chat.id)} onEditMessage={(id, content, catId) => editCalendarEvent(id, content, catId, chat.id)} />
                    )}
                    {chat.mode === 'alarm' && (
                      <AlarmEngine activeChat={chat} currentTheme={currentTheme} onUpdateAlarms={(alarms) => updateAlarms(alarms, chat.id)} />
                    )}
                    {chat.mode === 'call' && (
                      <CallEngine activeChat={chat} currentTheme={currentTheme} onUpdateSettings={(settings) => updateCallSettings(settings, chat.id)} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} />
                    )}
                    {chat.mode === 'news' && (
                      <NewsEngine activeChat={chat} currentTheme={currentTheme} onUpdateMessage={(msgId, updates) => handleUpdateNewsMessage(msgId, updates, chat.id)} onDeleteMessage={(msgId) => handleDeleteMessage(msgId, chat.id)} />
                    )}
                    {chat.mode === 'social' && (
                      <SocialMediaEngine activeChat={chat} currentTheme={currentTheme} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} onDeleteMessage={(msgId) => handleDeleteMessage(msgId, chat.id)} />
                    )}
                    {chat.mode === 'sync' && (
                      <SyncEngine activeChat={chat} currentTheme={currentTheme} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} onCleanup={handleNeuralCleanup} />
                    )}
                    {(!chat.mode || ['chat', 'neural_link'].includes(chat.mode)) && (
                      <ChatEngine activeChat={chat} currentTheme={currentTheme} palette={palette} isTyping={isTyping} inputText={inputText} setInputText={setInputText} isRecording={isRecording} recordingDuration={recordingDuration} audioBlob={audioBlob} holdProgress={holdProgress} lastAssistantMsgIndex={lastAssistantMsgIndex} onSendMessage={(content, type, extra, blob, file) => handleSendMessage(content, type, extra, blob, file, chat.id)} onReaction={(msg, reaction) => handleReaction(msg, reaction, chat.id)} onFileUpload={handleFileUpload} onMicMouseDown={handleMicMouseDown} onMicMouseUp={handleMicMouseUp} onCancelRecording={cancelRecording} onStopRecording={stopRecording} messagesEndRef={messagesEndRef} chatFileInputRef={chatFileInputRef} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Deploy Choice Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsDeployModalOpen(false)} />
          <div className={`relative bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-800 shadow-2xl p-6 sm:p-10 animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto custom-scrollbar ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
            <h3 className={`text-2xl sm:text-3xl font-black italic tracking-tighter mb-8 text-center text-white sticky top-0 bg-slate-900 py-2 z-10 ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}>Protocol Deployment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { mode: 'chat', icon: <MessageSquare size={32} />, label: 'Neural Link', sub: 'Signal Hub', color: 'bg-purple-600' },
                { mode: 'calendar', icon: <CalendarDays size={32} />, label: 'Temporal Node', sub: 'Chronos Grid', color: 'bg-emerald-600' },
                { mode: 'todo', icon: <ListTodo size={32} />, label: 'Task Grid', sub: 'Protocol Sync', color: 'bg-amber-600' },
                { mode: 'blueprint', icon: <FileText size={32} />, label: 'Blueprint Hub', sub: 'Design Codex', color: 'bg-cyan-600' },
                { mode: 'social', icon: <Instagram size={32} />, label: 'Social Grid', sub: 'Content Control', color: 'bg-fuchsia-600' },
                { mode: 'news', icon: <Newspaper size={32} />, label: 'News Feed', sub: 'Article Loop', color: 'bg-emerald-500' },
                { mode: 'sync', icon: <Server size={32} />, label: 'Sync Engine', sub: 'Neural Bridge', color: 'bg-indigo-500' },
                { mode: 'alarm', icon: <AlarmIcon size={32} />, label: 'Alarm Module', sub: 'Clock Grid', color: 'bg-rose-600' },
                { mode: 'call', icon: <Phone size={32} />, label: 'Voice Link', sub: 'Neural Loop', color: 'bg-indigo-600' }
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

      {isSettingsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSettingsModalOpen(false)} />
          <div className={`relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-white ${appStyle === 'cyber' ? 'rounded-none border-indigo-500/50' : ''}`}>
            <h3 className={`text-2xl font-black italic tracking-tighter mb-10 flex items-center gap-3 ${appStyle === 'cyber' ? 'font-mono uppercase glitch-text' : ''}`}><SettingsIcon className={currentTheme.text} /> Parameters</h3>
            <div className="space-y-10">
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

      {isInfoModalOpen && activeChat && (
        <InfoModal 
          isOpen={isInfoModalOpen} 
          onClose={() => setIsInfoModalOpen(false)} 
          activeChat={activeChat} 
          appStyle={appStyle} 
        />
      )}

      <Tutorial 
        activeStep={tutorialStep} 
        onNext={handleNextTutorial} 
        onClose={() => setTutorialStep('completed')}
        targetElementId={
          tutorialStep === 'settings' ? 'tutorial-settings' :
          tutorialStep === 'deploy' ? 'tutorial-deploy' :
          tutorialStep === 'chat_opened' ? 'tutorial-chat-settings' :
          undefined
        }
      />
    </div>
  );
};

export default App;
