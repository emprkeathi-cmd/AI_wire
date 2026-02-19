import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Trash2, Terminal, HelpCircle, Clock, Plus,
  Maximize2, ImageIcon, Send, Cpu, Zap, MessageCircle, Bot, User,
  Eye, Code, GripVertical, Activity, ChevronRight, ChevronLeft, CloudUpload, Check
} from 'lucide-react';
import { Chat, Message } from './types';
import { sendMessageToN8N } from './services/n8nService';

// --- NEURAL REFERENCE POPUP ---
const WikiReference: React.FC<{ label: string; assetIdx: number; assets: string[] }> = ({ label, assetIdx, assets }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const asset = assets[assetIdx];

  const handleMouseMove = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX + 20, y: e.clientY + 20 });
  };

  return (
    <span 
      className="text-indigo-400 font-bold underline decoration-indigo-500/30 cursor-help relative inline-block transition-colors hover:text-indigo-300 select-text"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {label}
      {isHovered && asset && (
        <div 
          className="fixed z-[99999] w-72 h-72 bg-[#0a0d14] border-2 border-indigo-500/50 rounded-[2.5rem] p-1.5 shadow-[0_40px_100px_rgba(0,0,0,0.9)] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ left: coords.x, top: coords.y }}
        >
          <img src={asset} className="w-full h-full object-cover rounded-[2.2rem]" alt="Reference" />
          <div className="absolute top-6 right-6 bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-2xl border border-white/20 tracking-tighter">Asset #{assetIdx}</div>
        </div>
      )}
    </span>
  );
};

// --- CUSTOM SYNTAX PARSER ---
const BlueprintRenderer: React.FC<{ content: string; assets: string[] }> = ({ content, assets }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-4 font-medium leading-relaxed text-slate-300 select-text cursor-auto">
      {lines.map((line, i) => {
        let currentLine = line;
        let type: 'h1' | 'h2' | 'h3' | 'meta' | 'p' = 'p';

        if (currentLine.startsWith('+++ ')) { type = 'h1'; currentLine = currentLine.slice(4); }
        else if (currentLine.startsWith('++ ')) { type = 'h2'; currentLine = currentLine.slice(3); }
        else if (currentLine.startsWith('+ ')) { type = 'h3'; currentLine = currentLine.slice(2); }
        else if (currentLine.startsWith('- ')) { type = 'meta'; currentLine = currentLine.slice(2); }

        const parts: (string | React.ReactNode)[] = [];
        const wikiRegex = /\[\[(.*?)\s*\|\s*(\d+)\]\]/g;
        let lastIndex = 0;
        let match;

        while ((match = wikiRegex.exec(currentLine)) !== null) {
          if (match.index > lastIndex) {
            parts.push(currentLine.substring(lastIndex, match.index));
          }
          const label = match[1].trim();
          const assetIdx = parseInt(match[2]);
          parts.push(<WikiReference key={match.index} label={label} assetIdx={assetIdx} assets={assets || []} />);
          lastIndex = wikiRegex.lastIndex;
        }
        parts.push(currentLine.substring(lastIndex));

        if (type === 'h1') return <h1 key={i} className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase text-white mb-6 mt-4 select-text">{parts}</h1>;
        if (type === 'h2') return <h2 key={i} className="text-xl sm:text-2xl font-black tracking-tight text-white mb-4 select-text">{parts}</h2>;
        if (type === 'h3') return <h3 key={i} className="text-base sm:text-lg font-bold text-slate-100 mb-2 select-text">{parts}</h3>;
        if (type === 'meta') return <p key={i} className="text-[10px] sm:text-[11px] italic text-slate-500 uppercase tracking-widest select-text">{parts}</p>;
        return <p key={i} className="text-sm select-text">{parts}</p>;
      })}
    </div>
  );
};

interface BlueprintEngineProps {
  activeChat: Chat;
  onDeploy: (title: string, content: string, assets: string[]) => void;
  onUpdate: (msgId: string, newContent: string) => void;
  onDelete: (msgId: string) => void;
}

export const BlueprintEngine: React.FC<BlueprintEngineProps> = ({ activeChat, onDeploy, onUpdate, onDelete }) => {
  const [blueprintTitle, setBlueprintTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [assets, setAssets] = useState<string[]>([]);
  
  // Unified Window State
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Per-project Chat States
  const [blueprintChats, setBlueprintChats] = useState<Record<string, any[]>>({});
  const [uplinkInput, setUplinkInput] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  // Spatial Window Layout
  const [winPos, setWinPos] = useState({ x: 0, y: 0 });
  const [winSize, setWinSize] = useState({ w: 640, h: 750 });
  const [dragState, setDragState] = useState<{ startX: number, startY: number, winX: number, winY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ startX: number, startY: number, winW: number, winH: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeProject = useMemo(() => 
    activeChat.messages.find(m => m.id === activeProjectId), 
    [activeProjectId, activeChat.messages]
  );

  const centerWorkspace = () => {
    const isMobile = window.innerWidth < 640;
    const w = isMobile ? window.innerWidth * 0.92 : 640;
    const h = isMobile ? window.innerHeight * 0.75 : 750;
    setWinSize({ w, h });
    setWinPos({
      x: (window.innerWidth / 2) - (w / 2),
      y: (window.innerHeight / 2) - (h / 2)
    });
  };

  useEffect(() => {
    if (activeProjectId) centerWorkspace();
  }, [activeProjectId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [blueprintChats, isSyncOpen]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (dragState) {
        setWinPos({ x: dragState.winX + (e.clientX - dragState.startX), y: dragState.winY + (e.clientY - dragState.startY) });
      }
      if (resizeState) {
        setWinSize({ w: Math.max(320, resizeState.winW + (e.clientX - resizeState.startX)), h: Math.max(320, resizeState.winH + (e.clientY - resizeState.startY)) });
      }
    };
    const handleUp = () => { setDragState(null); setResizeState(null); };
    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, resizeState]);

  const handleFullSync = async () => {
    if (!activeProject || isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      if (activeChat.webhookUrl) {
        // Send full state to n8n for universal recreation
        await sendMessageToN8N(activeChat.webhookUrl, activeProject.content, 'blueprint', {
          title: activeProject.title,
          assets: activeProject.assets,
          sync_type: 'full_recreation_payload'
        });
        setSaveSuccess(true);
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Neural Save Failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToUplink = async () => {
    if (!uplinkInput.trim() || !activeProject) return;
    const blueprintId = activeProject.id;
    const msg = { id: Date.now(), role: 'user', content: uplinkInput, timestamp: Date.now() };
    setBlueprintChats(prev => ({ ...prev, [blueprintId]: [...(prev[blueprintId] || []), msg] }));
    const userPrompt = uplinkInput;
    setUplinkInput('');
    setIsAIProcessing(true);
    try {
      if (activeChat.webhookUrl) {
        const response = await sendMessageToN8N(activeChat.webhookUrl, `[PROTOCOL CONTEXT]: ${activeProject.content}\n\n[USER]: ${userPrompt}`, 'blueprint', { blueprintId, title: activeProject.title });
        const aiMsg = { id: Date.now() + 1, role: 'assistant', content: response, timestamp: Date.now() };
        setBlueprintChats(prev => ({ ...prev, [blueprintId]: [...(prev[blueprintId] || []), aiMsg] }));
      }
    } catch (err) { console.error(err); } finally { setIsAIProcessing(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setAssets(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar w-full bg-[#02040a]">
      <div className="max-w-6xl mx-auto p-4 sm:p-10 space-y-8 animate-in fade-in duration-300 pb-32">
        
        {/* COMPOSER (Project Creator) */}
        <div className="bg-[#0f121d] border border-slate-800/60 rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
            <div className="flex-1 space-y-6 sm:space-y-8">
              <input 
                type="text" value={blueprintTitle} onChange={(e) => setBlueprintTitle(e.target.value)}
                placeholder="Protocol Name..." 
                className="w-full bg-transparent border-none focus:outline-none text-2xl sm:text-4xl font-black italic tracking-tighter text-white placeholder:text-slate-800 uppercase"
              />
              <textarea 
                value={objective} onChange={(e) => setObjective(e.target.value)}
                placeholder="Objectives... +++ Titles, [[Label|Index]] Assets."
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-[2rem] p-6 sm:p-8 text-sm font-medium text-slate-300 min-h-[160px] sm:min-h-[200px] focus:outline-none focus:border-indigo-500/40 transition-all custom-scrollbar resize-none leading-relaxed"
              />
            </div>
            <div className="w-full sm:w-56 flex flex-col gap-4 sm:gap-6 shrink-0">
              <div 
                className="flex-1 bg-slate-950/40 border-2 border-dashed border-slate-800 hover:border-indigo-500/40 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-slate-700 hover:text-indigo-400 transition-all cursor-pointer relative group/upload overflow-hidden min-h-[100px]" 
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                <ImageIcon size={28} className="group-hover/upload:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">Add Asset</span>
              </div>
              <button 
                onClick={() => { onDeploy(blueprintTitle, objective, assets); setBlueprintTitle(''); setObjective(''); setAssets([]); }}
                disabled={!blueprintTitle || !objective}
                className={`h-16 sm:h-20 rounded-[1.5rem] flex items-center justify-center gap-2 font-black uppercase tracking-[0.4em] text-xs transition-all shadow-2xl active:scale-95 ${blueprintTitle && objective ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              >
                <Plus size={18} /> Deploy
              </button>
            </div>
          </div>
          {assets.length > 0 && (
            <div className="flex gap-4 mt-8 overflow-x-auto pb-2 custom-scrollbar">
              {assets.map((asset, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-[1.2rem] overflow-hidden border border-slate-700 shrink-0 shadow-lg group/asset">
                  <img src={asset} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-black/80 px-1.5 py-0.5 rounded text-[7px] font-black text-white">#{idx}</div>
                  <button onClick={() => setAssets(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 opacity-0 group-hover/asset:opacity-100 bg-red-600 p-1 rounded text-white transition-opacity"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* REGISTRY (Project List) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
          {activeChat.messages.filter(m => m.type === 'blueprint').map(bp => (
            <div 
              key={bp.id} 
              className="bg-[#0a0d14] border border-slate-800/80 rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 hover:bg-[#111624] transition-all cursor-pointer group shadow-2xl relative overflow-hidden group/card"
              onClick={() => { setActiveProjectId(bp.id); setIsEditing(false); setIsSyncOpen(false); }}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] bg-indigo-600 flex items-center justify-center text-xs sm:text-md font-black text-white shadow-xl shadow-indigo-600/30">B</div>
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Registered Node</span>
                    <span className="text-[7px] sm:text-[8px] font-bold text-slate-700 uppercase mt-1 tracking-[0.2em]">{new Date(bp.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:opacity-0 group-hover/card:opacity-100 transition-all">
                  <button onClick={(e) => { e.stopPropagation(); setActiveProjectId(bp.id); setIsSyncOpen(true); }} className="p-3 text-slate-600 hover:text-emerald-400 bg-slate-900/60 rounded-[1.2rem] border border-slate-800 transition-colors shadow-lg"><MessageCircle size={18} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(bp.id); }} className="p-3 text-slate-600 hover:text-red-500 bg-slate-900/60 rounded-[1.2rem] border border-slate-800 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black italic tracking-tighter text-white uppercase mb-3 truncate leading-none">{bp.title}</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium line-clamp-2 mb-6 sm:mb-8 leading-relaxed italic">"{bp.content}"</p>
              {bp.assets && bp.assets.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:gap-4">
                  {bp.assets.slice(0, 4).map((asset, i) => (
                    <div key={i} className="aspect-square rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden bg-slate-950 border border-slate-800 relative shadow-inner">
                      <img src={asset} className="w-full h-full object-cover grayscale-[0.5] group-hover/card:grayscale-0 transition-all duration-700" />
                      {i === 3 && bp.assets!.length > 4 && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[9px] font-black text-white">+{bp.assets!.length - 4}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* UNIFIED HUB POPUP */}
        {activeProject && (
          <div 
            className={`fixed bg-[#080a0f] border border-slate-800/90 rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_60px_150px_rgba(0,0,0,1)] flex flex-col overflow-hidden z-[1000] animate-in zoom-in-95 duration-120 ${dragState || resizeState ? '' : 'transition-all duration-120'}`}
            style={{ left: winPos.x, top: winPos.y, width: winSize.w, height: winSize.h }}
          >
            {/* Draggable Header */}
            <div 
              className="h-14 sm:h-16 shrink-0 px-6 sm:px-10 flex items-center justify-between cursor-grab active:cursor-grabbing bg-[#121624] border-b border-slate-800/40"
              onMouseDown={(e) => setDragState({ startX: e.clientX, startY: e.clientY, winX: winPos.x, winY: winPos.y })}
            >
              <div className="flex items-center gap-3 sm:gap-5 overflow-hidden">
                <Terminal size={18} className="text-indigo-400 shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-white truncate italic">Hub // {activeProject.title}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button 
                  onMouseDown={e => e.stopPropagation()} 
                  onClick={handleFullSync} 
                  disabled={isSaving}
                  className={`p-2.5 rounded-xl transition-all ${saveSuccess ? 'bg-emerald-600 text-white' : isSaving ? 'bg-slate-800 text-slate-500 animate-pulse' : 'text-slate-500 hover:text-indigo-400 hover:bg-white/5'}`}
                  title="Neural Sync (Cloud Save)"
                >
                  {saveSuccess ? <Check size={18} /> : isSaving ? <Activity size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                </button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setIsEditing(!isEditing)} className={`p-2.5 rounded-xl transition-all ${isEditing ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{isEditing ? <Eye size={18} /> : <Code size={18} />}</button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setIsSyncOpen(!isSyncOpen)} className={`p-2.5 rounded-xl transition-all ${isSyncOpen ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}><MessageCircle size={18} /></button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setActiveProjectId(null)} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden bg-[#05060a] relative">
              {/* MAIN CONTENT LAYER */}
              <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSyncOpen ? 'pr-0 sm:pr-[320px]' : ''}`}>
                {isEditing ? (
                  <div className="flex-1 flex overflow-hidden animate-in fade-in duration-120">
                    <div className="w-[60px] sm:w-[90px] shrink-0 bg-[#05060a] border-r border-slate-800/40 flex flex-col items-center py-6 sm:py-10 gap-6 overflow-y-auto custom-scrollbar">
                      {activeProject.assets?.map((asset, i) => (
                        <div key={i} className="w-10 h-10 sm:w-14 sm:h-14 rounded-[1rem] bg-slate-900 border border-slate-800/60 overflow-hidden shrink-0 relative group shadow-2xl">
                          <img src={asset} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-indigo-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] font-black text-white transition-opacity">#{i}</div>
                        </div>
                      ))}
                      <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 sm:w-14 sm:h-14 rounded-[1rem] bg-slate-900 border border-dashed border-slate-800/40 flex items-center justify-center text-slate-700 hover:text-indigo-400 transition-all shrink-0"><Plus size={18} /></button>
                    </div>
                    <div className="flex-1 p-6 sm:p-12">
                      <textarea 
                        value={activeProject.content} onChange={(e) => onUpdate(activeProject.id, e.target.value)}
                        className="w-full h-full bg-transparent border-none focus:outline-none text-[13px] font-mono text-indigo-100/90 custom-scrollbar resize-none leading-relaxed select-text"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-8 sm:p-20 overflow-y-auto custom-scrollbar select-text animate-in fade-in duration-120">
                     <BlueprintRenderer content={activeProject.content} assets={activeProject.assets || []} />
                  </div>
                )}
              </div>

              {/* NEURAL UPLINK DRAWER */}
              <div 
                className={`absolute top-0 right-0 bottom-0 w-full sm:w-[320px] bg-[#0a0d16] border-l border-slate-800/90 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col z-10 transition-transform duration-200 transform ${isSyncOpen ? 'translate-x-0' : 'translate-x-full'}`}
              >
                <div className="h-12 flex items-center justify-between px-6 bg-[#12172b] border-b border-slate-800/40 shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Sync Uplink</span>
                  <button onClick={() => setIsSyncOpen(false)} className="text-slate-500 hover:text-white transition-all"><ChevronRight size={18} /></button>
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar select-text">
                  <div className="flex justify-center"><div className="bg-slate-900/50 border border-slate-800/50 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5"><Activity size={8} className="text-emerald-500" /> Neural Link Active</div></div>
                  {(blueprintChats[activeProject.id] || []).map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg"><Bot size={12} /></div>}
                      <div className={`max-w-[90%] px-3.5 py-2.5 rounded-[1.2rem] text-[12px] leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'}`}>{msg.content}</div>
                      {msg.role === 'user' && <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400 shrink-0"><User size={12} /></div>}
                    </div>
                  ))}
                  {isAIProcessing && <div className="flex justify-start items-center gap-2 animate-pulse"><div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white"><Cpu size={12} /></div><div className="flex gap-1"><span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" /><span className="w-1 h-1 bg-indigo-500 opacity-50 rounded-full animate-bounce [animation-delay:0.2s]" /></div></div>}
                </div>
                <div className="p-4 bg-[#0d111d] border-t border-slate-800/60 flex items-center gap-2">
                  <textarea 
                    value={uplinkInput} onChange={(e) => setUplinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToUplink(); } }}
                    placeholder="Sync intent..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[12px] font-medium text-white focus:outline-none focus:border-indigo-500/30 transition-all resize-none max-h-20 custom-scrollbar" rows={1}
                  />
                  <button onClick={handleSendToUplink} className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shrink-0 shadow-lg"><Send size={14} /></button>
                </div>
              </div>
            </div>
            
            {/* Resize Handle (Desktop Only) */}
            <div 
              className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-slate-800 hover:text-indigo-500 hidden sm:block"
              onMouseDown={(e) => { e.stopPropagation(); setResizeState({ startX: e.clientX, startY: e.clientY, winW: winSize.w, winH: winSize.h }); }}
            >
              <Maximize2 size={16} className="rotate-90" />
            </div>
          </div>
        )}

        {/* CODEX OVERLAY */}
        {showCodex && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setShowCodex(false)} />
            <div className="relative bg-[#0d101b] w-full max-lg rounded-[2.5rem] sm:rounded-[4rem] border border-slate-800/80 p-10 sm:p-16 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4"><HelpCircle className="text-indigo-400" size={28} /><h3 className="text-2xl font-black uppercase italic text-white leading-none">Manual v4.2</h3></div>
                <button onClick={() => setShowCodex(false)} className="p-2 text-slate-600 hover:text-white transition-all"><X size={32} /></button>
              </div>
              <div className="space-y-10 text-white">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 italic">Formatting Protocol</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/40 space-y-4">
                      <div className="flex items-center gap-4 text-sm font-bold"><span className="w-12 bg-slate-900/80 p-2 rounded-xl text-center text-[9px] text-indigo-400 border border-slate-800">+++</span> Master Title</div>
                      <div className="flex items-center gap-4 text-sm font-bold"><span className="w-12 bg-slate-900/80 p-2 rounded-xl text-center text-[9px] text-indigo-400 border border-slate-800">++</span> Section Head</div>
                      <div className="flex items-center gap-4 text-sm font-bold"><span className="w-12 bg-slate-900/80 p-2 rounded-xl text-center text-[9px] text-indigo-400 border border-slate-800">+</span> Paragraph Head</div>
                      <div className="flex items-center gap-4 text-sm font-bold"><span className="w-12 bg-slate-900/80 p-2 rounded-xl text-center text-[9px] text-slate-500 border border-slate-800">-</span> Metadata Tag</div>
                    </div>
                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/40 space-y-4">
                      <div className="flex items-center gap-4 text-sm font-bold"><span className="w-24 bg-slate-900/80 p-2 rounded-xl text-center text-[9px] text-emerald-400 border border-slate-800">[[Name|#]]</span> Visual Link</div>
                      <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest">Replace Name with label and # with the asset index in the side strip.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};