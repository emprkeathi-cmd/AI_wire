export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Alarm {
  id: string;
  time: string; // HH:MM
  label: string;
  isActive: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  title?: string;
  assets?: string[];
  type?: 'text' | 'audio' | 'file' | 'event' | 'reaction' | 'task' | 'blueprint' | 'alarm' | 'timer' | 'call' | 'post' | 'social_post';
  date?: string;
  categoryId?: string;
  timestamp: number;
  reacted?: boolean;
  
  // Todo specific
  todoStatus?: 'active' | 'done' | 'deleted';
  todoReminder?: boolean;
  todoNotes?: string;

  // News specific
  isRead?: boolean;
  quiz?: QuizQuestion[];

  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}

export type ThemePalette = 'purple' | 'emerald' | 'amber' | 'rose' | 'cyan';
export type AppStyle = 'sleek' | 'cyber';

export interface Chat {
  id: string;
  name: string;
  mode: 'chat' | 'calendar' | 'todo' | 'blueprint' | 'alarm' | 'call' | 'news' | 'social';
  webhookUrl: string;
  receiverId: string;
  icon?: string;
  messages: Message[];
  categories: Category[];
  alarms?: Alarm[];
  callSettings?: {
    threshold: number;
    silenceTimeout: number;
  };
  createdAt: number;
}

export interface Settings {
  palette: ThemePalette;
  style: AppStyle;
  username: string;
}