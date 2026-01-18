export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'audio' | 'file';
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
  webhookUrl: string;
  icon?: string;
  messages: Message[];
  createdAt: number;
}

export interface Settings {
  palette: ThemePalette;
  username: string;
}