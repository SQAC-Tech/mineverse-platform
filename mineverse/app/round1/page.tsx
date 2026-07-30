'use client';

import { useState, useEffect } from 'react';

type TabType = 'crosswords' | 'aptitudes' | 'output';

export default function Round1Page() {
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes
  
  const [toasts, setToasts] = useState<{ id: number; icon: string; title: string; subtitle: string; }[]>([]);
  const [activeSlot, setActiveSlot] = useState(1);
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>('crosswords');
  const [questionIndices, setQuestionIndices] = useState<Record<TabType, number>>({
    crosswords: 0,
    aptitudes: 0,
    output: 0
  });

  const QUESTIONS = {
    crosswords: [
      { title: "Crossword #1", content: "Solve the first crossword puzzle." },
      { title: "Crossword #2", content: "Solve the second crossword puzzle." },
    ],
    aptitudes: [
      { title: "Aptitude #1", content: "Aptitude Question 1..." },
      { title: "Aptitude #2", content: "Aptitude Question 2..." },
      { title: "Aptitude #3", content: "Aptitude Question 3..." },
      { title: "Aptitude #4", content: "Aptitude Question 4..." },
      { title: "Aptitude #5", content: "Aptitude Question 5..." },
      { title: "Aptitude #6", content: "Aptitude Question 6..." },
    ],
    output: [
      { title: "Output Prediction #1", content: "Predict the output of the following code..." },
      { title: "Output Prediction #2", content: "Predict the output of the following code..." },
    ]
  };

  const TABS = [
    { id: 'crosswords', label: 'CROSSWORDS' },
    { id: 'aptitudes', label: 'APTITUDES' },
    { id: 'output', label: 'OUTPUT PREDICTION' }
  ] as const;

  const handleNext = () => {
    setQuestionIndices(prev => {
      const max = QUESTIONS[activeTab].length - 1;
      const current = prev[activeTab];
      return { ...prev, [activeTab]: current < max ? current + 1 : current };
    });
  };

  const handlePrev = () => {
    setQuestionIndices(prev => {
      const current = prev[activeTab];
      return { ...prev, [activeTab]: current > 0 ? current - 1 : 0 };
    });
  };

  const currentIndex = questionIndices[activeTab];
  const currentQuestion = QUESTIONS[activeTab][currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === QUESTIONS[activeTab].length - 1;

  const [playerInventory, setPlayerInventory] = useState([
    { key: 1, name: 'Wood', icon: '/wood.png', count: 25 },
    { key: 2, name: 'Stone', icon: '/stone.png', count: 10 },
    { key: 3, name: 'Iron', icon: '/iron.png', count: 0 },
    { key: 4, name: 'Gold', icon: '/gold.png', count: 0 },
    { key: 5, name: 'Diamond', icon: '/diamond.png', count: 0 },
    { key: 6, name: 'Emerald', icon: '/emerald.png', count: 5 },
    { key: 7, name: 'Obsidian', icon: '/obsidian.png', count: 0 },
  ]);

  const CRAFTING_RECIPES = [
    { id: 'pickaxe_stone', name: 'Stone Pickaxe', icon: '/pickaxe.png', output: { name: 'Stone Pickaxe', count: 1 }, requirements: { 'Wood': 2, 'Stone': 3 }, grid: ['Stone', 'Stone', 'Stone', null, 'Wood', null, null, 'Wood', null] },
    { id: 'sword_stone', name: 'Stone Sword', icon: '/pickaxe.png', output: { name: 'Stone Sword', count: 1 }, requirements: { 'Wood': 1, 'Stone': 2 }, grid: [null, 'Stone', null, null, 'Stone', null, null, 'Wood', null] },
    { id: 'axe_stone', name: 'Stone Axe', icon: '/pickaxe.png', output: { name: 'Stone Axe', count: 1 }, requirements: { 'Wood': 2, 'Stone': 3 }, grid: ['Stone', 'Stone', null, 'Stone', 'Wood', null, null, 'Wood', null] },
    { id: 'pickaxe_iron', name: 'Iron Pickaxe', icon: '/pickaxe.png', output: { name: 'Iron Pickaxe', count: 1 }, requirements: { 'Wood': 2, 'Iron': 3 }, grid: ['Iron', 'Iron', 'Iron', null, 'Wood', null, null, 'Wood', null] },
    { id: 'sword_iron', name: 'Iron Sword', icon: '/pickaxe.png', output: { name: 'Iron Sword', count: 1 }, requirements: { 'Wood': 1, 'Iron': 2 }, grid: [null, 'Iron', null, null, 'Iron', null, null, 'Wood', null] },
    { id: 'pickaxe_gold', name: 'Gold Pickaxe', icon: '/pickaxe.png', output: { name: 'Gold Pickaxe', count: 1 }, requirements: { 'Wood': 2, 'Gold': 3 }, grid: ['Gold', 'Gold', 'Gold', null, 'Wood', null, null, 'Wood', null] },
    { id: 'pickaxe_diamond', name: 'Diamond Pickaxe', icon: '/pickaxe.png', output: { name: 'Diamond Pickaxe', count: 1 }, requirements: { 'Wood': 2, 'Diamond': 3 }, grid: ['Diamond', 'Diamond', 'Diamond', null, 'Wood', null, null, 'Wood', null] },
    { id: 'block_emerald', name: 'Emerald Block', icon: '/emerald.png', output: { name: 'Emerald Block', count: 1 }, requirements: { 'Emerald': 9 }, grid: ['Emerald', 'Emerald', 'Emerald', 'Emerald', 'Emerald', 'Emerald', 'Emerald', 'Emerald', 'Emerald'] },
    { id: 'portal', name: 'Nether Portal', icon: '/obsidian.png', output: { name: 'Nether Portal', count: 1 }, requirements: { 'Obsidian': 10 }, grid: [null, 'Obsidian', 'Obsidian', 'Obsidian', null, 'Obsidian', 'Obsidian', null, 'Obsidian'] },
    { id: 'planks', name: 'Wooden Planks', icon: '/wood.png', output: { name: 'Wooden Planks', count: 4 }, requirements: { 'Wood': 1 }, grid: [null, null, null, null, 'Wood', null, null, null, null] }
  ];

  const getCraftableStatus = (recipe: any) => {
    for (const [reqName, reqCount] of Object.entries(recipe.requirements)) {
      const item = playerInventory.find(inv => inv.name === reqName);
      if (!item || item.count < (reqCount as number)) return false;
    }
    return true;
  };

  const handleCraft = () => {
    if (!selectedRecipe || !getCraftableStatus(selectedRecipe)) return;
    
    setPlayerInventory(prev => {
      let newInv = [...prev];
      for (const [reqName, reqCount] of Object.entries(selectedRecipe.requirements)) {
        const itemIdx = newInv.findIndex(inv => inv.name === reqName);
        if (itemIdx !== -1) {
          newInv[itemIdx] = { ...newInv[itemIdx], count: newInv[itemIdx].count - (reqCount as number) };
        }
      }
      
      const outIdx = newInv.findIndex(inv => inv.name === selectedRecipe.output.name);
      if (outIdx !== -1) {
        newInv[outIdx] = { ...newInv[outIdx], count: newInv[outIdx].count + selectedRecipe.output.count };
      } else {
        const emptyIdx = newInv.findIndex(inv => inv.count === 0 && inv.name === '');
        if (emptyIdx !== -1) {
          newInv[emptyIdx] = { ...newInv[emptyIdx], name: selectedRecipe.output.name, count: selectedRecipe.output.count, icon: selectedRecipe.icon };
        } else if (newInv.length < 9) {
          newInv.push({ key: newInv.length + 1, name: selectedRecipe.output.name, icon: selectedRecipe.icon, count: selectedRecipe.output.count });
        }
      }
      return newInv;
    });
    
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, icon: '✅', title: 'Crafted!', subtitle: `Created ${selectedRecipe.output.name}` }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        setActiveSlot(num);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToast = (icon: string, title: string, subtitle: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, icon, title, subtitle }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };



  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes mc-toast-in {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      
      {/* Minecraft Toasts */}
      <div style={{ position: 'fixed', top: '24px', right: '4px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(14,14,14,0.92)',
            border: '2px solid rgba(80,80,80,0.9)',
            borderRadius: '4px', overflow: 'hidden',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.8)',
            minWidth: '260px', maxWidth: '340px',
            animation: 'mc-toast-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
            fontFamily: 'var(--font-minecraft, monospace)',
          }}>
            <div style={{
              width: '52px', minWidth: '52px', height: '52px',
              background: 'rgba(30,30,30,0.95)',
              borderRight: '2px solid rgba(80,80,80,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', flexShrink: 0,
            }}>{toast.icon}</div>
            <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{
                color: toast.title.includes('Advancement') ? '#FFAA00' : toast.title.includes('Challenge') ? '#FF55FF' : '#FFFF55', 
                fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.5px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.2,
              }}>{toast.title}</div>
              <div style={{
                color: 'rgba(255,255,255,0.88)', fontSize: '10px',
                letterSpacing: '0.3px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.3,
              }}>{toast.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Background Video Loop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        style={{ filter: 'brightness(0.6)' }}
      >
        <source src="/biome1-1.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

     
      {/* Logo Container */}
      <div className="relative z-10 w-full p-6 flex items-center pointer-events-none">
        <div 
          role="button"
          tabIndex={0}
          onClick={() => addToast('🔔', 'Notification', 'No new notifications right now!')}
          className="absolute left-4 top-2 md:left-8 md:top-2 pointer-events-auto cursor-pointer group"
        >
          {/* Counter badge */}
          <div style={{
            position: 'absolute', top: '-5%', right: '-10%', zIndex: 30,
            background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
            border: '2px solid rgba(100,210,255,0.6)',
            borderRadius: '50%', width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(100,210,255,0.9)', fontSize: '11px', fontWeight: 700,
            fontFamily: 'var(--font-minecraft, monospace)',
            boxShadow: '0 0 12px rgba(100,210,255,0.5)',
          }}>0</div>
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-16 md:w-24 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-[110px] md:pb-[130px] p-2 pointer-events-none -translate-x-8 md:-translate-x-16 lg:-translate-x-24">
        {/* Container that acts as the board with correct aspect ratio */}
        <div className="relative w-[98vw] md:w-[95vw] max-w-6xl aspect-[1306/876] max-h-[75vh] flex flex-col pointer-events-auto mt-12">
          
          {/* Timer positioned outside, top right */}
      <div className="absolute -top-14 md:-top-[4.5rem] right-[1%] md:right-[0%] pointer-events-auto flex items-center justify-center">
       <img 
        src="/timer.png" 
        alt="Timer background" 
        className="w-24 md:w-32 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
        style={{ imageRendering: 'pixelated' }}
       />
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ ...mc }}
      >
      <span className="text-[#fde047] text-[7px] md:text-[9px] drop-shadow-[2px_2px_0_#000] mb-0.5">TIME LEFT</span>
      <span className="text-white text-sm md:text-base drop-shadow-[2px_2px_0_#000]">{formatTime(timeLeft)}</span>
      </div>
      </div>

          {/* Tabs positioned outside, top left */}
          <div className="absolute -top-10 md:-top-[2.75rem] left-[1%] md:left-[0%] flex">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 md:px-6 py-2 md:py-3 cursor-pointer select-none transition-all hover:brightness-110`}
                  style={{
                    ...mc,
                    backgroundImage: `linear-gradient(${isActive ? 'rgba(255,255,255,0.1), rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4), rgba(0,0,0,0.4)'}), url(/tab_bg.png)`,
                    backgroundSize: '64px',
                    imageRendering: 'pixelated',
                    color: isActive ? '#ffffff' : '#aaaaaa',
                    borderTop: `4px solid ${isActive ? '#7a7a7a' : '#4a4a4a'}`,
                    borderLeft: `4px solid ${isActive ? '#7a7a7a' : '#4a4a4a'}`,
                    borderRight: `4px solid ${isActive ? '#2a2a2a' : '#1a1a1a'}`,
                    borderBottom: 'none',
                    marginRight: '4px',
                    fontSize: 'clamp(10px, 1.5vw, 16px)',
                    zIndex: isActive ? 10 : 1,
                    textShadow: '2px 2px 0 rgba(0,0,0,0.8)'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Board Background */}
          <div 
            className="absolute inset-0 z-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
            style={{
              backgroundImage: 'url(/question.png)',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />

          {/* Board Content Area */}
          <div className="relative z-10 flex-1 flex flex-col p-[8%] md:p-[10%]">
             <div className="flex justify-between items-center mb-4 border-b-2 border-[#555] pb-2">
               <h2 className="text-[#333] text-2xl md:text-4xl" style={{ ...mc, textShadow: '1px 1px 0 rgba(255,255,255,0.5)' }}>
                 {currentQuestion.title}
               </h2>
               <span className="text-[#555] text-sm md:text-base font-bold" style={mc}>
                 {currentIndex + 1} / {QUESTIONS[activeTab].length}
               </span>
             </div>
             <div className="flex-1 text-[#222] text-lg md:text-xl font-medium overflow-y-auto" style={mc}>
               {currentQuestion.content}
             </div>
          </div>

          {/* Navigation Arrows */}
          <div className="absolute bottom-[6%] right-[8%] z-20 flex gap-2 md:gap-4">
            <button 
              onClick={handlePrev}
              disabled={isFirst}
              className={`w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-[#8b8b8b] m-[2px] transition-all ${isFirst ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#9b9b9b] active:border-t-[#373737] active:border-l-[#373737] active:border-b-[#ffffff] active:border-r-[#ffffff]'}`}
              style={{
                borderTop: '4px solid #ffffff',
                borderLeft: '4px solid #ffffff',
                borderBottom: '4px solid #373737',
                borderRight: '4px solid #373737',
                boxShadow: '0 0 0 2px #000000'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button 
              onClick={handleNext}
              disabled={isLast}
              className={`w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-[#8b8b8b] m-[2px] transition-all ${isLast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#9b9b9b] active:border-t-[#373737] active:border-l-[#373737] active:border-b-[#ffffff] active:border-r-[#ffffff]'}`}
              style={{
                borderTop: '4px solid #ffffff',
                borderLeft: '4px solid #ffffff',
                borderBottom: '4px solid #373737',
                borderRight: '4px solid #373737',
                boxShadow: '0 0 0 2px #000000'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Crafting Image */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => setIsCraftingOpen(true)}
        className="absolute bottom-0 left-[-100px] z-20 pointer-events-auto cursor-pointer group"
      >
        <img 
          src="/crafting.png" 
          alt="Crafting" 
          className="w-[12rem] md:w-[14rem] lg:w-[18rem] drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] group-hover:scale-105 group-hover:drop-shadow-[0_0_20px_rgba(100,210,255,0.5)] transition-all"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Steve Video */}
      <div className="absolute bottom-0 right-0 z-20 pointer-events-none p-1.5 bg-[#c6c6c6] border-[4px] border-t-white border-l-white border-b-[#555] border-r-[#555]">
        <video 
          src="/stevevid.mp4" 
          autoPlay
          loop
          muted
          playsInline
          className="w-[10rem] md:w-[14rem] lg:w-[16rem] object-cover drop-shadow-md" 
        />
      </div>

      {/* Minecraft HUD Hotbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
        <div 
          className="flex bg-[#8b8b8b] p-1.5"
          style={{ 
            borderTop: '3px solid #ffffff',
            borderLeft: '3px solid #ffffff',
            borderBottom: '3px solid #373737',
            borderRight: '3px solid #373737',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const slotNum = i + 1;
            const item = playerInventory.find(inv => inv.key === slotNum);
            const isActive = slotNum === activeSlot;
            return (
              <div 
                key={slotNum}
                onClick={() => setActiveSlot(slotNum)}
                className="relative w-12 h-12 md:w-16 md:h-16 bg-[#8b8b8b] mx-[2px] flex items-center justify-center cursor-pointer"
                style={{
                  borderTop: '3px solid #373737',
                  borderLeft: '3px solid #373737',
                  borderBottom: '3px solid #ffffff',
                  borderRight: '3px solid #ffffff',
                }}
              >
                {isActive && (
                  <div className="absolute -inset-[4px] border-[4px] border-white z-20 pointer-events-none" />
                )}
                {item && (
                  <>
                    <img 
                      src={item.icon} 
                      alt={item.name} 
                      className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]" 
                      style={{ imageRendering: 'pixelated' }} 
                    />
                    <span 
                      className="absolute top-0.5 right-1 text-white drop-shadow-[2px_2px_0_#000] z-10"
                      style={{ ...mc, fontSize: 'clamp(10px, 1.5vw, 14px)' }}
                    >
                      {item.count}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isCraftingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto backdrop-blur-sm p-4">
          <div className="flex w-full max-w-4xl h-[70vh] max-h-[600px] bg-[#c6c6c6] shadow-[0_0_0_4px_#000] p-2 flex-col md:flex-row relative">
            <button 
              onClick={() => setIsCraftingOpen(false)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-[#c6c6c6] text-black text-xl font-bold flex items-center justify-center border-t-2 border-l-2 border-t-white border-l-white border-b-2 border-r-2 border-b-[#555] border-r-[#555] cursor-pointer hover:brightness-110 shadow-[0_0_0_2px_#000] z-50"
              style={mc}
            >
              X
            </button>
            {/* Left Pane - Recipe Book */}
            <div className="w-full md:w-1/3 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white p-2 flex flex-col h-full overflow-hidden mr-0 md:mr-2 mb-2 md:mb-0">
              <div className="flex items-center mb-2 bg-[#707070] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white p-1">
                <span className="text-white mx-auto text-sm" style={mc}>Recipe Book</span>
              </div>
              <div className="grid grid-cols-4 gap-1 overflow-y-auto pr-1">
                {CRAFTING_RECIPES.map((recipe, idx) => {
                  const canCraft = getCraftableStatus(recipe);
                  const isSelected = selectedRecipe?.id === recipe.id;
                  return (
                    <div 
                      key={idx}
                      onClick={() => setSelectedRecipe(recipe)}
                      className={`aspect-square bg-[#c6c6c6] border-2 flex items-center justify-center cursor-pointer transition-all hover:bg-[#d6d6d6] ${isSelected ? 'border-t-[#373737] border-l-[#373737] border-b-white border-r-white bg-[#a0a0a0]' : 'border-t-white border-l-white border-b-[#373737] border-r-[#373737]'}`}
                    >
                      <img src={recipe.icon} alt={recipe.name} className={`w-8 h-8 object-contain ${canCraft ? '' : 'opacity-40 grayscale'}`} style={{ imageRendering: 'pixelated' }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane - Crafting Area */}
            <div className="w-full md:w-2/3 p-4 flex flex-col h-full overflow-y-auto">
              <span className="text-[#373737] text-xl mb-4" style={mc}>Crafting</span>
              
              <div className="flex flex-1 flex-col items-center justify-start mt-4">
                {selectedRecipe ? (
                  <div className="w-full max-w-sm">
                    <div className="flex justify-between items-center mb-8">
                      {/* 3x3 Crafting Grid */}
                      <div className="grid grid-cols-3 gap-0 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white">
                        {selectedRecipe.grid.map((itemName: string | null, idx: number) => {
                          const iconUrl = itemName ? `/${itemName.toLowerCase()}.png` : null;
                          return (
                            <div key={idx} className="w-10 h-10 md:w-12 md:h-12 border border-[#373737] flex items-center justify-center">
                              {iconUrl && (
                                <img src={iconUrl} alt={itemName!} className="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]" style={{ imageRendering: 'pixelated' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mx-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#373737" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>

                      {/* Output Slot */}
                      <div className="w-16 h-16 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center relative flex-shrink-0">
                        <img src={selectedRecipe.icon} alt="output" className="w-10 h-10 object-contain" style={{ imageRendering: 'pixelated' }} />
                        <span className="absolute bottom-0 right-1 text-white text-xs drop-shadow-[1px_1px_0_#000]" style={mc}>{selectedRecipe.output.count}</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleCraft}
                      disabled={!getCraftableStatus(selectedRecipe)}
                      className={`w-full py-3 bg-[#c6c6c6] border-2 border-t-white border-l-white border-b-[#373737] border-r-[#373737] flex items-center justify-center cursor-pointer transition-all ${getCraftableStatus(selectedRecipe) ? 'hover:bg-[#d6d6d6] active:border-t-[#373737] active:border-l-[#373737] active:border-b-white active:border-r-white' : 'opacity-50 cursor-not-allowed'}`}
                    >
                      <span className="text-[#373737] text-lg" style={mc}>CRAFT</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[#8b8b8b] text-center mt-10" style={mc}>Select a recipe<br/>from the book.</div>
                )}
              </div>

              {/* Player Inventory (Bottom) */}
              <div className="mt-auto pt-4">
                <span className="text-[#373737] mb-2 block" style={mc}>Inventory</span>
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 27 }).map((_, i) => {
                    const item = playerInventory[i];
                    return (
                      <div key={i} className="aspect-square bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white flex items-center justify-center relative">
                        {item && item.count > 0 && item.name && (
                          <>
                            <img src={item.icon} alt={item.name} className="w-[70%] h-[70%] object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]" style={{ imageRendering: 'pixelated' }} />
                            <span className="absolute bottom-0 right-1 text-white drop-shadow-[2px_2px_0_#000]" style={{ ...mc, fontSize: '10px' }}>{item.count}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
