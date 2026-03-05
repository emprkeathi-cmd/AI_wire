import React, { useCallback } from 'react';
import { Chat, Message, UniversalSignal } from '@/src/types';

export const useSocialEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const processSocialMessage = useCallback((data: UniversalSignal): { additions: Message[], debug: any } | null => {
    if (data.type === 'social_post' || data.article_type === 'social' || data.engine === 'social') {
      return {
        additions: [{
          id: `social-${Date.now()}`,
          role: 'assistant',
          type: 'social_post',
          title: data.title || 'Draft Publication',
          content: data.text || data.content || '',
          assets: data.assets || (data.image ? [data.image] : []),
          timestamp: Date.now()
        }],
        debug: { interpreted: { type: 'social_post', title: data.title } }
      };
    }
    return null;
  }, []);
  
  return {
    processSocialMessage,
  };
};
