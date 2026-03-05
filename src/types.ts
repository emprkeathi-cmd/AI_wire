export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Alarm {
  id: string;
  time: string; // HH:MM
  date?: string; // YYYY-MM-DD (Optional)
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
  feedback?: string;

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
  mode: 'chat' | 'calendar' | 'todo' | 'blueprint' | 'alarm' | 'call' | 'news' | 'social' | 'sync';
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

export interface UniversalSignal {
  nodeId?: string;
  engine?: string;
  action?: string;
  data?: {
    title?: string;
    content?: string;
    category?: string;
    date?: string;
    assets?: string[];
    [key: string]: any;
  };
  // Legacy/Fuzzy fields
  type?: string;
  article_type?: string;
  sync_type?: string;
  alarm_time?: string;
  timer_duration?: string;
  call?: boolean;
  audio?: any;
  command?: string;
  WHAT?: string;
  what?: string;
  [key: string]: any;
}

export interface SignalLog {
  id: string;
  timestamp: number;
  type: 'inbound' | 'outbound';
  nodeId?: string;
  nodeName?: string;
  engine?: string;
  action?: string;
  raw: string;
  status: 'success' | 'error' | 'pending';
}

export interface Settings {
  palette: ThemePalette;
  style: AppStyle;
  username: string;
  globalReceiverId: string;
  signalLogs: SignalLog[];
}
