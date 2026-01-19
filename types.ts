export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  // Added 'reaction' to the type union to support reaction signal messages
  type?: 'text' | 'audio' | 'file' | 'event' | 'reaction';
  date?: string; // YYYY-MM-DD
  categoryId?: string; // Links to a category for events
  timestamp: number;
  reacted?: boolean;
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}

export type ThemePalette = 'purple' | 'emerald' | 'amber' | 'rose' | 'cyan';

export interface Chat {
  id: string;
  name: string;
  mode: 'chat' | 'calendar';
  webhookUrl: string;
  receiverId: string;
  icon?: string;
  messages: Message[];
  categories: Category[]; // Categories for calendar events
  createdAt: number;
}

export interface Settings {
  palette: ThemePalette;
  username: string;
}