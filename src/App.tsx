import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Share2, 
  Timer, 
  Star, 
  Volume2, 
  VolumeX, 
  Truck, 
  BarChart3, 
  TrendingUp, 
  Settings, 
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants ---
const DEPARTMENTS = [
  { id: 'supply', name: 'Supply Chain', desc: 'Material availability, transport planning, and inventory levels are reviewed to support market needs.', icon: Truck },
  { id: 'marketing', name: 'Marketing', desc: 'Insights from consumer research are used to refine brand messaging and packaging direction.', icon: BarChart3 },
  { id: 'sales', name: 'Sales', desc: 'Customer discussions focus on order volumes, promotions, and achievement of monthly targets.', icon: TrendingUp },
  { id: 'technical', name: 'Technical', desc: 'Process stability and equipment performance are assessed to ensure consistent product quality.', icon: Settings },
  { id: 'finance', name: 'Finance', desc: 'Spending trends are assessed to identify risks or variances.', icon: CreditCard },
];

const INITIAL_XP = 2500;
const MAX_XP = 5000;
const INITIAL_TIME = 270; // 4:30

export default function App() {
  // --- State ---
  const [shuffledDepts, setShuffledDepts] = useState([...DEPARTMENTS]);
  const [shuffledZones, setShuffledZones] = useState([...DEPARTMENTS]);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(INITIAL_XP);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [isMuted, setIsMuted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [draggedId, setDraggedId] = useState<string|null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string|null>(null);

  const timerRef = useRef<NodeJS.Timeout|null>(null);

  // --- Audio Engine ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((type: OscillatorType, freq: number, duration: number, vol = 0.18, attack = 0.01, release = 0.12) => {
    if (isMuted) return;
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration - release);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, [isMuted]);

  const soundPickup = useCallback(() => playTone('sine', 520, 0.12, 0.12), [playTone]);
  const soundDragOver = useCallback(() => playTone('sine', 660, 0.08, 0.07), [playTone]);
  const soundTick = useCallback(() => playTone('square', 880, 0.05, 0.04), [playTone]);
  
  const soundCorrect = useCallback(() => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => playTone('sine', f, 0.22, 0.15), i * 70));
  }, [playTone]);

  const soundWrong = useCallback(() => {
    playTone('sawtooth', 180, 0.28, 0.12);
    setTimeout(() => playTone('sawtooth', 140, 0.22, 0.10), 90);
  }, [playTone]);

  const soundWin = useCallback(() => {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((f, i) => setTimeout(() => playTone('sine', f, 0.3, 0.14), i * 110));
    const chord = [523, 659, 784, 1047];
    setTimeout(() => {
      chord.forEach((f, i) => setTimeout(() => playTone('sine', f, 0.8, 0.1), i * 40));
    }, melody.length * 110 + 80);
  }, [playTone]);

  // --- Initialization ---
  const initGame = useCallback(() => {
    setShuffledDepts([...DEPARTMENTS].sort(() => Math.random() - 0.5));
    setShuffledZones([...DEPARTMENTS].sort(() => Math.random() - 0.5));
    setMatched({});
    setScore(0);
    setStreak(0);
    setXp(INITIAL_XP);
    setTimeLeft(INITIAL_TIME);
    setIsGameOver(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // --- Timer ---
  useEffect(() => {
    if (isGameOver) return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          setIsGameOver(true);
          return 0;
        }
        if (prev <= 31) {
          soundTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameOver]);

  // --- Matching Logic ---
  const handleMatch = (deptId: string, zoneId: string) => {
    if (deptId === zoneId) {
      soundCorrect();
      setMatched((prev) => ({ ...prev, [deptId]: true }));
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      
      const streakBonus = streak * 50;
      setXp((prev) => Math.min(MAX_XP, prev + 100 + streakBonus));
      
      // Mini mini celebration
      confetti({
        particleCount: 40,
        spread: 30,
        origin: { y: 0.7 },
        colors: ['#1e5aab', '#f5c842', '#27c97a']
      });

      if (score + 1 === DEPARTMENTS.length) {
        setIsGameOver(true);
        setTimeout(() => {
          confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
          soundWin();
        }, 300);
      }
    } else {
      soundWrong();
      setStreak(0);
      setXp((prev) => Math.max(0, prev - 50));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center p-4 min-h-screen selection:bg-nestle-gold selection:text-nestle-blue-dark relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 nestle-pattern pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-1 bg-linear-to-r from-nestle-blue via-nestle-gold to-success opacity-30 z-50" />
      
      <motion.div 
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-5xl bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/50 shadow-[0_24px_100px_rgba(26,58,107,0.12)] overflow-hidden"
      >
        {/* Top Header - Dashboard Style */}
        <header className="px-8 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 5 }}
              className="w-12 h-12 bg-nestle-blue rounded-xl shadow-lg flex items-center justify-center ring-4 ring-nestle-blue/5"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                 <path d="M12 3C9 3 6.5 5 6 8c-1.5.5-2.5 2-2.5 3.5C3.5 14 5.5 16 8 16h8c2.5 0 4-2 4-4s-1.5-3.5-3.5-3.5C16 5.5 14.5 3 12 3z"/>
                 <path d="M10 16v4M14 16v4M8 20h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </motion.div>
            <div>
              <h1 className="font-brand font-black text-2xl text-nestle-blue-dark tracking-tight uppercase leading-none">Nestlé</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Strategic Alignment Board</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Bento Stats */}
            <div className="flex items-center gap-2 bg-slate-100/50 rounded-2xl px-4 py-2 border border-slate-200 shadow-[0_2px_10px_rgba(30,90,171,0.05)]">
              <Star className="w-4 h-4 text-nestle-gold fill-nestle-gold" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Global XP</span>
                <span className="text-sm font-black text-nestle-blue-dark">{xp}</span>
              </div>
            </div>

            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all shadow-[0_2px_10px_rgba(30,90,171,0.05)] ${timeLeft <= 30 ? 'bg-error/5 border-error/20 text-error' : 'bg-slate-100/50 border-slate-200 text-nestle-blue-dark'}`}>
              <Timer className="w-4 h-4 opacity-70" />
              <span className="text-sm font-black tabular-nums">{formatTime(timeLeft)}</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-2xl border border-slate-200 text-nestle-blue-dark shadow-[0_2px_10px_rgba(30,90,171,0.05)]">
              <Trophy className="w-4 h-4 text-nestle-gold" />
              <span className="text-sm font-black">{score}/5</span>
            </div>

            <div className="h-10 w-px bg-slate-200 mx-1 hidden md:block" />

            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 bg-slate-100/50 rounded-2xl border border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors text-nestle-blue-dark"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Info Banner */}
        <div className="bg-nestle-blue-dark px-4 sm:px-8 py-2 flex items-center justify-center gap-4 sm:gap-8 text-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-nestle-gold animate-pulse" />
            <span className="text-[8px] sm:text-[10px] font-brand font-black text-white/50 uppercase tracking-[0.2em]">Strategy Active</span>
          </div>
          <AnimatePresence mode="wait">
            {streak > 1 && (
              <motion.div 
                key={streak}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="flex items-center gap-2"
              >
                <div className="bg-nestle-gold px-1.5 sm:px-2 py-0.5 rounded text-[7px] sm:text-[9px] font-black text-nestle-blue-dark uppercase">Combo x{streak}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Area - Fixed 2-Column Layout with Height Alignment */}
        <div className="p-4 sm:p-8 lg:p-8 bg-linear-to-b from-white/20 to-slate-50/50">
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-6 mb-4 sm:mb-6">
            {/* Column Headlines */}
            <div className="flex items-center justify-between">
              <h2 className="font-brand font-black text-nestle-blue-dark text-[9px] sm:text-xs uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                <span className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-nestle-blue text-[8px] sm:text-[10px] text-white flex items-center justify-center font-brand font-black">1</span>
                Available <span className="hidden sm:inline">Depts</span>
              </h2>
            </div>
            <div className="flex items-center justify-between">
              <h2 className="font-brand font-black text-nestle-blue-dark text-[9px] sm:text-xs uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                <span className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-nestle-gold text-[8px] sm:text-[10px] text-nestle-blue-dark flex items-center justify-center font-brand font-black">2</span>
                Alignment <span className="hidden sm:inline">Zones</span>
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {Array.from({ length: DEPARTMENTS.length }).map((_, index) => {
              const dept = shuffledDepts[index];
              const zone = shuffledZones[index];
              const isMatched = matched[dept.id];
              const isCorrect = matched[zone.id];
              const isActive = activeZoneId === zone.id;
              const Icon = dept.icon;

              return (
                <React.Fragment key={index}>
                  {/* Department Card */}
                  <motion.div
                    layoutId={dept.id}
                    draggable={!isMatched}
                    onDragStart={() => {
                      setDraggedId(dept.id);
                      soundPickup();
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    whileHover={!isMatched ? { scale: 1.02, x: 4 } : {}}
                    whileTap={!isMatched ? { scale: 0.98 } : {}}
                    className={`
                      group relative flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 p-4 sm:p-5 lg:p-6 min-h-[90px] sm:min-h-[110px] rounded-xl sm:rounded-2xl border transition-all cursor-grab active:cursor-grabbing
                      ${isMatched 
                        ? 'bg-slate-100/50 border-slate-200 opacity-30 grayscale cursor-default pointer-events-none' 
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-lg hover:border-nestle-blue/30'}
                    `}
                  >
                    <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all shrink-0 ring-4 ring-transparent ${isMatched ? 'bg-slate-100 border-slate-200 shadow-none' : 'bg-slate-50 border-slate-100 shadow-xs group-hover:bg-nestle-blue/5 group-hover:ring-nestle-blue/5 group-hover:border-nestle-blue/20'}`}>
                      <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${isMatched ? 'text-slate-400' : 'text-nestle-blue'}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
                      <span className={`block font-display font-black text-[10px] sm:text-sm lg:text-base leading-tight ${isMatched ? 'text-slate-400' : 'text-nestle-blue-dark'}`}>
                        {dept.name}
                      </span>
                    </div>
                    {!isMatched && (
                      <div className="hidden lg:flex flex-col gap-1 opacity-10 group-hover:opacity-30 transition-opacity">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex gap-1">
                            <div className="w-1 h-1 bg-nestle-blue-dark rounded-full" />
                            <div className="w-1 h-1 bg-nestle-blue-dark rounded-full" />
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Alignment Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!isCorrect) {
                        if (activeZoneId !== zone.id) {
                          soundDragOver();
                        }
                        setActiveZoneId(zone.id);
                      }
                    }}
                    onDragLeave={() => setActiveZoneId(null)}
                    onDrop={() => {
                      setActiveZoneId(null);
                      if (draggedId) handleMatch(draggedId, zone.id);
                    }}
                    className={`
                      relative flex flex-col-reverse sm:flex-row items-center sm:items-center gap-4 sm:gap-5 p-4 sm:p-5 lg:p-6 min-h-[90px] sm:min-h-[110px] rounded-xl sm:rounded-2xl border transition-all duration-300
                      ${isCorrect 
                        ? 'bg-success/5 border-success/30 ring-1 ring-success/20' 
                        : isActive 
                        ? 'bg-nestle-blue/5 border-nestle-blue scale-[1.02] shadow-xl' 
                        : 'bg-white border-slate-200 border-dashed border-2'}
                    `}
                  >
                    <AnimatePresence>
                      {isCorrect && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute -top-2 sm:-top-3 right-1 sm:right-auto sm:left-6 bg-success px-1 sm:px-2.5 py-0.5 sm:py-1 rounded shadow-sm border border-white z-10"
                        >
                          <span className="text-[6px] sm:text-[9px] font-black text-white uppercase tracking-wider flex items-center gap-0.5 sm:gap-1">
                            <CheckCircle2 className="w-1.5 h-1.5 sm:w-3 sm:h-3" />
                            Aligned
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex-1 text-center sm:text-left">
                      <p className={`text-[9px] sm:text-[13px] lg:text-[15px] font-bold leading-tight sm:leading-snug transition-colors ${isCorrect ? 'text-success-dark font-black' : 'text-slate-600'}`}>
                        {zone.desc}
                      </p>
                    </div>

                    <div className={`w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl flex items-center justify-center border transition-all shrink-0 ${isCorrect ? 'bg-success/15 border-success/20 shadow-inner' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                      {isCorrect ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <CheckCircle2 className="w-5 h-5 sm:w-7 sm:h-7 text-success" strokeWidth={3} />
                        </motion.div>
                      ) : (
                        <div className={`w-4 h-4 sm:w-7 sm:h-7 rounded-full border-2 border-dashed transition-all ${isActive ? 'rotate-45 border-nestle-blue' : 'border-slate-200'}`} />
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Win/Loss Overlay */}
        <AnimatePresence>
          {isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-nestle-blue-dark/95 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="absolute inset-0 nestle-pattern opacity-10" />

              <motion.div 
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                className="w-32 h-32 bg-linear-to-br from-nestle-gold to-orange-400 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_80px_rgba(245,200,66,0.4)] mb-10 relative z-10"
              >
                <Trophy className="w-16 h-16 text-nestle-blue-dark" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-white/20 rounded-[2.5rem] blur-xl"
                />
              </motion.div>

              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="font-display font-black text-6xl text-white mb-4 tracking-tighter relative z-10"
              >
                {score === 5 ? 'Elite' : 'Mission'} <span className="text-nestle-gold">Success</span>
              </motion.h1>
              
              <motion.p 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-white/60 text-xl mb-12 max-w-sm font-medium relative z-10"
              >
                {score === 5 
                  ? "You've successfully aligned all Nestle departments with their strategic global objectives." 
                  : "Challenge complete! Review the alignments to achieve a perfect professional score next time."}
              </motion.p>

              <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mb-16 relative z-10">
                {[
                  { label: 'Global Score', val: `${score}/5`, color: 'text-nestle-gold' },
                  { label: 'Time Efficiency', val: formatTime(timeLeft), color: 'text-nestle-blue-light' },
                  { label: 'Total XP Points', val: xp, color: 'text-success' },
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-[2rem] p-7 flex flex-col items-center backdrop-blur-sm shadow-2xl"
                  >
                    <span className={`font-display font-black text-4xl mb-2 ${stat.color}`}>{stat.val}</span>
                    <span className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">{stat.label}</span>
                  </motion.div>
                ))}
              </div>

              <motion.button 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(245, 200, 66, 0.4)' }}
                whileTap={{ scale: 0.95 }}
                onClick={initGame}
                className="bg-nestle-gold text-nestle-blue-dark font-display font-black px-12 py-5 rounded-2xl flex items-center justify-center gap-4 shadow-xl transition-all relative z-10 text-lg"
              >
                <RotateCcw className="w-6 h-6" />
                INITIATE NEW CHALLENGE
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Footer Branding */}
      <footer className="fixed bottom-8 flex flex-col items-center gap-3 pointer-events-none opacity-50 transition-opacity hover:opacity-100">
        <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-nestle-blue-dark" />
            <div className="w-1 h-1 rounded-full bg-nestle-gold" />
            <div className="w-1 h-1 rounded-full bg-nestle-blue-dark" />
        </div>
        <p className="text-[9px] text-nestle-blue-dark font-black uppercase tracking-[0.25em]">
          Good Food, Good Life &mdash; Professional Development Series
        </p>
      </footer>
    </div>
  );
}
