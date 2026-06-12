/**
 * ARCADE 2026 — app.js
 * Firebase: Username/Password Auth + Firestore
 * Games: Fruit Spin, Lucky 777
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit, getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════
//  FIREBASE CONFIG
// ═══════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDeZudTZ4BOZT6TEaqWCJbbZa1SA_PzDnM",
  authDomain:        "webretro-games-2026.firebaseapp.com",
  projectId:         "webretro-games-2026",
  storageBucket:     "webretro-games-2026.firebasestorage.app",
  messagingSenderId: "719993018557",
  appId:             "1:719993018557:web:90577dfab542bed7c1bfd4",
};

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════

const AVATARS = [
  "👾","🤖","👻","🐉","🦊","🐺","🎭","💀","👽","🐸",
  "🦁","🐯","🐧","🦄","🐙","🎃","🔥","⚡","🌙","💎",
  "🍒","🎮","🃏","🎲","🚀",
];

const FRUIT_ITEMS = [
  { emoji:"🍒", label:"Cherry",      value:1,   weight:45 },
  { emoji:"🥭", label:"Mango",       value:3,   weight:18 },
  { emoji:"🍎", label:"Apple",       value:5,   weight:15 },
  { emoji:"🍍", label:"Pineapple",   value:10,  weight:12 },
  { emoji:"🍫", label:"Jackpot Bar", value:100, weight:3  },
  { emoji:"💣", label:"Bomb",        value:0,   weight:7  },
];
const FRUIT_TOTAL_WEIGHT = FRUIT_ITEMS.reduce((s, f) => s + f.weight, 0);

const FRUIT_FIXED_BORDER = {
  0:"🍒", 1:"🍍", 2:"💣", 3:"🍎", 4:"🍒",
  5:"🍍",                          9:"🍎",
  10:"🍒",                         14:"🍒",
  15:"💣",                         19:"💣",
  20:"🍒", 21:"🥭", 22:"🍫", 23:"🥭", 24:"🍒",
};

const FRUIT_SPIN_COST = 5;
const FRUIT_SPIN_MS   = 4000;
const FRUIT_TICK_MS   = 65;

const LUCKY_SYMBOLS   = ["7️⃣","💎","⭐","🍒","🍋","🔔","🍇","🍀"];
const LUCKY_PULL_COST = 10;

const LUCKY_PAYOUTS = {
  "7️⃣-7️⃣-7️⃣": 500,
  "💎-💎-💎":    200,
  "⭐-⭐-⭐":    100,
  "🍒-🍒-🍒":    50,
  "🍋-🍋-🍋":    30,
  "🔔-🔔-🔔":    20,
};
const LUCKY_PARTIAL_WIN = 5;

const DAILY_REWARD = 100;
const MS_PER_DAY   = 86_400_000;

// Username → internal Firebase Auth email
const toEmail = (username) => `${username.toLowerCase()}@arcade2026.local`;

// Password: exactly 8 alphanumeric chars
const PW_REGEX = /^[a-zA-Z0-9]{8}$/;

// ═══════════════════════════════════════════════════
//  FIREBASE INIT
// ═══════════════════════════════════════════════════

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

// ═══════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════

const $       = (id)           => document.getElementById(id);
const qs      = (sel, ctx = document) => ctx.querySelector(sel);
const sleep   = (ms)           => new Promise(r => setTimeout(r, ms));

const cls = {
  add:    (el, ...c) => el?.classList.add(...c),
  remove: (el, ...c) => el?.classList.remove(...c),
  toggle: (el, c, v) => el?.classList.toggle(c, v),
  has:    (el, c)    => !!el?.classList.contains(c),
};

const fmt = {
  coins: (n) => Math.floor(n ?? 0).toLocaleString(),
  time:  (d) => d instanceof Date
    ? d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
    : "—",
  date:  (d) => d instanceof Date
    ? d.toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" })
    : "—",
};

// Resolve Firestore Timestamp or plain Date/number → JS Date
const toDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
};

const weightedPick = (items, totalWeight) => {
  let r = Math.random() * totalWeight;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
};

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════

const Toast = (() => {
  let _t = null;
  const ICONS = {
    win:     '<i class="bi bi-check-circle-fill"></i>',
    loss:    '<i class="bi bi-x-circle-fill"></i>',
    jackpot: '<i class="bi bi-stars"></i>',
    info:    '<i class="bi bi-info-circle-fill"></i>',
  };

  const show = (msg, type = "info", ms = 2600) => {
    const el = $("toast");
    if (!el) return;
    clearTimeout(_t);
    el.className = `toast ${type}`;
    el.innerHTML = `${ICONS[type] || ""} ${msg}`;
    cls.remove(el, "hidden");
    void el.offsetWidth; // force reflow for animation restart
    _t = setTimeout(() => {
      cls.add(el, "hiding");
      el.addEventListener("animationend", () => {
        cls.add(el, "hidden");
        cls.remove(el, "hiding");
      }, { once: true });
    }, ms);
  };

  return { show };
})();

// ═══════════════════════════════════════════════════
//  APP STATE
// ═══════════════════════════════════════════════════

const State = {
  user:          null,
  userData:      null,
  fruitSpinning: false,
  luckySpinning: false,
};

// ═══════════════════════════════════════════════════
//  FIRESTORE SERVICE
// ═══════════════════════════════════════════════════

const userRef     = (uid)      => doc(db, "users", uid);
const spinsCol    = ()         => collection(db, "spins");
const usernameRef = (username) => doc(db, "usernames", username.toLowerCase());

const DB = {
  async isUsernameTaken(username) {
    const snap = await getDoc(usernameRef(username));
    return snap.exists();
  },

  async getUser(uid) {
    const snap = await getDoc(userRef(uid));
    return snap.exists() ? snap.data() : null;
  },

  async createUser(uid, username) {
    const data = {
      username,
      avatar:          "👾",
      coins:           100,   // welcome bonus
      totalFruitSpins: 0,
      totalLuckySpins: 0,
      bestWin:         0,
      lastClaimAt:     null,
      createdAt:       serverTimestamp(),
    };
    await setDoc(userRef(uid), data);
    await setDoc(usernameRef(username), { uid });
    return data;
  },

  async updateUser(uid, fields) {
    await updateDoc(userRef(uid), fields);
    if (State.userData) Object.assign(State.userData, fields);
  },

  async logSpin(uid, game, symbols, coinsWon, coinsCost) {
    await addDoc(spinsCol(), {
      uid, game,
      symbols:  Array.isArray(symbols) ? symbols.join(",") : symbols,
      coinsWon, coinsCost,
      net:      coinsWon - coinsCost,
      createdAt: serverTimestamp(),
    });
  },

  async getSpins(uid, game, count = 20) {
    const q = query(
      spinsCol(),
      where("uid",  "==", uid),
      where("game", "==", game),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getLeaderboard(n = 20) {
    const q = query(
      collection(db, "users"),
      orderBy("coins", "desc"),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
};

// ═══════════════════════════════════════════════════
//  COINS MODULE
// ═══════════════════════════════════════════════════

const Coins = {
  get() { return State.userData?.coins ?? 0; },

  _refresh() {
    const v = fmt.coins(this.get());
    // Update every coin display in the DOM
    [$("topbar-coins"), $("fruit-coins-display"), $("lucky-coins-display")].forEach(el => {
      if (el) el.textContent = v;
    });
    // Profile / stats displays
    if ($("acc-coins"))        $("acc-coins").textContent        = v + " coins";
    if ($("stat-total-coins")) $("stat-total-coins").textContent = v;
  },

  bump() {
    const el = $("topbar-coins");
    if (!el) return;
    cls.add(el, "bump");
    setTimeout(() => cls.remove(el, "bump"), 500);
  },

  async add(amount, persist = true) {
    State.userData.coins = (State.userData.coins ?? 0) + amount;
    this._refresh();
    this.bump();
    if (persist && State.user) {
      await DB.updateUser(State.user.uid, { coins: State.userData.coins });
    }
  },

  async deduct(amount) {
    if (this.get() < amount) return false;
    State.userData.coins -= amount;
    this._refresh();
    if (State.user) await DB.updateUser(State.user.uid, { coins: State.userData.coins });
    return true;
  },

  set(val) {
    if (State.userData) State.userData.coins = val;
    this._refresh();
  },
};

// ═══════════════════════════════════════════════════
//  DAILY REWARD
// ═══════════════════════════════════════════════════

const Daily = (() => {
  let _interval = null;

  const getLastClaim = () => toDate(State.userData?.lastClaimAt);

  const canClaim = () => {
    const last = getLastClaim();
    return !last || Date.now() - last.getTime() >= MS_PER_DAY;
  };

  const msUntilNext = () => {
    const last = getLastClaim();
    if (!last) return 0;
    return Math.max(0, MS_PER_DAY - (Date.now() - last.getTime()));
  };

  const fmtCountdown = (ms) => {
    const s   = Math.floor(ms / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
  };

  const stop = () => { clearInterval(_interval); _interval = null; };

  const render = () => {
    const right = $("daily-right");
    if (!right) return;

    if (canClaim()) {
      right.innerHTML = `
        <button id="btn-claim-daily" class="btn-claim">
          <i class="bi bi-coin"></i> CLAIM
        </button>`;
      $("btn-claim-daily")?.addEventListener("click", claim);
    } else {
      stop();
      const tick = () => {
        const dr = $("daily-right");
        if (dr) {
          dr.innerHTML = `
            <div class="daily-countdown">
              <i class="bi bi-hourglass-split"></i> ${fmtCountdown(msUntilNext())}
            </div>`;
        }
        if (msUntilNext() <= 1000) { stop(); render(); }
      };
      tick();
      _interval = setInterval(tick, 1000);
    }
  };

  const claim = async () => {
    if (!canClaim()) return;
    const dr = $("daily-right");
    if (dr) dr.innerHTML = `<div class="daily-countdown">Claiming…</div>`;

    const now = new Date();
    State.userData.lastClaimAt = now;
    await DB.updateUser(State.user.uid, { lastClaimAt: now });
    await Coins.add(DAILY_REWARD, false);
    await DB.updateUser(State.user.uid, { coins: State.userData.coins });
    Toast.show(`+${DAILY_REWARD} daily coins claimed!`, "win", 3000);
    render();
  };

  const init = () => render();

  return { init, stop, render };
})();

// ═══════════════════════════════════════════════════
//  ROUTER / NAV
// ═══════════════════════════════════════════════════

const Router = {
  _current: "home",

  go(page) {
    document.querySelectorAll(".page").forEach(p => cls.remove(p, "active"));
    document.querySelectorAll(".nav-btn").forEach(b => {
      cls.toggle(b, "active", b.dataset.page === page);
    });
    const el = $(`page-${page}`);
    if (el) cls.add(el, "active");
    this._current = page;

    if (page === "dashboard") DashPage.refresh();
    if (page === "profile")   ProfilePage.refresh();
  },

  init() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => this.go(btn.dataset.page));
    });
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => this.go(el.dataset.nav));
    });
  },
};

// ═══════════════════════════════════════════════════
//  SPLASH / SCREEN MANAGER
// ═══════════════════════════════════════════════════

const Screens = {
  _screens: ["screen-splash", "screen-signin"],

  show(id) {
    this._screens.forEach(s => {
      const el = $(s);
      if (!el) return;
      cls.toggle(el, "active", s === id);
    });
    cls.toggle($("app"), "hidden", id !== "app");
  },

  splashOut(cb) {
    const el = $("screen-splash");
    if (!el) { cb(); return; }
    cls.add(el, "fade-out");
    el.addEventListener("animationend", () => {
      cls.remove(el, "active", "fade-out");
      cb();
    }, { once: true });
  },
};

// ═══════════════════════════════════════════════════
//  AUTH SCREEN
// ═══════════════════════════════════════════════════

const AuthScreen = {
  init() {
    // Tab switching
    document.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });

    // Password visibility toggles
    document.querySelectorAll(".pw-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.target);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        // Swap the icon inside the button
        const icon = btn.querySelector("i");
        if (icon) {
          icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
        }
      });
    });

    // Login
    $("btn-login")?.addEventListener("click", () => this.login());
    $("login-password")?.addEventListener("keydown", e => {
      if (e.key === "Enter") this.login();
    });

    // Sign Up
    $("btn-signup")?.addEventListener("click", () => this.signup());
    $("signup-password-confirm")?.addEventListener("keydown", e => {
      if (e.key === "Enter") this.signup();
    });
  },

  switchTab(tab) {
    document.querySelectorAll(".auth-tab").forEach(t => {
      cls.toggle(t, "active", t.dataset.tab === tab);
    });
    cls.toggle($("form-login"),  "hidden", tab !== "login");
    cls.toggle($("form-signup"), "hidden", tab !== "signup");
    this._clearErrors();
  },

  _clearErrors() {
    [
      { wrap: "login-error",    msg: "login-error-msg"   },
      { wrap: "signup-error",   msg: "signup-error-msg"  },
      { wrap: "signup-success", msg: "signup-success-msg"},
    ].forEach(({ wrap, msg }) => {
      const w = $(wrap), m = $(msg);
      if (w) cls.add(w, "hidden");
      if (m) m.textContent = "";
    });
  },

  _setError(wrapperId, msgId, text) {
    const w = $(wrapperId), m = $(msgId);
    if (m) m.textContent = text;
    if (w) cls.remove(w, "hidden");
  },

  _setSuccess(wrapperId, msgId, text) {
    const w = $(wrapperId), m = $(msgId);
    if (m) m.textContent = text;
    if (w) cls.remove(w, "hidden");
  },

  _setBusy(btnId, busy, idleLabel) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = busy;
    // Keep the icon, just change the text node
    const icon = btn.querySelector("i")?.outerHTML ?? "";
    btn.innerHTML = busy
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${busy === "login" ? "LOGGING IN…" : "CREATING…"}`
      : `${icon} ${idleLabel}`;
  },

  async login() {
    this._clearErrors();
    const username = $("login-username")?.value.trim();
    const password = $("login-password")?.value;

    if (!username) {
      this._setError("login-error", "login-error-msg", "Please enter your username.");
      return;
    }
    if (!password) {
      this._setError("login-error", "login-error-msg", "Please enter your password.");
      return;
    }

    const btn = $("btn-login");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> LOGGING IN…`; }
    try {
      await signInWithEmailAndPassword(auth, toEmail(username), password);
      // onAuthStateChanged handles the rest
    } catch (e) {
      this._setError("login-error", "login-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-lightning-charge-fill"></i> LOGIN`; }
    }
  },

  async signup() {
    this._clearErrors();
    const username = $("signup-username")?.value.trim();
    const password = $("signup-password")?.value;
    const confirm  = $("signup-password-confirm")?.value;

    if (!username) {
      this._setError("signup-error", "signup-error-msg", "Username is required."); return;
    }
    if (username.length > 25) {
      this._setError("signup-error", "signup-error-msg", "Username must be 25 characters or fewer."); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this._setError("signup-error", "signup-error-msg", "Username may only contain letters, numbers, and underscores."); return;
    }
    if (!PW_REGEX.test(password)) {
      this._setError("signup-error", "signup-error-msg", "Password must be exactly 8 alphanumeric characters (e.g. myPass25)."); return;
    }
    if (password !== confirm) {
      this._setError("signup-error", "signup-error-msg", "Passwords do not match."); return;
    }

    const btn = $("btn-signup");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> CREATING…`; }
    try {
      const taken = await DB.isUsernameTaken(username);
      if (taken) {
        this._setError("signup-error", "signup-error-msg", `"${username}" is already taken. Choose a different username.`);
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
      await DB.createUser(cred.user.uid, username);
      this._setSuccess("signup-success", "signup-success-msg", "Account created! Welcome to Arcade 2026 🎰");
      // onAuthStateChanged will sign them in automatically
    } catch (e) {
      this._setError("signup-error", "signup-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
    }
  },

  _friendlyError(code) {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect username or password.";
      case "auth/email-already-in-use":
        return "That username is already registered.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":
        return "Network error — check your connection and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  },
};

// ═══════════════════════════════════════════════════
//  PROFILE PAGE
// ═══════════════════════════════════════════════════

const ProfilePage = {
  init() {
    // Build avatar grid
    const grid = $("avatar-grid");
    if (grid) {
      grid.innerHTML = "";
      AVATARS.forEach(a => {
        const btn = document.createElement("button");
        btn.className    = "avatar-opt";
        btn.textContent  = a;
        btn.setAttribute("aria-label", `Select avatar ${a}`);
        btn.addEventListener("click", () => this.selectAvatar(a));
        grid.appendChild(btn);
      });
    }

    $("btn-signout")?.addEventListener("click", () => {
      Daily.stop();
      signOut(auth);
    });
  },

  refresh() {
    if (!State.userData) return;
    const d = State.userData;

    // Basic info
    if ($("acc-username"))    $("acc-username").textContent    = d.username || "—";
    if ($("acc-coins"))       $("acc-coins").textContent       = fmt.coins(d.coins) + " coins";
    if ($("acc-fruit-spins")) $("acc-fruit-spins").textContent = fmt.coins(d.totalFruitSpins || 0);
    if ($("acc-lucky-spins")) $("acc-lucky-spins").textContent = fmt.coins(d.totalLuckySpins || 0);
    if ($("acc-best-win"))    $("acc-best-win").textContent    = fmt.coins(d.bestWin || 0) + " coins";

    // Member since (Firestore Timestamp or Date)
    if ($("acc-since")) {
      const ts = toDate(d.createdAt);
      $("acc-since").textContent = ts ? fmt.date(ts) : "—";
    }

    this.setAvatar(d.avatar || "👾", false);
  },

  setAvatar(a, persist = true) {
    const preview = $("avatar-preview");
    if (preview) preview.textContent = a;

    document.querySelectorAll(".avatar-opt").forEach(btn => {
      cls.toggle(btn, "active", btn.textContent === a);
    });

    if (persist && State.user) {
      if (State.userData) State.userData.avatar = a;
      DB.updateUser(State.user.uid, { avatar: a }).catch(() => {});
      Toast.show("Avatar saved!", "win");
    }
  },

  selectAvatar(a) { this.setAvatar(a, true); },
};

// ═══════════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════════

const DashPage = {
  _activeGame: "fruit",

  async refresh() {
    if (!State.user || !State.userData) return;
    const d = State.userData;

    // Stats
    if ($("stat-total-coins"))  $("stat-total-coins").textContent  = fmt.coins(d.coins);
    if ($("stat-fruit-spins"))  $("stat-fruit-spins").textContent  = fmt.coins(d.totalFruitSpins || 0);
    if ($("stat-lucky-spins"))  $("stat-lucky-spins").textContent  = fmt.coins(d.totalLuckySpins || 0);
    if ($("stat-best-win"))     $("stat-best-win").textContent     = fmt.coins(d.bestWin || 0);

    await Promise.all([
      this.loadLeaderboard(),
      this.loadActivity(this._activeGame),
    ]);
  },

  async loadLeaderboard() {
    const list = $("leaderboard-list");
    if (!list) return;
    list.innerHTML = `<div class="lb-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const entries = await DB.getLeaderboard(20);
      list.innerHTML = "";
      if (!entries.length) {
        list.innerHTML = `<div class="lb-empty"><i class="bi bi-people"></i> No players yet.</div>`;
        return;
      }
      const medals = ["🥇","🥈","🥉"];
      entries.forEach((e, i) => {
        const isMe = e.uid === State.user.uid;
        const name = (e.username?.trim() || "Player");
        const row  = document.createElement("div");
        row.className = "lb-row" + (isMe ? " me" : "");
        row.innerHTML = `
          <span class="lb-rank">${medals[i] ?? "#"+(i+1)}</span>
          <span class="lb-avatar">${e.avatar || "👾"}</span>
          <span class="lb-name">${name}${isMe ? `<span class="lb-you">YOU</span>` : ""}</span>
          <span class="lb-coins">
            <i class="bi bi-coin" style="color:var(--gold)"></i>
            ${fmt.coins(e.coins || 0)}
          </span>`;
        list.appendChild(row);
      });
    } catch (err) {
      console.error("Leaderboard error:", err);
      list.innerHTML = `<div class="lb-empty"><i class="bi bi-wifi-off"></i> Could not load leaderboard.</div>`;
    }
  },

  async loadActivity(game) {
    this._activeGame = game;
    document.querySelectorAll(".act-tab").forEach(t => {
      cls.toggle(t, "act-tab-active", t.dataset.game === game);
    });

    const list = $("activity-list");
    if (!list) return;
    list.innerHTML = `<div class="act-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;

    try {
      const items = await DB.getSpins(State.user.uid, game, 20);
      list.innerHTML = "";

      if (!items.length) {
        list.innerHTML = `<div class="act-empty"><i class="bi bi-joystick"></i> No activity yet — go play!</div>`;
        return;
      }

      items.forEach(item => {
        const won    = item.coinsWon  ?? 0;
        const cost   = item.coinsCost ?? (game === "fruit" ? FRUIT_SPIN_COST : LUCKY_PULL_COST);
        const net    = won - cost;
        const date   = toDate(item.createdAt);
        const isWin  = net >= 0;
        const el     = document.createElement("div");
        el.className = "act-item";

        let emoji, resultText;

        if (game === "fruit") {
          emoji      = item.symbols || "🎰";
          resultText = won > 0 ? `Won ${fmt.coins(won)} coins` : "Bomb — no reward";
        } else {
          const syms = (item.symbols || "").split(",");
          emoji      = syms.slice(0, 3).join("") || "7️⃣";
          resultText = won > 0 ? `Won ${fmt.coins(won)} coins` : "No match";
        }

        el.innerHTML = `
          <span class="act-emoji">${emoji}</span>
          <div class="act-body">
            <div class="act-result ${isWin ? "win" : "loss"}">${resultText}</div>
            <div class="act-time">
              <i class="bi bi-clock"></i>
              ${date ? fmt.time(date) + " · " + fmt.date(date) : "Just now"}
            </div>
          </div>
          <span class="act-coins ${isWin ? "win" : "loss"}">
            ${isWin ? "+" : ""}${fmt.coins(net)}
          </span>`;
        list.appendChild(el);
      });
    } catch (err) {
      console.error("Activity error:", err);
      list.innerHTML = `<div class="act-empty"><i class="bi bi-wifi-off"></i> Could not load activity.</div>`;
    }
  },

  bindTabs() {
    document.querySelectorAll(".act-tab").forEach(t => {
      t.addEventListener("click", () => this.loadActivity(t.dataset.game));
    });
  },
};

// ═══════════════════════════════════════════════════
//  FRUIT GRID
// ═══════════════════════════════════════════════════

const FruitGrid = (() => {
  const SIZE  = 5;
  const TOTAL = SIZE * SIZE;
  let _cells  = [];

  const borderIndices = () => {
    const out = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (r === 0 || r === SIZE-1 || c === 0 || c === SIZE-1)
          out.push(r * SIZE + c);
    return out;
  };

  const BORDER = borderIndices();

  // Pre-compute fruit for each border cell
  const FRUIT_AT = {};
  BORDER.forEach(idx => {
    const emoji = FRUIT_FIXED_BORDER[idx];
    FRUIT_AT[idx] = FRUIT_ITEMS.find(f => f.emoji === emoji) ?? FRUIT_ITEMS[0];
  });

  const render = () => {
    const grid = $("fruit-grid");
    if (!grid) return;
    grid.innerHTML = "";
    _cells = [];
    for (let i = 0; i < TOTAL; i++) {
      const cell     = document.createElement("div");
      const isBorder = BORDER.includes(i);
      cell.className = isBorder ? "fg-cell border-cell" : "fg-cell inner-cell";
      cell.textContent = isBorder ? FRUIT_AT[i].emoji : "×";
      grid.appendChild(cell);
      _cells.push(cell);
    }
  };

  const clearLit = () => {
    BORDER.forEach(i => cls.remove(_cells[i], "lit", "winner", "winner-bomb"));
  };

  const setLit    = (idx) => { clearLit(); cls.add(_cells[idx], "lit"); };
  const setWinner = (idx, isBomb) => {
    clearLit();
    cls.add(_cells[idx], isBomb ? "winner-bomb" : "winner");
  };

  return { render, BORDER, FRUIT_AT, setLit, setWinner, clearLit };
})();

// ═══════════════════════════════════════════════════
//  FRUIT SPIN GAME
// ═══════════════════════════════════════════════════

const FruitGame = {
  init() {
    FruitGrid.render();
    $("btn-fruit-spin")?.addEventListener("click", () => this.spin());
    $("back-fruit")?.addEventListener("click",    () => {
      cls.add($("overlay-fruit"), "hidden");
    });
    $("open-fruit")?.addEventListener("click",    () => this.open());
  },

  open() {
    cls.remove($("overlay-fruit"), "hidden");
    FruitGrid.render();
    FruitGrid.clearLit();
    cls.add($("fruit-result"), "hidden");
    this._refreshCoins();
    this._loadHistory();
  },

  _refreshCoins() {
    const el = $("fruit-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },

  async _loadHistory() {
    const list = $("fruit-history");
    if (!list || !State.user) return;
    try {
      const items = await DB.getSpins(State.user.uid, "fruit", 10);
      list.innerHTML = "";
      items.forEach(item => list.appendChild(this._buildHistItem(item)));
    } catch { /* silent fail */ }
  },

  _buildHistItem(item) {
    const el   = document.createElement("div");
    el.className = "fh-item";
    const sym  = item.symbols || "?";
    const won  = item.coinsWon ?? 0;
    const cost = item.coinsCost ?? FRUIT_SPIN_COST;
    const net  = won - cost;
    const date = toDate(item.createdAt);
    const isWin = net >= 0;
    el.innerHTML = `
      <span class="fh-emoji">${sym}</span>
      <span class="fh-label">
        ${won > 0 ? "Collected" : "Bomb!"}
        · <i class="bi bi-clock"></i> ${date ? fmt.time(date) : "now"}
      </span>
      <span class="${isWin ? "fh-win" : "fh-loss"}">
        ${isWin ? "+" : ""}${fmt.coins(net)}
      </span>`;
    return el;
  },

  _prependHist(symbol, coinsWon) {
    const list = $("fruit-history");
    if (!list) return;
    const el = this._buildHistItem({ symbols: symbol, coinsWon, coinsCost: FRUIT_SPIN_COST, createdAt: null });
    list.prepend(el);
    while (list.children.length > 15) list.lastChild?.remove();
  },

  async spin() {
    if (State.fruitSpinning) return;
    if (Coins.get() < FRUIT_SPIN_COST) {
      Toast.show("Not enough coins!", "loss"); return;
    }

    State.fruitSpinning = true;
    const btn = $("btn-fruit-spin");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> SPINNING…`;
    }
    cls.add($("fruit-result"), "hidden");

    await Coins.deduct(FRUIT_SPIN_COST);
    this._refreshCoins();

    // Pick weighted winner
    const winner = weightedPick(FRUIT_ITEMS, FRUIT_TOTAL_WEIGHT);
    const matchingIdx = FruitGrid.BORDER.filter(idx => FruitGrid.FRUIT_AT[idx].emoji === winner.emoji);
    const winnerIdx   = matchingIdx.length
      ? matchingIdx[Math.floor(Math.random() * matchingIdx.length)]
      : FruitGrid.BORDER[Math.floor(Math.random() * FruitGrid.BORDER.length)];

    // Animate the light scanner
    const ticks = Math.floor(FRUIT_SPIN_MS / FRUIT_TICK_MS);
    for (let t = 0; t < ticks; t++) {
      FruitGrid.setLit(FruitGrid.BORDER[t % FruitGrid.BORDER.length]);
      Sound.tick();
      await sleep(FRUIT_TICK_MS);
    }
    FruitGrid.setWinner(winnerIdx, winner.emoji === "💣");

    // Show result
    const isBomb   = winner.emoji === "💣";
    const resultEl = $("fruit-result");
    if (resultEl) {
      resultEl.innerHTML = isBomb
        ? `<i class="bi bi-exclamation-octagon-fill"></i> BOMB! No reward.`
        : `${winner.emoji} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(winner.value)} coins!`;
      resultEl.className = "fruit-result" + (isBomb ? " bomb" : "");
      cls.remove(resultEl, "hidden");
    }

    // Sound & toast
    if (isBomb) {
      Sound.bomb();
      Toast.show("Bomb! Better luck next spin.", "loss");
    } else {
      Sound.win();
      await Coins.add(winner.value);
      this._refreshCoins();
      Toast.show(`+${fmt.coins(winner.value)} coins!`, "win");
    }

    // Persist stats
    const newFruitSpins = (State.userData.totalFruitSpins || 0) + 1;
    const newBestWin    = Math.max(State.userData.bestWin || 0, winner.value);
    State.userData.totalFruitSpins = newFruitSpins;
    State.userData.bestWin         = newBestWin;
    await DB.updateUser(State.user.uid, {
      totalFruitSpins: newFruitSpins,
      bestWin:         newBestWin,
    });
    DB.logSpin(State.user.uid, "fruit", winner.emoji, winner.value, FRUIT_SPIN_COST).catch(() => {});
    this._prependHist(winner.emoji, winner.value);

    State.fruitSpinning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-arrow-clockwise"></i> SPIN`;
    }
  },
};

// ═══════════════════════════════════════════════════
//  LUCKY 777 GAME
// ═══════════════════════════════════════════════════

const LuckyGame = {
  init() {
    $("btn-lucky-pull")?.addEventListener("click", () => this.pull());
    $("back-lucky")?.addEventListener("click",     () => {
      cls.add($("overlay-lucky"), "hidden");
    });
    $("open-lucky")?.addEventListener("click",     () => this.open());
    this._buildReels();
  },

  open() {
    cls.remove($("overlay-lucky"), "hidden");
    cls.add($("lucky-result"), "hidden");
    this._refreshCoins();
    this._loadHistory();
    this._resetReels();
  },

  _refreshCoins() {
    const el = $("lucky-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },

  _buildReels() {
    for (let r = 0; r < 3; r++) {
      const strip = $(`strip-${r}`);
      if (!strip) continue;
      strip.innerHTML = "";
      for (let i = 0; i < 40; i++) {
        const sym = LUCKY_SYMBOLS[Math.floor(Math.random() * LUCKY_SYMBOLS.length)];
        const div = document.createElement("div");
        div.className   = "reel-symbol";
        div.textContent = sym;
        strip.appendChild(div);
      }
    }
  },

  _resetReels() {
    for (let r = 0; r < 3; r++) {
      const strip = $(`strip-${r}`);
      if (strip) strip.style.transform = "translateY(0)";
    }
  },

  async _animateReel(reelIdx, targetSymbol, duration) {
    const strip = $(`strip-${reelIdx}`);
    if (!strip) return;
    const symbolH   = 100;
    const symbols   = strip.querySelectorAll(".reel-symbol");
    const targetIdx = symbols.length - 1;

    // Place target at end
    symbols[targetIdx].textContent = targetSymbol;
    if (targetIdx > 0) {
      symbols[targetIdx - 1].textContent =
        LUCKY_SYMBOLS[Math.floor(Math.random() * LUCKY_SYMBOLS.length)];
    }

    const finalY = -(targetIdx * symbolH);
    strip.style.transition = "none";
    strip.style.transform  = "translateY(0)";
    void strip.offsetWidth; // force reflow
    strip.style.transition = `transform ${duration}ms cubic-bezier(.17,.67,.1,.98)`;
    strip.style.transform  = `translateY(${finalY}px)`;
    await sleep(duration);
    strip.style.transition = "none";
  },

  _evalResult(symbols) {
    const key = symbols.join("-");
    if (LUCKY_PAYOUTS[key] !== undefined) return LUCKY_PAYOUTS[key];
    if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2])
      return LUCKY_PARTIAL_WIN;
    return 0;
  },

  async _loadHistory() {
    const list = $("lucky-history");
    if (!list || !State.user) return;
    try {
      const items = await DB.getSpins(State.user.uid, "lucky", 10);
      list.innerHTML = "";
      items.forEach(item => list.appendChild(this._buildHistItem(item)));
    } catch { /* silent fail */ }
  },

  _buildHistItem(item) {
    const el   = document.createElement("div");
    el.className = "fh-item";
    const syms = (item.symbols || "?-?-?").split(",");
    const won  = item.coinsWon ?? 0;
    const cost = item.coinsCost ?? LUCKY_PULL_COST;
    const net  = won - cost;
    const date = toDate(item.createdAt);
    const isWin = net >= 0;
    el.innerHTML = `
      <span class="fh-emoji">${syms.slice(0, 3).join("")}</span>
      <span class="fh-label">
        ${won > 0 ? `Won ${fmt.coins(won)}` : "No match"}
        · <i class="bi bi-clock"></i> ${date ? fmt.time(date) : "now"}
      </span>
      <span class="${isWin ? "fh-win" : "fh-loss"}">
        ${isWin ? "+" : ""}${fmt.coins(net)}
      </span>`;
    return el;
  },

  _prependHist(symbols, coinsWon) {
    const list = $("lucky-history");
    if (!list) return;
    const el = this._buildHistItem({
      symbols:  symbols.join(","),
      coinsWon,
      coinsCost: LUCKY_PULL_COST,
      createdAt: null,
    });
    list.prepend(el);
    while (list.children.length > 15) list.lastChild?.remove();
  },

  async pull() {
    if (State.luckySpinning) return;
    if (Coins.get() < LUCKY_PULL_COST) {
      Toast.show("Not enough coins!", "loss"); return;
    }

    State.luckySpinning = true;
    const btn = $("btn-lucky-pull");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> PULLING…`;
    }
    cls.add($("lucky-result"), "hidden");

    await Coins.deduct(LUCKY_PULL_COST);
    this._refreshCoins();

    // Weighted symbol picker
    const WEIGHTED = [
      { sym:"7️⃣", w:2  }, { sym:"💎", w:5  }, { sym:"⭐", w:10 },
      { sym:"🍒", w:18 }, { sym:"🍋", w:20 }, { sym:"🔔", w:20 },
      { sym:"🍇", w:14 }, { sym:"🍀", w:11 },
    ];
    const totalW  = WEIGHTED.reduce((s, x) => s + x.w, 0);
    const pickSym = () => {
      let r = Math.random() * totalW;
      for (const x of WEIGHTED) { r -= x.w; if (r <= 0) return x.sym; }
      return "🍋";
    };
    const picked = [pickSym(), pickSym(), pickSym()];

    // Animate
    const lights = qs(".slot-lights");
    if (lights) cls.add(lights, "spinning");
    Sound.reelSpin();

    const durations = [1200, 1700, 2200];
    await Promise.all(picked.map((sym, i) => this._animateReel(i, sym, durations[i])));
    if (lights) cls.remove(lights, "spinning");

    // Evaluate
    const coinsWon  = this._evalResult(picked);
    const isJackpot = picked.join("-") === "7️⃣-7️⃣-7️⃣";

    // Show result
    const resultEl = $("lucky-result");
    if (resultEl) {
      if (isJackpot) {
        resultEl.innerHTML = `<i class="bi bi-stars"></i> JACKPOT! +${fmt.coins(coinsWon)} coins!`;
        resultEl.className = "lucky-result jackpot";
      } else if (coinsWon > 0) {
        resultEl.innerHTML = `${picked.join("")} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(coinsWon)} coins!`;
        resultEl.className = "lucky-result";
      } else {
        resultEl.innerHTML = `${picked.join("")} <i class="bi bi-dash-circle-fill"></i> No match. Try again!`;
        resultEl.className = "lucky-result loss";
      }
      cls.remove(resultEl, "hidden");
    }

    // Sound & toast
    if (isJackpot) {
      Sound.jackpot();
      Toast.show(`JACKPOT! +${fmt.coins(coinsWon)} coins!`, "jackpot", 4000);
    } else if (coinsWon > 0) {
      Sound.win();
      Toast.show(`+${fmt.coins(coinsWon)} coins!`, "win");
    } else {
      Sound.bomb();
      Toast.show("No match. Keep trying!", "loss");
    }

    if (coinsWon > 0) {
      await Coins.add(coinsWon);
      this._refreshCoins();
    }

    // Persist stats
    const newLuckySpins = (State.userData.totalLuckySpins || 0) + 1;
    const newBestWin    = Math.max(State.userData.bestWin || 0, coinsWon);
    State.userData.totalLuckySpins = newLuckySpins;
    State.userData.bestWin         = newBestWin;
    await DB.updateUser(State.user.uid, {
      totalLuckySpins: newLuckySpins,
      bestWin:         newBestWin,
    });
    DB.logSpin(State.user.uid, "lucky", picked, coinsWon, LUCKY_PULL_COST).catch(() => {});
    this._prependHist(picked, coinsWon);

    State.luckySpinning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-stars"></i> PULL`;
    }
  },
};

// ═══════════════════════════════════════════════════
//  SOUND MODULE (Web Audio API)
// ═══════════════════════════════════════════════════

const Sound = (() => {
  let _ctx;
  const ctx = () => {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  };

  const tone = (freq, dur, type = "square", vol = 0.06) => {
    try {
      const c = ctx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type          = type;
      o.frequency.value = freq;
      g.gain.value    = vol;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.stop(c.currentTime + dur);
    } catch {}
  };

  return {
    tick:     () => tone(920, .03),
    win:      () => tone(1300, .18, "sine", .07),
    bomb:     () => tone(110,  .3,  "sawtooth", .09),
    reelSpin: () => tone(700,  .07, "sawtooth", .04),
    jackpot:  () => {
      try {
        const c = ctx();
        [1200,1500,1800,2200].forEach((f, i) => {
          setTimeout(() => {
            const o = c.createOscillator();
            const g = c.createGain();
            o.type          = "sine";
            o.frequency.value = f;
            g.gain.value    = .22;
            o.connect(g);
            g.connect(c.destination);
            o.start();
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + .55);
            o.stop(c.currentTime + .55);
          }, i * 80);
        });
      } catch {}
    },
  };
})();

// ═══════════════════════════════════════════════════
//  AUTH STATE HANDLER
// ═══════════════════════════════════════════════════

const Auth = {
  async onSignedIn(user) {
    State.user     = user;
    State.userData = await DB.getUser(user.uid);

    // Fallback: re-create doc if missing
    if (!State.userData) {
      const username = user.email.replace("@arcade2026.local", "");
      State.userData = await DB.createUser(user.uid, username);
    }

    Coins.set(State.userData.coins ?? 0);
    ProfilePage.refresh();
    Daily.init();
    Router.init();
    Router.go("home");

    Screens.splashOut(() => {
      cls.remove($("screen-signin"), "active");
      cls.remove($("app"), "hidden");
    });
  },

  onSignedOut() {
    State.user = State.userData = null;
    Daily.stop();
    cls.add($("overlay-fruit"), "hidden");
    cls.add($("overlay-lucky"), "hidden");
    cls.add($("app"), "hidden");
    Screens.show("screen-signin");

    // Reset forms
    [
      "login-username","login-password",
      "signup-username","signup-password","signup-password-confirm",
    ].forEach(id => { const el = $(id); if (el) el.value = ""; });

    AuthScreen._clearErrors?.();
    AuthScreen.switchTab?.("login");
  },
};

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════

const boot = () => {
  Screens.show("screen-splash");

  // Init modules
  AuthScreen.init();
  DashPage.bindTabs();
  ProfilePage.init();
  FruitGame.init();
  LuckyGame.init();

  // Firebase auth listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      Auth.onSignedIn(user);
    } else {
      if (cls.has($("screen-splash"), "active")) {
        setTimeout(() => {
          Screens.splashOut(() => Screens.show("screen-signin"));
        }, 1700);
      } else {
        Auth.onSignedOut();
      }
    }
  });
};

boot();
