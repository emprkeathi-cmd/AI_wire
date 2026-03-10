import React, { useState, useCallback } from 'react';
import { Chat, Category, Message } from '@/src/types';
import { sendMessageToN8N } from '@/services/n8nService';

export const useBlueprintEngine = (
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  activeChatId: string | null,
  setActiveChatId: React.Dispatch<React.SetStateAction<string | null>>,
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  const createNewAgent = useCallback((mode: 'chat' | 'calendar' | 'todo' | 'blueprint' | 'alarm' | 'call' | 'news' | 'social' | 'sync') => {
    const newId = Date.now().toString();
    const categories: Category[] = mode === 'todo' ? [{ id: 't1', name: 'Important', color: '#EF4444' }, { id: 't2', name: 'Today', color: '#FBBF24' }, { id: 't3', name: 'Coming up', color: '#10B981' }, { id: 't4', name: 'Goals', color: '#A855F7' }] : [{ id: '1', name: 'Obligations', color: '#F87171' }, { id: '2', name: 'Social Engagements', color: '#60A5FA' }, { id: '3', name: 'Administrative Tasks', color: '#FBBF24' }, { id: '4', name: 'Personal Development', color: '#34D399' }, { id: '5', name: 'Logistics', color: '#A78BFA' }];
    const modeNames = { chat: 'Neural Link', calendar: 'Temporal Node', todo: 'Task Grid', blueprint: 'Blueprint Hub', alarm: 'Alarm Module', call: 'Voice Loop', news: 'News Feed', social: 'Social Grid', sync: 'Sync Engine' };
    const newChat: Chat = { 
      id: newId, 
      name: `${modeNames[mode]} ${chats.filter(c => c.mode === mode).length + 1}`, 
      mode, 
      webhookUrl: '', 
      receiverId: `ai_wire_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`, 
      categories, 
      messages: [{ role: 'system', content: `Protocol active. ${mode.toUpperCase()} node initialized.`, timestamp: Date.now() }], 
      createdAt: Date.now(), 
      alarms: [],
      callSettings: mode === 'call' ? { threshold: 45, silenceTimeout: 1500 } : undefined
    };
    setChats([newChat, ...chats]); 
    setActiveChatId(newId); 
    setIsDeployModalOpen(false); 
    setIsSidebarOpen(false);
  }, [chats, setChats, setActiveChatId, setIsSidebarOpen]);

  const handleUpdateBlueprint = useCallback((msgTimestamp: number, newContent: string, chatId?: string) => { 
    const targetId = chatId || activeChatId;
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.timestamp === msgTimestamp ? { ...m, content: newContent } : m) } : c)); 
  }, [activeChatId, setChats]);

  const handleDeleteMessage = useCallback(async (msgTimestamp: number, chatId?: string) => { 
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const message = targetChat.messages.find(m => m.timestamp === msgTimestamp);
    
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.filter(m => m.timestamp !== msgTimestamp) } : c)); 

    if (targetChat.webhookUrl && message && (message.type === 'task' || message.type === 'event')) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, message.content, `${message.type}_update`, {
          timestamp: message.timestamp,
          action: 'delete'
        });
      } catch (err) {
        console.error(`Failed to sync ${message.type} deletion to n8n:`, err);
      }
    }
  }, [activeChatId, setChats, chats]);

  const processBlueprintMessage = useCallback((data: any): { additions: Message[], debug: any } | null => {
    if (data.type === 'blueprint' || data.sync_type === 'full_recreation_payload') {
      return {
        additions: [{ 
          role: 'assistant', 
          type: 'blueprint',
          title: data.title || 'Reconstructed Protocol',
          content: data.content || data.message || '',
          assets: data.assets || [],
          timestamp: Date.now() 
        }],
        debug: { interpreted: { type: 'blueprint_sync', title: data.title } }
      };
    }
    return null;
  }, []);

  return {
    isDeployModalOpen,
    setIsDeployModalOpen,
    createNewAgent,
    handleUpdateBlueprint,
    handleDeleteMessage,
    processBlueprintMessage,
  };
};
