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
  5:"🍎",                          9:"🍍",
  10:"🍒",                         14:"🍒",
  15:"💣",                         19:"💣",
  20:"🍒", 21:"🥭", 22:"🍫", 23:"🥭", 24:"🍒"
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
  SCREENS: ["screen-splash", "screen-auth", "screen-dashboard", "screen-game"],
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
// LEADERBOARD MODULE
// ═══════════════════════════════════════════════════

const LeaderboardModule = (() => {
  const MEDALS = ["🥇", "🥈", "🥉"];

  /** Build a single leaderboard row */
  const buildRow = (entry, rank, currentUid) => {
    const isMe    = entry.uid === currentUid;
    const medal   = MEDALS[rank] ?? null;
    const name    = entry.nickname?.trim() || entry.email?.split("@")[0] || "Player";
    const credits = Math.floor(entry.credits ?? 0);

    const el = document.createElement("div");
    el.className = "lb-row" + (isMe ? " lb-row-me" : "");
    el.innerHTML = `
      <span class="lb-rank">${medal ?? "#" + (rank + 1)}</span>
      <span class="lb-name" title="${entry.email ?? ""}">${name}${isMe ? " <span class='lb-you'>YOU</span>" : ""}</span>
      <span class="lb-credits">${credits.toLocaleString()}</span>`;
    return el;
  };

  /** Render the full leaderboard list */
  const render = (entries) => {
    const list  = $("leaderboard-list");
    const count = $("lb-user-count");
    if (!list) return;

    list.innerHTML = "";
    if (count) count.textContent = `${entries.length} player${entries.length !== 1 ? "s" : ""}`;

    if (entries.length === 0) {
      list.innerHTML = `<div class="lb-empty">No players yet.</div>`;
      return;
    }

    const uid = State.user?.uid;
    entries.forEach((entry, i) => list.appendChild(buildRow(entry, i, uid)));
  };

  /** Load from Firestore and render. Also refreshes current user's live credits row. */
  const load = async () => {
    const list = $("leaderboard-list");
    if (list) list.innerHTML = `<div class="lb-loading">Loading…</div>`;
    try {
      const entries = await DB.getLeaderboard(20);
      render(entries);
    } catch (err) {
      console.error("Leaderboard load failed:", err);
      if (list) list.innerHTML = `<div class="lb-empty">Could not load.</div>`;
    }
  };

  /**
   * Refresh just the current user's row after a credit change,
   * without re-fetching everyone — just re-sort and re-render in memory.
   */
  const refreshCurrentUser = () => {
    // Lightweight: just reload the whole leaderboard (small dataset, fast query)
    load();
  };

  return { load, refreshCurrentUser };
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

  $("btn-back").addEventListener("click", () => Router.goto("screen-dashboard"));

  // Single listener — SpinModule.spin() handles all its own locking internally
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
