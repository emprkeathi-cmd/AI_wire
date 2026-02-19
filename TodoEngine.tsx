import React, { useMemo } from 'react';
import { 
  Plus, ListTodo, X, Activity, CheckCircle2, Circle, Bell, BellOff, Trash2
} from 'lucide-react';
import { Chat, ThemePalette } from './types';

interface TodoEngineProps {
  activeChat: Chat;
  currentTheme: any;
  palette: ThemePalette;
  isTodoModalOpen: boolean;
  setIsTodoModalOpen: (b: boolean) => void;
  todoFilter: 'ALL' | 'Active' | 'Done' | 'Deleted';
  setTodoFilter: (f: 'ALL' | 'Active' | 'Done' | 'Deleted') => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (s: string | null) => void;
  inputText: string;
  setInputText: (s: string) => void;
  todoNotes: string;
  setTodoNotes: (s: string) => void;
  todoReminder: boolean;
  setTodoReminder: (b: boolean) => void;
  onSendMessage: (content?: string, type?: any, extra?: any) => void;
  onToggleTaskStatus: (id: string, current: any) => void;
  onDeleteTask: (id: string) => void;
}

export const TodoEngine: React.FC<TodoEngineProps> = (props) => {
  const {
    activeChat, currentTheme, palette, isTodoModalOpen, setIsTodoModalOpen,
    todoFilter, setTodoFilter, selectedCategoryId, setSelectedCategoryId,
    inputText, setInputText, todoNotes, setTodoNotes, todoReminder, setTodoReminder,
    onSendMessage, onToggleTaskStatus, onDeleteTask
  } = props;

  const filteredTasks = useMemo(() => {
    return activeChat.messages.filter(m => {
      if (m.type !== 'task') return false;
      if (todoFilter === 'ALL') return m.todoStatus !== 'deleted';
      if (todoFilter === 'Active') return m.todoStatus === 'active';
      if (todoFilter === 'Done') return m.todoStatus === 'done';
      if (todoFilter === 'Deleted') return m.todoStatus === 'deleted';
      return false;
    });
  }, [activeChat, todoFilter]);

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col items-center pt-8 pb-20 overflow-y-auto h-full p-4 custom-scrollbar">
      <button 
        onClick={() => { setSelectedCategoryId(activeChat.categories[0].id); setIsTodoModalOpen(true); }} 
        className={`flex items-center gap-2 ${currentTheme.bg} text-white font-black uppercase tracking-widest px-8 py-4 rounded-3xl shadow-2xl hover:scale-105 active:scale-95 transition-all mb-8`}
      >
        <Plus size={20} /> Add Task
      </button>
      
      <div className="flex gap-2 mb-12 w-full justify-center">
        {['ALL', 'Active', 'Done', 'Deleted'].map(f => (
          <button 
            key={f} 
            onClick={() => setTodoFilter(f as any)} 
            className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${todoFilter === f ? `bg-slate-800 border-${palette}-500 text-white shadow-lg` : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="w-full space-y-3">
        {filteredTasks.length > 0 ? filteredTasks.map(task => {
          const category = activeChat.categories.find(c => c.id === task.categoryId);
          return (
            <div key={task.id} className="flex items-center gap-4 bg-slate-900 border border-slate-800/50 p-5 rounded-[2rem] hover:bg-slate-800/80 transition-all group shadow-sm">
              <button onClick={() => onToggleTaskStatus(task.id, task.todoStatus || 'active')} className={`shrink-0 transition-all ${task.todoStatus === 'done' ? 'text-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}>
                {task.todoStatus === 'done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em]" style={{ backgroundColor: `${category?.color}20`, color: category?.color }}>{category?.name}</div>
                  {task.todoReminder && <Bell size={10} className="text-amber-500 animate-pulse" />}
                </div>
                <h4 className={`font-bold text-sm truncate ${task.todoStatus === 'done' ? 'line-through text-slate-600' : 'text-white'}`}>{task.content}</h4>
                {task.todoNotes && <p className="text-[10px] text-slate-500 font-medium mt-1 italic truncate">{task.todoNotes}</p>}
              </div>

              <button onClick={() => onDeleteTask(task.id)} className="p-2 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                <Trash2 size={20} />
              </button>
            </div>
          );
        }) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-700 gap-3 italic">
            <Activity size={48} className="opacity-10" />
            <span className="text-xs font-black uppercase tracking-widest opacity-40">Grid Standby...</span>
          </div>
        )}
      </div>

      {/* Todo Add Task Modal */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[120] p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsTodoModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-md rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3 text-white"><div className={`p-3 ${currentTheme.bg} text-white rounded-2xl`}><ListTodo size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight italic">Initialize Task</h3></div>
                <button onClick={() => setIsTodoModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Task Category</label>
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
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Task Designation</label>
                  <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm focus:outline-none text-white shadow-inner font-bold" 
                    placeholder="Enter title..." 
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${todoReminder ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                      {todoReminder ? <Bell size={18} /> : <BellOff size={18} />}
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-white">Morning Reminder</span>
                      <span className="text-[9px] font-medium text-slate-500">Daily Protocol Notification</span>
                    </div>
                  </div>
                  <button onClick={() => setTodoReminder(!todoReminder)} className={`w-12 h-6 rounded-full transition-all relative ${todoReminder ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${todoReminder ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 text-white">Neural Notes</label>
                  <textarea 
                    value={todoNotes} 
                    onChange={(e) => setTodoNotes(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-2xl px-5 py-4 text-sm focus:outline-none h-24 resize-none custom-scrollbar text-white shadow-inner" 
                    placeholder="Extra task data..." 
                  />
                </div>

                <button 
                  onClick={() => onSendMessage(inputText, 'task', { categoryId: selectedCategoryId || activeChat.categories[0].id, todoReminder, todoNotes })}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${inputText.trim() ? `${currentTheme.bg} text-white shadow-xl shadow-${palette}-500/20 active:scale-95` : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                >
                  Save Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};