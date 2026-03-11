import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Github, ExternalLink } from 'lucide-react';

export type TutorialStep = 
  | 'welcome' 
  | 'settings' 
  | 'deploy' 
  | 'engines' 
  | 'github' 
  | 'chat_opened' 
  | 'completed';

interface TutorialProps {
  activeStep: TutorialStep;
  onNext: () => void;
  onClose: () => void;
  targetElementId?: string;
}

export const Tutorial: React.FC<TutorialProps> = ({ activeStep, onNext, onClose, targetElementId }) => {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (targetElementId) {
      const el = document.getElementById(targetElementId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  }, [targetElementId, activeStep]);

  if (activeStep === 'completed') return null;

  const getStepContent = () => {
    switch (activeStep) {
      case 'welcome':
        return {
          title: "Welcome to AI Wire",
          text: "I'm your Neural Interface Guide. Let's get you synchronized with the grid.",
          button: "Initialize"
        };
      case 'settings':
        return {
          title: "System Parameters",
          text: "Here you can adjust the HUD style. Try switching between Sleek and Cyber modes!",
          button: "Understood"
        };
      case 'deploy':
        return {
          title: "Deploying Agents",
          text: "This is where you can add new chat/modules. Each chat/module is a specialized AI agent Interface.",
          button: "Show me more"
        };
      case 'engines':
        return {
          title: "Neural Engines",
          text: "From Temporal Nodes (Calendar) to Task Grids (Todo), we have a chat/module for every workflow.",
          button: "Next"
        };
      case 'github':
        return {
          title: "Open Source Grid",
          text: "AI Wire is an open project. You can contribute or build your own engines by grabbing the source from GitHub!",
          button: "Got it",
          showGithub: true
        };
      case 'chat_opened':
        return {
          title: "Node Configuration",
          text: "Every chat/module has its own uniquely generated HTTPS link. You can change the alias, avatar, and even connect external webhooks in its settings accessible by the 3 dots.",
          button: "Finish Tutorial"
        };
      default:
        return null;
    }
  };

  const content = getStepContent();
  if (!content) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Highlight Overlay */}
        {targetElementId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 pointer-events-auto"
            style={{
              clipPath: `polygon(
                0% 0%, 
                0% 100%, 
                ${coords.left}px 100%, 
                ${coords.left}px ${coords.top}px, 
                ${coords.left + coords.width}px ${coords.top}px, 
                ${coords.left + coords.width}px ${coords.top + coords.height}px, 
                ${coords.left}px ${coords.top + coords.height}px, 
                ${coords.left}px 100%, 
                100% 100%, 
                100% 0%
              )`
            }}
            onClick={onClose}
          />
        )}

        {/* Character and Bubble Container */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-8 right-8 flex flex-col items-end gap-4 pointer-events-auto max-w-xs sm:max-w-sm"
        >
          {/* Speech Bubble */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button 
              onClick={onClose}
              className="absolute top-3 right-3 p-1 text-slate-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            
            <h4 className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mb-2">
              {content.title}
            </h4>
            <p className="text-slate-200 text-sm font-medium leading-relaxed mb-4">
              {content.text}
            </p>

            {content.showGithub && (
              <a 
                href="https://github.com/emprkeathi-cmd/AI_wire" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white mb-4 transition-colors"
              >
                <Github size={14} />
                <span>View Source on GitHub</span>
                <ExternalLink size={12} />
              </a>
            )}

            <button 
              onClick={onNext}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {content.button}
              <ChevronRight size={14} />
            </button>

            {/* Bubble Tail */}
            <div className="absolute -bottom-2 right-12 w-4 h-4 bg-slate-900 border-r border-b border-slate-800 rotate-45" />
          </div>

          {/* Character Avatar */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
              {/* LINE 135: Character Avatar Image */}
              <img 
                src="https://api.dicebear.com/7.x/bottts/svg?seed=AIWire&backgroundColor=b6e3f4" 
                alt="Guide" 
                className="w-16 h-16 rounded-xl"
              />
            </div>
            <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-800">
              <span className="text-[10px] font-black text-white uppercase tracking-tighter">Neural Guide</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
