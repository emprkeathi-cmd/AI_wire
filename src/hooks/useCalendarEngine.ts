import React, { useState, useCallback } from 'react';
import { Chat, Message } from '@/src/types';
import { sendMessageToN8N } from '@/services/n8nService';

export const useCalendarEngine = (
  chats: Chat[],
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const editCalendarEvent = useCallback(async (timestamp: number, newContent: string, newCategoryId: string, chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const event = targetChat.messages.find(m => m.timestamp === timestamp);

    setChats(prev => prev.map(c => c.id === targetId ? { 
      ...c, 
      messages: c.messages.map(m => m.timestamp === timestamp ? { ...m, content: newContent, categoryId: newCategoryId } : m) 
    } : c));

    if (targetChat.webhookUrl && event) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, newContent, 'event_update', {
          content: newContent,
          categoryId: newCategoryId,
          categoryName: targetChat.categories.find(c => c.id === newCategoryId)?.name,
          date: event.date,
          command: 'edit'
        });
      } catch (err) {
        console.error('Failed to sync event edit to n8n:', err);
      }
    }
  }, [activeChatId, setChats, chats]);

  const deleteCalendarEvent = useCallback(async (timestamp: number, chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const event = targetChat.messages.find(m => m.timestamp === timestamp);

    setChats(prev => prev.map(c => c.id === targetId ? { 
      ...c, 
      messages: c.messages.filter(m => m.timestamp !== timestamp) 
    } : c));

    if (targetChat.webhookUrl && event) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, event.content, 'event_update', {
          command: 'delete'
        });
      } catch (err) {
        console.error('Failed to sync event deletion to n8n:', err);
      }
    }
  }, [activeChatId, setChats, chats]);

  const processCalendarMessage = useCallback((
    raw: string, 
    chat: Chat, 
    dateStr: string, 
    parseDate: (input: string) => string | null, 
    findCategory: (str: string) => any,
    debugInfo: any
  ): { additions: Message[], deletions: any[], updates: any[], debug: any } | null => {
    let currentDateStr = dateStr;
    const additions: Message[] = [];
    const deletions: any[] = [];
    const updates: any[] = [];

    let data: any = null;
    try { 
      data = JSON.parse(raw); 
    } catch (e) {
      if (raw.includes('|')) {
        const parts = raw.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          const potentialDate = parseDate(parts[0]);
          const potentialCat = findCategory(parts[1]);
          if (potentialDate && potentialCat) {
            return {
              additions: [{ role: 'assistant', content: parts.slice(2).join('|').trim(), date: potentialDate, categoryId: potentialCat.id, type: 'event', timestamp: Date.now() }],
              deletions: [],
              updates: [],
              debug: { ...debugInfo, interpreted: { type: 'separator_format', category: potentialCat.name, date: potentialDate } }
            };
          }
        }
      }
    }

    if (data && typeof data === 'object') {
      const action = String(data.command || '').toLowerCase();
      if (action !== 'create' && action !== 'delete') return null;

      const explicitDate = data.Date || data.date;
      if (explicitDate) currentDateStr = parseDate(String(explicitDate)) || currentDateStr;
      const explicitCatValue = data.Category || data.category || data.Classification || data.classification;
      const explicitContent = data.Appointment || data.appointment || data.Content || data.content || data.Text || data.text;
      
      if (explicitCatValue && explicitContent) {
        const cat = findCategory(String(explicitCatValue));
        if (cat) {
          if (action === 'delete') {
            return {
              additions: [],
              deletions: [{ content: String(explicitContent), date: currentDateStr, categoryId: cat.id, newStatus: 'deleted' }],
              updates: [],
              debug: { ...debugInfo, interpreted: { type: 'calendar_json_delete', category: cat.name, date: currentDateStr } }
            };
          } else if (action === 'create') {
            return {
              additions: [{ 
                role: 'assistant', 
                content: String(explicitContent), 
                date: currentDateStr, 
                categoryId: cat.id, 
                type: 'event', 
                timestamp: Date.now() + Math.floor(Math.random() * 1000) 
              }],
              deletions: [],
              updates: [],
              debug: { ...debugInfo, interpreted: { type: 'calendar_json_create', category: cat.name, date: currentDateStr } }
            };
          }
        }
      }
    }
    return null;
  }, []);

  return {
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
  };
};
