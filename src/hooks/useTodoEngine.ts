import React, { useState, useCallback } from 'react';
import { Chat, Message } from '@/src/types';
import { sendMessageToN8N } from '@/services/n8nService';

export const useTodoEngine = (
  chats: Chat[],
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const [todoNotes, setTodoNotes] = useState('');
  const [todoReminder, setTodoReminder] = useState(false);
  const [todoFilter, setTodoFilter] = useState<'ALL' | 'Active' | 'Done' | 'Deleted'>('Active');
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);

  const toggleTaskStatus = useCallback(async (id: string, currentStatus: 'active' | 'done' | 'deleted', chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const nextStatus = currentStatus === 'active' ? 'done' : 'active';
    const task = targetChat.messages.find(m => m.id === id);
    
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, todoStatus: nextStatus } : m) } : c));
    
    if (targetChat.webhookUrl && task) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, task.content, 'task_update', {
          todoStatus: nextStatus,
          categoryId: task.categoryId,
          categoryName: targetChat.categories.find(c => c.id === task.categoryId)?.name,
          command: 'toggle_status'
        });
      } catch (err) {
        console.error('Failed to sync task status to n8n:', err);
      }
    }

    if (navigator.vibrate) navigator.vibrate(20);
  }, [activeChatId, setChats, chats]);

  const deleteTask = useCallback(async (id: string, chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const task = targetChat.messages.find(m => m.id === id);

    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, todoStatus: 'deleted' } : m) } : c));

    if (targetChat.webhookUrl && task) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, task.content, 'task_update', {
          todoStatus: 'deleted',
          command: 'delete'
        });
      } catch (err) {
        console.error('Failed to sync task deletion to n8n:', err);
      }
    }
  }, [activeChatId, setChats, chats]);

  const editTask = useCallback(async (id: string, updates: any, chatId?: string) => {
    const targetId = chatId || activeChatId;
    const targetChat = chats.find(c => c.id === targetId);
    if (!targetChat) return;

    const task = targetChat.messages.find(m => m.id === id);

    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === id ? { ...m, ...updates } : m) } : c));

    if (targetChat.webhookUrl && task) {
      try {
        await sendMessageToN8N(targetChat.webhookUrl, updates.content || task.content, 'task_update', {
          ...updates,
          command: 'edit'
        });
      } catch (err) {
        console.error('Failed to sync task edit to n8n:', err);
      }
    }
  }, [activeChatId, setChats, chats]);

  const processTodoMessage = useCallback((raw: string, chat: Chat, findCategory: (str: string) => any): { additions: Message[], deletions: any[], updates: any[], debug: any } | null => {
    if (chat.mode !== 'todo') return null;
    
    let jsonData: any = null;
    try { jsonData = JSON.parse(raw); } catch (e) { return null; }
    
    if (jsonData && typeof jsonData === 'object') {
      const cmd = (jsonData.command || jsonData.WHAT || jsonData.what || '').toLowerCase();
      const catName = jsonData.category || jsonData.Category;
      const cat = findCategory(catName);
      const title = jsonData.title || jsonData.Title || jsonData.content || jsonData.Content || jsonData.appointment || jsonData.Appointment;
      
      if (cat && title) {
        if (cmd === 'save' || cmd === 'create') {
          return {
            additions: [{ id: `todo-j-${Date.now()}`, role: 'assistant', type: 'task', content: String(title), categoryId: cat.id, todoStatus: 'active', todoReminder: jsonData.reminder === 'positive' || jsonData.reminder === true, todoNotes: String(jsonData.notes || ''), timestamp: Date.now() }],
            deletions: [],
            updates: [],
            debug: { interpreted: { type: 'todo_json_save', category: cat.name, title } }
          };
        } else if (cmd === 'delete') {
          return {
            additions: [],
            deletions: [{ content: String(title), categoryId: cat.id, mode: 'todo', newStatus: 'deleted' }],
            updates: [],
            debug: { interpreted: { type: 'todo_json_delete', category: cat.name, title } }
          };
        } else if (cmd === 'done' || cmd === 'complete') {
          return {
            additions: [],
            deletions: [{ content: String(title), categoryId: cat.id, mode: 'todo', newStatus: 'done' }],
            updates: [],
            debug: { interpreted: { type: 'todo_json_done', category: cat.name, title } }
          };
        } else if (cmd === 'edit' || cmd === 'update') {
          return {
            additions: [],
            deletions: [],
            updates: [{ content: String(title), categoryId: cat.id, todoReminder: jsonData.reminder === 'positive' || jsonData.reminder === true, todoNotes: String(jsonData.notes || '') }],
            debug: { interpreted: { type: 'todo_json_edit', category: cat.name, title } }
          };
        }
      }
    }
    return null;
  }, []);

  return {
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
  };
};
