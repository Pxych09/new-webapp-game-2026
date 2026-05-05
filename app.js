/**
 * Fruit Game 2026 — Main Application
 * Auth: Google Sign-In (popup)
 * Architecture: Module pattern with clear separation of concerns
 * Principles: DRY, Encapsulation, Utility functions
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════
// CONFIG — paste your Firebase project values here
// ═══════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCp_FRyk-SRUr_tHqwRa6jZBclW9U-hJwQ",
  authDomain: "fruit-game-2026.firebaseapp.com",
  projectId: "fruit-game-2026",
  storageBucket: "fruit-game-2026.firebasestorage.app",
  messagingSenderId: "1007167234923",
  appId: "1:1007167234923:web:b99d77476bc132a544a22e"
};

const GAME_CONFIG = {
  SPIN_COST:        5,
  STARTING_CREDITS: 100,
  GRID_SIZE:        5,
  SPIN_DURATION_MS: 4200,
  TICK_MS:          60,
};

// ═══════════════════════════════════════════════════
// FRUITS CONFIG (Weights for spinning probability)
// ═══════════════════════════════════════════════════
const FRUITS = [
  { emoji: "🍒", value: 1,   weight: 45, label: "cherry" },
  { emoji: "🍍", value: 10,  weight: 12, label: "pineapple" },
  { emoji: "🥭", value: 3,   weight: 18, label: "mango" },
  { emoji: "🍎", value: 5,   weight: 15, label: "apple" },
  { emoji: "🍫", value: 100, weight: 3,  label: "bar" },
  { emoji: "💣", value: 0,   weight: 7,  label: "bomb" },
];

const TOTAL_WEIGHT = FRUITS.reduce((sum, f) => sum + f.weight, 0);

// ═══════════════════════════════════════════════════
// EXACT BORDER LAYOUT — Matching your image
// ═══════════════════════════════════════════════════

const FIXED_LAYOUT = {
  0:"🍒",1:"🍍",2:"💣",3:"🍎",4:"🍒",
  5:"🍎",9:"🍍",
  10:"🍒",14:"🍒",
  15:"💣",19:"💣",
  20:"🍒",21:"🥭",22:"🍫",23:"🥭",24:"🍒"
};

// ═══════════════════════════════════════════════════
// UTILITY HELPERS (Added: May 5)
// ═══════════════════════════════════════════════════

const getWeightedFruit = () => {
  let random = Math.random() * TOTAL_WEIGHT;
  
  for (const fruit of FRUITS) {
    random -= fruit.weight;
    if (random <= 0) return fruit;
  }
  return FRUITS[FRUITS.length - 1]; // fallback
};

// ═══════════════════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════════════════

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);
const provider    = new GoogleAuthProvider();

// ═══════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

const cls = {
  add:    (el, ...c) => el?.classList.add(...c),
  remove: (el, ...c) => el?.classList.remove(...c),
  toggle: (el, c, v) => el?.classList.toggle(c, v),
};

const showEl = (el) => cls.remove(el, "hidden");
const hideEl = (el) => cls.add(el, "hidden");
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));

const formatCurrency = (val)  => `₱${Number(val).toFixed(2)}`;
const formatTime     = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const animateBump = (el, cssClass, duration = 500) => {
  cls.add(el, cssClass);
  setTimeout(() => cls.remove(el, cssClass), duration);
};

// ═══════════════════════════════════════════════════
// GRID UTILITIES  (pure — no DOM)
// ═══════════════════════════════════════════════════

const GridUtils = (() => {
  const SIZE  = GAME_CONFIG.GRID_SIZE;
  const TOTAL = SIZE * SIZE;

  const borderIndices = () => {
    const out = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1)
          out.push(r * SIZE + c);
    return out;
  };

  const isBorder = (idx) => {
    const r = Math.floor(idx / SIZE);
    const c = idx % SIZE;
    return r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
  };

  return { borderIndices, isBorder, SIZE, TOTAL };
})();

// ═══════════════════════════════════════════════════
// FIRESTORE SERVICE
// ═══════════════════════════════════════════════════

const DB = {
  userRef:    (uid) => doc(db, "users", uid),
  historyCol: ()    => collection(db, "gameHistory"),

  async getUser(uid) {
    const snap = await getDoc(DB.userRef(uid));
    return snap.exists() ? snap.data() : null;
  },

  async createUser(uid, email) {
    const data = {
      email,
      credits: GAME_CONFIG.STARTING_CREDITS,
      lastLogin: serverTimestamp(),
      lastClaimAt: null,
    };
    await setDoc(DB.userRef(uid), data);
    return data;
  },

  async ensureUser(uid, email) {
    const existing = await DB.getUser(uid);
    if (existing) {
      await updateDoc(DB.userRef(uid), { lastLogin: serverTimestamp() });
      return existing;
    }
    return DB.createUser(uid, email);
  },

  async updateCredits(uid, credits) {
    await updateDoc(DB.userRef(uid), { credits });
  },

  async logHistory(uid, result, reward) {
    await addDoc(DB.historyCol(), {
      userId: uid, result, reward, createdAt: serverTimestamp(),
    });
  },

  async getRecentHistory(uid, count = 8) {
    const q = query(
      DB.historyCol(),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
};

// ═══════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════

const State = {
  user:       null,   // Firebase Auth user
  userData:   null,   // Firestore document
  isSpinning: false,
};

// ═══════════════════════════════════════════════════
// SCREEN ROUTER
// ═══════════════════════════════════════════════════

const Router = {
  SCREENS: ["screen-auth", "screen-dashboard", "screen-game"],
  goto(id) {
    this.SCREENS.forEach((s) => cls.toggle($(s), "active", s === id));
  },
};

// ═══════════════════════════════════════════════════
// GRID MODULE
// ═══════════════════════════════════════════════════

const GridModule = (() => {
  const borderIdx = GridUtils.borderIndices();
  const fruitLayout = {};

  borderIdx.forEach(idx => {
    const emoji = FIXED_LAYOUT[idx];
    fruitLayout[idx] = FRUITS.find(f => f.emoji === emoji);
  });

  let cells = [];

  const render = () => {
    const grid = $("fruit-grid");
    grid.innerHTML = "";
    cells = [];

    for (let i = 0; i < GridUtils.TOTAL; i++) {
      const el = document.createElement("div");
      const isBorder = GridUtils.isBorder(i);
      
      el.className = isBorder ? "cell fruit" : "cell inner";
      
      if (isBorder) {
        const fruit = fruitLayout[i];
        el.textContent = fruit.emoji;
        el.dataset.index = i;

        if (fruit.emoji === "💣") el.classList.add("bomb");
        if (fruit.emoji === "🍫") el.classList.add("jackpot");
      } else {
        el.textContent = "X";
      }
      
      grid.appendChild(el);
      cells.push(el);
    }
  };

  const clearHighlights = () => borderIdx.forEach(i => 
    cls.remove(cells[i], "lit", "winner")
  );

  const setLit    = (idx) => { clearHighlights(); cls.add(cells[idx], "lit"); };
  const setWinner = (idx) => { clearHighlights(); cls.add(cells[idx], "winner"); };
  const getFruitAt = (idx) => fruitLayout[idx];

  return { render, clearHighlights, setLit, setWinner, getFruitAt, getBorderIndices: () => borderIdx };
})();

// ═══════════════════════════════════════════════════
// HISTORY MODULE
// ═══════════════════════════════════════════════════

const HistoryModule = (() => {
  const buildItem = ({ result, reward, createdAt }) => {
    const el     = document.createElement("div");
    el.className = "history-item";
    const time   = createdAt?.toDate ? formatTime(createdAt.toDate()) : formatTime(new Date());
    el.innerHTML = `
      <span class="hi-fruit">${result}</span>
      <span class="hi-reward">+${formatCurrency(reward)}</span>
      <span class="hi-time">${time}</span>`;
    return el;
  };

  const prepend = (entry) => {
    const list = $("history-list");
    list.prepend(buildItem(entry));
    while (list.children.length > 8) list.lastChild.remove();
  };

  const load = async (uid) => {
    const list = $("history-list");
    list.innerHTML = "";
    try {
      const items = await DB.getRecentHistory(uid);
      items.forEach((item) => list.appendChild(buildItem(item)));
    } catch (_) { /* non-critical */ }
  };

  return { prepend, load };
})();

// ═══════════════════════════════════════════════════
// CREDITS MODULE
// ═══════════════════════════════════════════════════

const CreditsModule = (() => {
  const setDisplay = (val) => {
    const v = Math.floor(val);
    $("hdr-credits").textContent  = v;
    $("game-credits").textContent = v;
  };

  const bump = () => {
    animateBump($("hdr-credits"),  "bump");
    animateBump($("game-credits"), "bump");
  };
  const flashInsufficient = () => animateBump($("game-credits"), "flash-red");

  const deduct = async (amount) => {
    const current = State.userData.credits;
    if (current < amount) return false;
    const updated = current - amount;
    State.userData.credits = updated;
    setDisplay(updated);
    await DB.updateCredits(State.user.uid, updated);
    return true;
  };

  const add = async (amount) => {
    const updated = State.userData.credits + amount;
    State.userData.credits = updated;
    setDisplay(updated);
    bump();
    await DB.updateCredits(State.user.uid, updated);
  };

  return { setDisplay, deduct, add, flashInsufficient };
})();

// ═══════════════════════════════════════════════════
// DAILY REWARD MODULE (Fixed May 5, 2026)
//
// Rules:
//  • Every full 24-hr window since last claim = +100 credits
//  • If never claimed, the account creation counts as time 0
//    (we fall back to a very old date so first-timers always get 100)
//  • Claiming stores `now` as lastClaimAt — countdown resets to 24h
//  • After claim: button is hidden, live countdown shown instead
//  • Countdown ticks every second; when it hits 0 the claim UI reappears
// ═══════════════════════════════════════════════════

const DailyReward = (() => {
  const REWARD_PER_DAY = 100;
  const MS_PER_DAY     = 24 * 60 * 60 * 1000;

  let _countdownInterval = null; // holds setInterval id for cleanup

  // ── Helpers ────────────────────────────────────────

  /** Returns the last-claim Date, or epoch 0 if never claimed. */
  const getLastClaim = () => {
    const raw = State.userData.lastClaimAt;
    if (!raw) return new Date(0);                  // never claimed → treat as very old
    if (raw.toDate) return raw.toDate();            // Firestore Timestamp
    if (raw instanceof Date) return raw;
    return new Date(raw);
  };

  /**
   * How many full 24-hr periods have elapsed since lastClaimAt?
   * e.g. 3 days unclaimed → 300 credits available.
   */
  const getAvailableReward = () => {
    const last      = getLastClaim();
    const elapsedMs = Date.now() - last.getTime();
    const fullDays  = Math.floor(elapsedMs / MS_PER_DAY);
    return fullDays * REWARD_PER_DAY;
  };

  /**
   * How many ms remain until the NEXT reward period opens.
   * (i.e. time until elapsedMs reaches the next multiple of MS_PER_DAY)
   */
  const getMsUntilNext = () => {
    const last      = getLastClaim();
    const elapsedMs = Date.now() - last.getTime();
    // If there's already unclaimed reward this should be 0, but guard anyway.
    const remainder = elapsedMs % MS_PER_DAY;
    return MS_PER_DAY - remainder;
  };

  /** Format milliseconds → "HH:MM:SS" */
  const fmtCountdown = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  };

  // ── DOM targets ────────────────────────────────────
  // We manipulate the .daily-reward container directly.
  const container   = () => document.querySelector(".daily-reward");

  const renderClaimable = (amount) => {
    const c = container();
    if (!c) return;
    c.innerHTML = `
      <span class="credits-label">
        Daily Rewards: <b id="daily-reward-amount" class="credits-val">${amount}</b>
      </span>
      <button id="btn-claim-reward" class="btn-claim">Claim</button>`;

    // Re-bind click (element was recreated)
    c.querySelector("#btn-claim-reward")
      .addEventListener("click", claim);
  };

  const renderCountdown = () => {
    stopCountdown(); // clear any previous interval

    const c = container();
    if (!c) return;

    // Build the "waiting" UI
    c.innerHTML = `
      <span class="credits-label daily-waiting">
        Next free 100 credits in <b id="daily-countdown" class="credits-val"></b>
      </span>`;

    const tick = () => {
      const msLeft = getMsUntilNext();
      const el     = document.getElementById("daily-countdown");
      if (el) el.textContent = fmtCountdown(msLeft);

      // When countdown expires → switch back to claimable UI
      if (msLeft <= 0) {
        stopCountdown();
        updateUI();
      }
    };

    tick(); // run immediately so there's no 1-second blank
    _countdownInterval = setInterval(tick, 1000);
  };

  const stopCountdown = () => {
    if (_countdownInterval !== null) {
      clearInterval(_countdownInterval);
      _countdownInterval = null;
    }
  };

  // ── Public API ─────────────────────────────────────

  /** Call once after login / screen switch to set correct state. */
  const updateUI = () => {
    const amount = getAvailableReward();
    if (amount > 0) {
      stopCountdown();
      renderClaimable(amount);
    } else {
      renderCountdown();
    }
  };

  /** Called when the player taps "Claim". */
  const claim = async () => {
    const amount = getAvailableReward();
    if (amount <= 0) return;

    await CreditsModule.add(amount);

    // Save claim time as the last full-day boundary, NOT `now`,
    // so accumulated days are consumed but partial-day progress is kept.
    // Strategy: advance lastClaimAt by (fullDays × MS_PER_DAY).
    const last     = getLastClaim();
    const fullDays = amount / REWARD_PER_DAY;
    const newClaim = new Date(last.getTime() + fullDays * MS_PER_DAY);

    State.userData.lastClaimAt = newClaim;

    await updateDoc(DB.userRef(State.user.uid), { lastClaimAt: newClaim });

    // Switch to countdown immediately
    renderCountdown();
  };

  return { updateUI, claim, stopCountdown };
})();

// ═══════════════════════════════════════════════════
// SOUND MODULE (lightweight tick + win + bomb)
// ═══════════════════════════════════════════════════

const Sound = (() => {
  let ctx;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playTone = (freq = 800, duration = 0.05, type = "square", volume = 0.05) => {
    const audioCtx = getCtx();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  };

  return {
    tick: () => playTone(900, 0.03),
    win:  () => playTone(1200, 0.15),
    bomb: () => playTone(120, 0.25, "sawtooth", 0.08)
  };
})();

// ═══════════════════════════════════════════════════
// SPIN MODULE
// ═══════════════════════════════════════════════════

const SpinModule = (() => {
  const spinBtn = () => $("btn-spin");

  const setSpinning = (v) => {
    State.isSpinning = v;
    spinBtn().disabled = v;
  };

  const showResult = (fruit) => {
    const resultEl = $("result-text");
    if (fruit.emoji === "💣") {
      resultEl.textContent = `💥 BOOM! Fruit Bomb! You got nothing.`;
      resultEl.style.color = "#ff4444";
    } else {
      resultEl.textContent = `You got ${fruit.emoji} = ${formatCurrency(fruit.value)}`;
      resultEl.style.color = "";
    }
    showEl($("result-display"));
  };

  const animate = async (borders) => {
    const ticks = Math.floor(GAME_CONFIG.SPIN_DURATION_MS / GAME_CONFIG.TICK_MS);
    const winningFruit = getWeightedFruit();

    let winnerIdx = borders.find(idx =>
      GridModule.getFruitAt(idx).emoji === winningFruit.emoji
    );
    if (winnerIdx === undefined) {
      winnerIdx = borders[Math.floor(Math.random() * borders.length)];
    }

    for (let t = 0; t < ticks; t++) {
      const idx = borders[t % borders.length];
      GridModule.setLit(idx);
      Sound.tick();
      await sleep(GAME_CONFIG.TICK_MS);
    }

    GridModule.setWinner(winnerIdx);

    if (winningFruit.emoji === "💣") Sound.bomb();
    else Sound.win();

    return winningFruit;
  };

  const spin = async () => {
    if (State.isSpinning) return;

    const ok = await CreditsModule.deduct(GAME_CONFIG.SPIN_COST);
    if (!ok) {
      CreditsModule.flashInsufficient();
      $("result-text").textContent = "⚠️ Not enough credits!";
      showEl($("result-display"));
      return;
    }

    setSpinning(true);
    hideEl($("result-display"));

    const fruit = await animate(GridModule.getBorderIndices());
    showResult(fruit);

    if (fruit.value > 0) {
      await CreditsModule.add(fruit.value);
    }

    DB.logHistory(State.user.uid, fruit.emoji, fruit.value).catch(() => {});
    HistoryModule.prepend({ result: fruit.emoji, reward: fruit.value, createdAt: null });

    setSpinning(false);
  };

  return { spin };
})();

// ═══════════════════════════════════════════════════
// AUTH MODULE
// ═══════════════════════════════════════════════════

const AuthModule = {
  signIn:  () => signInWithPopup(auth, provider),
  signOut: () => signOut(auth),
};

// ═══════════════════════════════════════════════════
// UI EVENT BINDINGS
// ═══════════════════════════════════════════════════

const bindEvents = () => {
  $("btn-google-signin").addEventListener("click", async () => {
    const btn   = $("btn-google-signin");
    const errEl = $("auth-error");
    btn.disabled = true;
    hideEl(errEl);
    try {
      await AuthModule.signIn();
    } catch (err) {
      errEl.textContent = `Sign-in failed: ${err.message}`;
      showEl(errEl);
      btn.disabled = false;
    }
  });

  // NOTE: btn-claim-reward is now dynamically rendered by DailyReward.renderClaimable()
  // so we do NOT bind it here. The click handler is attached inside renderClaimable().

  $("btn-logout").addEventListener("click",  () => { DailyReward.stopCountdown(); AuthModule.signOut(); });
  $("btn-logout2").addEventListener("click", () => { DailyReward.stopCountdown(); AuthModule.signOut(); });

  $("btn-play-fruit").addEventListener("click", () => {
    Router.goto("screen-game");
    HistoryModule.load(State.user.uid);
    DailyReward.updateUI(); // re-sync countdown when entering game screen
  });

  $("btn-back").addEventListener("click", () => Router.goto("screen-dashboard"));
  $("btn-spin").addEventListener("click", SpinModule.spin);
};

// ═══════════════════════════════════════════════════
// SESSION HANDLERS
// ═══════════════════════════════════════════════════

const onUserSignedIn = async (user) => {
  State.user     = user;
  State.userData = await DB.ensureUser(user.uid, user.email);

  $("hdr-email").textContent  = user.email;
  $("game-email").textContent = user.email;

  const avatar = $("hdr-avatar");
  if (user.photoURL) {
    avatar.src           = user.photoURL;
    avatar.style.display = "block";
  } else {
    avatar.style.display = "none";
  }

  CreditsModule.setDisplay(State.userData.credits);
  GridModule.render();
  Router.goto("screen-dashboard");
  DailyReward.updateUI();
};

const onUserSignedOut = () => {
  DailyReward.stopCountdown();
  State.user     = null;
  State.userData = null;
  Router.goto("screen-auth");
};

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════

const init = () => {
  bindEvents();
  onAuthStateChanged(auth, (user) => {
    if (user) onUserSignedIn(user);
    else      onUserSignedOut();
  });
};

init();
