import React, { useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, X, Activity, Trash2
} from 'lucide-react';
import { Chat, Message, ThemePalette } from './types';

interface CalendarEngineProps {
  activeChat: Chat;
  currentTheme: any;
  palette: ThemePalette;
  currentCalendarDate: Date;
  setCurrentCalendarDate: (d: Date) => void;
  selectedEventDate: string | null;
  setSelectedEventDate: (s: string | null) => void;
  isDayDetailOpen: boolean;
  setIsDayDetailOpen: (b: boolean) => void;
  isEventModalOpen: boolean;
  setIsEventModalOpen: (b: boolean) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (s: string | null) => void;
  inputText: string;
  setInputText: (s: string) => void;
  onSendMessage: (content?: string, type?: any, extra?: any) => void;
  onDeleteMessage: (id: string) => void;
}

export const CalendarEngine: React.FC<CalendarEngineProps> = (props) => {
  const {
    activeChat, currentTheme, palette, currentCalendarDate, setCurrentCalendarDate,
    selectedEventDate, setSelectedEventDate, isDayDetailOpen, setIsDayDetailOpen,
    isEventModalOpen, setIsEventModalOpen, selectedCategoryId, setSelectedCategoryId,
    inputText, setInputText, onSendMessage, onDeleteMessage
  } = props;

  const calendarData = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentCalendarDate]);

  const getEventsForDay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return activeChat.messages.filter(m => m.date === dateStr);
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 w-full overflow-y-auto h-full p-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">{currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
          <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
            <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1)))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentCalendarDate(new Date())} className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Today</button>
            <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1)))} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest pb-4">{d}</div>
        ))}
        {calendarData.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[120px]" />;
          const today = new Date();
          today.setHours(0,0,0,0);
          const isPast = day < today;
          const isToday = day.getTime() === today.getTime();
          const events = getEventsForDay(day);
          return (
            <div 
              key={day.toISOString()} 
              onClick={() => { 
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, '0');
                const date = String(day.getDate()).padStart(2, '0');
                setSelectedEventDate(`${year}-${month}-${date}`); 
                setIsDayDetailOpen(true); 
              }}
              className={`relative group min-h-[130px] p-3 rounded-2xl border transition-all cursor-pointer overflow-hidden ${isToday ? `bg-gradient-to-br ${currentTheme.from}/10 ${currentTheme.to}/5 border-${palette}-500/50 ring-1 ring-${palette}-500/20` : 'bg-slate-900 border-slate-800/50 hover:bg-slate-800/80'}`}
            >
              {isPast && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30">
                  <div className="w-[150%] h-[2px] bg-red-600 rotate-45 shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
                </div>
              )}
              <div className="flex justify-between items-start mb-2 relative z-10">
                 <span className={`text-xs font-black ${isToday ? currentTheme.text : 'text-slate-400'}`}>{day.getDate()}</span>
                 <button 
                   onClick={(e) => { 
                     e.stopPropagation(); 
                     const year = day.getFullYear();
                     const month = String(day.getMonth() + 1).padStart(2, '0');
                     const date = String(day.getDate()).padStart(2, '0');
                     setSelectedEventDate(`${year}-${month}-${date}`); 
                     setSelectedCategoryId(activeChat.categories[0]?.id || null);
                     setIsEventModalOpen(true); 
                   }} 
                   className="p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                 >
                   <Plus size={14} />
                 </button>
              </div>
              <div className="space-y-1 relative z-10">
                {events.slice(0, 4).map(ev => {
                  const category = activeChat.categories.find(c => c.id === ev.categoryId);
                  return (
                    <div key={ev.id} className="text-[8px] font-black p-1 rounded bg-slate-950/60 truncate border border-slate-800/30 uppercase tracking-tighter" style={{ color: category?.color || '#94a3b8' }}>
                      • {ev.content}
                    </div>
                  );
                })}
                {events.length > 4 && <div className="text-[7px] font-black text-slate-600 px-1 uppercase">+{events.length - 4} Signals</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Snapshot Modal */}
      {isDayDetailOpen && selectedEventDate && (
        <div className="fixed inset-0 flex items-center justify-center z-[110] p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsDayDetailOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
               <div>
                 <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight italic text-white">
                   {(() => {
                     const [y, m, d] = selectedEventDate.split('-').map(Number);
                     return new Date(y, m - 1, d).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
                   })()}
                 </h3>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Signal Records</span>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => { setSelectedCategoryId(activeChat.categories[0]?.id || null); setIsEventModalOpen(true); }} className={`p-2 ${currentTheme.bg} text-white rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95`}><Plus size={20} /></button>
                 <button onClick={() => setIsDayDetailOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 custom-scrollbar text-white">
              {(() => {
                const [y, m, d] = selectedEventDate.split('-').map(Number);
                const localDate = new Date(y, m - 1, d);
                const events = getEventsForDay(localDate);
                return events.length > 0 ? (
                  events.map(ev => {
                    const category = activeChat.categories.find(c => c.id === ev.categoryId);
                    return (
                      <div key={ev.id} className="p-6 bg-slate-800/50 rounded-[2rem] border border-slate-700/50 relative overflow-hidden group hover:border-slate-500 transition-colors shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: category?.color }} />
                        <div className="flex items-center gap-2 mb-3">
                          <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-slate-900" style={{ color: category?.color }}>{category?.name || 'Protocol'}</div>
                          <span className="text-[9px] font-bold text-slate-500 ml-auto">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-100 whitespace-pre-wrap">{ev.content}</p>
                        <button onClick={() => onDeleteMessage(ev.id)} className="absolute right-4 top-4 p-2 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-3">
                    <Activity size={48} className="opacity-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-center">No signals recorded</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isEventModalOpen && selectedEventDate && (
        <div className="fixed inset-0 flex items-center justify-center z-[120] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsEventModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
               <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-white"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl`}><Plus size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight">Direct Entry</h3></div>
                <button onClick={() => setIsEventModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Frequency</label>
                  <div className="grid grid-cols-2 gap-2">
                    {activeChat.categories.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setSelectedCategoryId(cat.id)} 
                        className={`px-4 py-3 rounded-xl transition-all flex items-center gap-3 border ${selectedCategoryId === cat.id ? 'bg-slate-800 border-white shadow-lg' : 'bg-slate-900 border-slate-800/50 hover:border-slate-600'}`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[9px] font-black uppercase tracking-widest truncate text-white">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 text-white">Record Payload</label>
                  <textarea 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm focus:outline-none h-32 resize-none custom-scrollbar text-white shadow-inner" 
                    placeholder="Enter record..." 
                  />
                </div>
                <button 
                  onClick={() => onSendMessage(inputText, 'event', { date: selectedEventDate, categoryId: selectedCategoryId || activeChat.categories[0].id })}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${inputText.trim() ? `${currentTheme.bg} text-white shadow-xl shadow-${palette}-500/20 active:scale-95` : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                >
                  Commit Signal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};