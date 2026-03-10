import React, { useCallback } from 'react';
import { Chat, Message, UniversalSignal } from '@/src/types';

export const useSocialEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const processSocialMessage = useCallback((data: UniversalSignal): { additions: Message[], debug: any } | null => {
    const isSocial = data.type === 'social_post' || 
                     data.article_type === 'social' || 
                     data.engine === 'social' || 
                     data.type === 'social' ||
                     (data.data && (data.data.type === 'social_post' || data.data.engine === 'social'));

    if (isSocial) {
      const source = data.data || data;
      return {
        additions: [{
          role: 'assistant',
          type: 'social_post',
          title: source.title || source.Title || 'Draft Publication',
          content: source.text || source.content || source.Content || source.body || '',
          assets: source.assets || (source.image ? [source.image] : (source.images ? source.images : [])),
          timestamp: Date.now()
        }],
        debug: { interpreted: { type: 'social_post', title: source.title } }
      };
    }
    return null;
  }, []);
  
  return {
    processSocialMessage,
  };
};
