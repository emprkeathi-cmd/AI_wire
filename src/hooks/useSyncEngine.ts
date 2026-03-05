import React, { useCallback } from 'react';
import { Message, Chat, UniversalSignal } from '@/src/types';
import { cleanAllChats } from '@/services/NeuralCleaner';

export const useSyncEngine = (
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const handleNeuralCleanup = useCallback(() => {
    setChats(prev => cleanAllChats(prev));
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }, [setChats]);

  const processSyncMessage = useCallback((data: UniversalSignal): { additions: Message[], debug: any } | null => {
    if (data.type === 'sync_update' || data.engine === 'sync') {
      return {
        additions: [{
          id: `sync-${Date.now()}`,
          role: 'assistant',
          content: data.content || data.text || '',
          timestamp: Date.now()
        }],
        debug: { interpreted: { type: 'sync_update' } }
      };
    }
    return null;
  }, []);

  return {
    handleNeuralCleanup,
    processSyncMessage,
  };
};
