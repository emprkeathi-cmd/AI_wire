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

  const processAlarmMessage = useCallback((data: UniversalSignal, raw: string): { additions: Message[], alarms?: Alarm[], debug: any } | null => {
    const source = data.data || data;
    const isAlarm = source.alarm_time || source.timer_duration || source.engine === 'alarm' || data.engine === 'alarm';

    if (isAlarm) {
      const additions: Message[] = [{ role: 'assistant', content: raw, timestamp: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`) }];
      const alarms: Alarm[] = [];

      if (source.alarm_time) {
        alarms.push({
          timestamp: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`),
          time: source.alarm_time,
          date: source.alarm_date,
          label: source.alarm_label || 'Remote Protocol',
          isActive: source.activate_alarm !== false
        });
      }

      return {
        additions,
        alarms: alarms.length > 0 ? alarms : undefined,
        debug: { interpreted: { type: 'iot_signal', ...source } }
      };
    }
    return null;
  }, []);

  return {
    updateAlarms,
    processAlarmMessage,
  };
};
