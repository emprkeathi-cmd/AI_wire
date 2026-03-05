import React, { useCallback } from 'react';
import { Chat, Message, UniversalSignal } from '@/src/types';

export const useNewsEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const handleUpdateNewsMessage = useCallback((msgId: string, updates: Partial<Message>, chatId?: string) => {
    const targetId = chatId || activeChatId;
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, ...updates } : m) } : c));
  }, [activeChatId, setChats]);

  const processNewsMessage = useCallback((data: UniversalSignal): { additions: Message[], debug: any } | null => {
    // Fuse type/article_type/engine into a single check
    const isNews = data.type === 'post' || data.type === 'news' || data.article_type === 'news' || data.engine === 'news';
    
    if (isNews) {
      const rawQuiz = data.quiz || data.questions;
      const processedQuiz = rawQuiz ? rawQuiz.map((q: any, i: number) => {
        // Support 'answers' as alias for 'options'
        const options = q.options || q.answers || [];
        const correctAnswer = q.correct_answer || q.correctAnswer;
        
        // Ensure correct answer is in options if not already there
        if (correctAnswer && !options.includes(correctAnswer)) {
          options.push(correctAnswer);
        }

        return {
          id: q.id || `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`,
          question: q.question,
          options: options,
          correctAnswer: correctAnswer
        };
      }) : undefined;

      return {
        additions: [{
          // Fix ID collision by adding random suffix
          id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          type: 'post',
          title: data.title || 'Incoming Signal',
          content: data.text || data.content || '',
          quiz: processedQuiz,
          isRead: false,
          timestamp: Date.now()
        }],
        debug: { interpreted: { type: 'news_post', title: data.title } }
      };
    }
    return null;
  }, []);

  return {
    handleUpdateNewsMessage,
    processNewsMessage,
  };
};
