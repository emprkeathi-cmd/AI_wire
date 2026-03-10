import React, { useCallback } from 'react';
import { Chat, Message, UniversalSignal } from '@/src/types';

export const useNewsEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const handleUpdateNewsMessage = useCallback((timestamp: number, updates: Partial<Message>, chatId?: string) => {
    const targetId = chatId || activeChatId;
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.timestamp === timestamp ? { ...m, ...updates } : m) } : c));
  }, [activeChatId, setChats]);

  const processNewsMessage = useCallback((data: UniversalSignal): { additions: Message[], debug: any } | null => {
    const isNews = data.type === 'post' || 
                   data.type === 'news' || 
                   data.article_type === 'news' || 
                   data.engine === 'news' ||
                   (data.data && (data.data.type === 'post' || data.data.type === 'news' || data.data.engine === 'news'));
    
    if (isNews) {
      const source = data.data || data;
      const rawQuiz = source.quiz || source.questions || source.Questions;
      const processedQuiz = (rawQuiz && Array.isArray(rawQuiz)) ? rawQuiz.map((q: any, i: number) => {
        const options = q.options || q.answers || q.Options || q.Answers || [];
        const correctAnswer = q.correct_answer || q.correctAnswer || q.CorrectAnswer;
        
        if (correctAnswer && !options.includes(correctAnswer)) {
          options.push(correctAnswer);
        }

        return {
          id: q.id || `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`,
          question: q.question || q.Question || '',
          options: options,
          correctAnswer: correctAnswer,
          isLocked: false
        };
      }) : undefined;

      return {
        additions: [{
          role: 'assistant',
          type: 'post',
          title: source.title || source.Title || 'Incoming Signal',
          content: source.text || source.content || source.Content || source.body || '',
          quiz: processedQuiz,
          isRead: false,
          timestamp: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`)
        }],
        debug: { interpreted: { type: 'news_post', title: source.title } }
      };
    }
    return null;
  }, []);

  return {
    handleUpdateNewsMessage,
    processNewsMessage,
  };
};
