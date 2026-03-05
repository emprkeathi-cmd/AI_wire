import React, { useCallback } from 'react';
import { Chat, Alarm, Message, UniversalSignal } from '@/src/types';

export const useAlarmEngine = (
  activeChatId: string | null,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) => {
  const updateAlarms = useCallback((alarms: Alarm[], chatId?: string) => {
    const targetId = chatId || activeChatId;
    setChats(prev => prev.map(c => c.id === targetId ? { ...c, alarms } : c));
  }, [activeChatId, setChats]);

  const processAlarmMessage = useCallback((data: UniversalSignal, raw: string): { additions: Message[], debug: any } | null => {
    if (data.alarm_time || data.timer_duration || data.engine === 'alarm') {
      return {
        additions: [{ id: `iot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, role: 'assistant', content: raw, timestamp: Date.now() }],
        debug: { interpreted: { type: 'iot_signal', ...data } }
      };
    }
    return null;
  }, []);

  return {
    updateAlarms,
    processAlarmMessage,
  };
};
