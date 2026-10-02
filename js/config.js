// js/config.js
export const CONFIG = {
  gridSize: 9,                  // 3x3 layout (can change to 12 or 16 anytime)
  gameDuration: 30,             // Total round time in seconds
  
  // Spawn timing (in milliseconds)
  baseSpawnInterval: [650, 1150],
  baseStayDuration: [650, 1100],
  minStayDuration: 380,         // Fastest possible mole stay time at max difficulty
  difficultyRampFactor: 0.92,   // Speeds up every 6 seconds
  maxConcurrentMoles: 2,        // Max moles allowed up at once
  
  // Scoring rules
  points: {
    regular: 100,
    golden: 300,
    bomb: -150,
    whiffPenalty: 0             // Set to -25 if manager wants penalties for missing
  },
  
  // Spawn probabilities (must add up to 1.0)
  probabilities: {
    regular: 0.72,
    golden: 0.15,
    bomb: 0.13
  },

  // Rage-bait commentary cooldown (ms) to prevent UI spam
  tauntCooldownMs: 850
};
