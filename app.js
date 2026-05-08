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
  deleteDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════
// CONFIG
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
// POP MATCH PRESETS
// ═══════════════════════════════════════════════════

const PM_PRESETS = {
  colors: [
    {
      id:      "default",
      name:    "Arcade Classic",
      price:   0,
      free:    true,
      preview: { cardBorder: "#ff4d6d", matched: "#00b38a", glow: "rgba(255,77,109,0.5)" },
      desc:    "The original arcade look. Always free.",
    },
    {
      id:      "neon",
      name:    "Neon Pulse",
      price:   100,
      free:    false,
      preview: { cardBorder: "#00f5d4", matched: "#7b2fff", glow: "rgba(0,245,212,0.5)" },
      desc:    "Cyan borders, violet matched cards. Electric.",
    },
    {
      id:      "gold",
      name:    "Golden Hour",
      price:   150,
      free:    false,
      preview: { cardBorder: "#f7c948", matched: "#ff8c00", glow: "rgba(247,201,72,0.5)" },
      desc:    "All-gold everything. For the top of the leaderboard.",
    },
    {
      id:      "ghost",
      name:    "Ghost Mode",
      price:   120,
      free:    false,
      preview: { cardBorder: "#a855f7", matched: "#ec4899", glow: "rgba(168,85,247,0.5)" },
      desc:    "Purple & pink. Hauntingly good.",
    },
    {
      id:      "ice",
      name:    "Ice Cold",
      price:   130,
      free:    false,
      preview: { cardBorder: "#38bdf8", matched: "#0ea5e9", glow: "rgba(56,189,248,0.5)" },
      desc:    "Cool blue tones. Keep it frosty.",
    },
  ],

  emojis: [
    {
      id:      "classic",
      name:    "Classic Arcade",
      price:   0,
      free:    true,
      symbols: ["👾","🕹️","💎","⚡","👑","🎲","🚀","🔥","🌌","🌀"],
      desc:    "The original symbol set. Always free.",
    },
    {
      id:      "fruits",
      name:    "Fruit Frenzy",
      price:   100,
      free:    false,
      symbols: ["🍒","🥭","🍎","🍍","🍫","🍓","🍑","🍇","🍉","🥝"],
      desc:    "Familiar fruits from the slot machine, now on cards.",
    },
    {
      id:      "animals",
      name:    "Wild Pack",
      price:   120,
      free:    false,
      symbols: ["🐶","🐱","🦊","🐸","🐧","🦁","🐯","🦋","🐙","🦄"],
      desc:    "Cute but competitive. Don't let the animals fool you.",
    },
    {
      id:      "space",
      name:    "Deep Space",
      price:   150,
      free:    false,
      symbols: ["🪐","🌙","⭐","☄️","🛸","🌟","💫","🔭","🎆","🚀"],
      desc:    "Explore the cosmos one card flip at a time.",
    },
    {
      id:      "food",
      name:    "Junk Food",
      price:   100,
      free:    false,
      symbols: ["🍕","🍔","🌮","🍜","🍣","🧁","🍩","🍦","🥐","🍿"],
      desc:    "Chaotic and delicious. Hunger not included.",
    },
  ],
};

const POP_MATCH_CONFIG = {
  STAGE_REWARDS:   [0, 2, 4, 7, 12, 20], // index = stage number (index 0 unused)
  DAILY_CAP:       50,                    // max credits earnable from Pop Match per day
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
// FIXED BORDER LAYOUT
// ═══════════════════════════════════════════════════

const FIXED_LAYOUT = {
  0:"🍒", 1:"🍍", 2:"💣", 3:"🍎", 4:"🍒",
  5:"🍍",                          9:"🍎",
  10:"🍒",                         14:"🍒",
  15:"💣",                         19:"💣",
  20:"🍒", 21:"🥭", 22:"🍫", 23:"🥭", 24:"🍒"
};

// ═══════════════════════════════════════════════════
// TOAST MODULE
// ═══════════════════════════════════════════════════

const Toast = (() => {
  let _timer = null;

  const show = (text, type = "", duration = 2500) => {
    const el = $("pm-toast");
    if (!el) return;

    // Cancel any existing hide timer and reset animation
    clearTimeout(_timer);
    el.className = "pm-toast";           // strip all type + hiding classes
    el.textContent = text;
    if (type) cls.add(el, type);
    cls.remove(el, "hidden");

    // Force reflow so animation restarts if called back-to-back
    void el.offsetWidth;

    _timer = setTimeout(() => {
      cls.add(el, "hiding");
      el.addEventListener("animationend", () => {
        cls.add(el, "hidden");
        cls.remove(el, "hiding");
      }, { once: true });
    }, duration);
  };

  return { show };
})();

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
  has:    (el, c)    => el?.classList.contains(c) ?? false,
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

const getWeightedFruit = () => {
  let random = Math.random() * TOTAL_WEIGHT;
  for (const fruit of FRUITS) {
    random -= fruit.weight;
    if (random <= 0) return fruit;
  }
  return FRUITS[FRUITS.length - 1];
};

// ═══════════════════════════════════════════════════
// GRID UTILITIES (pure — no DOM)
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
      credits:     GAME_CONFIG.STARTING_CREDITS,
      lastLogin:   serverTimestamp(),
      lastClaimAt: null,
      nickname:    "",
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

  async updateNickname(uid, nickname) {
    await updateDoc(DB.userRef(uid), { nickname });
  },

  /**
   * Fetch top N users ordered by credits descending.
   * Returns array of { uid, email, nickname, credits }
   */
  async getLeaderboard(topN = 20) {
    const q = query(
      collection(db, "users"),
      orderBy("credits", "desc"),
      limit(topN)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  /**
   * Delete all gameHistory entries for this user that are older than today midnight.
   * Uses batched deletes (Firestore max 500 per batch).
   * Fire-and-forget — called silently in the background.
   */
  async purgeOldHistory(uid) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0); // today midnight = anything before this is stale

    const q = query(
      DB.historyCol(),
      where("userId",    "==", uid),
      where("createdAt", "<",  Timestamp.fromDate(cutoff))
    );

    const snap = await getDocs(q);
    if (snap.empty) return; // nothing to purge

    // Firestore batches are capped at 500 ops — chunk if needed
    const BATCH_LIMIT = 499;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    console.log(`[Purge] Deleted ${docs.length} stale history record(s).`);
  },

  /**
   * Fetch all history entries for a user within a specific day.
   * @param {string} uid
   * @param {Date} dayStart  — midnight of the target day (local time)
   * @param {Date} dayEnd    — midnight of the next day (local time)
   */
  async getDayHistory(uid, dayStart, dayEnd) {
    const q = query(
      DB.historyCol(),
      where("userId", "==", uid),
      where("createdAt", ">=", Timestamp.fromDate(dayStart)),
      where("createdAt", "<",  Timestamp.fromDate(dayEnd)),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  /**
   * Get how many Pop Match credits this user has earned today.
   * Stored in users/{uid}.popMatchCreditsToday and popMatchCapDate.
   */
  async getPopMatchDailyEarned(uid) {
    const data = await DB.getUser(uid);
    if (!data) return 0;

    const capDate = data.popMatchCapDate;
    if (!capDate) return 0;

    // Reset if the stored date is from a previous day
    const stored  = capDate.toDate ? capDate.toDate() : new Date(capDate);
    const todayStr = new Date().toDateString();
    if (stored.toDateString() !== todayStr) return 0;

    return data.popMatchCreditsToday || 0;
  },

  /**
   * Increment the user's Pop Match daily earned counter.
   * Also stamps the date so it auto-resets the next calendar day.
   */
  async incrementPopMatchDailyEarned(uid, amount) {
    const current = await DB.getPopMatchDailyEarned(uid);
    await updateDoc(DB.userRef(uid), {
      popMatchCreditsToday: current + amount,
      popMatchCapDate:      new Date(),
    });
  },
  async getInventory(uid) {
    const data = await DB.getUser(uid);
    return data?.popMatchInventory ?? {
      ownedPresets: ["default", "classic"],
      activeColor:  "default",
      activeEmoji:  "classic",
    };
  },

  async saveInventory(uid, inventory) {
    await updateDoc(DB.userRef(uid), { popMatchInventory: inventory });
  },
};

// ═══════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════

const State = {
  user:       null,
  userData:   null,
  isSpinning: false,  // ← single source of truth for spin lock
};

// ═══════════════════════════════════════════════════
// SCREEN ROUTER
// ═══════════════════════════════════════════════════

const Router = {
  SCREENS: ["screen-splash", "screen-auth", "screen-dashboard", "screen-game", "screen-match"],
  goto(id) {
    const splash = $("screen-splash");

    const doSwitch = () => {
      this.SCREENS.forEach((s) => cls.toggle($(s), "active", s === id));
    };

    // If we're leaving the splash, fade it out then switch
    if (splash && cls.has(splash, "active") && id !== "screen-splash") {
      cls.add(splash, "fade-out");
      splash.addEventListener("animationend", () => {
        cls.remove(splash, "active", "fade-out");
        doSwitch();
      }, { once: true });
    } else {
      doSwitch();
    }
  },
};

// ═══════════════════════════════════════════════════
// GRID MODULE
// ═══════════════════════════════════════════════════

const GridModule = (() => {
  const borderIdx   = GridUtils.borderIndices();
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
      const el       = document.createElement("div");
      const isBorder = GridUtils.isBorder(i);
      el.className   = isBorder ? "cell fruit" : "cell inner";

      if (isBorder) {
        const fruit    = fruitLayout[i];
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

  const clearHighlights = () =>
    borderIdx.forEach(i => cls.remove(cells[i], "lit", "winner"));

  const setLit    = (idx) => { clearHighlights(); cls.add(cells[idx], "lit");    };
  const setWinner = (idx) => { clearHighlights(); cls.add(cells[idx], "winner"); };
  const getFruitAt       = (idx) => fruitLayout[idx];
  const getBorderIndices = ()    => borderIdx;

  return { render, clearHighlights, setLit, setWinner, getFruitAt, getBorderIndices };
})();

// ═══════════════════════════════════════════════════
// HISTORY MODULE
// ═══════════════════════════════════════════════════

const HistoryModule = (() => {
  // ── Date helpers ─────────────────────────────────

  /** Returns midnight (00:00:00) of a given date in local time */
  const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const todayEnd   = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+1); return d; };

  // ── In-memory session accumulator (Today only) ────
  // Tracks spins added during the current session before Firestore confirms them
  let _sessionSpins = 0;
  let _sessionWon   = 0;

  // ── DOM helpers ───────────────────────────────────

  const setStatEl = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  const renderStats = ({ todaySpins, todayWon, totalCount }) => {
    setStatEl("stat-today-spins", todaySpins);
    setStatEl("stat-today-won",   todayWon > 0 ? formatCurrency(todayWon) : "₱0.00");
    setStatEl("history-count",    totalCount);
    // Show/hide empty state
    const list  = $("history-list");
    const empty = $("history-empty");
    if (list && empty) {
      if (list.children.length === 0) {
        cls.remove(empty, "hidden");
      } else {
        cls.add(empty, "hidden");
      }
    }
  };

  // ── Build a single history item card ─────────────

  const buildItem = ({ result, reward, createdAt }, isNew = false) => {
    const el     = document.createElement("div");
    el.className = "history-item" + (isNew ? " is-new" : "");
    const time   = createdAt?.toDate ? formatTime(createdAt.toDate()) : formatTime(new Date());
    const isBomb = result === "💣";
    el.innerHTML = `
      <span class="hi-fruit">${result}</span>
      <span class="hi-middle">
        <span class="hi-reward ${isBomb ? "hi-bomb" : ""}">
          ${isBomb ? "💥 Nothing" : "+" + formatCurrency(reward)}
        </span>
        <span class="hi-label">${isBomb ? "Bomb hit!" : "Collected"}</span>
      </span>
      <span class="hi-time">${time}</span>`;
    return el;
  };

  // ── Public: prepend a new spin result (live update) ──

  const prepend = (entry) => {
    const list = $("history-list");
    if (!list) return;

    // Add to list (cap at 50 visible items)
    list.prepend(buildItem(entry, true));
    while (list.children.length > 50) list.lastChild.remove();

    // Remove is-new highlight after animation
    setTimeout(() => list.firstChild?.classList.remove("is-new"), 1500);

    // Update session accumulators
    _sessionSpins += 1;
    _sessionWon   += entry.reward || 0;

    // Update today stats immediately (optimistic, no DB round-trip)
    const todaySpinsEl = $("stat-today-spins");
    const todayWonEl   = $("stat-today-won");
    if (todaySpinsEl) {
      const prev = parseInt(todaySpinsEl.textContent) || 0;
      todaySpinsEl.textContent = prev + 1;
      animateBump(todaySpinsEl, "stat-bump");
    }
    if (todayWonEl && entry.reward > 0) {
      const prev = parseFloat((todayWonEl.textContent || "0").replace("₱","")) || 0;
      todayWonEl.textContent = formatCurrency(prev + entry.reward);
      animateBump(todayWonEl, "stat-bump");
    }

    // Update badge count
    const badge = $("history-count");
    if (badge) {
      badge.textContent = parseInt(badge.textContent || "0") + 1;
      animateBump(badge, "stat-bump");
    }

    // Hide empty state
    cls.add($("history-empty"), "hidden");
  };

  // ── Public: load full history from Firestore ──────

  const load = async (uid) => {
    const list = $("history-list");
    if (!list) return;
    list.innerHTML = "";

    // Silently purge stale records in the background — no await so UI loads immediately
    DB.purgeOldHistory(uid).catch(err => console.warn("[Purge] failed:", err));

    // Reset stats to loading state
    ["stat-today-spins","stat-today-won"].forEach(id => setStatEl(id, "…"));

    try {
      // Parallel fetch: today stats + recent list
      const [todayItems, recentItems] = await Promise.all([
        DB.getDayHistory(uid, todayStart(), todayEnd()),
        DB.getRecentHistory(uid, 50),
      ]);

      const sum = (items) => items.reduce((s, i) => s + (i.reward || 0), 0);

      renderStats({
        todaySpins: todayItems.length,
        todayWon:   sum(todayItems),
        totalCount: recentItems.length,
      });

      // Render recent list
      recentItems.forEach(item => list.appendChild(buildItem(item)));
      if (recentItems.length === 0) {
        cls.remove($("history-empty"), "hidden");
      } else {
        cls.add($("history-empty"), "hidden");
      }

    } catch (err) {
      console.error("History load failed:", err);
      ["stat-today-spins","stat-today-won"]
        .forEach(id => setStatEl(id, "—"));
    }
  };

  return { prepend, load };
})();

// ═══════════════════════════════════════════════════
// CREDITS MODULE
// ═══════════════════════════════════════════════════

const CreditsModule = (() => {
  const setDisplay = (val) => {
    const v = Math.floor(val);
    $("hdr-credits").textContent   = v;
    $("game-credits").textContent  = v;
    $("match-credits").textContent = v;
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
// DAILY REWARD MODULE
// ═══════════════════════════════════════════════════

const DailyReward = (() => {
  const REWARD_PER_DAY = 100;
  const MS_PER_DAY     = 24 * 60 * 60 * 1000;

  let _countdownInterval = null;

  const getLastClaim = () => {
    const raw = State.userData.lastClaimAt;
    if (!raw) return null;
    if (raw.toDate) return raw.toDate();
    if (raw instanceof Date) return raw;
    return new Date(raw);
  };

  const getAvailableReward = () => {
    const last = getLastClaim();
    if (!last) return REWARD_PER_DAY;
    const elapsedMs = Date.now() - last.getTime();
    return Math.floor(elapsedMs / MS_PER_DAY) * REWARD_PER_DAY;
  };

  const getMsUntilNext = () => {
    const last = getLastClaim();
    if (!last) return 0;
    const elapsedMs = Date.now() - last.getTime();
    const remainder = elapsedMs % MS_PER_DAY;
    return MS_PER_DAY - remainder;
  };

  const fmtCountdown = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  };

  const container = () => document.querySelector(".daily-reward");

  const renderClaimable = (amount) => {
    const c = container();
    if (!c) return;
    c.innerHTML = `
      <span class="credits-label">
        🎉 Daily Rewards <b id="daily-reward-amount" class="credits-val">${amount}</b>
      </span>
      <button id="btn-claim-reward" class="btn btn-claim-reward">🎁 Claim</button>`;
    c.querySelector("#btn-claim-reward").addEventListener("click", claim);
  };

  const renderCountdown = () => {
    stopCountdown();
    const c = container();
    if (!c) return;
    c.innerHTML = `
      <span class="credits-label daily-waiting">
        Free +100 credits in <b id="daily-countdown" class="credits-val countdown-val"></b>
      </span>`;

    const tick = () => {
      const msLeft = getMsUntilNext();
      const el = document.getElementById("daily-countdown");
      if (el) el.textContent = fmtCountdown(msLeft);
      if (msLeft <= 1000) { stopCountdown(); updateUI(); }
    };
    tick();
    _countdownInterval = setInterval(tick, 1000);
  };

  const stopCountdown = () => {
    if (_countdownInterval !== null) {
      clearInterval(_countdownInterval);
      _countdownInterval = null;
    }
  };

  const updateUI = () => {
    const amount = getAvailableReward();
    if (amount > 0) { stopCountdown(); renderClaimable(amount); }
    else            { renderCountdown(); }
  };

  const claim = async () => {
    const amount = getAvailableReward();
    if (amount <= 0) return;
    const btn = document.getElementById("btn-claim-reward");
    if (btn) btn.disabled = true;
    await CreditsModule.add(amount);
    const now = new Date();
    State.userData.lastClaimAt = now;
    await updateDoc(DB.userRef(State.user.uid), { lastClaimAt: now });
    renderCountdown();
  };

  return { updateUI, claim, stopCountdown };
})();

// ═══════════════════════════════════════════════════
// SOUND MODULE
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
    tick: () => playTone(900,  0.03),
    win:  () => playTone(1200, 0.15),
    bomb: () => playTone(120,  0.25, "sawtooth", 0.08),
  };
})();

// ═══════════════════════════════════════════════════
// SPIN MODULE
// ═══════════════════════════════════════════════════

const SpinModule = (() => {
  const spinBtn = () => $("btn-spin");

  /**
   * Central lock setter — always keeps State.isSpinning and the
   * button's disabled attribute in sync. Call this in ONE place only.
   */
  const setSpinning = (v) => {
    State.isSpinning   = v;
    spinBtn().disabled = v;
  };

  const showResult = (fruit) => {
    const resultEl = $("result-text");
    if (fruit.emoji === "💣") {
      resultEl.textContent = "💥 BOOM! Fruit Bomb! You got nothing.";
      resultEl.style.color = "#ff4444";
    } else {
      resultEl.textContent = `You got ${fruit.emoji} = ${formatCurrency(fruit.value)}`;
      resultEl.style.color = "";
    }
    showEl($("result-display"));
  };

  const animate = async (borders) => {
    const ticks        = Math.floor(GAME_CONFIG.SPIN_DURATION_MS / GAME_CONFIG.TICK_MS);
    const winningFruit = getWeightedFruit();

    // let winnerIdx = borders.find(idx =>
    //   GridModule.getFruitAt(idx).emoji === winningFruit.emoji
    // );
    // if (winnerIdx === undefined) {
    //   winnerIdx = borders[Math.floor(Math.random() * borders.length)];
    // }

    const matchingIndices = borders.filter(idx =>
      GridModule.getFruitAt(idx).emoji === winningFruit.emoji
    );

    const winnerIdx =
      matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

    for (let t = 0; t < ticks; t++) {
      GridModule.setLit(borders[t % borders.length]);
      Sound.tick();
      await sleep(GAME_CONFIG.TICK_MS);
    }

    GridModule.setWinner(winnerIdx);
    if (winningFruit.emoji === "💣") Sound.bomb();
    else Sound.win();

    return winningFruit;
  };

  const spin = async () => {
    // ─────────────────────────────────────────────────────────────
    // RAPID-CLICK GUARD: lock immediately — before any async work.
    // This is a synchronous check+set so no second click can slip
    // through between an await and the next state check.
    // ─────────────────────────────────────────────────────────────
    if (State.isSpinning) return;
    setSpinning(true);            // ← lock FIRST, async work AFTER

    // Insufficient credits check
    if (State.userData.credits < GAME_CONFIG.SPIN_COST) {
      CreditsModule.flashInsufficient();
      $("result-text").textContent = "⚠️ Not enough credits!";
      $("result-text").style.color = "";
      showEl($("result-display"));
      setSpinning(false);         // release lock so user can try again
      return;
    }

    hideEl($("result-display"));

    // Deduct credits (we already confirmed balance above)
    await CreditsModule.deduct(GAME_CONFIG.SPIN_COST);

    const fruit = await animate(GridModule.getBorderIndices());
    showResult(fruit);

    if (fruit.value > 0) {
      await CreditsModule.add(fruit.value);
    }

    DB.logHistory(State.user.uid, fruit.emoji, fruit.value).catch(() => {});
    HistoryModule.prepend({ result: fruit.emoji, reward: fruit.value, createdAt: null });
    LeaderboardModule.refreshCurrentUser();

    setSpinning(false);           // release lock when fully done
  };

  return { spin };
})();

// ═══════════════════════════════════════════════════
// POP MATCH SHOP MODULE  (inline panel, above pm-shell)
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// POP MATCH SHOP MODULE  (inline panel, above pm-shell)
// ═══════════════════════════════════════════════════

const ShopModule = (() => {
  let _inventory = {
    ownedPresets: ["default", "classic"],
    activeColor:  "default",
    activeEmoji:  "classic",
  };

  // Which preset is currently being previewed (clicked), null = none
  let _previewId   = null;
  let _previewType = null;

  // ── Init ──────────────────────────────────────────

  const init = async () => {
    if (!State.user) return;
    _inventory = await DB.getInventory(State.user.uid);
    if (!_inventory.ownedPresets.includes("default"))
      _inventory.ownedPresets.push("default");
    if (!_inventory.ownedPresets.includes("classic"))
      _inventory.ownedPresets.push("classic");
    applyActive();
  };

  // ── Apply active preset to board CSS vars ──────────

  const applyActive = () => {
    const colorPreset = PM_PRESETS.colors.find(c => c.id === _inventory.activeColor)
      ?? PM_PRESETS.colors[0];
    applyColorPreset(colorPreset.preview);
  };

  const applyColorPreset = ({ cardBorder, matched, glow }) => {
    const board = $("pm-board");
    if (!board) return;
    board.style.setProperty("--pm-card-border",    cardBorder);
    board.style.setProperty("--pm-matched-bg",     matched);
    board.style.setProperty("--pm-matched-border", matched);
    board.style.setProperty("--pm-card-glow",      glow);
  };

  const getActiveSymbols = () => {
    const pack = PM_PRESETS.emojis.find(e => e.id === _inventory.activeEmoji)
      ?? PM_PRESETS.emojis[0];
    return pack.symbols;
  };

  // ── Click-to-preview ──────────────────────────────
  // Clicking a card toggles it as the previewed preset.
  // Clicking the same card again deselects (reverts board).
  // Only color themes preview live on the board below.

  const togglePreview = (type, presetId) => {
    const alreadyPreviewing = _previewId === presetId && _previewType === type;

    if (alreadyPreviewing) {
      // Deselect — revert board and clear preview state
      _previewId   = null;
      _previewType = null;
      applyActive();
    } else {
      // Select this preset as the active preview
      _previewId   = presetId;
      _previewType = type;
      if (type === "color") {
        const p = PM_PRESETS.colors.find(c => c.id === presetId);
        if (p) applyColorPreset(p.preview);
      }
    }

    renderShopUI();
  };

  const clearPreview = () => {
    _previewId   = null;
    _previewType = null;
    applyActive();
  };

  // ── Confirm dialog ────────────────────────────────

  const showConfirm = (preset) => new Promise((resolve) => {
    const overlay = $("pm-confirm-overlay");
    const titleEl = $("pm-confirm-title");
    const bodyEl  = $("pm-confirm-body");
    const yesBtn  = $("pm-confirm-yes");
    const noBtn   = $("pm-confirm-no");

    titleEl.textContent = `Purchase "${preset.name}"?`;
    bodyEl.innerHTML    = `You are about to buy <strong>${preset.name}</strong> for
      <strong>${preset.price} credits</strong>.<br><br>
      Are you sure you want to proceed?`;

    cls.remove(overlay, "hidden");

    const finish = (result) => {
      cls.add(overlay, "hidden");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click",  onNo);
      overlay.removeEventListener("click", onOverlay);
      resolve(result);
    };

    const onYes     = () => finish(true);
    const onNo      = () => finish(false);
    const onOverlay = (e) => { if (e.target === overlay) finish(false); };

    yesBtn.addEventListener("click",  onYes);
    noBtn.addEventListener("click",   onNo);
    overlay.addEventListener("click", onOverlay);
  });

  // ── Purchase / equip ──────────────────────────────

  const purchase = async (type, presetId) => {
    const list   = type === "color" ? PM_PRESETS.colors : PM_PRESETS.emojis;
    const preset = list.find(p => p.id === presetId);
    if (!preset) return;

    // Already owned → equip directly, no confirm needed
    if (_inventory.ownedPresets.includes(presetId)) {
      await equipPreset(type, presetId);
      return;
    }

    // Not enough credits
    if (State.userData.credits < preset.price) {
      showShopMsg("Not enough credits!", "error");
      return;
    }

    // Confirm dialog
    const confirmed = await showConfirm(preset);
    if (!confirmed) {
      showShopMsg("Purchase cancelled.", "");
      return;
    }

    // Deduct and unlock
    await CreditsModule.deduct(preset.price);
    _inventory.ownedPresets.push(presetId);
    await DB.saveInventory(State.user.uid, _inventory);

    await equipPreset(type, presetId);
    showShopMsg(`✅ ${preset.name} purchased & equipped!`, "success");
  };

  const equipPreset = async (type, presetId) => {
    if (type === "color") _inventory.activeColor = presetId;
    else                  _inventory.activeEmoji = presetId;

    clearPreview();
    await DB.saveInventory(State.user.uid, _inventory);
    applyActive();
    renderShopUI();
    showShopMsg("✅ Equipped!", "success");
  };

  // ── Shop message toast ────────────────────────────
  const showShopMsg = (text, type = "") => Toast.show(text, type);

  // ── Render ────────────────────────────────────────

  const renderShopUI = () => {
    renderSection("color");
    renderSection("emoji");
  };

  const renderSection = (type) => {
    const container = $(`pm-shop-${type}-grid`);
    if (!container) return;
    container.innerHTML = "";

    const list     = type === "color" ? PM_PRESETS.colors : PM_PRESETS.emojis;
    const activeId = type === "color" ? _inventory.activeColor : _inventory.activeEmoji;

    list.forEach(preset => {
      const owned      = _inventory.ownedPresets.includes(preset.id);
      const isActive   = preset.id === activeId;
      const isPrev     = preset.id === _previewId && type === _previewType;

      const card = document.createElement("div");
      card.className = [
        "pm-shop-card",
        isActive ? "pm-shop-card-active"  : "",
        isPrev   ? "pm-shop-card-preview" : "",
      ].filter(Boolean).join(" ");

      // Visual
      const visual = type === "color"
        ? `<div class="pm-shop-swatch" style="
              border-color:${preset.preview.cardBorder};
              box-shadow: 0 0 10px ${preset.preview.glow};
           ">
             <div class="pm-shop-swatch-inner" style="background:${preset.preview.matched}"></div>
           </div>`
        : `<div class="pm-shop-emoji-preview">
             ${preset.symbols.slice(0, 6).map(s => `<span>${s}</span>`).join("")}
           </div>`;

      // Status badge
      let badge = "";
      if (isActive)       badge = `<span class="pm-shop-badge equipped">✓ EQUIPPED</span>`;
      else if (isPrev)    badge = `<span class="pm-shop-badge previewing">👁 PREVIEWING</span>`;
      else if (owned)     badge = `<span class="pm-shop-badge owned">OWNED</span>`;
      else if (preset.free) badge = `<span class="pm-shop-badge free">FREE</span>`;
      else                badge = `<span class="pm-shop-badge price">💰 ${preset.price} cr</span>`;

      // Action button — shown below the badge
      // • Already equipped  → no button (it IS active)
      // • Owned but not equipped → "Equip" button
      // • Not owned, free   → "Equip" button
      // • Not owned, paid   → "Buy & Equip" button (shown always, not just in preview)
      let actionBtn = "";
      if (!isActive) {
        if (owned || preset.free) {
          actionBtn = `<button class="pm-shop-action-btn pm-shop-equip-btn" data-id="${preset.id}" data-type="${type}">
            ✓ Equip
          </button>`;
        } else {
          actionBtn = `<button class="pm-shop-action-btn pm-shop-buy-btn" data-id="${preset.id}" data-type="${type}">
            🛒 Buy · ${preset.price} cr
          </button>`;
        }
      }

      card.innerHTML = `
        ${visual}
        <div class="pm-shop-card-info">
          <span class="pm-shop-card-name">${preset.name}</span>
          <span class="pm-shop-card-desc">${preset.desc}</span>
          ${badge}
          ${actionBtn}
        </div>`;

      // Clicking the card itself toggles preview
      card.addEventListener("click", (e) => {
        // Don't trigger preview when clicking the action button
        if (e.target.closest(".pm-shop-action-btn")) return;
        if (!isActive) togglePreview(type, preset.id);
      });

      // Action button click → purchase or equip
      card.querySelector(".pm-shop-action-btn")
        ?.addEventListener("click", (e) => {
          e.stopPropagation();
          purchase(type, preset.id);
        });

      container.appendChild(card);
    });
  };

  // ── Tab switcher ──────────────────────────────────

  const switchShopTab = (tab) => {
    clearPreview();
    ["color", "emoji"].forEach(t => {
      $(`pm-shop-tab-${t}`)?.classList.toggle("pm-shop-tab-active", t === tab);
      $(`pm-shop-section-${t}`)?.classList.toggle("hidden",         t !== tab);
    });
  };

  // ── Open / close ──────────────────────────────────

  const open = async () => {
    await init();
    renderShopUI();
    const panel = $("pm-shop-panel");
    if (panel) {
      cls.remove(panel, "hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    switchShopTab("color");
  };

  const close = () => {
    clearPreview();
    cls.add($("pm-shop-panel"), "hidden");
  };

  const cancelPreview = () => clearPreview();

  return {
    open, close, init, getActiveSymbols, applyActive,
    switchShopTab, renderShopUI, cancelPreview,
  };
})();

// ═══════════════════════════════════════════════════
// POP MATCH MODULE
// ═══════════════════════════════════════════════════

class PopMatchGame {
  constructor() {
    // All DOM lookups use pm- prefixed IDs
    this.board       = $("pm-board");
    this.timerEl     = $("pm-timer");
    this.scoreEl     = $("pm-score");
    this.highScoreEl = $("pm-highScore");
    this.comboEl     = $("pm-combo");
    this.messageEl   = $("pm-message");
    this.stageEl     = $("pm-stageNum");
    this.mainBtn     = $("pm-mainBtn");

    // this.symbols = ["👾","🕹️","💎","⚡","👑","🎲","🚀","🔥","🌌","🌀"];
    this.symbols = ShopModule.getActiveSymbols();
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    this.currentStage = 1;
    this.maxStages    = 5;

    this.state = {
      firstCard: null, secondCard: null,
      lockBoard: false,
      score: 0, combo: 0, matches: 0,
      timer: 60, interval: null, running: false
    };
    this.isProcessing = false;
  }

  /** Called by Router each time the screen is entered */
  mount() {
     ShopModule.init();
    this.symbols = ShopModule.getActiveSymbols(); // refresh symbols on each entry
    ShopModule.applyActive();                     // apply saved color preset
    this.resetFullGame();
    this.createBoard();
    this.bindEvents();
    this.loadHighScore();
    this.updateButtonState();
  }

  /** Called by Router when leaving the screen — stops the timer */
  unmount() {
    clearInterval(this.state.interval);
    this.state.running = false;
    // Remove the mainBtn listener to avoid stacking on re-entry
    this.mainBtn.replaceWith(this.mainBtn.cloneNode(true));
    this.mainBtn = $("pm-mainBtn");
  }

  bindEvents() {
    // replaceWith above ensures only one listener exists at a time
    this.mainBtn.addEventListener("click", () => {
      if (!this.state.running && !this.isProcessing) this.startNewGame();
    });
  }

  getStageConfig(stage) {
    return {
      pairs: 4 + (stage - 1) * 2,
      time:  Math.max(35, 68 - stage * 5),
      cols:  stage >= 4 ? 5 : 4
    };
  }

  shuffle(array) { return array.sort(() => Math.random() - 0.5); }

  createBoard() {
    this.board.innerHTML = "";
    const config = this.getStageConfig(this.currentStage);
    this.board.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

    const selected = this.symbols.slice(0, config.pairs);
    this.shuffle([...selected, ...selected]).forEach(symbol => {
      const card = document.createElement("div");
      card.className    = "pm-card";          // ← pm- prefix
      card.dataset.symbol = symbol;
      card.textContent  = "?";
      card.addEventListener("click", () => this.onCardClick(card));
      this.board.appendChild(card);
    });
  }

  onCardClick(card) {
    if (!this.state.running || this.state.lockBoard || this.isProcessing ||
        card.classList.contains("matched") || card === this.state.firstCard) return;

    this.playSound("flip");
    this.revealCard(card);

    if (!this.state.firstCard) { this.state.firstCard = card; return; }
    this.state.secondCard = card;
    this.validateMatch();
  }

  revealCard(card) { card.textContent = card.dataset.symbol; card.classList.add("revealed"); }
  hideCard(card)   { if (card) { card.textContent = "?"; card.classList.remove("revealed"); } }

  validateMatch() {
    this.isProcessing = true;
    this.state.lockBoard = true;
    const isMatch = this.state.firstCard.dataset.symbol === this.state.secondCard.dataset.symbol;
    isMatch ? this.handleMatch() : this.handleMismatch();
  }

  handleMatch() {
    this.state.matches++;
    this.state.combo++;
    const points = this.state.combo * 12;
    this.state.score += points;
    this.updateUI();
    this.playSound("match");
    this.state.firstCard.classList.add("matched");
    this.state.secondCard.classList.add("matched");
    this.showMessage(`+${points}`, "success");
    this.resetTurn();
    const config = this.getStageConfig(this.currentStage);
    if (this.state.matches === config.pairs) this.completeStage();
    else this.isProcessing = false;
  }

  handleMismatch() {
    this.playSound("miss");
    this.showMessage("MISS!");
    setTimeout(() => {
      this.hideCard(this.state.firstCard);
      this.hideCard(this.state.secondCard);
      this.resetTurn();
      this.isProcessing = false;
    }, 680);
  }

  resetTurn() {
    this.state.firstCard = null;
    this.state.secondCard = null;
    this.state.lockBoard = false;
  }

  async completeStage() {
    this.state.running = false;
    this.isProcessing  = true;
    this.updateButtonState();

    // ── Score bonus (cosmetic, not credits) ──────────
    const bonus = this.currentStage * 150;
    this.state.score += bonus;
    this.updateUI();
    this.playSound("win");

    // ── Credit reward for clearing this stage ────────
    await this._awardStageCredits(this.currentStage);

    this.showMessage(`STAGE ${this.currentStage} CLEAR! +${bonus} pts`, "success");

    setTimeout(() => {
      if (this.currentStage < this.maxStages) { this.currentStage++; this.startNextStage(); }
      else this.endGame(true);
    }, 1600);
  }

  /**
   * Awards credits for clearing a stage, respecting the daily cap.
   * Shows a toast in the result message and updates the credits display.
   * Silent no-op if the user is not signed in or cap is already reached.
   */
  async _awardStageCredits(stage) {
    if (!State.user || !State.userData) return;

    const reward   = POP_MATCH_CONFIG.STAGE_REWARDS[stage] ?? 0;
    if (reward <= 0) return;

    const earned   = await DB.getPopMatchDailyEarned(State.user.uid);
    const canEarn  = POP_MATCH_CONFIG.DAILY_CAP - earned;

    if (canEarn <= 0) {
      // Cap reached — show a soft message but don't break the game flow
      setTimeout(() =>
        this.showMessage(`Stage ${stage} clear! (Daily cap reached)`, ""), 200);
      return;
    }

    const actual = Math.min(reward, canEarn);

    // Update credits via the shared module (writes to Firestore + updates UI)
    await CreditsModule.add(actual);

    // Update the Pop Match credits display in the top bar
    $("match-credits").textContent = Math.floor(State.userData.credits);

    // Record against the daily cap
    await DB.incrementPopMatchDailyEarned(State.user.uid, actual);

    const capNote = actual < reward ? ` (cap: +${actual})` : "";
    setTimeout(() =>
      this.showMessage(`+${actual} credits earned!${capNote}`, "success"), 200);
  }

  startNewGame()  { this.resetFullGame(); this.startNextStage(); }

  resetFullGame() {
    clearInterval(this.state.interval);
    this.currentStage = 1;
    this.stageEl.textContent = "1";
    Object.assign(this.state, { score: 0, combo: 0, matches: 0, running: false });
    this.isProcessing = false;
    this.updateUI();
  }

  startNextStage() {
    const config = this.getStageConfig(this.currentStage);
    Object.assign(this.state, { timer: config.time, matches: 0, combo: 0 });
    this.stageEl.textContent = this.currentStage;
    this.updateUI();
    this.createBoard();
    this.state.running = true;
    this.isProcessing  = false;
    this.updateButtonState();
    this.startTimer();
  }

  startTimer() {
    clearInterval(this.state.interval);
    this.state.interval = setInterval(() => {
      if (!this.state.running) return;
      this.state.timer--;
      this.timerEl.textContent = this.state.timer;
      if (this.state.timer <= 0) this.endGame(false);
    }, 1000);
  }

  endGame(win) {
    clearInterval(this.state.interval);
    this.state.running = false;
    this.isProcessing  = false;
    this.updateButtonState();
    this.saveHighScore();

    if (win) {
      // Full clear already paid out per-stage — just celebrate
      this.showMessage("GAME COMPLETE! LEGEND! 🎉", "success");
      this.playSound("win");
    } else {
      this.showMessage("TIME'S UP! No credits for incomplete stages.", "error");
      this.playSound("lose");
    }
  }

  updateUI() {
    this.scoreEl.textContent = this.state.score;
    this.comboEl.textContent = `x${this.state.combo}`;
    this.timerEl.textContent = this.state.timer;
  }

  updateButtonState() {
    const fresh = this.currentStage === 1 && this.state.score === 0;
    this.mainBtn.textContent = this.state.running ? "GAME IN PROGRESS" : (fresh ? "START GAME" : "PLAY AGAIN");
    this.mainBtn.disabled    = this.state.running;
  }

  saveHighScore() {
      const current = Number(localStorage.getItem("pop-highscore")) || 0;
      if (this.state.score > current) {
        localStorage.setItem("pop-highscore", this.state.score);
        this.loadHighScore();

        // Persist to Firestore so it appears on the dashboard leaderboard
        if (State.user) {
          updateDoc(DB.userRef(State.user.uid), {
            popMatchHighScore: this.state.score
          }).catch(err => console.warn("High score save failed:", err));
        }
      }
    }

loadHighScore() {
    // Prefer the Firestore value (set during mount) over localStorage
    const stored = State.userData?.popMatchHighScore
      || Number(localStorage.getItem("pop-highscore"))
      || 0;
    // Sync localStorage to whatever is highest
    const local = Number(localStorage.getItem("pop-highscore")) || 0;
    if (stored > local) localStorage.setItem("pop-highscore", stored);
    this.highScoreEl.textContent = Math.max(stored, local);
  }

  showMessage(text, type = "") {
    Toast.show(text, type);
  }

  playSound(type) {
    try {
      const ctx  = this.audioCtx;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      switch (type) {
        case "flip":
          osc.type = "sawtooth"; osc.frequency.value = 900; gain.gain.value = 0.12;
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.start(); osc.stop(ctx.currentTime + 0.15); break;
        case "match":
          osc.type = "sine"; osc.frequency.setValueAtTime(1100, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.35);
          gain.gain.value = 0.3; gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(); osc.stop(ctx.currentTime + 0.4); break;
        case "miss":
          osc.type = "square"; osc.frequency.value = 420; gain.gain.value = 0.2;
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.start(); osc.stop(ctx.currentTime + 0.45); break;
        case "win":
          [1200,1500,1800,2200].forEach((f,i) => setTimeout(() => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f; g.gain.value = 0.25;
            o.connect(g); g.connect(ctx.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            o.stop(ctx.currentTime + 0.6);
          }, i * 70)); break;
        case "lose":
          osc.type = "sawtooth"; osc.frequency.setValueAtTime(650, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.9);
          gain.gain.value = 0.25; gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
          osc.start(); osc.stop(ctx.currentTime + 0.9); break;
      }
    } catch(e) {}
  }
}

// Single instance — created once, mounted/unmounted by Router
const popMatch = new PopMatchGame();

// ═══════════════════════════════════════════════════
// LEADERBOARD MODULE
// Renders on dashboard (#dash-leaderboard-list)
// and on fruit game sidebar (#leaderboard-list)
// ═══════════════════════════════════════════════════

const LeaderboardModule = (() => {
  const MEDALS = ["🥇", "🥈", "🥉"];
  let _activeTab = "credits"; // "credits" | "popmatch"

  // ── Data fetching ─────────────────────────────────

  const fetchCredits = () => DB.getLeaderboard(20);

  const fetchPopMatch = async () => {
    const q = query(
      collection(db, "users"),
      orderBy("popMatchHighScore", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(d => (d.popMatchHighScore ?? 0) > 0);
  };

  // ── Row builders ──────────────────────────────────

  const buildCreditsRow = (entry, rank, currentUid) => {
    const isMe    = entry.uid === currentUid;
    const medal   = MEDALS[rank] ?? null;
    const name    = entry.nickname?.trim() || entry.email?.split("@")[0] || "Player";
    const credits = Math.floor(entry.credits ?? 0);
    const el      = document.createElement("div");
    el.className  = "lb-row" + (isMe ? " lb-row-me" : "");
    el.innerHTML  = `
      <span class="lb-rank">${medal ?? "#" + (rank + 1)}</span>
      <span class="lb-name" title="${entry.email ?? ""}">${name}${isMe ? " <span class='lb-you'>YOU</span>" : ""}</span>
      <span class="lb-credits">${credits.toLocaleString()}</span>`;
    return el;
  };

  const buildPopMatchRow = (entry, rank, currentUid) => {
    const isMe  = entry.uid === currentUid;
    const medal = MEDALS[rank] ?? null;
    const name  = entry.nickname?.trim() || entry.email?.split("@")[0] || "Player";
    const score = Math.floor(entry.popMatchHighScore ?? 0);
    const el    = document.createElement("div");
    el.className = "lb-row" + (isMe ? " lb-row-me" : "");
    el.innerHTML = `
      <span class="lb-rank">${medal ?? "#" + (rank + 1)}</span>
      <span class="lb-name" title="${entry.email ?? ""}">${name}${isMe ? " <span class='lb-you'>YOU</span>" : ""}</span>
      <span class="lb-credits">${score.toLocaleString()} <span class="lb-pts">pts</span></span>`;
    return el;
  };

  // ── Core render — writes to a given list element ──

  const renderInto = (listEl, entries, tab, currentUid) => {
    listEl.innerHTML = "";
    if (entries.length === 0) {
      listEl.innerHTML = `<div class="lb-empty">${
        tab === "popmatch" ? "No scores yet." : "No players yet."
      }</div>`;
      return;
    }
    entries.forEach((entry, i) => {
      listEl.appendChild(
        tab === "popmatch"
          ? buildPopMatchRow(entry, i, currentUid)
          : buildCreditsRow(entry, i, currentUid)
      );
    });
  };

  // ── Render to ALL visible leaderboard containers ──

  const renderAll = (entries, tab) => {
    const uid   = State.user?.uid;
    const lists = [
      $("dash-leaderboard-list"),   // dashboard
      $("leaderboard-list"),        // fruit game sidebar
    ].filter(Boolean);
    lists.forEach(el => renderInto(el, entries, tab, uid));
  };

  // ── Tab switcher (dashboard only) ─────────────────

  const switchTab = async (tab) => {
    _activeTab = tab;

    // Update tab button states on dashboard
    ["credits", "popmatch"].forEach(t => {
      const btn = $(`lb-tab-${t}`);
      if (btn) btn.classList.toggle("lb-tab-active", t === tab);
    });

    // Update count label
    await load(tab);
  };

  // ── Public: load and render ───────────────────────

  const load = async (tab = _activeTab) => {
    // Set loading state in all containers
    [$("dash-leaderboard-list"), $("leaderboard-list")]
      .filter(Boolean)
      .forEach(el => el.innerHTML = `<div class="lb-loading">Loading…</div>`);

    // Update player count label (dashboard only)
    const countEl = $("dash-lb-user-count");

    try {
      const entries = tab === "popmatch"
        ? await fetchPopMatch()
        : await fetchCredits();

      if (countEl) countEl.textContent =
        `${entries.length} player${entries.length !== 1 ? "s" : ""}`;

      renderAll(entries, tab);
    } catch (err) {
      console.error("Leaderboard load failed:", err);
      [$("dash-leaderboard-list"), $("leaderboard-list")]
        .filter(Boolean)
        .forEach(el => el.innerHTML = `<div class="lb-empty">Could not load.</div>`);
    }
  };

  const refreshCurrentUser = () => load();

  // ── Tab button wiring (called once after DOM ready) ─

  const bindTabs = () => {
    $("lb-tab-credits")?.addEventListener("click",  () => switchTab("credits"));
    $("lb-tab-popmatch")?.addEventListener("click", () => switchTab("popmatch"));
  };

  return { load, refreshCurrentUser, bindTabs };
})();

// ═══════════════════════════════════════════════════
// NICKNAME MODULE
// Synced across both top-bars (dashboard + game screen)
// Persisted to Firestore users/{uid}.nickname
// ═══════════════════════════════════════════════════

const NicknameModule = (() => {
  // IDs for the two instances (dashboard + game screen)
  const INSTANCES = [
    { display: "dash-nickname-display", editBtn: "dash-nickname-edit-btn", input: "dash-nickname-input", saveBtn: "dash-nickname-save-btn" },
    { display: "game-nickname-display", editBtn: "game-nickname-edit-btn", input: "game-nickname-input", saveBtn: "game-nickname-save-btn" },
  ];

  // ── Helpers ──────────────────────────────────────

  /** Render the saved name (or placeholder) into all display spans */
  const renderAll = (nickname) => {
    INSTANCES.forEach(({ display }) => {
      const el = $(display);
      if (!el) return;
      if (nickname) {
        el.textContent = nickname;
        cls.remove(el, "empty");
      } else {
        el.textContent = "Set your nickname…";
        cls.add(el, "empty");
      }
    });
  };

  /** Switch one instance into edit mode */
  const openEdit = ({ display, editBtn, input, saveBtn }) => {
    const displayEl = $(display);
    const editBtnEl = $(editBtn);
    const inputEl   = $(input);
    const saveBtnEl = $(saveBtn);

    // Pre-fill with current nickname (not placeholder text)
    inputEl.value = State.userData?.nickname || "";
    cls.add(displayEl, "hidden");
    cls.add(editBtnEl, "hidden");
    cls.remove(inputEl,   "hidden");
    cls.remove(saveBtnEl, "hidden");
    inputEl.focus();
    inputEl.select();
  };

  /** Switch one instance back to display mode */
  const closeEdit = ({ display, editBtn, input, saveBtn }) => {
    cls.remove($(display),  "hidden");
    cls.remove($(editBtn),  "hidden");
    cls.add($(input),   "hidden");
    cls.add($(saveBtn), "hidden");
  };

  /** Save nickname to Firestore and update all displays */
  const save = async ({ display, editBtn, input, saveBtn }) => {
    const saveBtnEl = $(saveBtn);
    const inputEl   = $(input);
    const raw       = inputEl.value.trim();

    // Validate: 1–20 chars, no special abuse
    if (raw.length === 0) { inputEl.focus(); return; }

    cls.add(saveBtnEl, "saving");
    saveBtnEl.disabled = true;

    try {
      State.userData.nickname = raw;
      await DB.updateNickname(State.user.uid, raw);
      renderAll(raw);
      closeEdit({ display, editBtn, input, saveBtn });

      // Flash the saved name on BOTH displays
      INSTANCES.forEach(({ display: d }) => animateBump($(d), "saved-flash"));
    } catch (err) {
      console.error("Nickname save failed:", err);
    } finally {
      cls.remove(saveBtnEl, "saving");
      saveBtnEl.disabled = false;
    }
  };

  // ── Public API ────────────────────────────────────

  /** Call once after user data is loaded */
  const init = (nickname) => {
    renderAll(nickname);

    INSTANCES.forEach((instance) => {
      const { display, editBtn, input, saveBtn } = instance;

      // Clicking the display text also opens edit
      $(display)?.addEventListener("click", () => openEdit(instance));
      $(editBtn)?.addEventListener("click", () => openEdit(instance));

      // Save on ✓ button
      $(saveBtn)?.addEventListener("click", () => save(instance));

      // Save on Enter, cancel on Escape
      $(input)?.addEventListener("keydown", (e) => {
        if (e.key === "Enter")  { e.preventDefault(); save(instance); }
        if (e.key === "Escape") { closeEdit(instance); }
      });
    });
  };

  return { init, renderAll };
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

  $("btn-logout").addEventListener("click",  () => { DailyReward.stopCountdown(); AuthModule.signOut(); });
  $("btn-logout2").addEventListener("click", () => { DailyReward.stopCountdown(); AuthModule.signOut(); });

  // Hamburger toggle for game screen
  const menuBtn  = $("game-menu-btn");
  const menuDrop = $("game-menu-dropdown");
  if (menuBtn && menuDrop) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cls.toggle(menuDrop, "hidden");
    });
    document.addEventListener("click", () => cls.add(menuDrop, "hidden"));
  }

  const enterGame = () => {
    Router.goto("screen-game");
    HistoryModule.load(State.user.uid);
    LeaderboardModule.load();
    DailyReward.updateUI();
  };

  // enterGame reloads history every time — covers both first visit and re-entry
  $("btn-play-fruit").addEventListener("click", enterGame);

    // ADD these two lines right after it:
  $("btn-play-match").addEventListener("click", () => {
    Router.goto("screen-match");
    popMatch.mount();
    // Keep nickname display in sync
    $("match-nickname-display").textContent =
      State.userData?.nickname || State.user?.email?.split("@")[0] || "";
    $("match-credits").textContent = Math.floor(State.userData?.credits ?? 0);
  });

  $("btn-back-match").addEventListener("click", () => {
    popMatch.unmount();
    Router.goto("screen-dashboard");
  });

  $("btn-back").addEventListener("click", () => Router.goto("screen-dashboard"));

  // Single listener — SpinModule.spin() handles all its own locking internally
  $("btn-spin").addEventListener("click", SpinModule.spin);
  LeaderboardModule.bindTabs();

  // Shop button
  $("pm-shop-btn")?.addEventListener("click", () => ShopModule.open());
  $("pm-shop-close")?.addEventListener("click", () => ShopModule.close());

  // Shop tabs
  $("pm-shop-tab-color")?.addEventListener("click", () => ShopModule.switchShopTab("color"));
  $("pm-shop-tab-emoji")?.addEventListener("click", () => ShopModule.switchShopTab("emoji"));
  $("pm-shop-close-btn")?.addEventListener("click", () => ShopModule.close());

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
  NicknameModule.init(State.userData.nickname || "");
  GridModule.render();
  Router.goto("screen-dashboard");
  DailyReward.updateUI();
  // Pre-warm leaderboard so it's ready when user enters the game
  LeaderboardModule.load();
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
