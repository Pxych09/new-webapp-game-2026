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
  SPIN_DURATION_MS: 2200,
  TICK_MS:          90,
};

const FRUITS = [
  { emoji: "🍒", value: 1   },
  { emoji: "🥭", value: 3   },
  { emoji: "🍎", value: 5   },
  { emoji: "🍍", value: 10  },
  { emoji: "🍫", value: 100 },
];

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
      credits:   GAME_CONFIG.STARTING_CREDITS,
      lastLogin: serverTimestamp(),
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
  const borderIdx   = GridUtils.borderIndices();
  const fruitLayout = {};
  borderIdx.forEach((idx, i) => { fruitLayout[idx] = FRUITS[i % FRUITS.length]; });

  let cells = [];

  const render = () => {
    const grid = $("fruit-grid");
    grid.innerHTML = "";
    cells = [];

    for (let i = 0; i < GridUtils.TOTAL; i++) {
      const el       = document.createElement("div");
      const isBorder = GridUtils.isBorder(i);
      el.className   = isBorder ? "cell fruit" : "cell inner";
      el.textContent = isBorder ? fruitLayout[i].emoji : "X";
      if (isBorder) el.dataset.index = i;
      grid.appendChild(el);
      cells.push(el);
    }
  };

  const clearHighlights  = () => borderIdx.forEach((i) => cls.remove(cells[i], "lit", "winner"));
  const setLit           = (idx) => { clearHighlights(); cls.add(cells[idx], "lit");    };
  const setWinner        = (idx) => { clearHighlights(); cls.add(cells[idx], "winner"); };
  const getFruitAt       = (idx) => fruitLayout[idx];
  const getBorderIndices = ()    => borderIdx;

  return { render, clearHighlights, setLit, setWinner, getFruitAt, getBorderIndices };
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

  const bump              = () => {
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
// SPIN MODULE
// ═══════════════════════════════════════════════════

const SpinModule = (() => {
  const spinBtn     = ()  => $("btn-spin");
  const setSpinning = (v) => { State.isSpinning = v; spinBtn().disabled = v; };

  const showResult = ({ emoji, value }) => {
    $("result-text").textContent = `You got ${emoji} = ${formatCurrency(value)}`;
    showEl($("result-display"));
  };

  const animate = async (borders) => {
    const ticks     = Math.floor(GAME_CONFIG.SPIN_DURATION_MS / GAME_CONFIG.TICK_MS);
    const winnerIdx = borders[Math.floor(Math.random() * borders.length)];

    for (let t = 0; t < ticks; t++) {
      GridModule.setLit(borders[t % borders.length]);
      await sleep(GAME_CONFIG.TICK_MS);
    }

    GridModule.setWinner(winnerIdx);
    return GridModule.getFruitAt(winnerIdx);
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
    await CreditsModule.add(fruit.value);

    DB.logHistory(State.user.uid, fruit.emoji, fruit.value).catch(() => {});
    HistoryModule.prepend({ result: fruit.emoji, reward: fruit.value, createdAt: null });

    setSpinning(false);
  };

  return { spin };
})();

// ═══════════════════════════════════════════════════
// AUTH MODULE  (Google popup — no email needed)
// ═══════════════════════════════════════════════════

const AuthModule = {
  signIn:  () => signInWithPopup(auth, provider),
  signOut: () => signOut(auth),
};

// ═══════════════════════════════════════════════════
// UI EVENT BINDINGS
// ═══════════════════════════════════════════════════

const bindEvents = () => {
  // Google sign-in button
  $("btn-google-signin").addEventListener("click", async () => {
    const btn   = $("btn-google-signin");
    const errEl = $("auth-error");
    btn.disabled = true;
    hideEl(errEl);
    try {
      await AuthModule.signIn();
      // onAuthStateChanged handles screen transition
    } catch (err) {
      errEl.textContent = `Sign-in failed: ${err.message}`;
      showEl(errEl);
      btn.disabled = false;
    }
  });

  // Logout (both screens)
  $("btn-logout").addEventListener("click",  () => AuthModule.signOut());
  $("btn-logout2").addEventListener("click", () => AuthModule.signOut());

  // Dashboard → Game
  $("btn-play-fruit").addEventListener("click", () => {
    Router.goto("screen-game");
    HistoryModule.load(State.user.uid);
  });

  // Game → Dashboard
  $("btn-back").addEventListener("click", () => Router.goto("screen-dashboard"));

  // Spin
  $("btn-spin").addEventListener("click", SpinModule.spin);
};

// ═══════════════════════════════════════════════════
// SESSION HANDLERS
// ═══════════════════════════════════════════════════

const onUserSignedIn = async (user) => {
  State.user     = user;
  State.userData = await DB.ensureUser(user.uid, user.email);

  // Populate header info
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
};

const onUserSignedOut = () => {
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