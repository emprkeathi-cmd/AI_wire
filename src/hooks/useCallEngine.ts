import React, { useCallback } from 'react';
import { Chat, Message, UniversalSignal } from '@/src/types';

export const useCallEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const updateCallSettings = useCallback((settings: { threshold: number; silenceTimeout: number }, chatId?: string) => {
    const targetId = chatId || activeChatId;
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, callSettings: settings } : c));
  }, [activeChatId, setChats]);

  const processCallMessage = useCallback((data: UniversalSignal, raw: string, chat: Chat): { additions: Message[], debug: any } | null => {
    if ((chat.mode === 'call' || data.engine === 'call') && (data.call === true || data.call === false || data.audio)) {
      return {
        additions: [{ id: `call-signal-${Date.now()}`, role: 'assistant', content: raw, timestamp: Date.now() }],
        debug: { interpreted: { type: 'call_signal', ...data } }
      };
    }
    return null;
  }, []);

  return {
    updateCallSettings,
    processCallMessage,
  };
};
