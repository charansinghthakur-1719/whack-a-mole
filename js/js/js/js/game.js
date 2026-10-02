// js/game.js
import { CONFIG } from './config.js';
import { TauntManager } from './taunts.js';
import { AudioEngine } from './audio.js';

const GAME_STATES = {
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER'
};

class WhackAMoleGame {
  constructor() {
    this.state = GAME_STATES.IDLE;
    this.taunts = new TauntManager();
    this.audio = new AudioEngine();

    // State Data
    this.score = 0;
    this.highScore = Number(localStorage.getItem('wam_pro_highscore')) || 0;
    this.timeLeft = CONFIG.gameDuration;
    this.streak = 0;
    this.maxStreak = 0;
    this.totalClicks = 0;
    this.successfulHits = 0;

    // Active timers & hole tracking
    this.activeHoles = new Map(); // holeIndex -> timeoutId
    this.spawnTimer = null;
    this.clockTimer = null;
    this.speedMultiplier = 1;

    // DOM References
    this.boardEl = document.getElementById('game-board');
    this.scoreEl = document.getElementById('score-display');
    this.timerEl = document.getElementById('timer-display');
    this.streakEl = document.getElementById('streak-display');
    this.highScoreEl = document.getElementById('highscore-display');
    this.stateBadgeEl = document.getElementById('state-badge');
    this.startBtn = document.getElementById('start-btn');
    this.muteBtn = document.getElementById('mute-btn');
    this.voiceBtn = document.getElementById('voice-btn');
    this.modalEl = document.getElementById('modal-overlay');

    this._initBoard();
    this._bindEvents();
    this._updateHUD();
  }

  _initBoard() {
    this.boardEl.innerHTML = '';
    for (let i = 0; i < CONFIG.gridSize; i++) {
      const slot = document.createElement('div');
      slot.className = 'hole-slot';
      slot.dataset.index = i;
      slot.innerHTML = `
        <div class="hole-mask">
          <div class="hole-pit"></div>
          <div class="mole" data-index="${i}" data-type="regular">
            ${this._getMoleSVG('regular')}
          </div>
          <div class="hole-lip"></div>
        </div>
      `;
      this.boardEl.appendChild(slot);
    }
  }

  _getMoleSVG(type) {
    const crown = type === 'golden'
      ? `<polygon points="28,18 38,4 50,15 62,4 72,18" fill="#facc15" stroke="#0f172a" stroke-width="2.5"/>`
      : '';
    const bodyColor = type === 'golden' ? '#eab308' : type === 'bomb' ? '#e11d48' : '#854d0e';
    const snoutColor = type === 'bomb' ? '#fda4af' : '#fef08a';

    return `
      <svg viewBox="0 0 100 110" width="100%" height="100%">
        ${crown}
        <!-- Mole Body -->
        <path d="M18,105 L18,48 C18,20 82,20 82,48 L82,105 Z" fill="${bodyColor}" stroke="#0f172a" stroke-width="4"/>
        <!-- Eyes -->
        <circle cx="37" cy="46" r="6" fill="#0f172a"/>
        <circle cx="63" cy="46" r="6" fill="#0f172a"/>
        <circle cx="35" cy="44" r="2" fill="#ffffff"/>
        <circle cx="61" cy="44" r="2" fill="#ffffff"/>
        <!-- Snout & Smug Grin -->
        <ellipse cx="50" cy="62" rx="18" ry="12" fill="${snoutColor}" stroke="#0f172a" stroke-width="3"/>
        <ellipse cx="50" cy="57" rx="6" ry="4" fill="#0f172a"/>
        <!-- Buck Teeth -->
        <rect x="44" y="72" width="5" height="7" rx="1" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
        <rect x="51" y="72" width="5" height="7" rx="1" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
      </svg>
    `;
  }

  _bindEvents() {
    // Single delegated listener on the board (Zero memory leaks)
    this.boardEl.addEventListener('pointerdown', (e) => this._handleBoardClick(e));

    this.startBtn.addEventListener('click', () => this.startGame());
    document.getElementById('play-again-btn').addEventListener('click', () => {
      this.modalEl.classList.add('hidden');
      this.startGame();
    });

    this.muteBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.muteBtn.textContent = `SFX: ${this.audio.muted ? 'OFF' : 'ON'}`;
    });

    this.voiceBtn.addEventListener('click', () => {
      this.audio.voiceEnabled = !this.audio.voiceEnabled;
      this.voiceBtn.textContent = `Voice Taunts: ${this.audio.voiceEnabled ? 'ON' : 'OFF'}`;
    });
  }

  startGame() {
    if (this.state === GAME_STATES.PLAYING) return; // Prevent start button spam

    this._clearAllTimers();
    this.state = GAME_STATES.PLAYING;
    this.score = 0;
    this.timeLeft = CONFIG.gameDuration;
    this.streak = 0;
    this.maxStreak = 0;
    this.totalClicks = 0;
    this.successfulHits = 0;
    this.speedMultiplier = 1;

    this._updateHUD();
    this.startBtn.disabled = true;
    this.startBtn.textContent = 'IN PROGRESS...';

    // Start 1-second game clock
    this.clockTimer = setInterval(() => {
      this.timeLeft--;
      // Ramp difficulty every 6 seconds
      if (this.timeLeft % 6 === 0 && this.timeLeft > 0) {
        this.speedMultiplier *= CONFIG.difficultyRampFactor;
      }
      this._updateHUD();

      if (this.timeLeft <= 0) {
        this.endGame();
      }
    }, 1000);

    this._scheduleNextSpawn();
  }

  _scheduleNextSpawn() {
    if (this.state !== GAME_STATES.PLAYING) return;

    const [min, max] = CONFIG.baseSpawnInterval;
    const delay = (min + Math.random() * (max - min)) * this.speedMultiplier;

    this.spawnTimer = setTimeout(() => {
      this._spawnMole();
      this._scheduleNextSpawn();
    }, delay);
  }

  _spawnMole() {
    if (this.state !== GAME_STATES.PLAYING) return;
    if (this.activeHoles.size >= CONFIG.maxConcurrentMoles) return;

    // Pick random unoccupied hole
    const available = [];
    for (let i = 0; i < CONFIG.gridSize; i++) {
      if (!this.activeHoles.has(i)) available.push(i);
    }
    if (available.length === 0) return;

    const holeIdx = available[Math.floor(Math.random() * available.length)];
    const type = this._rollMoleType();

    const slotEl = this.boardEl.children[holeIdx];
    const moleEl = slotEl.querySelector('.mole');

    moleEl.dataset.type = type;
    moleEl.dataset.whacked = 'false';
    moleEl.innerHTML = this._getMoleSVG(type);
    moleEl.classList.remove('whacked');
    moleEl.classList.add('up');

    this.audio.playPop();

    const [minStay, maxStay] = CONFIG.baseStayDuration;
    const stayTime = Math.max(
      CONFIG.minStayDuration,
      (minStay + Math.random() * (maxStay - minStay)) * this.speedMultiplier
    );

    const hideTimeout = setTimeout(() => {
      const wasWhacked = moleEl.dataset.whacked === 'true';
      moleEl.classList.remove('up');
      this.activeHoles.delete(holeIdx);

      // PASSIVE MISS: A non-bomb mole escaped unharmed!
      if (!wasWhacked && type !== 'bomb' && this.state === GAME_STATES.PLAYING) {
        const hadCombo = this.streak >= 3;
        this.streak = 0;
        this._updateHUD();
        const category = hadCombo ? 'streakBroken' : 'passiveEscape';
        this._triggerRageBait(holeIdx, category);
      }
    }, stayTime);

    this.activeHoles.set(holeIdx, hideTimeout);
  }

  _rollMoleType() {
    const r = Math.random();
    if (r < CONFIG.probabilities.golden) return 'golden';
    if (r < CONFIG.probabilities.golden + CONFIG.probabilities.bomb) return 'bomb';
    return 'regular';
  }

  _handleBoardClick(e) {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.totalClicks++;

    const moleEl = e.target.closest('.mole');
    const slotEl = e.target.closest('.hole-slot');

    // Check if player hit an active, un-whacked mole
    if (moleEl && moleEl.classList.contains('up') && moleEl.dataset.whacked !== 'true') {
      const holeIdx = Number(moleEl.dataset.index);
      const type = moleEl.dataset.type;

      // Lock immediately to prevent double-click exploit
      moleEl.dataset.whacked = 'true';
      moleEl.classList.add('whacked');
      clearTimeout(this.activeHoles.get(holeIdx));

      setTimeout(() => {
        moleEl.classList.remove('up', 'whacked');
        this.activeHoles.delete(holeIdx);
      }, 180);

      this._processHit(holeIdx, type);
    } else {
      // ACTIVE MISS (Whiffed on empty dirt or retreating mole)
      const targetHoleIdx = slotEl
        ? Number(slotEl.dataset.index)
        : Math.floor(Math.random() * CONFIG.gridSize);

      const hadCombo = this.streak >= 3;
      this.streak = 0;
      this.score = Math.max(0, this.score + CONFIG.points.whiffPenalty);
      this.audio.playWhiff();
      this._updateHUD();

      const category = hadCombo ? 'streakBroken' : 'activeMiss';
      this._triggerRageBait(targetHoleIdx, category);
    }
  }

  _processHit(holeIdx, type) {
    this.successfulHits++;
    this.audio.playHit(type);

    if (type === 'bomb') {
      this.streak = 0;
      this.score = Math.max(0, this.score + CONFIG.points.bomb);
      this._showScorePop(holeIdx, `${CONFIG.points.bomb}`, '#f43f5e');
      this._triggerRageBait(holeIdx, 'streakBroken');
    } else {
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      const multiplier = this.streak >= 6 ? 2 : this.streak >= 3 ? 1.5 : 1;
      const earned = Math.round(CONFIG.points[type] * multiplier);
      this.score += earned;

      const color = type === 'golden' ? '#facc15' : '#38bdf8';
      this._showScorePop(holeIdx, `+${earned}`, color);
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('wam_pro_highscore', this.highScore);
    }

    this._updateHUD();
  }

  _triggerRageBait(holeIdx, category) {
    const insult = this.taunts.getTaunt(category);
    if (!insult) return;

    const slotEl = this.boardEl.children[holeIdx];
    if (!slotEl) return;

    // Remove existing bubble on this hole if present
    const existing = slotEl.querySelector('.taunt-bubble');
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'taunt-bubble';
    bubble.textContent = insult;
    slotEl.appendChild(bubble);

    this.audio.speakTaunt(insult);

    setTimeout(() => bubble.remove(), 1550);
  }

  _showScorePop(holeIdx, text, color) {
    const slotEl = this.boardEl.children[holeIdx];
    const pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.style.color = color;
    pop.textContent = text;
    slotEl.appendChild(pop);
    setTimeout(() => pop.remove(), 750);
  }

  _updateHUD() {
    this.scoreEl.textContent = String(this.score).padStart(4, '0');
    this.highScoreEl.textContent = String(this.highScore).padStart(4, '0');
    this.timerEl.textContent = `${this.timeLeft}s`;
    this.streakEl.textContent = `${this.streak}x`;
    this.stateBadgeEl.textContent = `STATE: ${this.state}`;
  }

  _clearAllTimers() {
    clearInterval(this.clockTimer);
    clearTimeout(this.spawnTimer);
    this.activeHoles.forEach((timeoutId) => clearTimeout(timeoutId));
    this.activeHoles.clear();
  }

  endGame() {
    this._clearAllTimers();
    this.state = GAME_STATES.GAME_OVER;
    this._updateHUD();

    // Retract any remaining moles
    this.boardEl.querySelectorAll('.mole.up').forEach((m) => m.classList.remove('up'));

    this.startBtn.disabled = false;
    this.startBtn.textContent = 'START GAME';

    const accuracy = this.totalClicks > 0
      ? Math.round((this.successfulHits / this.totalClicks) * 100)
      : 0;

    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-accuracy').textContent = `${accuracy}%`;
    document.getElementById('final-streak').textContent = `${this.maxStreak}x`;
    document.getElementById('modal-subtitle').textContent =
      accuracy < 50
        ? '"LA-HOOO-ZUH-HER! Did you play with your eyes closed?!"'
        : '"Alrighty then! Ssssmokin\' reflexes!"';

    this.modalEl.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new WhackAMoleGame();
});
