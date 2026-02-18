
export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  title?: string; // For blueprints
  assets?: string[]; // For blueprints (base64 or URLs)
  type?: 'text' | 'audio' | 'file' | 'event' | 'reaction' | 'task' | 'blueprint';
  date?: string; // YYYY-MM-DD
  categoryId?: string; // Links to a category for events or tasks
  timestamp: number;
  reacted?: boolean;
  
  // Todo specific
  todoStatus?: 'active' | 'done' | 'deleted';
  todoReminder?: boolean;
  todoNotes?: string;

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
  mode: 'chat' | 'calendar' | 'todo' | 'blueprint';
  webhookUrl: string;
  receiverId: string;
  icon?: string;
  messages: Message[];
  categories: Category[]; // Categories for calendar events or todo tasks
  createdAt: number;
}

export interface Settings {
  palette: ThemePalette;
  style: AppStyle;
  username: string;
}
