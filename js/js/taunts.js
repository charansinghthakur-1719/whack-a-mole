// js/taunts.js
import { CONFIG } from './config.js';

export const TAUNT_BANK = {
  // Player clicked an empty hole or swung too late
  activeMiss: [
    "ALRIGHTY THEN! Hitting dirt now, are we?!",
    "LA-HOOO-ZUH-HER!",
    "B-E-A-UTIFUL swing... at absolutely nothing!",
    "Ssssmokin'! ...The air, not me!",
    "Do NOT go in there! Seriously, I'm not even there!",
    "Like a glove! ...Except you missed completely!",
    "Excuse me, your poor aim is showing! Bumblebee Tuna!",
    "Is your monitor off, or is that a tactical whiff?!"
  ],
  
  // Mole popped up, waited, and escaped untouched
  passiveEscape: [
    "Too slow! I packed a lunch and took a nap!",
    "Re-he-he-heally thought you'd hit me there!",
    "Alrighty then, I'll just see myself out!",
    "Zero reflexes detected! Fascinating!",
    "You had three business days to click me!",
    "If I wasn't back in 5 minutes... just wait longer!",
    "Good-y for me! Terrible for you!"
  ],

  // Player lost an active combo streak (3+ hits)
  streakBroken: [
    "AAAAND the combo is GONE! Tragic!",
    "Choked under zero pressure! Ssssmokin'!",
    "Nonsense, poopy-pants! There goes your streak!",
    "That combo died faster than your reaction time!"
  ]
};

export class TauntManager {
  constructor() {
    this.bags = {
      activeMiss: [],
      passiveEscape: [],
      streakBroken: []
    };
    this.lastTauntTime = 0;
  }

  _refillAndShuffle(category) {
    const copy = [...TAUNT_BANK[category]];
    // Fisher-Yates shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    this.bags[category] = copy;
  }

  getTaunt(category = 'activeMiss') {
    const now = performance.now();
    if (now - this.lastTauntTime < CONFIG.tauntCooldownMs) {
      return null; // Cooldown active to prevent spam
    }
    this.lastTauntTime = now;

    if (!this.bags[category] || this.bags[category].length === 0) {
      this._refillAndShuffle(category);
    }

    return this.bags[category].pop();
  }
}
