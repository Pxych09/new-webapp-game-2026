
/**
 * ARCADE 2026 — app.js
 * Firebase: Username/Password Auth + Firestore
 * Games: Fruit Spin, Lucky 777, Capture a Pokémon (Tier 1 & Tier 2)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit, getDocs, serverTimestamp,
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
//  CONSTANTS — GENERAL
// ═══════════════════════════════════════════════════
const POKE_COUNT    = 151;
const POKE_PER_PAGE = 6;
const POKE_MAX      = 1025;

const POKE_SPRITE_URL  = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const POKE_ARTWORK_URL = (id) =>
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

const FRUIT_SPIN_COST = 1;
const FRUIT_SPIN_MS   = 4000;
const FRUIT_TICK_MS   = 65;

const LUCKY_SYMBOLS   = ["7️⃣","💎","⭐","🍒","🍋","🔔","🍇","🍀"];
const LUCKY_PULL_COST = 3;
const LUCKY_PAYOUTS   = {
  "7️⃣-7️⃣-7️⃣": 500,
  "💎-💎-💎":    200,
  "⭐-⭐-⭐":    100,
  "🍒-🍒-🍒":    50,
  "🍋-🍋-🍋":    30,
  "🔔-🔔-🔔":    20,
};
const LUCKY_PARTIAL_WIN = 5;

const DAILY_REWARD   = 100;
const MS_PER_DAY     = 86_400_000;
const MS_PER_WEEK    = 7 * MS_PER_DAY;

// ═══════════════════════════════════════════════════
//  CAPTURE CONSTANTS
// ═══════════════════════════════════════════════════
const CAPTURE_BALL_COUNT = 5;

const CAPTURE_T1_BASE_COST = 50;
const CAPTURE_T1_INCREMENT = 50;

const CAPTURE_T2_BASE_COST = 150;
const CAPTURE_T2_INCREMENT = 50;

// ═══════════════════════════════════════════════════
//  POKÉMON DATA — Names (Gen 1 for avatar picker)
// ═══════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════
//  POKÉMON POOLS — Tier 1 (common) & Tier 2 (legendary/epic)
// ═══════════════════════════════════════════════════
const TIER2_IDS = new Set([
  144, 145, 146, 149, 150, 151,
  243, 244, 245, 248, 249, 250, 251,
  373, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  445, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  635, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  706, 716, 717, 718, 719, 720, 721,
  772, 773, 784, 785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808, 809,
  887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905,
  998, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010, 1017, 1019, 1020, 1021, 1024, 1025,
]);

const VALID_GEN9_IDS = [
  906,907,908,909,910,911,912,913,914,915,916,917,918,919,920,
  921,922,923,924,925,926,927,928,929,930,931,932,933,934,935,
  936,937,938,939,940,941,942,943,944,945,946,947,948,949,950,
  951,952,953,954,955,956,957,958,959,960,961,962,963,964,965,
  966,967,968,969,970,971,972,973,974,975,976,977,978,979,980,
  981,982,983,984,985,986,987,988,989,990,991,992,993,994,995,
  996,997,998,999,1000,1001,1002,1003,1004,1005,1006,1007,1008,
  1009,1010,1017,1019,1020,1021,1022,1023,1024,1025,
];

const ALL_VALID_IDS = [
  ...Array.from({ length: 905 }, (_, i) => i + 1),
  ...VALID_GEN9_IDS,
];

const TIER1_POOL = ALL_VALID_IDS.filter(id => !TIER2_IDS.has(id));
const TIER2_POOL = ALL_VALID_IDS.filter(id =>  TIER2_IDS.has(id));

const pokeName = (id) => {
  if (id <= 151 && POKE_NAMES[id]) {
    const n = POKE_NAMES[id];
    return n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, " ");
  }
  return `Pokémon #${id}`;
};

// ═══════════════════════════════════════════════════
//  AUTH / MISC HELPERS
// ═══════════════════════════════════════════════════
const toEmail  = (username) => `${username.toLowerCase()}@arcade2026.local`;
const PW_REGEX = /^[a-zA-Z0-9]{8}$/;
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
const $     = (id)               => document.getElementById(id);
const qs    = (sel, ctx=document) => ctx.querySelector(sel);
const sleep = (ms)               => new Promise(r => setTimeout(r, ms));

const cls = {
  add:    (el, ...c) => el?.classList.add(...c),
  remove: (el, ...c) => el?.classList.remove(...c),
  toggle: (el, c, v) => el?.classList.toggle(c, v),
  has:    (el, c)    => !!el?.classList.contains(c),
};

const fmt = {
  coins: (n) => Math.floor(n ?? 0).toLocaleString(),
  time:  (d) => d instanceof Date
    ? d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "—",
  date:  (d) => d instanceof Date
    ? d.toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" }) : "—",
  timeAgo: (d) => {
    if (!(d instanceof Date)) return "just now";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)    return "just now";
    if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  },
  countdown: (ms) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24), rh = h % 24;
      return `${d}d ${String(rh).padStart(2,"0")}h`;
    }
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
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
//  POKÉMON AVATAR HELPERS
// ═══════════════════════════════════════════════════
const parseAvatar = (raw) => {
  if (!raw) return DEFAULT_AVATAR;
  if (typeof raw === "string" && raw.startsWith("pokemon:")) {
    const [, idStr, name] = raw.split(":");
    return { type:"pokemon", id:parseInt(idStr), name: name || "" };
  }
  return DEFAULT_AVATAR;
};
const avatarToString  = (av) => `pokemon:${av.id}:${av.name}`;
const renderAvatarPreview = (av) => {
  const img  = $("avatar-preview-img");
  const fall = $("avatar-preview-fallback");
  if (!img || !fall) return;
  if (av?.type === "pokemon") {
    img.src = POKE_SPRITE_URL(av.id); img.alt = av.name;
    cls.remove(img, "hidden"); cls.add(fall, "hidden");
  } else {
    cls.add(img, "hidden"); cls.remove(fall, "hidden"); fall.textContent = "?";
  }
};
const avatarHtml = (raw) => {
  const av = parseAvatar(raw);
  if (av.type === "pokemon")
    return `<img src="${POKE_SPRITE_URL(av.id)}" alt="${av.name}" style="width:24px;height:24px;object-fit:contain;image-rendering:pixelated;border-radius:50%;" />`;
  return av.emoji || "👾";
};

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════
const Toast = (() => {
  let _t = null;
  const ICONS = {
    win:       '<i class="bi bi-check-circle-fill"></i>',
    loss:      '<i class="bi bi-x-circle-fill"></i>',
    jackpot:   '<i class="bi bi-stars"></i>',
    info:      '<i class="bi bi-info-circle-fill"></i>',
    capture:   '<i class="bi bi-collection-fill"></i>',
    legendary: '<i class="bi bi-gem-fill"></i>',
  };
  const show = (msg, type="info", ms=2600) => {
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
        cls.add(el, "hidden"); cls.remove(el, "hiding");
      }, { once:true });
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
    return (await getDoc(usernameRef(username))).exists();
  },
  async getUser(uid) {
    const snap = await getDoc(userRef(uid));
    return snap.exists() ? snap.data() : null;
  },
  async createUser(uid, username) {
    const data = {
      username,
      avatar:               avatarToString(DEFAULT_AVATAR),
      coins:                100,
      totalFruitSpins:      0,
      totalLuckySpins:      0,
      totalCaptures:        0,
      bestWin:              0,
      pokemonCollection:    [],
      captureT1LastClaimAt: null,
      captureT1PaidCount:   0,
      captureT2LastClaimAt: null,
      captureT2PaidCount:   0,
      captureLastClaimAt:   null,
      captureUsed:          false,
      lastClaimAt:          null,
      createdAt:            serverTimestamp(),
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
      symbols:   Array.isArray(symbols) ? symbols.join(",") : symbols,
      coinsWon, coinsCost,
      net:       coinsWon - coinsCost,
      createdAt: serverTimestamp(),
    });
  },
  async logCapture(uid, username, pokemonId, pokemonName, coinsCost, tier) {
    await addDoc(capturesCol(), {
      uid, username, pokemonId, pokemonName, coinsCost,
      tier: tier || "t1",
      createdAt: serverTimestamp(),
    });
  },
  async getSpins(uid, game, count=20) {
    const q = query(spinsCol(), where("uid","==",uid), where("game","==",game),
                    orderBy("createdAt","desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  },
  async getRecentCaptures(count=3) {
    const q = query(capturesCol(), orderBy("createdAt","desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  },
  async getLeaderboard(n=20) {
    const q = query(collection(db,"users"), orderBy("coins","desc"), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid:d.id, ...d.data() }));
  },
};

// ═══════════════════════════════════════════════════
//  COINS MODULE
// ═══════════════════════════════════════════════════
const Coins = {
  get() { return State.userData?.coins ?? 0; },
  _refresh() {
    const v = fmt.coins(this.get());
    [$("topbar-coins"),$("fruit-coins-display"),$("lucky-coins-display"),$("capture-coins-display")]
      .forEach(el => { if (el) el.textContent = v; });
    if ($("acc-coins"))        $("acc-coins").textContent        = v + " coins";
    if ($("stat-total-coins")) $("stat-total-coins").textContent = v;
  },
  bump() {
    const el = $("topbar-coins");
    if (!el) return;
    cls.add(el, "bump");
    setTimeout(() => cls.remove(el, "bump"), 500);
  },
  async add(amount, persist=true) {
    State.userData.coins = (State.userData.coins ?? 0) + amount;
    this._refresh(); this.bump();
    if (persist && State.user) await DB.updateUser(State.user.uid, { coins:State.userData.coins });
  },
  async deduct(amount) {
    if (this.get() < amount) return false;
    State.userData.coins -= amount;
    this._refresh();
    if (State.user) await DB.updateUser(State.user.uid, { coins:State.userData.coins });
    return true;
  },
  set(val) { if (State.userData) State.userData.coins = val; this._refresh(); },
};

// ═══════════════════════════════════════════════════
//  DAILY REWARD
// ═══════════════════════════════════════════════════
const Daily = (() => {
  let _interval = null;
  const getLastClaim = () => toDate(State.userData?.lastClaimAt);
  const canClaim     = () => { const l=getLastClaim(); return !l || Date.now()-l.getTime()>=MS_PER_DAY; };
  const msUntilNext  = () => { const l=getLastClaim(); if(!l) return 0; return Math.max(0,MS_PER_DAY-(Date.now()-l.getTime())); };
  const stop         = () => { clearInterval(_interval); _interval=null; };
  const render       = () => {
    const right = $("daily-right");
    if (!right) return;
    if (canClaim()) {
      right.innerHTML = `<button id="btn-claim-daily" class="btn-claim"><i class="bi bi-coin"></i> CLAIM</button>`;
      $("btn-claim-daily")?.addEventListener("click", claim);
    } else {
      stop();
      const tick = () => {
        const dr = $("daily-right");
        if (dr) dr.innerHTML = `<div class="daily-countdown"><i class="bi bi-hourglass-split"></i> ${fmt.countdown(msUntilNext())}</div>`;
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
    await DB.updateUser(State.user.uid, { lastClaimAt:now });
    await Coins.add(DAILY_REWARD, false);
    await DB.updateUser(State.user.uid, { coins:State.userData.coins });
    Toast.show(`+${DAILY_REWARD} daily coins claimed!`, "win", 3000);
    render();
  };
  return { init:()=>render(), stop, render };
})();

// ═══════════════════════════════════════════════════
//  ROUTER / NAV
// ═══════════════════════════════════════════════════
const Router = {
  _current: "home",
  go(page) {
    document.querySelectorAll(".page").forEach(p => cls.remove(p,"active"));
    document.querySelectorAll(".nav-btn").forEach(b => cls.toggle(b,"active",b.dataset.page===page));
    const el = $(`page-${page}`); if (el) cls.add(el,"active");
    this._current = page;
    if (page==="dashboard") DashPage.refresh();
    if (page==="profile")   ProfilePage.refresh();
  },
  init() {
    document.querySelectorAll(".nav-btn").forEach(btn =>
      btn.addEventListener("click", () => this.go(btn.dataset.page)));
    document.querySelectorAll("[data-nav]").forEach(el =>
      el.addEventListener("click", () => this.go(el.dataset.nav)));
  },
};

// ═══════════════════════════════════════════════════
//  SCREENS
// ═══════════════════════════════════════════════════
const Screens = {
  _screens: ["screen-splash","screen-signin"],
  show(id) {
    this._screens.forEach(s => { const el=$(s); if(!el)return; cls.toggle(el,"active",s===id); });
    cls.toggle($("app"), "hidden", id!=="app");
  },
  splashOut(cb) {
    const el = $("screen-splash");
    if (!el || !cls.has(el,"active")) { cb(); return; }
    let called = false;
    const done = () => { if (called) return; called=true; cls.remove(el,"active","fade-out"); cb(); };
    cls.add(el,"fade-out");
    el.addEventListener("animationend", done, { once:true });
    setTimeout(done, 1000);
  },
};

// ═══════════════════════════════════════════════════
//  AUTH SCREEN
// ═══════════════════════════════════════════════════
const AuthScreen = {
  init() {
    document.querySelectorAll(".auth-tab").forEach(tab =>
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab)));
    document.querySelectorAll(".pw-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.target); if (!input) return;
        const show = input.type==="password";
        input.type = show ? "text" : "password";
        const icon = btn.querySelector("i");
        if (icon) icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
      });
    });
    $("btn-login")?.addEventListener("click", () => this.login());
    $("login-password")?.addEventListener("keydown", e => { if(e.key==="Enter") this.login(); });
    $("btn-signup")?.addEventListener("click", () => this.signup());
    $("signup-password-confirm")?.addEventListener("keydown", e => { if(e.key==="Enter") this.signup(); });
  },
  switchTab(tab) {
    document.querySelectorAll(".auth-tab").forEach(t => cls.toggle(t,"active",t.dataset.tab===tab));
    cls.toggle($("form-login"),  "hidden", tab!=="login");
    cls.toggle($("form-signup"), "hidden", tab!=="signup");
    this._clearErrors();
  },
  _clearErrors() {
    [
      { wrap:"login-error",    msg:"login-error-msg"    },
      { wrap:"signup-error",   msg:"signup-error-msg"   },
      { wrap:"signup-success", msg:"signup-success-msg" },
    ].forEach(({ wrap, msg }) => {
      const w=$(wrap), m=$(msg);
      if (w) cls.add(w,"hidden"); if (m) m.textContent="";
    });
  },
  _setError(wrapperId, msgId, text) {
    const w=$(wrapperId), m=$(msgId);
    if (m) m.textContent=text; if (w) cls.remove(w,"hidden");
  },
  _setSuccess(wrapperId, msgId, text) {
    const w=$(wrapperId), m=$(msgId);
    if (m) m.textContent=text; if (w) cls.remove(w,"hidden");
  },
  async login() {
    this._clearErrors();
    const username = $("login-username")?.value.trim();
    const password = $("login-password")?.value;
    if (!username) { this._setError("login-error","login-error-msg","Please enter your username."); return; }
    if (!password) { this._setError("login-error","login-error-msg","Please enter your password."); return; }
    const btn = $("btn-login");
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> LOGGING IN…`; }
    try {
      await signInWithEmailAndPassword(auth, toEmail(username), password);
    } catch (e) {
      this._setError("login-error","login-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-lightning-charge-fill"></i> LOGIN`; }
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
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> CREATING…`; }
    try {
      const taken = await DB.isUsernameTaken(username);
      if (taken) {
        this._setError("signup-error","signup-error-msg",`"${username}" is already taken. Choose a different username.`);
        if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
      await DB.createUser(cred.user.uid, username);
      this._setSuccess("signup-success","signup-success-msg","Account created! Welcome to Arcade 2026 🎰");
    } catch (e) {
      this._setError("signup-error","signup-error-msg", this._friendlyError(e.code));
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-person-check-fill"></i> CREATE ACCOUNT`; }
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
//  POKÉMON AVATAR PICKER (Gen 1, profile page)
// ═══════════════════════════════════════════════════
const PokemonPicker = (() => {
  let _page = 0, _selected = null;
  const totalPages = Math.ceil(POKE_COUNT / POKE_PER_PAGE);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const render = () => {
    const grid = $("pokemon-avatar-grid"); if (!grid) return;
    const start = _page * POKE_PER_PAGE + 1;
    const end   = Math.min(start + POKE_PER_PAGE - 1, POKE_COUNT);
    grid.innerHTML = "";
    for (let id = start; id <= end; id++) {
      const card = document.createElement("div");
      card.className  = "pokemon-card" + (_selected?.id===id ? " active" : "");
      card.dataset.id = id;
      const name = POKE_NAMES[id] || `pokemon-${id}`;
      card.innerHTML = `<img class="pokemon-img" src="${POKE_SPRITE_URL(id)}" alt="${name}" loading="lazy" /><span class="pokemon-name">${cap(name)}</span>`;
      card.addEventListener("click", () => selectPokemon(id, name));
      grid.appendChild(card);
    }
    const prev=$("btn-pokemon-prev"), next=$("btn-pokemon-next"), label=$("pokemon-page-label");
    if (prev)  prev.disabled  = _page===0;
    if (next)  next.disabled  = _page>=totalPages-1;
    if (label) label.textContent = `Page ${_page+1} / ${totalPages}`;
  };
  const selectPokemon = (id, name) => {
    _selected = { id, name };
    document.querySelectorAll(".pokemon-card").forEach(c => cls.toggle(c,"active",parseInt(c.dataset.id)===id));
    renderAvatarPreview({ type:"pokemon", id, name });
    if (State.user && State.userData) {
      const str = avatarToString({ type:"pokemon", id, name });
      State.userData.avatar = str;
      DB.updateUser(State.user.uid, { avatar:str }).catch(()=>{});
      Toast.show(`${cap(name)} selected!`, "win");
    }
  };
  const init = (currentAvatar) => {
    _page=0; _selected = currentAvatar?.type==="pokemon" ? currentAvatar : null;
    if (_selected) _page = Math.floor((_selected.id-1)/POKE_PER_PAGE);
    render();
    const prev=$("btn-pokemon-prev"), next=$("btn-pokemon-next");
    if (prev) {
      const np=prev.cloneNode(true); prev.parentNode.replaceChild(np,prev);
      np.addEventListener("click", () => { if(_page>0){_page--;render();} });
    }
    if (next) {
      const nn=next.cloneNode(true); next.parentNode.replaceChild(nn,next);
      nn.addEventListener("click", () => { if(_page<totalPages-1){_page++;render();} });
    }
  };
  const refresh = (currentAvatar) => {
    if (currentAvatar?.type==="pokemon" && _selected?.id!==currentAvatar.id) {
      _selected=currentAvatar; _page=Math.floor((_selected.id-1)/POKE_PER_PAGE);
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
  reset() { this._initialized = false; },
  init() {
    $("btn-signout")?.addEventListener("click", () => { Daily.stop(); signOut(auth); });
  },
  refresh() {
    if (!State.userData) return;
    const d = State.userData, av = parseAvatar(d.avatar);
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
    if (!this._initialized) { PokemonPicker.init(av); this._initialized=true; }
    else { PokemonPicker.refresh(av); }
    this._renderCollection(d.pokemonCollection || []);
  },
  _renderCollection(collection) {
    const wrap = $("collection-gallery"); if (!wrap) return;
    const countEl = $("collection-count"); if (countEl) countEl.textContent = collection.length;
    if (!collection.length) {
      wrap.innerHTML = `<div class="collection-empty"><i class="bi bi-collection"></i><p>No Pokémon captured yet.</p><p class="collection-empty-sub">Head to Games and try Capture a Pokémon!</p></div>`;
      return;
    }
    wrap.innerHTML = "";
    const sorted = [...collection].sort((a,b) => a.id - b.id);
    sorted.forEach(({ id, name, tier }) => {
      const isLegend = tier === "t2" || TIER2_IDS.has(id);
      const card = document.createElement("div");
      card.className = "collection-card" + (isLegend ? " legendary-card" : "");
      card.innerHTML = `
        <div class="collection-card-img-wrap">
          <img src="${POKE_ARTWORK_URL(id)}" alt="${name}" loading="lazy" class="collection-card-img" onerror="this.src='${POKE_SPRITE_URL(id)}'" />
        </div>
        ${isLegend ? `<span class="collection-legend-badge"><i class="bi bi-gem-fill"></i></span>` : ""}
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
    if ($("stat-fruit-spins"))  $("stat-fruit-spins").textContent  = fmt.coins(d.totalFruitSpins||0);
    if ($("stat-lucky-spins"))  $("stat-lucky-spins").textContent  = fmt.coins(d.totalLuckySpins||0);
    if ($("stat-captures"))     $("stat-captures").textContent     = fmt.coins(d.totalCaptures||0);
    if ($("stat-best-win"))     $("stat-best-win").textContent     = fmt.coins(d.bestWin||0);
    await Promise.all([this.loadLeaderboard(), this.loadActivity(this._activeGame), this.loadPokemonCandidates()]);
  },
  async loadLeaderboard() {
    const list=$("leaderboard-list"); if(!list) return;
    list.innerHTML=`<div class="lb-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const entries = await DB.getLeaderboard(20);
      list.innerHTML="";
      if (!entries.length) { list.innerHTML=`<div class="lb-empty"><i class="bi bi-people"></i> No players yet.</div>`; return; }
      const medals=["🥇","🥈","🥉"];
      entries.forEach((e,i) => {
        const isMe=e.uid===State.user.uid, name=(e.username?.trim()||"Player");
        const row=document.createElement("div");
        row.className="lb-row"+(isMe?" me":"");
        row.innerHTML=`
          <span class="lb-rank">${medals[i]??"#"+(i+1)}</span>
          <span class="lb-avatar">${avatarHtml(e.avatar)}</span>
          <span class="lb-name">${name}${isMe?`<span class="lb-you">YOU</span>`:""}</span>
          <span class="lb-coins"><i class="bi bi-coin" style="color:var(--gold)"></i> ${fmt.coins(e.coins||0)}</span>`;
        list.appendChild(row);
      });
    } catch(err) {
      console.error("Leaderboard error:",err);
      list.innerHTML=`<div class="lb-empty"><i class="bi bi-wifi-off"></i> Could not load leaderboard.</div>`;
    }
  },
  async loadPokemonCandidates() {
    const list=$("pokemon-candidates-list"); if(!list) return;
    list.innerHTML=`<div class="candidates-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getRecentCaptures(3);
      list.innerHTML="";
      if (!items.length) { list.innerHTML=`<div class="candidates-empty"><i class="bi bi-award"></i> No captures yet — be the first!</div>`; return; }
      items.forEach(item => {
        const date=toDate(item.createdAt), isLegend=(item.tier==="t2"||TIER2_IDS.has(item.pokemonId));
        const card=document.createElement("div");
        card.className="candidate-card"+(isLegend?" legendary-candidate":"");
        card.innerHTML=`
          <div class="candidate-img-wrap${isLegend?" legend-img-wrap":""}">
            <img src="${POKE_ARTWORK_URL(item.pokemonId)}" alt="${item.pokemonName}" class="candidate-img" loading="lazy" onerror="this.src='${POKE_SPRITE_URL(item.pokemonId)}'" />
          </div>
          <div class="candidate-info">
            <span class="candidate-name">${item.pokemonName}${isLegend?` <span class="candidate-legend-tag"><i class="bi bi-gem-fill"></i></span>`:""}</span>
            <span class="candidate-id">#${String(item.pokemonId).padStart(3,"0")} · ${isLegend?"LEGENDARY":"Common"}</span>
            <span class="candidate-by"><i class="bi bi-person-fill"></i> ${item.username||"Trainer"}</span>
          </div>
          <span class="candidate-time">${fmt.timeAgo(date)}</span>`;
        list.appendChild(card);
      });
    } catch(err) {
      console.error("Candidates error:",err);
      list.innerHTML=`<div class="candidates-empty"><i class="bi bi-wifi-off"></i> Could not load.</div>`;
    }
  },
  async loadActivity(game) {
    this._activeGame=game;
    document.querySelectorAll(".act-tab").forEach(t => cls.toggle(t,"act-tab-active",t.dataset.game===game));
    const list=$("activity-list"); if(!list) return;
    list.innerHTML=`<div class="act-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items=await DB.getSpins(State.user.uid,game,20);
      list.innerHTML="";
      if (!items.length) { list.innerHTML=`<div class="act-empty"><i class="bi bi-joystick"></i> No activity yet — go play!</div>`; return; }
      items.forEach(item => {
        const won=item.coinsWon??0, cost=item.coinsCost??(game==="fruit"?FRUIT_SPIN_COST:LUCKY_PULL_COST);
        const net=won-cost, date=toDate(item.createdAt), isWin=net>=0;
        const el=document.createElement("div"); el.className="act-item";
        let emoji, resultText;
        if (game==="fruit") {
          emoji=item.symbols||"🎰"; resultText=won>0?`Won ${fmt.coins(won)} coins`:"Bomb — no reward";
        } else {
          const syms=(item.symbols||"").split(",");
          emoji=syms.slice(0,3).join("")||"7️⃣"; resultText=won>0?`Won ${fmt.coins(won)} coins`:"No match";
        }
        el.innerHTML=`
          <span class="act-emoji">${emoji}</span>
          <div class="act-body">
            <div class="act-result ${isWin?"win":"loss"}">${resultText}</div>
            <div class="act-time"><i class="bi bi-clock"></i> ${date?fmt.time(date)+" · "+fmt.date(date):"Just now"}</div>
          </div>
          <span class="act-coins ${isWin?"win":"loss"}">${isWin?"+":""}${fmt.coins(net)}</span>`;
        list.appendChild(el);
      });
    } catch(err) {
      console.error("Activity error:",err);
      list.innerHTML=`<div class="act-empty"><i class="bi bi-wifi-off"></i> Could not load activity.</div>`;
    }
  },
  bindTabs() {
    document.querySelectorAll(".act-tab").forEach(t => t.addEventListener("click", () => this.loadActivity(t.dataset.game)));
  },
};

// ═══════════════════════════════════════════════════
//  FRUIT GRID
// ═══════════════════════════════════════════════════
const FruitGrid = (() => {
  const SIZE=5, TOTAL=SIZE*SIZE; let _cells=[];
  const borderIndices=()=>{ const out=[]; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(r===0||r===SIZE-1||c===0||c===SIZE-1) out.push(r*SIZE+c); return out; };
  const BORDER=borderIndices(), FRUIT_AT={};
  BORDER.forEach(idx=>{ const emoji=FRUIT_FIXED_BORDER[idx]; FRUIT_AT[idx]=FRUIT_ITEMS.find(f=>f.emoji===emoji)??FRUIT_ITEMS[0]; });
  const render=()=>{
    const grid=$("fruit-grid"); if(!grid) return;
    grid.innerHTML=""; _cells=[];
    for(let i=0;i<TOTAL;i++){
      const cell=document.createElement("div"), isBorder=BORDER.includes(i);
      cell.className=isBorder?"fg-cell border-cell":"fg-cell inner-cell";
      cell.textContent=isBorder?FRUIT_AT[i].emoji:"×";
      grid.appendChild(cell); _cells.push(cell);
    }
  };
  const clearLit=()=>{ BORDER.forEach(i=>cls.remove(_cells[i],"lit","winner","winner-bomb")); };
  const setLit=(idx)=>{ clearLit(); cls.add(_cells[idx],"lit"); };
  const setWinner=(idx,isBomb)=>{ clearLit(); cls.add(_cells[idx],isBomb?"winner-bomb":"winner"); };
  return { render, BORDER, FRUIT_AT, setLit, setWinner, clearLit };
})();

// ═══════════════════════════════════════════════════
//  FRUIT SPIN GAME
// ═══════════════════════════════════════════════════
const FruitGame = {
  init() {
    FruitGrid.render();
    $("btn-fruit-spin")?.addEventListener("click", () => this.spin());
    $("back-fruit")?.addEventListener("click",    () => cls.add($("overlay-fruit"),"hidden"));
    $("open-fruit")?.addEventListener("click",    () => this.open());
  },
  open() {
    cls.remove($("overlay-fruit"),"hidden"); FruitGrid.render(); FruitGrid.clearLit();
    cls.add($("fruit-result"),"hidden"); this._refreshCoins(); this._loadHistory();
  },
  _refreshCoins() { const el=$("fruit-coins-display"); if(el) el.textContent=fmt.coins(Coins.get()); },
  async _loadHistory() {
    const list=$("fruit-history"); if(!list||!State.user) return;
    try { const items=await DB.getSpins(State.user.uid,"fruit",10); list.innerHTML=""; items.forEach(item=>list.appendChild(this._buildHistItem(item))); } catch{}
  },
  _buildHistItem(item) {
    const el=document.createElement("div"); el.className="fh-item";
    const sym=item.symbols||"?", won=item.coinsWon??0, cost=item.coinsCost??FRUIT_SPIN_COST;
    const net=won-cost, date=toDate(item.createdAt), isWin=net>=0;
    el.innerHTML=`<span class="fh-emoji">${sym}</span><span class="fh-label">${won>0?"Collected":"Bomb!"} · <i class="bi bi-clock"></i> ${date?fmt.time(date):"now"}</span><span class="${isWin?"fh-win":"fh-loss"}">${isWin?"+":""}${fmt.coins(net)}</span>`;
    return el;
  },
  _prependHist(symbol,coinsWon) {
    const list=$("fruit-history"); if(!list) return;
    const el=this._buildHistItem({symbols:symbol,coinsWon,coinsCost:FRUIT_SPIN_COST,createdAt:null});
    list.prepend(el); while(list.children.length>15) list.lastChild?.remove();
  },
  async spin() {
    if (State.fruitSpinning) return;
    if (Coins.get()<FRUIT_SPIN_COST) { Toast.show("Not enough coins!","loss"); return; }
    State.fruitSpinning=true;
    const btn=$("btn-fruit-spin");
    if(btn){btn.disabled=true;btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> SPINNING…`;}
    cls.add($("fruit-result"),"hidden");
    await Coins.deduct(FRUIT_SPIN_COST); this._refreshCoins();
    const winner=weightedPick(FRUIT_ITEMS,FRUIT_TOTAL_WEIGHT);
    const matchingIdx=FruitGrid.BORDER.filter(idx=>FruitGrid.FRUIT_AT[idx].emoji===winner.emoji);
    const winnerIdx=matchingIdx.length?matchingIdx[Math.floor(Math.random()*matchingIdx.length)]:FruitGrid.BORDER[Math.floor(Math.random()*FruitGrid.BORDER.length)];
    const ticks=Math.floor(FRUIT_SPIN_MS/FRUIT_TICK_MS);
    for(let t=0;t<ticks;t++){ FruitGrid.setLit(FruitGrid.BORDER[t%FruitGrid.BORDER.length]); Sound.tick(); await sleep(FRUIT_TICK_MS); }
    FruitGrid.setWinner(winnerIdx,winner.emoji==="💣");
    const isBomb=winner.emoji==="💣", resultEl=$("fruit-result");
    if(resultEl){ resultEl.innerHTML=isBomb?`<i class="bi bi-exclamation-octagon-fill"></i> BOMB! No reward.`:`${winner.emoji} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(winner.value)} coins!`; resultEl.className="fruit-result"+(isBomb?" bomb":""); cls.remove(resultEl,"hidden"); }
    if(isBomb){Sound.bomb();Toast.show("Bomb! Better luck next spin.","loss");}
    else{Sound.win();await Coins.add(winner.value);this._refreshCoins();Toast.show(`+${fmt.coins(winner.value)} coins!`,"win");}
    const newFruitSpins=(State.userData.totalFruitSpins||0)+1, newBestWin=Math.max(State.userData.bestWin||0,winner.value);
    State.userData.totalFruitSpins=newFruitSpins; State.userData.bestWin=newBestWin;
    await DB.updateUser(State.user.uid,{totalFruitSpins:newFruitSpins,bestWin:newBestWin});
    DB.logSpin(State.user.uid,"fruit",winner.emoji,winner.value,FRUIT_SPIN_COST).catch(()=>{});
    this._prependHist(winner.emoji,winner.value);
    State.fruitSpinning=false;
    if(btn){btn.disabled=false;btn.innerHTML=`<i class="bi bi-arrow-clockwise"></i> SPIN`;}
  },
};

// ═══════════════════════════════════════════════════
//  LUCKY 777 GAME
// ═══════════════════════════════════════════════════
const LuckyGame = {
  init() {
    $("btn-lucky-pull")?.addEventListener("click", () => this.pull());
    $("back-lucky")?.addEventListener("click",     () => cls.add($("overlay-lucky"),"hidden"));
    $("open-lucky")?.addEventListener("click",     () => this.open());
    this._buildReels();
  },
  open() { cls.remove($("overlay-lucky"),"hidden"); cls.add($("lucky-result"),"hidden"); this._refreshCoins(); this._loadHistory(); this._resetReels(); },
  _refreshCoins() { const el=$("lucky-coins-display"); if(el) el.textContent=fmt.coins(Coins.get()); },
  _buildReels() {
    for(let r=0;r<3;r++){
      const strip=$(`strip-${r}`); if(!strip) continue;
      strip.innerHTML="";
      for(let i=0;i<40;i++){
        const sym=LUCKY_SYMBOLS[Math.floor(Math.random()*LUCKY_SYMBOLS.length)];
        const div=document.createElement("div"); div.className="reel-symbol"; div.textContent=sym; strip.appendChild(div);
      }
    }
  },
  _resetReels() { for(let r=0;r<3;r++){const strip=$(`strip-${r}`);if(strip)strip.style.transform="translateY(0)";} },
  async _animateReel(reelIdx,targetSymbol,duration) {
    const strip=$(`strip-${reelIdx}`); if(!strip) return;
    const symbolH=100, symbols=strip.querySelectorAll(".reel-symbol"), targetIdx=symbols.length-1;
    symbols[targetIdx].textContent=targetSymbol;
    if(targetIdx>0) symbols[targetIdx-1].textContent=LUCKY_SYMBOLS[Math.floor(Math.random()*LUCKY_SYMBOLS.length)];
    const finalY=-(targetIdx*symbolH);
    strip.style.transition="none"; strip.style.transform="translateY(0)"; void strip.offsetWidth;
    strip.style.transition=`transform ${duration}ms cubic-bezier(.17,.67,.1,.98)`; strip.style.transform=`translateY(${finalY}px)`;
    await sleep(duration); strip.style.transition="none";
  },
  _evalResult(symbols) {
    const key=symbols.join("-");
    if(LUCKY_PAYOUTS[key]!==undefined) return LUCKY_PAYOUTS[key];
    if(symbols[0]===symbols[1]||symbols[1]===symbols[2]||symbols[0]===symbols[2]) return LUCKY_PARTIAL_WIN;
    return 0;
  },
  async _loadHistory() {
    const list=$("lucky-history"); if(!list||!State.user) return;
    try { const items=await DB.getSpins(State.user.uid,"lucky",10); list.innerHTML=""; items.forEach(item=>list.appendChild(this._buildHistItem(item))); } catch{}
  },
  _buildHistItem(item) {
    const el=document.createElement("div"); el.className="fh-item";
    const syms=(item.symbols||"?-?-?").split(","), won=item.coinsWon??0, cost=item.coinsCost??LUCKY_PULL_COST;
    const net=won-cost, date=toDate(item.createdAt), isWin=net>=0;
    el.innerHTML=`<span class="fh-emoji">${syms.slice(0,3).join("")}</span><span class="fh-label">${won>0?`Won ${fmt.coins(won)}`:"No match"} · <i class="bi bi-clock"></i> ${date?fmt.time(date):"now"}</span><span class="${isWin?"fh-win":"fh-loss"}">${isWin?"+":""}${fmt.coins(net)}</span>`;
    return el;
  },
  _prependHist(symbols,coinsWon) {
    const list=$("lucky-history"); if(!list) return;
    const el=this._buildHistItem({symbols:symbols.join(","),coinsWon,coinsCost:LUCKY_PULL_COST,createdAt:null});
    list.prepend(el); while(list.children.length>15) list.lastChild?.remove();
  },
  async pull() {
    if(State.luckySpinning) return;
    if(Coins.get()<LUCKY_PULL_COST){Toast.show("Not enough coins!","loss");return;}
    State.luckySpinning=true;
    const btn=$("btn-lucky-pull");
    if(btn){btn.disabled=true;btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> PULLING…`;}
    cls.add($("lucky-result"),"hidden");
    await Coins.deduct(LUCKY_PULL_COST); this._refreshCoins();
    const WEIGHTED=[{sym:"7️⃣",w:2},{sym:"💎",w:5},{sym:"⭐",w:10},{sym:"🍒",w:18},{sym:"🍋",w:20},{sym:"🔔",w:20},{sym:"🍇",w:14},{sym:"🍀",w:11}];
    const totalW=WEIGHTED.reduce((s,x)=>s+x.w,0);
    const pickSym=()=>{let r=Math.random()*totalW;for(const x of WEIGHTED){r-=x.w;if(r<=0)return x.sym;}return "🍋";};
    const picked=[pickSym(),pickSym(),pickSym()];
    const lights=qs(".slot-lights"); if(lights) cls.add(lights,"spinning");
    Sound.reelSpin();
    const durations=[1200,1700,2200];
    await Promise.all(picked.map((sym,i)=>this._animateReel(i,sym,durations[i])));
    if(lights) cls.remove(lights,"spinning");
    const coinsWon=this._evalResult(picked), isJackpot=picked.join("-")==="7️⃣-7️⃣-7️⃣";
    const resultEl=$("lucky-result");
    if(resultEl){
      if(isJackpot){resultEl.innerHTML=`<i class="bi bi-stars"></i> JACKPOT! +${fmt.coins(coinsWon)} coins!`;resultEl.className="lucky-result jackpot";}
      else if(coinsWon>0){resultEl.innerHTML=`${picked.join("")} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(coinsWon)} coins!`;resultEl.className="lucky-result";}
      else{resultEl.innerHTML=`${picked.join("")} <i class="bi bi-dash-circle-fill"></i> No match. Try again!`;resultEl.className="lucky-result loss";}
      cls.remove(resultEl,"hidden");
    }
    if(isJackpot){Sound.jackpot();Toast.show(`JACKPOT! +${fmt.coins(coinsWon)} coins!`,"jackpot",4000);}
    else if(coinsWon>0){Sound.win();Toast.show(`+${fmt.coins(coinsWon)} coins!`,"win");}
    else{Sound.bomb();Toast.show("No match. Keep trying!","loss");}
    if(coinsWon>0){await Coins.add(coinsWon);this._refreshCoins();}
    const newLuckySpins=(State.userData.totalLuckySpins||0)+1, newBestWin=Math.max(State.userData.bestWin||0,coinsWon);
    State.userData.totalLuckySpins=newLuckySpins; State.userData.bestWin=newBestWin;
    await DB.updateUser(State.user.uid,{totalLuckySpins:newLuckySpins,bestWin:newBestWin});
    DB.logSpin(State.user.uid,"lucky",picked,coinsWon,LUCKY_PULL_COST).catch(()=>{});
    this._prependHist(picked,coinsWon);
    State.luckySpinning=false;
    if(btn){btn.disabled=false;btn.innerHTML=`<i class="bi bi-stars"></i> PULL`;}
  },
};

// ═══════════════════════════════════════════════════
//  CAPTURE A POKÉMON — TWO-TIER SYSTEM
// ═══════════════════════════════════════════════════
const CaptureGame = {
  _tier:          "t1",
  _pickedBall:    null,
  _revealedPoke:  null,
  _wasFreeThrow:  false,

  // ── Tier helpers ──────────────────────────────────

  _lastClaimKey()  { return this._tier === "t1" ? "captureT1LastClaimAt" : "captureT2LastClaimAt"; },
  _paidCountKey()  { return this._tier === "t1" ? "captureT1PaidCount"   : "captureT2PaidCount"; },
  _window()        { return this._tier === "t1" ? MS_PER_DAY  : MS_PER_WEEK; },
  _pool()          { return this._tier === "t1" ? TIER1_POOL  : TIER2_POOL; },
  _basePrice()     { return this._tier === "t1" ? CAPTURE_T1_BASE_COST : CAPTURE_T2_BASE_COST; },
  _increment()     { return this._tier === "t1" ? CAPTURE_T1_INCREMENT  : CAPTURE_T2_INCREMENT; },

  _lastClaim() { return toDate(State.userData?.[this._lastClaimKey()]); },
  _paidCount() {
    const last = this._lastClaim();
    if (!last || Date.now() - last.getTime() >= this._window()) return 0;
    return State.userData?.[this._paidCountKey()] ?? 0;
  },
  _canClaimFree() {
    const l = this._lastClaim();
    return !l || Date.now() - l.getTime() >= this._window();
  },
  _nextPaidCost() {
    const n = this._paidCount();
    return this._basePrice() + n * this._increment();
  },
  _msUntilReset() {
    const l = this._lastClaim(); if (!l) return 0;
    return Math.max(0, this._window() - (Date.now() - l.getTime()));
  },

  // ── Lifecycle ─────────────────────────────────────

  init() {
    $("open-capture")?.addEventListener("click",        () => this.open());
    $("back-capture")?.addEventListener("click",        () => this._closeOverlay());
    $("btn-capture-again")?.addEventListener("click",   () => this._resetForNewThrow());
    // How to Play modal
    $("btn-capture-howto")?.addEventListener("click",   () => this._showHowToModal());
    $("btn-howto-close")?.addEventListener("click",     () => this._closeHowToModal());
    $("capture-howto-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "capture-howto-modal") this._closeHowToModal();
    });
    // Tier tab listeners
    document.querySelectorAll(".capture-tier-tab").forEach(btn => {
      btn.addEventListener("click", () => this._switchTier(btn.dataset.tier));
    });
  },

  open() {
    cls.remove($("overlay-capture"), "hidden");
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._wasFreeThrow = false;
    const revealEl = $("capture-reveal");
    if (revealEl) cls.add(revealEl, "hidden");
    const againWrap = $("capture-again-wrap");
    if (againWrap) cls.add(againWrap, "hidden");
    this._refreshCoins();
    this._renderTierTabs();
    this._renderState();
    // Always show How to Play when entering the game
    this._showHowToModal();
  },

  _closeOverlay() {
    cls.add($("overlay-capture"), "hidden");
    // Also close modal if open
    const modal = $("capture-howto-modal");
    if (modal && cls.has(modal, "visible")) {
      cls.remove(modal, "visible");
      cls.add(modal, "hidden");
    }
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._wasFreeThrow = false;
  },

  _refreshCoins() {
    const el = $("capture-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },

  _switchTier(tier) {
    this._tier         = tier;
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._wasFreeThrow = false;
    const revealEl = $("capture-reveal");
    if (revealEl) cls.add(revealEl, "hidden");
    const againWrap = $("capture-again-wrap");
    if (againWrap) cls.add(againWrap, "hidden");
    this._renderTierTabs();
    this._renderState();
  },

  _renderTierTabs() {
    document.querySelectorAll(".capture-tier-tab").forEach(btn => {
      cls.toggle(btn, "active", btn.dataset.tier === this._tier);
    });
    const overlay = $("overlay-capture");
    if (overlay) cls.toggle(overlay, "tier2-active", this._tier === "t2");
  },

  // ── How to Play Modal ─────────────────────────────

  _showHowToModal() {
    const modal = $("capture-howto-modal");
    if (!modal) return;
    cls.remove(modal, "hidden");
    // Small delay so transition fires after display:flex kicks in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => cls.add(modal, "visible"));
    });
  },

  _closeHowToModal() {
    const modal = $("capture-howto-modal");
    if (!modal) return;
    cls.remove(modal, "visible");
    modal.addEventListener("transitionend", () => {
      if (!cls.has(modal, "visible")) cls.add(modal, "hidden");
    }, { once: true });
  },

  // ── State rendering ───────────────────────────────

  _renderState() {
    const canFree   = this._canClaimFree();
    const statusEl  = $("capture-status");
    const ballsWrap = $("pokeballs-wrap");
    const revealEl  = $("capture-reveal");
    const buyWrap   = $("capture-buy-wrap");

    if (revealEl) cls.add(revealEl, "hidden");

    if (canFree) {
      if (statusEl) statusEl.innerHTML = this._tier === "t1"
        ? `<span class="capture-status-badge free"><i class="bi bi-gift-fill"></i> FREE DAILY BALL READY</span>
           <p class="capture-status-sub">Pick one of the 5 Pokéballs to catch a Pokémon!</p>`
        : `<span class="capture-status-badge legendary"><i class="bi bi-gem-fill"></i> FREE WEEKLY BALL READY</span>
           <p class="capture-status-sub">Your weekly shot at a <strong>Legendary or Epic</strong> Pokémon!</p>`;
      if (ballsWrap) { cls.remove(ballsWrap, "hidden"); this._renderBalls(true); }
      if (buyWrap)   cls.add(buyWrap, "hidden");
    } else {
      const nextCost = this._nextPaidCost();
      const msLeft   = this._msUntilReset();

      if (statusEl) statusEl.innerHTML = this._tier === "t1"
        ? `<span class="capture-status-badge used"><i class="bi bi-check-circle-fill"></i> TODAY'S FREE THROW USED</span>
           <p class="capture-status-sub">Resets in <strong>${fmt.countdown(msLeft)}</strong> — or throw again for <strong>${fmt.coins(nextCost)} coins</strong></p>`
        : `<span class="capture-status-badge used-legendary"><i class="bi bi-check-circle-fill"></i> THIS WEEK'S FREE THROW USED</span>
           <p class="capture-status-sub">Resets in <strong>${fmt.countdown(msLeft)}</strong> — or throw again for <strong>${fmt.coins(nextCost)} coins</strong></p>`;

      if (ballsWrap) cls.add(ballsWrap, "hidden");
      if (buyWrap)   cls.remove(buyWrap, "hidden");

      this._updateBuyButton(nextCost);
    }
  },

  _updateBuyButton(cost) {
    const wrap = $("capture-buy-wrap");
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="capture-buy-card ${this._tier === "t2" ? "legendary-buy-card" : ""}">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Pokéball" class="buy-ball-img" />
        <p class="buy-title">${this._tier === "t1" ? "Want to catch more?" : "Chase the Legend!"}</p>
        <p class="buy-sub">
          ${this._tier === "t1"
            ? `Throw again for <strong>${fmt.coins(cost)} coins</strong>. Price increases by 50 per extra throw, resets daily.`
            : `Throw again for <strong>${fmt.coins(cost)} coins</strong>. Price increases by 50 per extra throw, resets weekly.`
          }
        </p>
        <button id="btn-buy-pokeball" class="btn-buy-pokeball ${this._tier === "t2" ? "legendary-buy-btn" : ""}">
          <i class="bi bi-bag-fill"></i> THROW AGAIN — ${fmt.coins(cost)} coins
        </button>
      </div>`;
    $("btn-buy-pokeball")?.addEventListener("click", () => this._buyThrow());
  },

  // ── Pokéballs ─────────────────────────────────────

  _renderBalls(interactive=true) {
    const grid = $("pokeballs-grid"); if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < CAPTURE_BALL_COUNT; i++) {
      const ball = document.createElement("button");
      ball.className   = "pokeball-btn" + (this._pickedBall===i ? " picked" : "");
      ball.dataset.idx = i;
      ball.disabled    = !interactive || this._pickedBall !== null;
      ball.setAttribute("aria-label", `Pokéball ${i+1}`);
      ball.innerHTML = `
        <div class="pokeball ${this._tier==="t2"?"pokeball-legend":""}">
          <div class="pokeball-top"></div>
          <div class="pokeball-band"><div class="pokeball-btn-center"></div></div>
          <div class="pokeball-bottom"></div>
        </div>
        <span class="pokeball-label">${i+1}</span>`;
      ball.addEventListener("click", () => this._onBallPick(i));
      grid.appendChild(ball);
    }
  },

  // ── Ball pick & reveal ────────────────────────────

  async _onBallPick(idx) {
    if (this._pickedBall !== null || State.captureRevealing) return;
    State.captureRevealing = true;
    this._pickedBall   = idx;
    this._wasFreeThrow = this._canClaimFree();

    document.querySelectorAll(".pokeball-btn").forEach(b => b.disabled = true);

    const pickedEl = document.querySelector(`.pokeball-btn[data-idx="${idx}"]`);
    if (pickedEl) {
      cls.add(pickedEl, "shaking");
      await sleep(900);
      cls.remove(pickedEl, "shaking");
      cls.add(pickedEl, "picked");
      await sleep(200);
    }

    const pool    = this._pool();
    const pokeId  = pool[Math.floor(Math.random() * pool.length)];
    const species = await this._fetchSpeciesData(pokeId);
    const pName   = species.name || pokeName(pokeId);
    const types   = await this._fetchTypes(pokeId);

    this._revealedPoke = { id: pokeId, name: pName };
    await this._showReveal(pokeId, pName, species.flavorText, types);
    await this._persist(pokeId, pName);

    State.captureRevealing = false;
  },

  // ── PokéAPI fetchers ──────────────────────────────

  async _fetchSpeciesData(id) {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
      const data = await res.json();
      const entry = data.flavor_text_entries?.find(e => e.language.name==="en");
      const flavorText = entry
        ? entry.flavor_text.replace(/\f|\n/g," ").replace(/\s+/g," ").trim()
        : "A mysterious Pokémon with unknown abilities.";
      const name = data.name
        ? data.name.charAt(0).toUpperCase() + data.name.slice(1).replace(/-/g," ")
        : pokeName(id);
      return { name, flavorText };
    } catch {
      return { name: pokeName(id), flavorText: "A mysterious Pokémon with unknown abilities." };
    }
  },

  async _fetchTypes(id) {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();
      return data.types?.map(t => t.type.name) || [];
    } catch { return []; }
  },

  // ── Reveal panel ──────────────────────────────────

  async _showReveal(id, name, flavorText, types) {
    const revealEl  = $("capture-reveal");
    const ballsWrap = $("pokeballs-wrap");
    const buyWrap   = $("capture-buy-wrap");
    if (!revealEl) return;

    const isLegend   = this._tier === "t2";
    const typeBadges = types.map(t => `<span class="poke-type-badge poke-type-${t}">${t}</span>`).join("");

    revealEl.innerHTML = `
      <div class="reveal-inner ${isLegend ? "reveal-legendary" : ""}">
        <div class="reveal-flash${isLegend ? " reveal-flash-legend" : ""}"></div>
        ${isLegend ? `<div class="reveal-legend-crown"><i class="bi bi-gem-fill"></i> LEGENDARY</div>` : ""}
        <div class="reveal-img-wrap">
          <img id="reveal-pokemon-img"
            src="${POKE_ARTWORK_URL(id)}" alt="${name}"
            class="reveal-pokemon-img"
            onerror="this.src='${POKE_SPRITE_URL(id)}'" />
        </div>
        <div class="reveal-info">
          <div class="reveal-number">#${String(id).padStart(3,"0")}</div>
          <h3 class="reveal-name ${isLegend ? "reveal-name-legend" : ""}">${name}</h3>
          <div class="reveal-types">${typeBadges}</div>
          <p class="reveal-flavor">${flavorText}</p>
          <div class="reveal-caught-badge ${isLegend ? "reveal-caught-legend" : ""}">
            <i class="bi bi-patch-check-fill"></i> Added to your collection!
          </div>
        </div>
      </div>`;

    if (ballsWrap) cls.add(ballsWrap, "hidden");
    if (buyWrap)   cls.add(buyWrap, "hidden");
    cls.remove(revealEl, "hidden");
    cls.add(revealEl, "reveal-enter");

    if (isLegend) { Sound.jackpot(); Toast.show(`✨ ${name} — LEGENDARY captured!`, "legendary", 4500); }
    else          { Sound.capture(); Toast.show(`${name} was captured!`, "capture", 3500); }

    await sleep(600);
    cls.remove(revealEl, "reveal-enter");

    const againWrap = $("capture-again-wrap");
    if (againWrap) cls.remove(againWrap, "hidden");
  },

  // ── Persist capture ───────────────────────────────

  async _persist(pokeId, pokeName_) {
    if (!State.user || !State.userData) return;
    const now        = new Date();
    const collection = State.userData.pokemonCollection || [];
    const alreadyHave = collection.some(p => p.id === pokeId);
    const newCollection = alreadyHave
      ? collection
      : [...collection, { id: pokeId, name: pokeName_, tier: this._tier }];

    const newCaptures = (State.userData.totalCaptures || 0) + 1;
    const paidCount   = this._paidCount();

    const fields = {
      pokemonCollection:    newCollection,
      totalCaptures:        newCaptures,
      [this._lastClaimKey()]: now,
    };

    if (!this._wasFreeThrow) {
      fields[this._paidCountKey()] = paidCount + 1;
    } else {
      fields[this._paidCountKey()] = 0;
    }

    State.userData.pokemonCollection       = newCollection;
    State.userData.totalCaptures           = newCaptures;
    State.userData[this._lastClaimKey()]   = now;
    State.userData[this._paidCountKey()]   = fields[this._paidCountKey()];

    await DB.updateUser(State.user.uid, fields);

    DB.logCapture(
      State.user.uid,
      State.userData.username || "Trainer",
      pokeId,
      pokeName_,
      this._wasFreeThrow ? 0 : this._nextPaidCost(),
      this._tier
    ).catch(() => {});

    this._refreshCoins();
  },

  // ── Buy a paid throw ──────────────────────────────

  async _buyThrow() {
    if (State.captureRevealing) return;
    const cost = this._nextPaidCost();
    if (Coins.get() < cost) {
      Toast.show(`Need ${fmt.coins(cost)} coins for this throw!`, "loss", 3000);
      return;
    }
    const btn = $("btn-buy-pokeball");
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> Purchasing…`; }

    const ok = await Coins.deduct(cost);
    if (!ok) {
      Toast.show("Not enough coins!", "loss");
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-bag-fill"></i> THROW AGAIN — ${fmt.coins(cost)} coins`; }
      return;
    }

    this._wasFreeThrow = false;
    this._refreshCoins();
    Toast.show("Pokéball purchased! Pick one to throw.", "info", 2000);

    const ballsWrap = $("pokeballs-wrap");
    const buyWrap   = $("capture-buy-wrap");
    if (ballsWrap) { cls.remove(ballsWrap, "hidden"); this._renderBalls(true); }
    if (buyWrap)   cls.add(buyWrap, "hidden");
    this._pickedBall   = null;
    this._revealedPoke = null;
    const revealEl = $("capture-reveal");
    if (revealEl) cls.add(revealEl, "hidden");
    const againWrap = $("capture-again-wrap");
    if (againWrap) cls.add(againWrap, "hidden");
  },

  // ── Reset for new throw (after reveal) ────────────

  _resetForNewThrow() {
    this._pickedBall   = null;
    this._revealedPoke = null;
    this._wasFreeThrow = false;
    const revealEl  = $("capture-reveal");
    if (revealEl) cls.add(revealEl, "hidden");
    const againWrap = $("capture-again-wrap");
    if (againWrap) cls.add(againWrap, "hidden");
    this._renderState();
  },
};

// ═══════════════════════════════════════════════════
//  SOUND MODULE
// ═══════════════════════════════════════════════════
const Sound = (() => {
  let _ctx;
  const ctx  = () => { if(!_ctx) _ctx=new(window.AudioContext||window.webkitAudioContext)(); return _ctx; };
  const tone = (freq,dur,type="square",vol=0.06) => {
    try {
      const c=ctx(),o=c.createOscillator(),g=c.createGain();
      o.type=type; o.frequency.value=freq; g.gain.value=vol;
      o.connect(g); g.connect(c.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+dur); o.stop(c.currentTime+dur);
    } catch{}
  };
  return {
    tick:     () => tone(920,.03),
    win:      () => tone(1300,.18,"sine",.07),
    bomb:     () => tone(110,.3,"sawtooth",.09),
    reelSpin: () => tone(700,.07,"sawtooth",.04),
    capture:  () => {
      try {
        const c=ctx();
        [600,900,1200].forEach((f,i)=>setTimeout(()=>{
          const o=c.createOscillator(),g=c.createGain();
          o.type="sine";o.frequency.value=f;g.gain.value=.14;
          o.connect(g);g.connect(c.destination);o.start();
          g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+.35);o.stop(c.currentTime+.35);
        },i*120));
      } catch{}
    },
    jackpot:  () => {
      try {
        const c=ctx();
        [1200,1500,1800,2200].forEach((f,i)=>setTimeout(()=>{
          const o=c.createOscillator(),g=c.createGain();
          o.type="sine";o.frequency.value=f;g.gain.value=.22;
          o.connect(g);g.connect(c.destination);o.start();
          g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+.55);o.stop(c.currentTime+.55);
        },i*80));
      } catch{}
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
      const username = user.email.replace("@arcade2026.local","");
      State.userData = await DB.createUser(user.uid, username);
    }
    if (State.userData.captureT1LastClaimAt === undefined) {
      const migrate = {
        captureT1LastClaimAt: State.userData.captureLastClaimAt || null,
        captureT1PaidCount:   0,
        captureT2LastClaimAt: null,
        captureT2PaidCount:   0,
      };
      await DB.updateUser(user.uid, migrate);
    }
    Coins.set(State.userData.coins ?? 0);
    ProfilePage.refresh();
    Daily.init();
    Router.init();
    Router.go("home");
    Screens.splashOut(() => {
      cls.remove($("screen-signin"),"active");
      cls.remove($("app"),"hidden");
    });
  },
  onSignedOut() {
    State.user = State.userData = null;
    Daily.stop();
    ProfilePage.reset();
    cls.add($("overlay-fruit"),   "hidden");
    cls.add($("overlay-lucky"),   "hidden");
    cls.add($("overlay-capture"), "hidden");
    // Also hide modal
    const modal = $("capture-howto-modal");
    if (modal) { cls.remove(modal, "visible"); cls.add(modal, "hidden"); }
    cls.add($("app"), "hidden");
    Screens.show("screen-signin");
    ["login-username","login-password","signup-username","signup-password","signup-password-confirm"]
      .forEach(id => { const el=$(id); if(el) el.value=""; });
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
      if (cls.has($("screen-splash"),"active")) {
        setTimeout(() => { Screens.splashOut(() => Screens.show("screen-signin")); }, 1700);
      } else {
        Auth.onSignedOut();
      }
    }
  });
};

boot();
