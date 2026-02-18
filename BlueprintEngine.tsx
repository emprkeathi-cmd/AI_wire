import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Trash2, FileText, ImagePlus, MessageSquare, 
  Terminal, HelpCircle, ExternalLink, Clock, Plus,
  Maximize2, Settings as GearIcon, Copy, Wifi, Info,
  Activity, Upload, Image as ImageIcon, Send,
  Cpu, Zap, MessageCircle, Bot, User
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

        if (type === 'h1') return <h1 key={i} className="text-4xl font-black italic tracking-tighter uppercase text-white mb-6 mt-4 select-text">{parts}</h1>;
        if (type === 'h2') return <h2 key={i} className="text-2xl font-black tracking-tight text-white mb-4 select-text">{parts}</h2>;
        if (type === 'h3') return <h3 key={i} className="text-lg font-bold text-slate-100 mb-2 select-text">{parts}</h3>;
        if (type === 'meta') return <p key={i} className="text-[11px] italic text-slate-500 uppercase tracking-widest select-text">{parts}</p>;
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
  const [editingBlueprintId, setEditingBlueprintId] = useState<string | null>(null);
  const [activeUplinkId, setActiveUplinkId] = useState<string | null>(null); 
  const [showCodex, setShowCodex] = useState(false);
  const [isRenderDetached, setIsRenderDetached] = useState(true);

  // Per-project Chat States
  const [blueprintChats, setBlueprintChats] = useState<Record<string, any[]>>({});
  const [uplinkInput, setUplinkInput] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  // Spatial Window Layouts
  const [windows, setWindows] = useState({
    terminal: { x: 50, y: 100, w: 580, h: 700, z: 500 },
    render: { x: 650, y: 100, w: 580, h: 700, z: 490 },
    chat: { x: 350, y: 200, w: 500, h: 600, z: 510 }
  });

  const [dragState, setDragState] = useState<{ id: keyof typeof windows, startX: number, startY: number, winX: number, winY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: keyof typeof windows, startX: number, startY: number, winW: number, winH: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeBlueprint = useMemo(() => 
    activeChat.messages.find(m => m.id === editingBlueprintId), 
    [editingBlueprintId, activeChat.messages]
  );

  const uplinkBlueprint = useMemo(() => 
    activeChat.messages.find(m => m.id === activeUplinkId),
    [activeUplinkId, activeChat.messages]
  );

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [blueprintChats, activeUplinkId]);

  const bringToFront = (id: keyof typeof windows) => {
    setWindows(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.z));
      return {
        ...prev,
        [id]: { ...prev[id], z: maxZ + 1 }
      };
    });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (dragState) {
        setWindows(prev => ({
          ...prev,
          [dragState.id]: { 
            ...prev[dragState.id], 
            x: dragState.winX + (e.clientX - dragState.startX), 
            y: dragState.winY + (e.clientY - dragState.startY) 
          }
        }));
      }
      if (resizeState) {
        setWindows(prev => ({
          ...prev,
          [resizeState.id]: { 
            ...prev[resizeState.id], 
            w: Math.max(300, resizeState.winW + (e.clientX - resizeState.startX)), 
            h: Math.max(300, resizeState.winH + (e.clientY - resizeState.startY)) 
          }
        }));
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

  const handleSendToUplink = async () => {
    if (!uplinkInput.trim() || !uplinkBlueprint) return;
    const blueprintId = uplinkBlueprint.id;
    const msg = { id: Date.now(), role: 'user', content: uplinkInput, timestamp: Date.now() };
    
    setBlueprintChats(prev => ({
      ...prev,
      [blueprintId]: [...(prev[blueprintId] || []), msg]
    }));
    
    const userPrompt = uplinkInput;
    setUplinkInput('');
    setIsAIProcessing(true);

    try {
      if (activeChat.webhookUrl) {
        // Automatically append project content context to the message
        const contextAwareMessage = `[CONTEXT: PROJECT BLUEPRINT CONTENT]:\n${uplinkBlueprint.content}\n\n[USER MESSAGE]:\n${userPrompt}`;
        
        const response = await sendMessageToN8N(activeChat.webhookUrl, contextAwareMessage, 'blueprint', { 
          blueprintId, 
          title: uplinkBlueprint.title,
          originalBlueprint: uplinkBlueprint.content
        });
        
        const aiMsg = { id: Date.now() + 1, role: 'assistant', content: response, timestamp: Date.now() };
        setBlueprintChats(prev => ({
          ...prev,
          [blueprintId]: [...(prev[blueprintId] || []), aiMsg]
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIProcessing(false);
    }
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
    <div className="h-full overflow-y-auto custom-scrollbar w-full">
      <div className="max-w-6xl mx-auto p-4 sm:p-10 space-y-12 animate-in fade-in duration-500 pb-32">
        
        {/* COMPOSER */}
        <div className="bg-[#0f121d] border border-slate-800/60 rounded-[3.5rem] p-10 sm:p-16 shadow-[0_60px_120px_rgba(0,0,0,0.6)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <div className="flex flex-col sm:flex-row gap-14">
            <div className="flex-1 space-y-10">
              <input 
                type="text" 
                value={blueprintTitle} 
                onChange={(e) => setBlueprintTitle(e.target.value)}
                placeholder="Designation..." 
                className="w-full bg-transparent border-none focus:outline-none text-4xl font-black italic tracking-tighter text-white placeholder:text-slate-800 uppercase"
              />
              <textarea 
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Protocol objectives... Use +++ for titles and [[Label|Index]] for visuals."
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-[2.5rem] p-10 text-sm font-medium text-slate-300 min-h-[240px] focus:outline-none focus:border-indigo-500/40 transition-all custom-scrollbar resize-none leading-relaxed"
              />
            </div>
            <div className="w-full sm:w-64 flex flex-col gap-8 shrink-0">
              <div 
                className="flex-1 bg-slate-950/40 border-2 border-dashed border-slate-800 hover:border-indigo-500/40 rounded-[3rem] flex flex-col items-center justify-center gap-6 text-slate-700 hover:text-indigo-400 transition-all cursor-pointer relative group/upload overflow-hidden" 
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                <ImageIcon size={44} className="group-hover/upload:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Add Asset</span>
              </div>
              <button 
                onClick={() => { onDeploy(blueprintTitle, objective, assets); setBlueprintTitle(''); setObjective(''); setAssets([]); }}
                disabled={!blueprintTitle || !objective}
                className={`h-20 rounded-[2rem] flex items-center justify-center gap-2 font-black uppercase tracking-[0.4em] text-xs transition-all shadow-2xl active:scale-95 ${blueprintTitle && objective ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              >
                <Plus size={20} /> Deploy Protocol
              </button>
            </div>
          </div>
          {assets.length > 0 && (
            <div className="flex gap-4 mt-10 overflow-x-auto pb-4 custom-scrollbar">
              {assets.map((asset, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-[1.8rem] overflow-hidden border border-slate-700 shrink-0 shadow-lg group/asset">
                  <img src={asset} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-black text-white">#{idx}</div>
                  <button onClick={() => setAssets(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 opacity-0 group-hover/asset:opacity-100 bg-red-600 p-1.5 rounded-lg text-white transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* REGISTRY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {activeChat.messages.filter(m => m.type === 'blueprint').map(bp => (
            <div 
              key={bp.id} 
              className="bg-[#0a0d14] border border-slate-800/80 rounded-[4rem] p-10 hover:bg-[#111624] transition-all cursor-pointer group shadow-2xl relative overflow-hidden group/card"
              onClick={() => setEditingBlueprintId(bp.id)}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.4rem] bg-indigo-600 flex items-center justify-center text-md font-black text-white shadow-xl shadow-indigo-600/30">B</div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Registered Node</span>
                    <span className="text-[9px] font-bold text-slate-700 uppercase mt-2 tracking-[0.2em]">{new Date(bp.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-all">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveUplinkId(bp.id); bringToFront('chat'); }} 
                    className="p-4 text-slate-600 hover:text-emerald-400 bg-slate-900/60 rounded-[1.4rem] border border-slate-800 transition-colors shadow-lg"
                    title="Neural Uplink"
                  >
                    <MessageCircle size={20} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(bp.id); }} 
                    className="p-4 text-slate-600 hover:text-red-500 bg-slate-900/60 rounded-[1.4rem] border border-slate-800 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <h3 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-4 truncate leading-none">{bp.title}</h3>
              <p className="text-sm text-slate-500 font-medium line-clamp-3 mb-10 leading-relaxed italic">"{bp.content}"</p>
              {bp.assets && bp.assets.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                  {bp.assets.slice(0, 4).map((asset, i) => (
                    <div key={i} className="aspect-square rounded-[1.8rem] overflow-hidden bg-slate-950 border border-slate-800 relative shadow-inner">
                      <img src={asset} className="w-full h-full object-cover grayscale-[0.5] group-hover/card:grayscale-0 transition-all duration-700" />
                      {i === 3 && bp.assets!.length > 4 && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[11px] font-black text-white">+{bp.assets!.length - 4}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* WINDOW: TERMINAL (EDITOR) */}
        {activeBlueprint && (
          <div 
            className={`fixed bg-[#080a0f] border border-slate-800/80 rounded-[3.5rem] shadow-[0_60px_150px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${dragState?.id === 'terminal' || resizeState?.id === 'terminal' ? '' : 'transition-all'}`}
            style={{ left: windows.terminal.x, top: windows.terminal.y, width: windows.terminal.w, height: windows.terminal.h, zIndex: windows.terminal.z }}
            onMouseDown={() => bringToFront('terminal')}
          >
            <div 
              className="h-16 shrink-0 px-10 flex items-center justify-between cursor-grab active:cursor-grabbing bg-[#121624] border-b border-slate-800/40"
              onMouseDown={(e) => {
                setDragState({ id: 'terminal', startX: e.clientX, startY: e.clientY, winX: windows.terminal.x, winY: windows.terminal.y });
              }}
            >
              <div className="flex items-center gap-5">
                <Terminal size={22} className="text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Protocol Terminal // {activeBlueprint.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setShowCodex(true)} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><HelpCircle size={22} /></button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setIsRenderDetached(!isRenderDetached)} className={`p-2.5 hover:bg-white/10 rounded-xl transition-all ${isRenderDetached ? 'text-indigo-400' : 'text-slate-500'}`}><ExternalLink size={22} /></button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setEditingBlueprintId(null)} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X size={22} /></button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[100px] shrink-0 bg-[#05060a] border-r border-slate-800/40 flex flex-col items-center py-10 gap-8 overflow-y-auto custom-scrollbar">
                {activeBlueprint.assets?.map((asset, i) => (
                  <div key={i} className="w-16 h-16 rounded-[1.5rem] bg-slate-900 border border-slate-800/60 overflow-hidden shrink-0 relative group shadow-2xl">
                    <img src={asset} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-indigo-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-black text-white transition-opacity"># {i}</div>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-[1.5rem] bg-slate-900 border border-dashed border-slate-800/40 flex items-center justify-center text-slate-700 hover:text-indigo-400 transition-all shrink-0"><Plus size={24} /></button>
              </div>
              
              <div className="flex-1 p-12 relative">
                <textarea 
                  value={activeBlueprint.content}
                  onChange={(e) => onUpdate(activeBlueprint.id, e.target.value)}
                  className="w-full h-full bg-transparent border-none focus:outline-none text-sm font-mono text-indigo-100/90 custom-scrollbar resize-none leading-relaxed select-text"
                  spellCheck={false}
                />
              </div>
            </div>
            
            <div 
              className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-slate-800 hover:text-indigo-500"
              onMouseDown={(e) => {
                e.stopPropagation();
                setResizeState({ id: 'terminal', startX: e.clientX, startY: e.clientY, winW: windows.terminal.w, winH: windows.terminal.h });
              }}
            >
              <Maximize2 size={18} className="rotate-90" />
            </div>
          </div>
        )}

        {/* WINDOW: RENDER (LIVE VIEW) */}
        {activeBlueprint && isRenderDetached && (
          <div 
            className={`fixed bg-slate-950/90 backdrop-blur-3xl border border-slate-800/60 rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-500 ${dragState?.id === 'render' || resizeState?.id === 'render' ? '' : 'transition-all'}`}
            style={{ left: windows.render.x, top: windows.render.y, width: windows.render.w, height: windows.render.h, zIndex: windows.render.z }}
            onMouseDown={() => bringToFront('render')}
          >
            <div 
              className="h-16 shrink-0 px-12 flex items-center justify-between cursor-grab active:cursor-grabbing bg-slate-900/40 text-slate-500 border-b border-slate-800/30"
              onMouseDown={(e) => {
                setDragState({ id: 'render', startX: e.clientX, startY: e.clientY, winX: windows.render.x, winY: windows.render.y });
              }}
            >
              <div className="flex items-center gap-5">
                <Clock size={20} className="text-slate-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.6em]">Live Render Layer</span>
              </div>
              <button onMouseDown={e => e.stopPropagation()} onClick={() => setIsRenderDetached(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 p-20 overflow-y-auto custom-scrollbar select-text cursor-auto">
              <BlueprintRenderer content={activeBlueprint.content} assets={activeBlueprint.assets || []} />
            </div>

            <div 
              className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-slate-800 hover:text-indigo-400"
              onMouseDown={(e) => {
                e.stopPropagation();
                setResizeState({ id: 'render', startX: e.clientX, startY: e.clientY, winW: windows.render.w, winH: windows.render.h });
              }}
            >
              <Maximize2 size={18} className="rotate-90" />
            </div>
          </div>
        )}

        {/* WINDOW: NEURAL UPLINK (CHAT) */}
        {uplinkBlueprint && (
          <div 
            className={`fixed bg-[#0a0d16] border border-slate-800/90 rounded-[3rem] shadow-[0_80px_160px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 ${dragState?.id === 'chat' || resizeState?.id === 'chat' ? '' : 'transition-all'}`}
            style={{ left: windows.chat.x, top: windows.chat.y, width: windows.chat.w, height: windows.chat.h, zIndex: windows.chat.z }}
            onMouseDown={() => bringToFront('chat')}
          >
            <div 
              className="h-16 shrink-0 px-10 flex items-center justify-between cursor-grab active:cursor-grabbing bg-[#12172b] border-b border-slate-800/50"
              onMouseDown={(e) => {
                setDragState({ id: 'chat', startX: e.clientX, startY: e.clientY, winX: windows.chat.x, winY: windows.chat.y });
              }}
            >
              <div className="flex items-center gap-5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white animate-pulse"><Zap size={16} /></div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Neural Uplink // {uplinkBlueprint.title}</span>
              </div>
              <button onMouseDown={e => e.stopPropagation()} onClick={() => setActiveUplinkId(null)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-slate-500 hover:text-red-500"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-[#05060a]">
              <div 
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar select-text"
              >
                <div className="flex justify-center py-4">
                   <div className="bg-slate-900/50 border border-slate-800/50 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                     <Wifi size={12} className="text-emerald-500 animate-pulse" />
                     Secure Link Active
                   </div>
                </div>

                {(blueprintChats[uplinkBlueprint.id] || []).map((msg) => (
                  <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg"><Bot size={16} /></div>
                    )}
                    <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.8rem] shadow-xl text-sm leading-relaxed transition-all ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 shadow-lg"><User size={16} /></div>
                    )}
                  </div>
                ))}
                
                {isAIProcessing && (
                  <div className="flex justify-start items-end gap-3">
                     <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 animate-pulse"><Cpu size={16} /></div>
                     <div className="bg-slate-900/50 border border-slate-800/30 px-5 py-3 rounded-[1.5rem] rounded-bl-none flex gap-1.5">
                       <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-duration:0.6s]" />
                       <span className="w-1.5 h-1.5 bg-indigo-500 opacity-50 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]" />
                     </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#0d111d] border-t border-slate-800/60 flex items-center gap-4">
                <textarea 
                  value={uplinkInput}
                  onChange={(e) => setUplinkInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToUplink(); } }}
                  placeholder="Synchronize intent..."
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 pr-12 text-sm font-medium text-white focus:outline-none focus:border-indigo-500/30 transition-all resize-none max-h-32 custom-scrollbar"
                  rows={1}
                />
                <button 
                  onClick={handleSendToUplink}
                  className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-all shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div 
              className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-slate-800 hover:text-indigo-400"
              onMouseDown={(e) => {
                e.stopPropagation();
                setResizeState({ id: 'chat', startX: e.clientX, startY: e.clientY, winW: windows.chat.w, winH: windows.chat.h });
              }}
            >
              <Maximize2 size={18} className="rotate-90" />
            </div>
          </div>
        )}

        {/* CODEX */}
        {showCodex && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setShowCodex(false)} />
            <div className="relative bg-[#0d101b] w-full max-w-xl rounded-[4rem] border border-slate-800/80 p-12 sm:p-20 shadow-[0_80px_160px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-14">
                <div className="flex items-center gap-5">
                  <HelpCircle className="text-indigo-400" size={36} />
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Manual v4.2</h3>
                </div>
                <button onClick={() => setShowCodex(false)} className="p-3 text-slate-600 hover:text-white transition-all"><X size={40} /></button>
              </div>
              <div className="space-y-12 text-white">
                <div className="space-y-10">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-600">Syntax Mapping</h4>
                  <div className="space-y-6">
                    <div className="flex items-center gap-10 text-sm font-bold"><span className="w-24 bg-slate-900/50 p-3 rounded-2xl text-center text-[10px] text-indigo-400 border border-slate-800 shadow-inner">+++</span> Master Title</div>
                    <div className="flex items-center gap-10 text-sm font-bold"><span className="w-24 bg-slate-900/50 p-3 rounded-2xl text-center text-[10px] text-indigo-400 border border-slate-800 shadow-inner">++</span> Protocol Block</div>
                    <div className="flex items-center gap-10 text-sm font-bold"><span className="w-24 bg-slate-900/50 p-3 rounded-2xl text-center text-[10px] text-indigo-400 border border-slate-800 shadow-inner">[[..|#]]</span> Visual Probe</div>
                  </div>
                </div>
                <div className="p-10 bg-slate-950/50 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden group/codex-ref">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={64} className="text-indigo-500" /></div>
                  <code className="text-indigo-300 text-sm font-black block mb-6 tracking-widest select-all">[[Reference Name | Index]]</code>
                  <p className="text-[11px] font-bold text-slate-600 uppercase leading-relaxed tracking-tight italic select-text">
                    Direct neural mapping. Hovering shows sidebar asset by index #. Perfect for structural cross-referencing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};