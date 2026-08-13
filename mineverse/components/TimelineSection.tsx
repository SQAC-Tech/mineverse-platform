"use client";

import React, { useState, useRef } from "react";
import { MinecraftBoard } from "@/components/MinecraftBoard";
import { motion, useScroll, useTransform } from "framer-motion";

const DAY1_TIMELINE = [
  { time: '9:00 – 10:00 AM', activity: 'Registration & Check-in', desc: 'Team registration, ID verification, welcome kit distribution, seating arrangement' },
  { time: '10:00 – 10:40 AM', activity: 'Opening Ceremony', desc: 'Welcome address, faculty speech, sponsor introduction, inauguration, club introduction' },
  { time: '10:40 – 11:00 AM', activity: 'Gameplay Briefing', desc: 'Explain rules, scoring, gameplay mechanics, crafting, platform demonstration' },
  { time: '11:00 – 11:45 AM', activity: 'Round 1 — Forest Biome', desc: 'Coding challenges, Forest Guardian, Wooden Pickaxe crafting' },
  { time: '12:00 – 1:00 PM', activity: 'Round 2 — Cave Biome', desc: 'Coding challenges, Skeleton Archer, world event, marketplace, Stone Pickaxe crafting' },
  { time: '2:10 – 3:20 PM', activity: 'Round 3 — Mountain Biome', desc: 'Coding challenges, Blaze Guardian, world event, marketplace, Iron Armor crafting' },
  { time: '3:30 – 3:45 PM', activity: 'Qualification & Leaderboard', desc: 'Verify scores and resources, announce teams qualified for Day 2' },
  { time: '4:00 – 4:40 PM', activity: 'Day 1 Closing', desc: 'Minecraft Quiz, Speed Debugging, Sponsor Activities; recap, qualified teams announcement' },
];

const DAY2_TIMELINE = [
  { time: '9:00 – 10:00 AM', activity: 'Venue Preparation', desc: 'Final technical setup, volunteer briefing, resource verification' },
  { time: '10:00 – 10:20 AM', activity: 'Welcome Back & Recap', desc: 'Recap, explain the final round, clarify doubts, verify inventories' },
  { time: '10:20 – 11:20 AM', activity: 'Round 4 — Pre-Final', desc: 'All physical games played in this round (Nether Portal repair)' },
  { time: '11:35 AM – 12:35 PM', activity: 'Round 5 — Final Round', desc: 'Coding and technical challenges (The End)' },
  { time: '1:45 – 2:15 PM', activity: 'Final Result Compilation', desc: 'Final scoring and winner confirmation; fun activity during this time' },
  { time: '2:15 – 3:00 PM', activity: 'Prize Distribution', desc: 'Winners announcement, certificates, special awards, vote of thanks, group photo' },
];

export const TimelineSection = () => {
  const [activeDay, setActiveDay] = useState<1 | 2>(1);
  const timelineData = activeDay === 1 ? DAY1_TIMELINE : DAY2_TIMELINE;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });
  
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="py-20 px-4 md:px-8 text-white relative overflow-hidden" ref={containerRef}>
      {/* Flanking Mobs */}
      <img 
        src="/zombie.svg" 
        alt="Zombie" 
        className="hidden xl:block absolute left-4 top-1/3 w-48 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] animate-float z-0" 
      />
      <img 
        src="/pigman.svg" 
        alt="Pigman" 
        className="hidden xl:block absolute right-4 top-2/3 w-48 object-contain transform scale-x-[-1] drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] animate-float z-0" 
        style={{ animationDelay: '1.5s' }}
      />

      <div className="relative z-20 w-full max-w-5xl mx-auto overflow-clip">
        {/* Day Toggles */}
        <div className="flex justify-center space-x-4 mt-8 mb-16">
          <button
            onClick={() => setActiveDay(1)}
            className={`px-8 py-3 text-lg font-minecraft text-white border-2 border-transparent transition-colors ${
              activeDay === 1
                ? 'bg-[#5D8C3E] border-[#5D8C3E]'
                : 'bg-[#222] text-gray-400 hover:bg-[#333]'
            }`}
            style={{ fontFamily: 'var(--font-minecraft)' }}
          >
            DAY 1
          </button>
          <button
            onClick={() => setActiveDay(2)}
            className={`px-8 py-3 text-lg font-minecraft text-white border-2 border-transparent transition-colors ${
              activeDay === 2
                ? 'bg-[#5D8C3E] border-[#5D8C3E]'
                : 'bg-[#222] text-gray-400 hover:bg-[#333]'
            }`}
            style={{ fontFamily: 'var(--font-minecraft)' }}
          >
            DAY 2
          </button>
        </div>

        {/* Timeline */}
        <div className="relative w-full py-8">
          {/* Central Line Background */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1.5 bg-[#1a110a] transform -translate-x-1/2"></div>
          
          {/* Animated Central Line */}
          <motion.div 
            className="absolute left-8 md:left-1/2 top-0 w-1.5 bg-[#5D8C3E] transform -translate-x-1/2 shadow-[0_0_15px_rgba(93,140,62,0.8)]"
            style={{ height: lineHeight }}
          />

          {timelineData.map((item, index) => {
            const isLeft = index % 2 === 0;
            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`relative flex items-center justify-between md:justify-normal w-full mb-20 ${isLeft ? 'md:flex-row-reverse' : 'md:flex-row'}`}
              >
                {/* Desktop Empty Space */}
                <div className="hidden md:block w-1/2"></div>
                
                {/* Node Point */}
                <motion.div 
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.3, type: "spring", delay: 0.2 }}
                  className="absolute left-8 md:left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-none bg-[#5D8C3E] border-[3px] border-[#2d1e0f] shadow-[0_0_10px_rgba(93,140,62,0.8)] z-10 flex items-center justify-center"
                >
                  <div className="w-2 h-2 bg-[#a7e872]"></div>
                </motion.div>

                {/* Content */}
                <div className={`w-full md:w-1/2 pl-16 md:pl-0 ${isLeft ? 'md:pr-12' : 'md:pl-12'} flex ${isLeft ? 'md:justify-end' : 'md:justify-start'}`}>
                  <div className="w-full max-w-sm">
                    <MinecraftBoard title={item.time}>
                      <h4 className="text-xl font-bold text-[#8b0000] mb-2">{item.activity}</h4>
                      <p className="text-sm font-bold text-[#3c2512] leading-tight">{item.desc}</p>
                    </MinecraftBoard>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
