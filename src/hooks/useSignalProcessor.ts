import { useCallback } from 'react';
import { Chat, Message, UniversalSignal, Alarm } from '@/src/types';

export const useSignalProcessor = (
  processSocialMessage: (data: UniversalSignal) => any,
  processNewsMessage: (data: UniversalSignal) => any,
  processSyncMessage: (data: UniversalSignal) => any,
  processBlueprintMessage: (data: UniversalSignal) => any,
  processAlarmMessage: (data: UniversalSignal, raw: string) => any,
  processCallMessage: (data: UniversalSignal, raw: string, chat: Chat) => any,
  processTodoMessage: (raw: string, chat: Chat, findCategory: (str: string) => any) => any,
  processCalendarMessage: (raw: string, chat: Chat, dateStr: string, parseDate: (input: string) => any, findCategory: (str: string) => any, debugInfo: any) => any
) => {
  const normalizeString = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');

  const processDoorMessage = useCallback((raw: string, chat: Chat): { additions: Message[], deletions: any[], updates: any[], alarms?: Alarm[], debug: any } => {
    const additions: Message[] = [];
    const deletions: any[] = [];
    const updates: any[] = [];
    let alarms: Alarm[] | undefined = undefined;
    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let dateStr = getLocalDateStr(new Date());
    let debugInfo: any = { raw };

    const parseDate = (input: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
      try {
        const d = new Date(input);
        if (!isNaN(d.getTime())) return getLocalDateStr(d);
      } catch (e) {}
      return null;
    };

    const findCategory = (str: string) => {
      const norm = normalizeString(str);
      return chat.categories.find(c => normalizeString(c.name) === norm);
    };

    // Global Neural Switch
    try {
      const data = JSON.parse(raw);
      
      const socialResult = processSocialMessage(data);
      if (socialResult) return { ...socialResult, deletions: [], updates: [] };

      const newsResult = processNewsMessage(data);
      if (newsResult) return { ...newsResult, deletions: [], updates: [] };

      const syncResult = processSyncMessage(data);
      if (syncResult) return { ...syncResult, deletions: [], updates: [] };

      const blueprintResult = processBlueprintMessage(data);
      if (blueprintResult) return { ...blueprintResult, deletions: [], updates: [] };

      const alarmResult = processAlarmMessage(data, raw);
      if (alarmResult) return { ...alarmResult, deletions: [], updates: [], alarms: alarmResult.alarms };

      const callResult = processCallMessage(data, raw, chat);
      if (callResult) return { ...callResult, deletions: [], updates: [] };
    } catch (e) {}

    const todoResult = processTodoMessage(raw, chat, findCategory);
    if (todoResult) return { ...todoResult, alarms: undefined };

    const calendarResult = processCalendarMessage(raw, chat, dateStr, parseDate, findCategory, debugInfo);
    if (calendarResult) return { ...calendarResult, alarms: undefined };

    if (additions.length === 0 && deletions.length === 0 && updates.length === 0 && raw.trim().length > 0) {
      additions.push({ role: 'assistant', content: raw, timestamp: Date.now() });
    }
    return { additions, deletions, updates, alarms, debug: debugInfo };
  }, [processSocialMessage, processNewsMessage, processSyncMessage, processBlueprintMessage, processAlarmMessage, processCallMessage, processTodoMessage, processCalendarMessage]);

  return { processDoorMessage };
};
