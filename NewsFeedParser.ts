
import { Message } from './types';

/**
 * Parsers raw JSON data from n8n into a News Feed Post (Message)
 */
export const parseNewsPayload = (data: any): Message | null => {
  // Check if this is a news/post type signal
  if (data.type === 'post' || data.article_type === 'news' || data.news_item) {
    const timestamp = Date.now();
    
    // Extract and return the news message object
    return {
      id: `news-${timestamp}`,
      role: 'assistant',
      type: 'post',
      title: data.title || 'Incoming Signal',
      content: data.text || data.content || '',
      quiz: data.quiz || (data.questions ? data.questions.map((q: any, i: number) => {
        // Build a unique set of options to prevent duplicates
        const rawOptions = q.options || q.answers || [];
        const uniqueOptions = Array.from(new Set([...rawOptions, q.correct_answer].filter(Boolean)));
        
        return {
          id: `q-${timestamp}-${i}`,
          question: q.question,
          options: uniqueOptions,
          correctAnswer: q.correct_answer
        };
      }) : undefined),
      isRead: false,
      timestamp: timestamp
    };
  }
  
  return null;
};
