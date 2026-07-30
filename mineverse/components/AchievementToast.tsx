'use client';

import React, { useEffect, useState } from 'react';

type Achievement = {
  id: string;
  title: string;
  description: string;
};

export const triggerAchievement = (title: string, description: string) => {
  const event = new CustomEvent('achievement-unlocked', {
    detail: { title, description }
  });
  window.dispatchEvent(event);
};

export const AchievementToast: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    const handleAchievement = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, description } = customEvent.detail;
      const id = Math.random().toString(36).substr(2, 9);
      
      setAchievements((prev) => [...prev, { id, title, description }]);

      // Remove after 4 seconds
      setTimeout(() => {
        setAchievements((prev) => prev.filter((a) => a.id !== id));
      }, 4000);
    };

    window.addEventListener('achievement-unlocked', handleAchievement);
    return () => window.removeEventListener('achievement-unlocked', handleAchievement);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {achievements.map((achievement) => (
        <div 
          key={achievement.id}
          className="bg-[#212121] border-2 border-[#555] rounded-lg p-4 w-80 shadow-lg transform transition-all duration-300 translate-x-0 opacity-100 flex items-center gap-4"
          style={{ 
            animation: 'slideIn 0.3s ease-out',
            boxShadow: 'inset 2px 2px 0px rgba(255,255,255,0.1), inset -2px -2px 0px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.5)'
          }}
        >
          {/* Achievement Icon Placeholder (e.g. Grass Block) */}
          <div className="w-10 h-10 flex-shrink-0 bg-[#5D8C3E] border-2 border-[#3E5C29] flex items-center justify-center">
            <span className="text-xl">🏆</span>
          </div>
          
          <div className="flex flex-col font-minecraft">
            <span className="text-[#FFFF55] text-sm tracking-wide" style={{ textShadow: '1px 1px 0 #000' }}>
              Achievement Unlocked!
            </span>
            <span className="text-white text-base">
              {achievement.title}
            </span>
            <span className="text-gray-400 text-xs mt-1">
              {achievement.description}
            </span>
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
};
