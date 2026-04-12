import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Chat, Message } from '@/src/types';
import { sendMessageToN8N } from '@/services/n8nService';

export const useChatEngine = (
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  activeChat: Chat | undefined,
  activeChatId: string | null,
  inputText: string,
  setInputText: (val: string) => void,
  setTodoNotes: (val: string) => void,
  setTodoReminder: (val: boolean) => void,
  setIsEventModalOpen: (val: boolean) => void,
  setIsTodoModalOpen: (val: boolean) => void,
) => {
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const longPressTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const lastAssistantMsgIndex = useMemo(() => {
    if (!activeChat) return -1;
    for (let i = activeChat.messages.length - 1; i >= 0; i--) {
      if (activeChat.messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [activeChat?.messages]);

  const handleSendMessage = useCallback(async (content?: string, type: any = 'text', extra?: any, blobToUse?: Blob, fileToUse?: File, chatId?: string) => {
    const targetChat = chatId ? chats.find(c => c.id === chatId) : activeChat;
    if (!targetChat) return;
    const targetId = targetChat.id;
    
    const finalType = (targetChat.mode === 'calendar' && type === 'text') ? 'event' : (targetChat.mode === 'todo' && type === 'text') ? 'task' : type;
    const messageContent = content || (targetId === activeChatId ? inputText : '');
    const finalBlob = blobToUse || (targetId === activeChatId ? audioBlob : null);
    if (!messageContent && !finalBlob && finalType !== 'file' && !fileToUse && finalType !== 'blueprint' && finalType !== 'reaction') return;

    const getTodayLocalDateStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const userMessage: Message = {
      role: 'user',
      content: finalType === 'audio' ? 'Voice Message' : finalType === 'file' ? (fileToUse?.name || String(messageContent)) : String(messageContent),
      type: finalType,
      title: extra?.title,
      assets: extra?.assets,
      date: extra?.date || (targetChat.mode === 'calendar' ? getTodayLocalDateStr() : undefined),
      categoryId: extra?.categoryId || (targetChat.mode !== 'chat' && targetChat.mode !== 'blueprint' && targetChat.mode !== 'alarm' && targetChat.mode !== 'call' ? targetChat.categories[0]?.id : undefined),
      timestamp: Date.now(),
      todoStatus: targetChat.mode === 'todo' ? 'active' : undefined,
      todoReminder: extra?.todoReminder,
      todoNotes: extra?.todoNotes,
      feedback: extra?.comment || extra?.feedback,
    };

    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: [...c.messages, userMessage] } : c));
    if (targetId === activeChatId) {
      if (type !== 'blueprint' && type !== 'reaction') { setInputText(''); setTodoNotes(''); setTodoReminder(false); }
      setIsEventModalOpen(false);
      setIsTodoModalOpen(false);
    }

    if (targetChat?.webhookUrl) {
      setIsTyping(true);
      try {
        let payload: string | Blob = messageContent;
        let metadata: any = { ...extra };
        if (finalType === 'audio') payload = finalBlob!;
        else if (finalType === 'file' && fileToUse) { payload = fileToUse.name; metadata = { ...metadata, files: [{ blob: fileToUse, name: fileToUse.name }] }; }
        else if (finalType === 'event') metadata = { ...metadata, command: 'create', date: userMessage.date, categoryId: userMessage.categoryId, categoryName: targetChat.categories.find(c => c.id === userMessage.categoryId)?.name };
        else if (finalType === 'task') metadata = { ...metadata, command: 'create', todoStatus: userMessage.todoStatus, todoReminder: userMessage.todoReminder, todoNotes: userMessage.todoNotes, categoryId: userMessage.categoryId, categoryName: targetChat.categories.find(c => c.id === userMessage.categoryId)?.name };
        else if (finalType === 'blueprint') metadata = { ...metadata, title: extra.title, assets: extra.assets };
        const response = await sendMessageToN8N(targetChat.webhookUrl, payload, finalType, metadata);
        const assistantMessage: Message = { role: 'assistant', content: response, timestamp: Date.now() + 1 };
        setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: [...c.messages, assistantMessage] } : c));
      } catch (err) { console.error(err); } finally { setIsTyping(false); }
    }
  }, [chats, activeChat, activeChatId, inputText, audioBlob, setChats, setInputText, setTodoNotes, setTodoReminder, setIsEventModalOpen, setIsTodoModalOpen]);

  const handleReaction = useCallback(async (message: Message, reaction: string, chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;
    
    // Find the user message that preceded this assistant message for context
    let userContext = '';
    if (message.role === 'assistant') {
      const msgIndex = targetChat.messages.findIndex(m => m.timestamp === message.timestamp);
      if (msgIndex > 0) {
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (targetChat.messages[i].role === 'user') {
            userContext = targetChat.messages[i].content;
            break;
          }
        }
      }
    }

    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.timestamp === message.timestamp ? { ...m, reacted: true } : m) } : c));
    
    if (targetChat.webhookUrl) {
      try { 
        await sendMessageToN8N(targetChat.webhookUrl, reaction, 'reaction', { 
          originalContent: message.content,
          userContext: userContext,
          timestamp: Date.now()
        }); 
        if (navigator.vibrate) navigator.vibrate(30); 
      } catch (err) { 
        console.error(err); 
      }
    }
  }, [chats, activeChatId, setChats]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => { 
    const files = e.target.files; 
    if (!files || files.length === 0) return; 
    await handleSendMessage(files[0].name, 'file', undefined, undefined, files[0]); 
    if (chatFileInputRef.current) chatFileInputRef.current.value = ''; 
  }, [handleSendMessage]);

  const startRecording = useCallback(async () => {
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
  }, []);

  const stopRecording = useCallback((shouldSend = false) => {
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
  }, [handleSendMessage]);

  const handleMicMouseDown = useCallback(() => { 
    setHoldProgress(1); 
    const step = 100 / (1300 / 10); 
    holdIntervalRef.current = window.setInterval(() => setHoldProgress(prev => (prev + step > 100 ? 100 : prev + step)), 10); 
    longPressTimerRef.current = window.setTimeout(() => { clearInterval(holdIntervalRef.current!); setHoldProgress(0); startRecording(); }, 1300); 
  }, [startRecording]);

  const handleMicMouseUp = useCallback(() => { 
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); 
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current); 
    setHoldProgress(0); 
    if (isRecording) stopRecording(true); 
  }, [isRecording, stopRecording]);

  const cancelRecording = useCallback(() => { 
    if (isRecording) stopRecording(false); 
    setAudioBlob(null); 
  }, [isRecording, stopRecording]);

  return {
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
  };
};
