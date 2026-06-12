/**
 * ARCADE 2026 — app.js
 * Firebase: Username/Password Auth + Firestore
 * Games: Fruit Spin, Lucky 777, Capture a Pokémon
 * Avatars: PokéAPI (first 151 Pokémon)
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

// Pokémon avatar config — first 151 (Gen 1), 6 per page
const POKE_COUNT      = 151;
const POKE_PER_PAGE   = 6;
const POKE_SPRITE_URL    = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const POKE_ARTWORK_URL   = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

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

// ── CAPTURE A POKÉMON ──
const CAPTURE_COST       = 500;
const CAPTURE_BALL_COUNT = 5;

// Full Gen-1 roster (IDs 1–151) for the capture pool
const CAPTURE_POOL = Array.from({ length: 151 }, (_, i) => i + 1);

// Static Gen-1 name list (index 0 unused so IDs are 1-based)
const POKE_NAMES = [
  "","bulbasaur","ivysaur","venusaur","charmander","charmeleon","charizard","squirtle","wartortle",
  "blastoise","caterpie","metapod","butterfree","weedle","kakuna","beedrill","pidgey","pidgeotto",
  "pidgeot","rattata","raticate","spearow","fearow","ekans","arbok","pikachu","raichu","sandshrew",
  "sandslash","nidoran-f","nidorina","nidoqueen","nidoran-m","nidorino","nidoking","clefairy",
  "clefable","vulpix","ninetales","jigglypuff","wigglytuff","zubat","golbat","oddish","gloom",
  "vileplume","paras","parasect","venonat","venomoth","diglett","dugtrio","meowth","persian",
  "psyduck","golduck","mankey","primeape","growlithe","arcanine","poliwag","poliwhirl","poliwrath",
  "abra","kadabra","alakazam","machop","machoke","machamp","bellsprout","weepinbell","victreebel",
  "tentacool","tentacruel","geodude","graveler","golem","ponyta","rapidash","slowpoke","slowbro",
  "magnemite","magneton","farfetchd","doduo","dodrio","seel","dewgong","grimer","muk","shellder",
  "cloyster","gastly","haunter","gengar","onix","drowzee","hypno","krabby","kingler","voltorb",
  "electrode","exeggcute","exeggutor","cubone","marowak","hitmonlee","hitmonchan","lickitung",
  "koffing","weezing","rhyhorn","rhydon","chansey","tangela","kangaskhan","horsea","seadra",
  "goldeen","seaking","staryu","starmie","mr-mime","scyther","jynx","electabuzz","magmar",
  "pinsir","tauros","magikarp","gyarados","lapras","ditto","eevee","vaporeon","jolteon","flareon",
  "porygon","omanyte","omastar","kabuto","kabutops","aerodactyl","snorlax","articuno","zapdos",
  "moltres","dratini","dragonair","dragonite","mewtwo","mew",
];

const pokeName = (id) => {
  const n = POKE_NAMES[id] || `pokemon-${id}`;
  return n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, " ");
};

const toEmail = (username) => `${username.toLowerCase()}@arcade2026.local`;
const PW_REGEX = /^[a-zA-Z0-9]{8}$/;

// Default avatar for new accounts (Pikachu)
const DEFAULT_AVATAR = { type:"pokemon", id:25, name:"pikachu" };

// ═══════════════════════════════════════════════════
//  FIREBASE INIT
// ═══════════════════════════════════════════════════

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

// ═══════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════

const $     = (id)           => document.getElementById(id);
const qs    = (sel, ctx = document) => ctx.querySelector(sel);
const sleep = (ms)           => new Promise(r => setTimeout(r, ms));

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
  timeAgo: (d) => {
    if (!(d instanceof Date)) return "just now";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)   return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  },
};

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
//  POKÉMON HELPERS
// ═══════════════════════════════════════════════════

const parseAvatar = (raw) => {
  if (!raw) return DEFAULT_AVATAR;
  if (typeof raw === "string" && raw.startsWith("pokemon:")) {
    const [, idStr, name] = raw.split(":");
    return { type:"pokemon", id:parseInt(idStr), name: name || "" };
  }
  return DEFAULT_AVATAR;
};

const avatarToString = (av) => `pokemon:${av.id}:${av.name}`;

const renderAvatarPreview = (av) => {
  const img  = $("avatar-preview-img");
  const fall = $("avatar-preview-fallback");
  if (!img || !fall) return;
  if (av && av.type === "pokemon") {
    img.src = POKE_SPRITE_URL(av.id);
    img.alt = av.name;
    cls.remove(img, "hidden");
    cls.add(fall, "hidden");
  } else {
    cls.add(img, "hidden");
    cls.remove(fall, "hidden");
    fall.textContent = "?";
  }
};

const avatarHtml = (raw) => {
  const av = parseAvatar(raw);
  if (av.type === "pokemon") {
    return `<img src="${POKE_SPRITE_URL(av.id)}" alt="${av.name}" style="width:24px;height:24px;object-fit:contain;image-rendering:pixelated;border-radius:50%;" />`;
  }
  return av.emoji || "👾";
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
    capture: '<i class="bi bi-collection-fill"></i>',
  };
  const show = (msg, type = "info", ms = 2600) => {
    const el = $("toast");
    if (!el) return;
    clearTimeout(_t);
    el.className = `toast ${type}`;
    el.innerHTML = `${ICONS[type] || ""} ${msg}`;
    cls.remove(el, "hidden");
    void el.offsetWidth;
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
  user:             null,
  userData:         null,
  fruitSpinning:    false,
  luckySpinning:    false,
  captureRevealing: false,
};

// ═══════════════════════════════════════════════════
//  FIRESTORE SERVICE
// ═══════════════════════════════════════════════════

const userRef     = (uid)      => doc(db, "users", uid);
const spinsCol    = ()         => collection(db, "spins");
const capturesCol = ()         => collection(db, "captures");
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
      avatar:              avatarToString(DEFAULT_AVATAR),
      coins:               100,
      totalFruitSpins:     0,
      totalLuckySpins:     0,
      totalCaptures:       0,
      bestWin:             0,
      pokemonCollection:   [],
      captureLastClaimAt:  null,
      captureUsed:         false,
      lastClaimAt:         null,
      createdAt:           serverTimestamp(),
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
  async logCapture(uid, username, pokemonId, pokemonName, coinsCost) {
    await addDoc(capturesCol(), {
      uid, username, pokemonId, pokemonName, coinsCost,
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
  // Recent captures across ALL players — for dashboard candidates section
  async getRecentCaptures(count = 3) {
    const q = query(capturesCol(), orderBy("createdAt", "desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getLeaderboard(n = 20) {
    const q = query(collection(db, "users"), orderBy("coins", "desc"), limit(n));
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
    [$("topbar-coins"), $("fruit-coins-display"), $("lucky-coins-display"), $("capture-coins-display")].forEach(el => {
      if (el) el.textContent = v;
    });
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
    if (persist && State.user)
      await DB.updateUser(State.user.uid, { coins: State.userData.coins });
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
  const getLastClaim  = () => toDate(State.userData?.lastClaimAt);
  const canClaim      = () => { const l = getLastClaim(); return !l || Date.now() - l.getTime() >= MS_PER_DAY; };
  const msUntilNext   = () => { const l = getLastClaim(); if (!l) return 0; return Math.max(0, MS_PER_DAY - (Date.now() - l.getTime())); };
  const fmtCountdown  = (ms) => { const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return [h,m,sec].map(v=>String(v).padStart(2,"0")).join(":"); };
  const stop          = () => { clearInterval(_interval); _interval = null; };
  const render        = () => {
    const right = $("daily-right");
    if (!right) return;
    if (canClaim()) {
      right.innerHTML = `<button id="btn-claim-daily" class="btn-claim"><i class="bi bi-coin"></i> CLAIM</button>`;
      $("btn-claim-daily")?.addEventListener("click", claim);
    } else {
      stop();
      const tick = () => {
        const dr = $("daily-right");
        if (dr) dr.innerHTML = `<div class="daily-countdown"><i class="bi bi-hourglass-split"></i> ${fmtCountdown(msUntilNext())}</div>`;
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
    document.querySelectorAll(".nav-btn").forEach(b => cls.toggle(b, "active", b.dataset.page === page));
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
//  SCREENS
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
    document.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
    document.querySelectorAll(".pw-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.target);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        const icon = btn.querySelector("i");
        if (icon) icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
      });
    });
    $("btn-login")?.addEventListener("click",   () => this.login());
    $("login-password")?.addEventListener("keydown", e => { if (e.key === "Enter") this.login(); });
    $("btn-signup")?.addEventListener("click",  () => this.signup());
    $("signup-password-confirm")?.addEventListener("keydown", e => { if (e.key === "Enter") this.signup(); });
  },
  switchTab(tab) {
    document.querySelectorAll(".auth-tab").forEach(t => cls.toggle(t, "active", t.dataset.tab === tab));
    cls.toggle($("form-login"),  "hidden", tab !== "login");
    cls.toggle($("form-signup"), "hidden", tab !== "signup");
    this._clearErrors();
  },
  _clearErrors() {
    [
      { wrap:"login-error",    msg:"login-error-msg"   },
      { wrap:"signup-error",   msg:"signup-error-msg"  },
      { wrap:"signup-success", msg:"signup-success-msg"},
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
  async login() {
    this._clearErrors();
    const username = $("login-username")?.value.trim();
    const password = $("login-password")?.value;
    if (!username) { this._setError("login-error","login-error-msg","Please enter your username."); return; }
    if (!password) { this._setError("login-error","login-error-msg","Please enter your password."); return; }
    const btn = $("btn-login");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> LOGGING IN…`; }
    try {
      await signInWithEmailAndPassword(auth, toEmail(username), password);
    } catch (e) {
      this._setError("login-error","login-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-lightning-charge-fill"></i> LOGIN`; }
    }
  },
  async signup() {
    this._clearErrors();
    const username = $("signup-username")?.value.trim();
    const password = $("signup-password")?.value;
    const confirm  = $("signup-password-confirm")?.value;
    if (!username) { this._setError("signup-error","signup-error-msg","Username is required."); return; }
    if (username.length > 25) { this._setError("signup-error","signup-error-msg","Username must be 25 characters or fewer."); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { this._setError("signup-error","signup-error-msg","Username may only contain letters, numbers, and underscores."); return; }
    if (!PW_REGEX.test(password)) { this._setError("signup-error","signup-error-msg","Password must be exactly 8 alphanumeric characters (e.g. myPass25)."); return; }
    if (password !== confirm) { this._setError("signup-error","signup-error-msg","Passwords do not match."); return; }
    const btn = $("btn-signup");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> CREATING…`; }
    try {
      const taken = await DB.isUsernameTaken(username);
      if (taken) {
        this._setError("signup-error","signup-error-msg",`"${username}" is already taken. Choose a different username.`);
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
      await DB.createUser(cred.user.uid, username);
      this._setSuccess("signup-success","signup-success-msg","Account created! Welcome to Arcade 2026 🎰");
    } catch (e) {
      this._setError("signup-error","signup-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
    }
  },
  _friendlyError(code) {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found": return "Incorrect username or password.";
      case "auth/email-already-in-use": return "That username is already registered.";
      case "auth/too-many-requests": return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed": return "Network error — check your connection and try again.";
      default: return "Something went wrong. Please try again.";
    }
  },
};

// ═══════════════════════════════════════════════════
//  POKÉMON AVATAR PICKER
// ═══════════════════════════════════════════════════

const PokemonPicker = (() => {
  let _page        = 0;
  let _selected    = null;
  const totalPages = Math.ceil(POKE_COUNT / POKE_PER_PAGE);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const render = () => {
    const grid = $("pokemon-avatar-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="pokemon-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    const start = _page * POKE_PER_PAGE + 1;
    const end   = Math.min(start + POKE_PER_PAGE - 1, POKE_COUNT);
    grid.innerHTML = "";
    for (let id = start; id <= end; id++) {
      const card = document.createElement("div");
      card.className  = "pokemon-card" + (_selected?.id === id ? " active" : "");
      card.dataset.id = id;
      const name = POKE_NAMES[id] || `pokemon-${id}`;
      card.innerHTML = `
        <img class="pokemon-img" src="${POKE_SPRITE_URL(id)}" alt="${name}" loading="lazy" />
        <span class="pokemon-name">${cap(name)}</span>`;
      card.addEventListener("click", () => selectPokemon(id, name));
      grid.appendChild(card);
    }
    const prev  = $("btn-pokemon-prev");
    const next  = $("btn-pokemon-next");
    const label = $("pokemon-page-label");
    if (prev)  prev.disabled  = _page === 0;
    if (next)  next.disabled  = _page >= totalPages - 1;
    if (label) label.textContent = `Page ${_page + 1} / ${totalPages}`;
  };

  const selectPokemon = (id, name) => {
    _selected = { id, name };
    document.querySelectorAll(".pokemon-card").forEach(c => {
      cls.toggle(c, "active", parseInt(c.dataset.id) === id);
    });
    renderAvatarPreview({ type:"pokemon", id, name });
    if (State.user && State.userData) {
      const str = avatarToString({ type:"pokemon", id, name });
      State.userData.avatar = str;
      DB.updateUser(State.user.uid, { avatar: str }).catch(() => {});
      Toast.show(`${cap(name)} selected!`, "win");
    }
  };

  const init = (currentAvatar) => {
    _selected = currentAvatar?.type === "pokemon" ? currentAvatar : null;
    if (_selected) _page = Math.floor((_selected.id - 1) / POKE_PER_PAGE);
    render();
    $("btn-pokemon-prev")?.addEventListener("click", () => { if (_page > 0) { _page--; render(); } });
    $("btn-pokemon-next")?.addEventListener("click", () => { if (_page < totalPages - 1) { _page++; render(); } });
  };

  const refresh = (currentAvatar) => {
    if (currentAvatar?.type === "pokemon" && _selected?.id !== currentAvatar.id) {
      _selected = currentAvatar;
      _page = Math.floor((_selected.id - 1) / POKE_PER_PAGE);
    }
    render();
  };

  return { init, refresh };
})();

// ═══════════════════════════════════════════════════
//  PROFILE PAGE
// ═══════════════════════════════════════════════════

const ProfilePage = {
  _initialized: false,

  init() {
    $("btn-signout")?.addEventListener("click", () => {
      Daily.stop();
      signOut(auth);
    });
  },

  refresh() {
    if (!State.userData) return;
    const d  = State.userData;
    const av = parseAvatar(d.avatar);

    if ($("acc-username"))    $("acc-username").textContent    = d.username || "—";
    if ($("acc-coins"))       $("acc-coins").textContent       = fmt.coins(d.coins) + " coins";
    if ($("acc-fruit-spins")) $("acc-fruit-spins").textContent = fmt.coins(d.totalFruitSpins || 0);
    if ($("acc-lucky-spins")) $("acc-lucky-spins").textContent = fmt.coins(d.totalLuckySpins || 0);
    if ($("acc-captures"))    $("acc-captures").textContent    = fmt.coins(d.totalCaptures || 0);
    if ($("acc-best-win"))    $("acc-best-win").textContent    = fmt.coins(d.bestWin || 0) + " coins";
    if ($("acc-since")) {
      const ts = toDate(d.createdAt);
      $("acc-since").textContent = ts ? fmt.date(ts) : "—";
    }

    renderAvatarPreview(av);

    if (!this._initialized) {
      PokemonPicker.init(av);
      this._initialized = true;
    } else {
      PokemonPicker.refresh(av);
    }

    this._renderCollection(d.pokemonCollection || []);
  },

  _renderCollection(collection) {
    const wrap = $("collection-gallery");
    if (!wrap) return;

    const countEl = $("collection-count");
    if (countEl) countEl.textContent = collection.length;

    if (!collection.length) {
      wrap.innerHTML = `
        <div class="collection-empty">
          <i class="bi bi-collection"></i>
          <p>No Pokémon captured yet.</p>
          <p class="collection-empty-sub">Head to Games and try Capture a Pokémon!</p>
        </div>`;
      return;
    }

    wrap.innerHTML = "";
    // Sort by id ascending for a nice Pokédex-like order
    const sorted = [...collection].sort((a, b) => a.id - b.id);
    sorted.forEach(({ id, name }) => {
      const card = document.createElement("div");
      card.className = "collection-card";
      card.innerHTML = `
        <div class="collection-card-img-wrap">
          <img
            src="${POKE_ARTWORK_URL(id)}"
            alt="${name}"
            loading="lazy"
            class="collection-card-img"
            onerror="this.src='${POKE_SPRITE_URL(id)}'"
          />
        </div>
        <span class="collection-card-name">${name}</span>
        <span class="collection-card-id">#${String(id).padStart(3,"0")}</span>`;
      wrap.appendChild(card);
    });
  },
};

// ═══════════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════════

const DashPage = {
  _activeGame: "fruit",
  async refresh() {
    if (!State.user || !State.userData) return;
    const d = State.userData;
    if ($("stat-total-coins"))  $("stat-total-coins").textContent  = fmt.coins(d.coins);
    if ($("stat-fruit-spins"))  $("stat-fruit-spins").textContent  = fmt.coins(d.totalFruitSpins || 0);
    if ($("stat-lucky-spins"))  $("stat-lucky-spins").textContent  = fmt.coins(d.totalLuckySpins || 0);
    if ($("stat-captures"))     $("stat-captures").textContent     = fmt.coins(d.totalCaptures || 0);
    if ($("stat-best-win"))     $("stat-best-win").textContent     = fmt.coins(d.bestWin || 0);
    await Promise.all([
      this.loadLeaderboard(),
      this.loadActivity(this._activeGame),
      this.loadPokemonCandidates(),
    ]);
  },
  async loadLeaderboard() {
    const list = $("leaderboard-list");
    if (!list) return;
    list.innerHTML = `<div class="lb-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const entries = await DB.getLeaderboard(20);
      list.innerHTML = "";
      if (!entries.length) { list.innerHTML = `<div class="lb-empty"><i class="bi bi-people"></i> No players yet.</div>`; return; }
      const medals = ["🥇","🥈","🥉"];
      entries.forEach((e, i) => {
        const isMe = e.uid === State.user.uid;
        const name = (e.username?.trim() || "Player");
        const row  = document.createElement("div");
        row.className = "lb-row" + (isMe ? " me" : "");
        row.innerHTML = `
          <span class="lb-rank">${medals[i] ?? "#"+(i+1)}</span>
          <span class="lb-avatar">${avatarHtml(e.avatar)}</span>
          <span class="lb-name">${name}${isMe ? `<span class="lb-you">YOU</span>` : ""}</span>
          <span class="lb-coins"><i class="bi bi-coin" style="color:var(--gold)"></i> ${fmt.coins(e.coins || 0)}</span>`;
        list.appendChild(row);
      });
    } catch (err) {
      console.error("Leaderboard error:", err);
      list.innerHTML = `<div class="lb-empty"><i class="bi bi-wifi-off"></i> Could not load leaderboard.</div>`;
    }
  },

  // ── Pokémon Candidates — recent captures across all players ──
  async loadPokemonCandidates() {
    const list = $("pokemon-candidates-list");
    if (!list) return;
    list.innerHTML = `<div class="candidates-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getRecentCaptures(3);
      list.innerHTML = "";
      if (!items.length) {
        list.innerHTML = `<div class="candidates-empty"><i class="bi bi-award"></i> No captures yet — be the first!</div>`;
        return;
      }
      items.forEach(item => {
        const date = toDate(item.createdAt);
        const card = document.createElement("div");
        card.className = "candidate-card";
        card.innerHTML = `
          <div class="candidate-img-wrap">
            <img
              src="${POKE_ARTWORK_URL(item.pokemonId)}"
              alt="${item.pokemonName}"
              class="candidate-img"
              loading="lazy"
              onerror="this.src='${POKE_SPRITE_URL(item.pokemonId)}'"
            />
          </div>
          <div class="candidate-info">
            <span class="candidate-name">${item.pokemonName}</span>
            <span class="candidate-id">#${String(item.pokemonId).padStart(3,"0")}</span>
            <span class="candidate-by">
              <i class="bi bi-person-fill"></i> ${item.username || "Trainer"}
            </span>
          </div>
          <span class="candidate-time">${fmt.timeAgo(date)}</span>`;
        list.appendChild(card);
      });
    } catch (err) {
      console.error("Candidates error:", err);
      list.innerHTML = `<div class="candidates-empty"><i class="bi bi-wifi-off"></i> Could not load.</div>`;
    }
  },

  async loadActivity(game) {
    this._activeGame = game;
    document.querySelectorAll(".act-tab").forEach(t => cls.toggle(t, "act-tab-active", t.dataset.game === game));
    const list = $("activity-list");
    if (!list) return;
    list.innerHTML = `<div class="act-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getSpins(State.user.uid, game, 20);
      list.innerHTML = "";
      if (!items.length) { list.innerHTML = `<div class="act-empty"><i class="bi bi-joystick"></i> No activity yet — go play!</div>`; return; }
      items.forEach(item => {
        const won   = item.coinsWon  ?? 0;
        const cost  = item.coinsCost ?? (game === "fruit" ? FRUIT_SPIN_COST : LUCKY_PULL_COST);
        const net   = won - cost;
        const date  = toDate(item.createdAt);
        const isWin = net >= 0;
        const el    = document.createElement("div");
        el.className = "act-item";
        let emoji, resultText;
        if (game === "fruit") {
          emoji = item.symbols || "🎰";
          resultText = won > 0 ? `Won ${fmt.coins(won)} coins` : "Bomb — no reward";
        } else {
          const syms = (item.symbols || "").split(",");
          emoji = syms.slice(0, 3).join("") || "7️⃣";
          resultText = won > 0 ? `Won ${fmt.coins(won)} coins` : "No match";
        }
        el.innerHTML = `
          <span class="act-emoji">${emoji}</span>
          <div class="act-body">
            <div class="act-result ${isWin ? "win" : "loss"}">${resultText}</div>
            <div class="act-time"><i class="bi bi-clock"></i> ${date ? fmt.time(date) + " · " + fmt.date(date) : "Just now"}</div>
          </div>
          <span class="act-coins ${isWin ? "win" : "loss"}">${isWin ? "+" : ""}${fmt.coins(net)}</span>`;
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
  const BORDER   = borderIndices();
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
      cell.className   = isBorder ? "fg-cell border-cell" : "fg-cell inner-cell";
      cell.textContent = isBorder ? FRUIT_AT[i].emoji : "×";
      grid.appendChild(cell);
      _cells.push(cell);
    }
  };
  const clearLit  = () => { BORDER.forEach(i => cls.remove(_cells[i], "lit","winner","winner-bomb")); };
  const setLit    = (idx) => { clearLit(); cls.add(_cells[idx], "lit"); };
  const setWinner = (idx, isBomb) => { clearLit(); cls.add(_cells[idx], isBomb ? "winner-bomb" : "winner"); };
  return { render, BORDER, FRUIT_AT, setLit, setWinner, clearLit };
})();

// ═══════════════════════════════════════════════════
//  FRUIT SPIN GAME
// ═══════════════════════════════════════════════════

const FruitGame = {
  init() {
    FruitGrid.render();
    $("btn-fruit-spin")?.addEventListener("click", () => this.spin());
    $("back-fruit")?.addEventListener("click",    () => cls.add($("overlay-fruit"), "hidden"));
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
    } catch {}
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
      <span class="fh-label">${won > 0 ? "Collected" : "Bomb!"} · <i class="bi bi-clock"></i> ${date ? fmt.time(date) : "now"}</span>
      <span class="${isWin ? "fh-win" : "fh-loss"}">${isWin ? "+" : ""}${fmt.coins(net)}</span>`;
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
    if (Coins.get() < FRUIT_SPIN_COST) { Toast.show("Not enough coins!", "loss"); return; }
    State.fruitSpinning = true;
    const btn = $("btn-fruit-spin");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> SPINNING…`; }
    cls.add($("fruit-result"), "hidden");
    await Coins.deduct(FRUIT_SPIN_COST);
    this._refreshCoins();
    const winner      = weightedPick(FRUIT_ITEMS, FRUIT_TOTAL_WEIGHT);
    const matchingIdx = FruitGrid.BORDER.filter(idx => FruitGrid.FRUIT_AT[idx].emoji === winner.emoji);
    const winnerIdx   = matchingIdx.length
      ? matchingIdx[Math.floor(Math.random() * matchingIdx.length)]
      : FruitGrid.BORDER[Math.floor(Math.random() * FruitGrid.BORDER.length)];
    const ticks = Math.floor(FRUIT_SPIN_MS / FRUIT_TICK_MS);
    for (let t = 0; t < ticks; t++) {
      FruitGrid.setLit(FruitGrid.BORDER[t % FruitGrid.BORDER.length]);
      Sound.tick();
      await sleep(FRUIT_TICK_MS);
    }
    FruitGrid.setWinner(winnerIdx, winner.emoji === "💣");
    const isBomb   = winner.emoji === "💣";
    const resultEl = $("fruit-result");
    if (resultEl) {
      resultEl.innerHTML = isBomb
        ? `<i class="bi bi-exclamation-octagon-fill"></i> BOMB! No reward.`
        : `${winner.emoji} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(winner.value)} coins!`;
      resultEl.className = "fruit-result" + (isBomb ? " bomb" : "");
      cls.remove(resultEl, "hidden");
    }
    if (isBomb) { Sound.bomb(); Toast.show("Bomb! Better luck next spin.", "loss"); }
    else { Sound.win(); await Coins.add(winner.value); this._refreshCoins(); Toast.show(`+${fmt.coins(winner.value)} coins!`, "win"); }
    const newFruitSpins = (State.userData.totalFruitSpins || 0) + 1;
    const newBestWin    = Math.max(State.userData.bestWin || 0, winner.value);
    State.userData.totalFruitSpins = newFruitSpins;
    State.userData.bestWin         = newBestWin;
    await DB.updateUser(State.user.uid, { totalFruitSpins: newFruitSpins, bestWin: newBestWin });
    DB.logSpin(State.user.uid, "fruit", winner.emoji, winner.value, FRUIT_SPIN_COST).catch(() => {});
    this._prependHist(winner.emoji, winner.value);
    State.fruitSpinning = false;
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-arrow-clockwise"></i> SPIN`; }
  },
};

// ═══════════════════════════════════════════════════
//  LUCKY 777 GAME
// ═══════════════════════════════════════════════════

const LuckyGame = {
  init() {
    $("btn-lucky-pull")?.addEventListener("click", () => this.pull());
    $("back-lucky")?.addEventListener("click",     () => cls.add($("overlay-lucky"), "hidden"));
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
    symbols[targetIdx].textContent = targetSymbol;
    if (targetIdx > 0) symbols[targetIdx - 1].textContent = LUCKY_SYMBOLS[Math.floor(Math.random() * LUCKY_SYMBOLS.length)];
    const finalY = -(targetIdx * symbolH);
    strip.style.transition = "none";
    strip.style.transform  = "translateY(0)";
    void strip.offsetWidth;
    strip.style.transition = `transform ${duration}ms cubic-bezier(.17,.67,.1,.98)`;
    strip.style.transform  = `translateY(${finalY}px)`;
    await sleep(duration);
    strip.style.transition = "none";
  },
  _evalResult(symbols) {
    const key = symbols.join("-");
    if (LUCKY_PAYOUTS[key] !== undefined) return LUCKY_PAYOUTS[key];
    if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) return LUCKY_PARTIAL_WIN;
    return 0;
  },
  async _loadHistory() {
    const list = $("lucky-history");
    if (!list || !State.user) return;
    try {
      const items = await DB.getSpins(State.user.uid, "lucky", 10);
      list.innerHTML = "";
      items.forEach(item => list.appendChild(this._buildHistItem(item)));
    } catch {}
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
      <span class="fh-emoji">${syms.slice(0,3).join("")}</span>
      <span class="fh-label">${won > 0 ? `Won ${fmt.coins(won)}` : "No match"} · <i class="bi bi-clock"></i> ${date ? fmt.time(date) : "now"}</span>
      <span class="${isWin ? "fh-win" : "fh-loss"}">${isWin ? "+" : ""}${fmt.coins(net)}</span>`;
    return el;
  },
  _prependHist(symbols, coinsWon) {
    const list = $("lucky-history");
    if (!list) return;
    const el = this._buildHistItem({ symbols: symbols.join(","), coinsWon, coinsCost: LUCKY_PULL_COST, createdAt: null });
    list.prepend(el);
    while (list.children.length > 15) list.lastChild?.remove();
  },
  async pull() {
    if (State.luckySpinning) return;
    if (Coins.get() < LUCKY_PULL_COST) { Toast.show("Not enough coins!", "loss"); return; }
    State.luckySpinning = true;
    const btn = $("btn-lucky-pull");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> PULLING…`; }
    cls.add($("lucky-result"), "hidden");
    await Coins.deduct(LUCKY_PULL_COST);
    this._refreshCoins();
    const WEIGHTED = [
      { sym:"7️⃣", w:2 },{ sym:"💎", w:5 },{ sym:"⭐", w:10 },
      { sym:"🍒", w:18 },{ sym:"🍋", w:20 },{ sym:"🔔", w:20 },
      { sym:"🍇", w:14 },{ sym:"🍀", w:11 },
    ];
    const totalW  = WEIGHTED.reduce((s, x) => s + x.w, 0);
    const pickSym = () => { let r = Math.random() * totalW; for (const x of WEIGHTED) { r -= x.w; if (r <= 0) return x.sym; } return "🍋"; };
    const picked  = [pickSym(), pickSym(), pickSym()];
    const lights  = qs(".slot-lights");
    if (lights) cls.add(lights, "spinning");
    Sound.reelSpin();
    const durations = [1200, 1700, 2200];
    await Promise.all(picked.map((sym, i) => this._animateReel(i, sym, durations[i])));
    if (lights) cls.remove(lights, "spinning");
    const coinsWon  = this._evalResult(picked);
    const isJackpot = picked.join("-") === "7️⃣-7️⃣-7️⃣";
    const resultEl  = $("lucky-result");
    if (resultEl) {
      if (isJackpot) { resultEl.innerHTML = `<i class="bi bi-stars"></i> JACKPOT! +${fmt.coins(coinsWon)} coins!`; resultEl.className = "lucky-result jackpot"; }
      else if (coinsWon > 0) { resultEl.innerHTML = `${picked.join("")} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(coinsWon)} coins!`; resultEl.className = "lucky-result"; }
      else { resultEl.innerHTML = `${picked.join("")} <i class="bi bi-dash-circle-fill"></i> No match. Try again!`; resultEl.className = "lucky-result loss"; }
      cls.remove(resultEl, "hidden");
    }
    if (isJackpot) { Sound.jackpot(); Toast.show(`JACKPOT! +${fmt.coins(coinsWon)} coins!`, "jackpot", 4000); }
    else if (coinsWon > 0) { Sound.win(); Toast.show(`+${fmt.coins(coinsWon)} coins!`, "win"); }
    else { Sound.bomb(); Toast.show("No match. Keep trying!", "loss"); }
    if (coinsWon > 0) { await Coins.add(coinsWon); this._refreshCoins(); }
    const newLuckySpins = (State.userData.totalLuckySpins || 0) + 1;
    const newBestWin    = Math.max(State.userData.bestWin || 0, coinsWon);
    State.userData.totalLuckySpins = newLuckySpins;
    State.userData.bestWin         = newBestWin;
    await DB.updateUser(State.user.uid, { totalLuckySpins: newLuckySpins, bestWin: newBestWin });
    DB.logSpin(State.user.uid, "lucky", picked, coinsWon, LUCKY_PULL_COST).catch(() => {});
    this._prependHist(picked, coinsWon);
    State.luckySpinning = false;
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-stars"></i> PULL`; }
  },
};

// ═══════════════════════════════════════════════════
//  CAPTURE A POKÉMON GAME
// ═══════════════════════════════════════════════════

const CaptureGame = {
  _pickedBall:    null,  // index 0–4 of which ball the player chose
  _revealedPoke:  null,  // { id, name } of the revealed Pokémon

  init() {
    $("open-capture")?.addEventListener("click",   () => this.open());
    $("back-capture")?.addEventListener("click",   () => this._closeOverlay());
    $("btn-buy-pokeball")?.addEventListener("click", () => this._buyPokeball());
    $("btn-capture-again")?.addEventListener("click", () => this._resetForNewThrow());
  },

  // ── daily free ball logic ──
  _captureLastClaim() { return toDate(State.userData?.captureLastClaimAt); },
  _canClaimFreeBall() {
    const l = this._captureLastClaim();
    return !l || Date.now() - l.getTime() >= MS_PER_DAY;
  },
  _hasFreeBalReady() {
    // Free if never used today
    return this._canClaimFreeBall() || !State.userData?.captureUsed;
  },
  _isBallAvailable() {
    // Ball available if: (free daily not yet used) OR (daily reset)
    if (this._canClaimFreeBall()) return true;      // 24h passed — fresh free ball
    return !State.userData?.captureUsed;            // same day but not yet used
  },

  open() {
    cls.remove($("overlay-capture"), "hidden");
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._refreshCoins();
    this._renderState();
  },

  _closeOverlay() {
    cls.add($("overlay-capture"), "hidden");
    this._pickedBall   = null;
    this._revealedPoke = null;
  },

  _refreshCoins() {
    const el = $("capture-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },

  // Decide what the overlay should show and render it
  _renderState() {
    const ballAvailable = this._isBallAvailable();
    const statusEl  = $("capture-status");
    const ballsWrap = $("pokeballs-wrap");
    const revealEl  = $("capture-reveal");
    const buyWrap   = $("capture-buy-wrap");

    // Hide reveal panel by default
    if (revealEl) cls.add(revealEl, "hidden");

    if (ballAvailable) {
      // Show balls, hide buy CTA
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="capture-status-badge free">
            <i class="bi bi-gift-fill"></i> FREE POKÉBALL READY
          </span>
          <p class="capture-status-sub">Pick one of the 5 Pokéballs to reveal a Pokémon!</p>`;
      }
      if (ballsWrap) { cls.remove(ballsWrap, "hidden"); this._renderBalls(true); }
      if (buyWrap)   cls.add(buyWrap, "hidden");
    } else {
      // Ball used — show buy CTA + countdown
      if (ballsWrap) cls.add(ballsWrap, "hidden");
      if (buyWrap)   cls.remove(buyWrap, "hidden");
      if (statusEl) {
        const ms   = MS_PER_DAY - (Date.now() - this._captureLastClaim().getTime());
        const h    = Math.floor(ms / 3600000);
        const m    = Math.floor((ms % 3600000) / 60000);
        statusEl.innerHTML = `
          <span class="capture-status-badge used">
            <i class="bi bi-check-circle-fill"></i> TODAY'S FREE THROW USED
          </span>
          <p class="capture-status-sub">Next free Pokéball in <strong>${h}h ${m}m</strong> — or buy one now!</p>`;
      }
    }
  },

  _renderBalls(interactive = true) {
    const grid = $("pokeballs-grid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < CAPTURE_BALL_COUNT; i++) {
      const ball = document.createElement("button");
      ball.className   = "pokeball-btn" + (this._pickedBall === i ? " picked" : "");
      ball.dataset.idx = i;
      ball.disabled    = !interactive || this._pickedBall !== null;
      ball.setAttribute("aria-label", `Pokéball ${i + 1}`);
      ball.innerHTML = `
        <div class="pokeball">
          <div class="pokeball-top"></div>
          <div class="pokeball-band">
            <div class="pokeball-btn-center"></div>
          </div>
          <div class="pokeball-bottom"></div>
        </div>
        <span class="pokeball-label">${i + 1}</span>`;
      ball.addEventListener("click", () => this._onBallPick(i));
      grid.appendChild(ball);
    }
  },

  async _onBallPick(idx) {
    if (this._pickedBall !== null || State.captureRevealing) return;
    State.captureRevealing = true;
    this._pickedBall = idx;

    // Disable all balls immediately
    document.querySelectorAll(".pokeball-btn").forEach(b => b.disabled = true);

    // Shake animation on picked ball
    const pickedEl = document.querySelector(`.pokeball-btn[data-idx="${idx}"]`);
    if (pickedEl) {
      cls.add(pickedEl, "shaking");
      await sleep(900);
      cls.remove(pickedEl, "shaking");
      cls.add(pickedEl, "picked");
      await sleep(200);
    }

    // Pick a random Pokémon from Gen 1
    const pokeId   = CAPTURE_POOL[Math.floor(Math.random() * CAPTURE_POOL.length)];
    const pokeName_ = pokeName(pokeId);
    this._revealedPoke = { id: pokeId, name: pokeName_ };

    // Fetch flavor text from PokéAPI
    const flavorText = await this._fetchFlavorText(pokeId);
    const types      = await this._fetchTypes(pokeId);

    // Show reveal panel
    await this._showReveal(pokeId, pokeName_, flavorText, types);

    // Persist — mark ball used and save to collection
    await this._persist(pokeId, pokeName_);

    State.captureRevealing = false;
  },

  async _fetchFlavorText(id) {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
      const data = await res.json();
      // Find first English flavor text
      const entry = data.flavor_text_entries?.find(e => e.language.name === "en");
      return entry
        ? entry.flavor_text.replace(/\f|\n/g, " ").replace(/\s+/g, " ").trim()
        : "A mysterious Pokémon with unknown abilities.";
    } catch {
      return "A mysterious Pokémon with unknown abilities.";
    }
  },

  async _fetchTypes(id) {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();
      return data.types?.map(t => t.type.name) || [];
    } catch {
      return [];
    }
  },

  async _showReveal(id, name, flavorText, types) {
    const revealEl = $("capture-reveal");
    const ballsWrap = $("pokeballs-wrap");
    if (!revealEl) return;

    // Build type badge HTML
    const typeBadges = types.map(t =>
      `<span class="poke-type-badge poke-type-${t}">${t}</span>`
    ).join("");

    revealEl.innerHTML = `
      <div class="reveal-inner">
        <div class="reveal-flash"></div>
        <div class="reveal-img-wrap">
          <img
            id="reveal-pokemon-img"
            src="${POKE_ARTWORK_URL(id)}"
            alt="${name}"
            class="reveal-pokemon-img"
            onerror="this.src='${POKE_SPRITE_URL(id)}'"
          />
        </div>
        <div class="reveal-info">
          <div class="reveal-number">#${String(id).padStart(3,"0")}</div>
          <h3 class="reveal-name">${name}</h3>
          <div class="reveal-types">${typeBadges}</div>
          <p class="reveal-flavor">${flavorText}</p>
          <div class="reveal-caught-badge">
            <i class="bi bi-patch-check-fill"></i> Added to your collection!
          </div>
        </div>
      </div>`;

    // Hide balls, show reveal
    if (ballsWrap) cls.add(ballsWrap, "hidden");
    cls.remove(revealEl, "hidden");
    cls.add(revealEl, "reveal-enter");

    Sound.capture();
    Toast.show(`${name} was captured!`, "capture", 3500);

    await sleep(600);
    cls.remove(revealEl, "reveal-enter");
  },

  async _persist(pokeId, pokeName_) {
    if (!State.user || !State.userData) return;

    const now        = new Date();
    const collection = State.userData.pokemonCollection || [];

    // Only add if not already in collection (no duplicates by id)
    const alreadyHave = collection.some(p => p.id === pokeId);
    const newCollection = alreadyHave
      ? collection
      : [...collection, { id: pokeId, name: pokeName_ }];

    const newCaptures = (State.userData.totalCaptures || 0) + 1;

    State.userData.pokemonCollection  = newCollection;
    State.userData.totalCaptures      = newCaptures;
    State.userData.captureUsed        = true;
    State.userData.captureLastClaimAt = now;

    await DB.updateUser(State.user.uid, {
      pokemonCollection:  newCollection,
      totalCaptures:      newCaptures,
      captureUsed:        true,
      captureLastClaimAt: now,
    });

    DB.logCapture(
      State.user.uid,
      State.userData.username || "Trainer",
      pokeId,
      pokeName_,
      this._canClaimFreeBall() ? 0 : CAPTURE_COST
    ).catch(() => {});

    this._refreshCoins();
    // Update capture-coins-display
    const el = $("capture-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },

  async _buyPokeball() {
    if (State.captureRevealing) return;
    if (Coins.get() < CAPTURE_COST) {
      Toast.show(`Not enough coins! Need ${fmt.coins(CAPTURE_COST)}.`, "loss", 3000);
      return;
    }
    const btn = $("btn-buy-pokeball");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Purchasing…`; }

    const ok = await Coins.deduct(CAPTURE_COST);
    if (!ok) {
      Toast.show("Not enough coins!", "loss");
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-bag-fill"></i> BUY POKÉBALL — 500 coins`; }
      return;
    }

    // Reset captureUsed so player can throw again
    State.userData.captureUsed = false;
    await DB.updateUser(State.user.uid, { captureUsed: false, coins: State.userData.coins });

    this._refreshCoins();
    Toast.show("Pokéball purchased!", "info", 2000);

    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-bag-fill"></i> BUY POKÉBALL — 500 coins`; }

    // Re-render to show the ball selection
    this._pickedBall   = null;
    this._revealedPoke = null;
    const revealEl = $("capture-reveal");
    if (revealEl) cls.add(revealEl, "hidden");
    this._renderState();
  },

  _resetForNewThrow() {
    // Only reachable after a reveal — hides reveal and goes back to buy CTA
    const revealEl  = $("capture-reveal");
    const buyWrap   = $("capture-buy-wrap");
    const statusEl  = $("capture-status");
    if (revealEl) cls.add(revealEl, "hidden");
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._renderState();
  },
};

// ═══════════════════════════════════════════════════
//  SOUND MODULE
// ═══════════════════════════════════════════════════

const Sound = (() => {
  let _ctx;
  const ctx = () => { if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)(); return _ctx; };
  const tone = (freq, dur, type = "square", vol = 0.06) => {
    try {
      const c = ctx(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(c.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.stop(c.currentTime + dur);
    } catch {}
  };
  return {
    tick:     () => tone(920, .03),
    win:      () => tone(1300, .18, "sine", .07),
    bomb:     () => tone(110, .3, "sawtooth", .09),
    reelSpin: () => tone(700, .07, "sawtooth", .04),
    capture:  () => {
      // Ascending "capture" sound — three rising tones
      try {
        const c = ctx();
        [600, 900, 1200].forEach((f, i) => {
          setTimeout(() => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = "sine"; o.frequency.value = f; g.gain.value = .14;
            o.connect(g); g.connect(c.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + .35);
            o.stop(c.currentTime + .35);
          }, i * 120);
        });
      } catch {}
    },
    jackpot:  () => {
      try {
        const c = ctx();
        [1200,1500,1800,2200].forEach((f, i) => {
          setTimeout(() => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = "sine"; o.frequency.value = f; g.gain.value = .22;
            o.connect(g); g.connect(c.destination); o.start();
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
    cls.add($("overlay-fruit"),   "hidden");
    cls.add($("overlay-lucky"),   "hidden");
    cls.add($("overlay-capture"), "hidden");
    cls.add($("app"), "hidden");
    Screens.show("screen-signin");
    ["login-username","login-password","signup-username","signup-password","signup-password-confirm"]
      .forEach(id => { const el = $(id); if (el) el.value = ""; });
    AuthScreen._clearErrors?.();
    AuthScreen.switchTab?.("login");
  },
};

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════

const boot = () => {
  Screens.show("screen-splash");
  AuthScreen.init();
  DashPage.bindTabs();
  ProfilePage.init();
  FruitGame.init();
  LuckyGame.init();
  CaptureGame.init();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      Auth.onSignedIn(user);
    } else {
      if (cls.has($("screen-splash"), "active")) {
        setTimeout(() => { Screens.splashOut(() => Screens.show("screen-signin")); }, 1700);
      } else {
        Auth.onSignedOut();
      }
    }
  });
};

boot();
