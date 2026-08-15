import re

with open('mineverse/components/game/custom-round-ui/CustomRoundShell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Chunk 1: Imports and definition
c1_old = """'use client';

import { useState, useEffect } from 'react';

type TabType = 'crosswords' | 'aptitudes' | 'output';

export default function Round1Page() {"""

c1_new = """'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

type TabType = 'crosswords' | 'aptitudes' | 'output';

interface CustomRoundShellProps {
  roundId: number;
}

export function CustomRoundShell({ roundId }: CustomRoundShellProps) {"""

content = content.replace(c1_old, c1_new)

# Chunk 2: Initial states to activeTab
c2_old = """  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes
  
  const [toasts, setToasts] = useState<{ id: number; icon: string; title: string; subtitle: React.ReactNode; }[]>([]);
  const [activeSlot, setActiveSlot] = useState(1);
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isVideoToggled, setIsVideoToggled] = useState(false);
  const [timerClickCount, setTimerClickCount] = useState(0);
  
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
  };"""

c2_new = """  const [timeLeft, setTimeLeft] = useState(0);
  const [offline, setOffline] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const refreshAll = useCallback(() => setRefreshToken((v) => v + 1), []);
  const [serverEndsAt, setServerEndsAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  
  const [fetchedQuestions, setFetchedQuestions] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  
  const [toasts, setToasts] = useState<{ id: number; icon: string; title: string; subtitle: React.ReactNode; }[]>([]);
  const [activeSlot, setActiveSlot] = useState(1);
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isVideoToggled, setIsVideoToggled] = useState(false);
  const [timerClickCount, setTimerClickCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState<TabType>('crosswords');
  const [questionIndices, setQuestionIndices] = useState<Record<TabType, number>>({ crosswords: 0, aptitudes: 0, output: 0 });

  const QUESTIONS = useMemo(() => {
    const crosswords: any[] = [];
    const aptitudes: any[] = [];
    const output: any[] = [];
    
    fetchedQuestions.forEach(q => {
      const mapped = { id: q.id, title: q.prompt || 'Question', content: String(q.content || '') };
      if (q.type === 'coding' || q.type === 'code_completion') output.push(mapped);
      else if (q.type === 'crossword') crosswords.push(mapped);
      else aptitudes.push(mapped);
    });

    if (crosswords.length === 0) crosswords.push({ id: 'dummy1', title: 'No Crosswords', content: 'Waiting for questions...' });
    if (aptitudes.length === 0) aptitudes.push({ id: 'dummy2', title: 'No Aptitude', content: 'Waiting for questions...' });
    if (output.length === 0) output.push({ id: 'dummy3', title: 'No Output', content: 'Waiting for questions...' });

    return { crosswords, aptitudes, output };
  }, [fetchedQuestions]);"""

content = content.replace(c2_old, c2_new)

# Chunk 3: playerInventory & CRAFTING_RECIPES
c3_old = """  const [playerInventory, setPlayerInventory] = useState([
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
  ];"""

c3_new = """  const [playerInventory, setPlayerInventory] = useState([
    { key: 1, name: 'wood', icon: '/wood.png', count: 0 },
    { key: 2, name: 'stone', icon: '/stone.png', count: 0 },
    { key: 3, name: 'iron', icon: '/iron.png', count: 0 },
    { key: 4, name: 'gold', icon: '/gold.png', count: 0 },
    { key: 5, name: 'diamond', icon: '/diamond.png', count: 0 },
    { key: 6, name: 'emerald', icon: '/emerald.png', count: 0 },
    { key: 7, name: 'obsidian', icon: '/obsidian.png', count: 0 },
  ]);

  const CRAFTING_RECIPES = [
    { id: 'pickaxe_stone', backendId: 'stone_pickaxe', name: 'Stone Pickaxe', icon: '/pickaxe.png', output: { name: 'Stone Pickaxe', count: 1 }, requirements: { 'wood': 2, 'stone': 3 }, grid: ['stone', 'stone', 'stone', null, 'wood', null, null, 'wood', null] },
    { id: 'sword_stone', backendId: 'stone_sword', name: 'Stone Sword', icon: '/pickaxe.png', output: { name: 'Stone Sword', count: 1 }, requirements: { 'wood': 1, 'stone': 2 }, grid: [null, 'stone', null, null, 'stone', null, null, 'wood', null] },
    { id: 'axe_stone', backendId: 'stone_axe', name: 'Stone Axe', icon: '/pickaxe.png', output: { name: 'Stone Axe', count: 1 }, requirements: { 'wood': 2, 'stone': 3 }, grid: ['stone', 'stone', null, 'stone', 'wood', null, null, 'wood', null] },
    { id: 'pickaxe_iron', backendId: 'iron_pickaxe', name: 'Iron Pickaxe', icon: '/pickaxe.png', output: { name: 'Iron Pickaxe', count: 1 }, requirements: { 'wood': 2, 'iron': 3 }, grid: ['iron', 'iron', 'iron', null, 'wood', null, null, 'wood', null] },
    { id: 'sword_iron', backendId: 'iron_sword', name: 'Iron Sword', icon: '/pickaxe.png', output: { name: 'Iron Sword', count: 1 }, requirements: { 'wood': 1, 'iron': 2 }, grid: [null, 'iron', null, null, 'iron', null, null, 'wood', null] },
    { id: 'pickaxe_gold', backendId: 'gold_pickaxe', name: 'Gold Pickaxe', icon: '/pickaxe.png', output: { name: 'Gold Pickaxe', count: 1 }, requirements: { 'wood': 2, 'gold': 3 }, grid: ['gold', 'gold', 'gold', null, 'wood', null, null, 'wood', null] },
    { id: 'pickaxe_diamond', backendId: 'diamond_pickaxe', name: 'Diamond Pickaxe', icon: '/pickaxe.png', output: { name: 'Diamond Pickaxe', count: 1 }, requirements: { 'wood': 2, 'diamond': 3 }, grid: ['diamond', 'diamond', 'diamond', null, 'wood', null, null, 'wood', null] },
    { id: 'block_emerald', backendId: 'emerald_block', name: 'Emerald Block', icon: '/emerald.png', output: { name: 'Emerald Block', count: 1 }, requirements: { 'emerald': 9 }, grid: ['emerald', 'emerald', 'emerald', 'emerald', 'emerald', 'emerald', 'emerald', 'emerald', 'emerald'] },
    { id: 'portal', backendId: 'nether_portal', name: 'Nether Portal', icon: '/obsidian.png', output: { name: 'Nether Portal', count: 1 }, requirements: { 'obsidian': 10 }, grid: [null, 'obsidian', 'obsidian', 'obsidian', null, 'obsidian', 'obsidian', null, 'obsidian'] },
    { id: 'planks', backendId: 'wooden_pickaxe', name: 'Wooden Pickaxe', icon: '/wood.png', output: { name: 'Wooden Pickaxe', count: 1 }, requirements: { 'wood': 3 }, grid: ['wood', 'wood', 'wood', null, 'wood', null, null, 'wood', null] }
  ];"""

content = content.replace(c3_old, c3_new)

# Chunk 4: getCraftableStatus and handleCraft
c4_old = """  const getCraftableStatus = (recipe: any) => {
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
    setToasts(prev => [...prev, { id, icon: '?', title: 'Crafted!', subtitle: Created  }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };"""

c4_new = """  const getCraftableStatus = (recipe: any) => {
    const backendRecipe = recipes.find(r => r.item === recipe.backendId);
    if (backendRecipe && backendRecipe.crafted) return false;
    for (const [reqName, reqCount] of Object.entries(recipe.requirements)) {
      const item = playerInventory.find(inv => inv.name === reqName);
      if (!item || item.count < (reqCount as number)) return false;
    }
    return true;
  };

  const handleCraft = async () => {
    if (!selectedRecipe || !getCraftableStatus(selectedRecipe)) return;
    
    try {
      const res = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: selectedRecipe.backendId }),
      });
      const json = await res.json();
      
      if (!json.success) {
        addToast('?', 'Craft Failed', json.error?.message || 'Unknown error');
        return;
      }
      addToast('?', 'Crafted!', Created );
      refreshAll();
    } catch {
      addToast('?', 'Error', 'Could not reach server.');
    }
  };"""

content = content.replace(c4_old, c4_new)

# Chunk 5: useEffect timer replacement
c5_old = """  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);"""

c5_new = """  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch(/api/rounds//questions, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setServerEndsAt(json.data.ends_at);
        setFetchedQuestions(json.data.questions || []);
      }
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [roundId]);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch('/api/team/resources', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        const bal = json.data.balance;
        setPlayerInventory(prev => prev.map(inv => ({
          ...inv,
          count: bal[inv.name] || 0
        })));
      }
    } catch { }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await fetch('/api/team/craft/recipes', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setRecipes(json.data.recipes || []);
      }
    } catch { }
  }, []);

  useEffect(() => {
    void fetchRound(); void fetchResources(); void fetchRecipes();
    const poll = window.setInterval(() => {
      fetchRound(); fetchResources(); fetchRecipes();
    }, 10000);
    return () => window.clearInterval(poll);
  }, [fetchRound, fetchResources, fetchRecipes, refreshToken]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (serverEndsAt) {
      const ms = new Date(serverEndsAt).getTime() - now;
      setTimeLeft(Math.max(0, Math.floor(ms / 1000)));
    }
  }, [now, serverEndsAt]);
  
  const submitQuestion = async (q: any) => {
    setSubmitting(q.id);
    try {
      const draft = drafts[q.id] || '';
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id, answer_text: draft }),
      });
      const json = await res.json();
      if (!json.success) addToast('?', 'Error', json.error?.message || 'Submission failed');
      else {
        addToast('?', 'Success', 'Answer submitted!');
        refreshAll();
      }
    } catch {
      addToast('?', 'Error', 'Could not reach server.');
    } finally {
      setSubmitting(null);
    }
  };"""

content = content.replace(c5_old, c5_new)

# Chunk 6: Add submission UI
c6_old = """             <div className="flex-1 text-[#222] text-lg md:text-xl font-medium overflow-y-auto" style={mc}>
               {currentQuestion.content}
             </div>"""

c6_new = """             <div className="flex-1 text-[#222] text-lg md:text-xl font-medium overflow-y-auto" style={mc}>
               {currentQuestion.content}
               
               {currentQuestion.id && !currentQuestion.id.startsWith('dummy') && (
                 <div className="mt-6 border-t-2 border-[#888] pt-4 pointer-events-auto">
                   <span className="text-[#333] text-sm md:text-base font-bold block mb-2" style={mc}>Your Answer:</span>
                   <textarea 
                     value={drafts[currentQuestion.id] || ''}
                     onChange={(e) => setDrafts(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                     className="w-full p-3 bg-[#e6e6e6] border-2 border-[#555] text-black outline-none focus:border-[#222] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] resize-none"
                     rows={3}
                     style={mc}
                     placeholder="Type your answer here..."
                   />
                   <button 
                     onClick={() => submitQuestion(currentQuestion)}
                     disabled={submitting === currentQuestion.id}
                     className="mt-3 px-6 py-2 bg-[#777] border-2 border-white hover:bg-[#888] active:border-[#333] text-white font-bold transition-all shadow-[0_2px_0_rgba(0,0,0,0.5)] cursor-pointer disabled:opacity-50"
                     style={mc}
                   >
                     {submitting === currentQuestion.id ? 'Submitting...' : 'Submit'}
                   </button>
                 </div>
               )}
             </div>"""

content = content.replace(c6_old, c6_new)

# Check if replacements were successful
if c1_new not in content: print("C1 failed")
if c2_new not in content: print("C2 failed")
if c3_new not in content: print("C3 failed")
if c4_new not in content: print("C4 failed")
if c5_new not in content: print("C5 failed")
if c6_new not in content: print("C6 failed")

with open('mineverse/components/game/custom-round-ui/CustomRoundShell.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
