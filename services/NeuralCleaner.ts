import { Chat, Message } from '@/src/types';

/**
 * Neural Cleaner Utility
 * Responsible for identifying and removing duplicate signals across nodes.
 */

const normalize = (s: string) => s.toLowerCase().trim().replace(/[\s_]/g, '');

export const deduplicateNodeMessages = (messages: Message[], mode: string): Message[] => {
  const seen = new Set<string>();
  
  // We process from newest to oldest to keep the most recent version if there are slight differences
  // but usually we just want to keep the first one we find in the original order.
  // Actually, let's keep the original order (oldest first) but filter out subsequent duplicates.
  
  return messages.filter(msg => {
    // System messages are never duplicates
    if (msg.role === 'system') return true;
    
    let key = '';
    const content = normalize(msg.content);
    const catId = msg.categoryId || 'none';

    if (mode === 'calendar' && msg.type === 'event') {
      const date = msg.date || 'no-date';
      // Key: mode + date + category + content
      key = `cal|${date}|${catId}|${content}`;
    } else if (mode === 'todo' && msg.type === 'task') {
      const notes = normalize(msg.todoNotes || '');
      // Key: mode + category + content + notes
      key = `todo|${catId}|${content}|${notes}`;
    } else if (mode === 'news' || mode === 'social') {
      const title = normalize(msg.title || '');
      key = `${mode}|${title}|${content}`;
    } else {
      // For other modes, we don't strictly deduplicate unless requested
      return true;
    }

    if (seen.has(key)) {
      console.log(`[Neural Cleaner] Removing duplicate: ${key}`);
      return false;
    }
    
    seen.add(key);
    return true;
  });
};

export const cleanAllChats = (chats: Chat[]): Chat[] => {
  return chats.map(chat => ({
    ...chat,
    messages: deduplicateNodeMessages(chat.messages, chat.mode)
  }));
};
