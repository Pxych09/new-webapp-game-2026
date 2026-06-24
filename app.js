/**
 * ARCADE 2026 — app.js
 * Firebase: Username/Password Auth + Firestore
 * Games: Fruit Spin, Lucky 777, Capture a Pokémon (Tier 1 & Tier 2), Pæir a Pæra
 *
 * Firestore read optimisations (v2):
 *  - Spin / pull history capped at 5 items and cached in memory for the session
 *  - Dashboard activity cached per game; re-fetched only on explicit tab switch
 *  - Leaderboard cached for the session; reloaded only on manual revisit after first load
 *  - Dashboard skips full reload if data was already loaded this session (dirty flag)
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

const DAILY_REWARD = 100;
const MS_PER_DAY  = 86_400_000;
const MS_PER_WEEK = 3 * MS_PER_DAY;

// ═══════════════════════════════════════════════════
//  WEEKLY UPDATES DATA
// ═══════════════════════════════════════════════════
const WEEKLY_UPDATES = [
  {
    version: "v1.4",
    date: "June 25, 2026",
    badge: "latest",
    items: [
      { icon: "bi-shield-fill-check", color: "var(--cyan)",    text: "Device back button now closes game overlays instead of exiting the app" },
      { icon: "bi-collection-fill",   color: "var(--poke-red)",text: "Pokémon Collection gallery redesigned with paginated 3×3 grid" },
      { icon: "bi-shop-window",       color: "var(--cyan)",    text: "Trading Plaza: all owned Pokémon are now always listable" },
      { icon: "bi-gem",          color: "var(--gold)",    text: "Legendary free throw reset reduced from 7 days to 3 days" },
    ],
  },
  {
    version: "v1.3",
    date: "June 18, 2026",
    badge: null,
    items: [
      { icon: "bi-shop",              color: "var(--cyan)",    text: "Trading Plaza launched — buy and sell Pokémon with other trainers" },
      { icon: "bi-trophy-fill",       color: "var(--gold)",    text: "Pokémon Masters leaderboard added inside Capture overlay" },
      { icon: "bi-person-fill",       color: "var(--cyan)",    text: "Long-press any Pokémon in your collection to set it as your avatar" },
      { icon: "bi-x-circle-fill",     color: "var(--magenta)", text: "Cancel your own Trading Plaza listings at any time" },
    ],
  },
  {
    version: "v1.2",
    date: "June 11, 2026",
    badge: null,
    items: [
      { icon: "bi-gem",               color: "var(--gold)",    text: "Capture Tier 2 added — hunt Legendary and Epic Pokémon every 3 days" },
      { icon: "bi-music-note-beamed", color: "var(--paer)",    text: "Procedural background music added for all four games and the lobby" },
      { icon: "bi-lightning-charge-fill", color: "var(--paer)", text: "Pæir a Pæra: power-ups ❄️ Freeze, ⭐ Star, 🌟 Superstar, 🧿 Orb added" },
      { icon: "bi-arrow-repeat",      color: "var(--cyan)",    text: "Wave system added to Pæir a Pæra — board reshuffles when all earn tiles are revealed" },
    ],
  },
  {
    version: "v1.1",
    date: "June 4, 2026",
    badge: null,
    items: [
      { icon: "bi-controller",        color: "var(--paer)",    text: "Pæir a Pæra vault game launched — flip tiles, bank gems, cash out coins" },
      { icon: "bi-collection-fill",   color: "var(--poke-red)",text: "Capture a Pokémon launched with full Gen 1–9 Pokédex" },
      { icon: "bi-bar-chart-fill",    color: "var(--cyan)",    text: "Dashboard with leaderboard and recent activity added" },
      { icon: "bi-coin",              color: "var(--gold)",    text: "Daily sign-in bonus of 100 coins introduced" },
    ],
  },
];

// ── History constants ──────────────────────────────
const HISTORY_LIMIT = 5; // items shown & fetched from Firestore

// ═══════════════════════════════════════════════════
//  PÆIR A PÆRA CONSTANTS
// ═══════════════════════════════════════════════════
const PAER_COST_BASE     = 50;
const PAER_REVEAL_MS      = 1500;
const PAER_SHUFFLE_MS     = 1800;
const PAER_DURATION_SEC   = 120;
const PAER_CASHOUT_BLOCK  = 5000;
const PAER_CASHOUT_COINS  = 50;

const PAER_TILES = [
  { emoji: "💎", label: "Diamond", value: 1000, cls: "diamond", count: 2 },
  { emoji: "💰", label: "Gold Bag", value: 500,  cls: "gold",    count: 5 },
  { emoji: "💵", label: "Cash",     value: 100,  cls: "cash",    count: 9 },
  { emoji: "💣", label: "Bomb",     value: 0,    cls: "bomb",    count: 9 },
];

const PAER_CASHOUT_TIERS = [
  { need: 5000,  coins: 50  },
  { need: 10000, coins: 100 },
  { need: 15000, coins: 150 },
  { need: 25000, coins: 250 },
  { need: 50000, coins: 500 },
];

// ═══════════════════════════════════════════════════
//  CAPTURE CONSTANTS
// ═══════════════════════════════════════════════════
const CAPTURE_BALL_COUNT    = 5;
const CAPTURE_T1_BASE_COST  = 50;
const CAPTURE_T1_INCREMENT  = 50;
const CAPTURE_T2_BASE_COST  = 150;
const CAPTURE_T2_INCREMENT  = 50;

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
const $     = (id)                => document.getElementById(id);
const qs    = (sel, ctx=document) => ctx.querySelector(sel);
const sleep = (ms)                => new Promise(r => setTimeout(r, ms));

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
//  SESSION CACHE
// ═══════════════════════════════════════════════════
const Cache = {
  _store: {},
  get(key) { return this._store[key] ?? null; },
  set(key, value) { this._store[key] = value; },
  prepend(key, item) {
    const arr = this._store[key] ?? [];
    this._store[key] = [item, ...arr].slice(0, HISTORY_LIMIT);
  },
  has(key) { return key in this._store; },
  clear() { this._store = {}; },
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
const avatarToString = (av) => `pokemon:${av.id}:${av.name}`;
const renderAvatarPreview = (av) => {
  // ── Profile page avatar ──
  const img  = $("avatar-preview-img");
  const fall = $("avatar-preview-fallback");
  if (img && fall) {
    if (av?.type === "pokemon") {
      img.src = POKE_ARTWORK_URL(av.id); img.alt = av.name;
      img.onerror = () => { img.src = POKE_SPRITE_URL(av.id); };
      cls.remove(img, "hidden"); cls.add(fall, "hidden");
    } else {
      cls.add(img, "hidden"); cls.remove(fall, "hidden"); fall.textContent = "?";
    }
  }

  // ── Topbar avatar ──
  const tbImg  = $("topbar-avatar-img");
  const tbFall = $("topbar-avatar-fallback");
  if (tbImg && tbFall) {
    if (av?.type === "pokemon") {
      tbImg.src = POKE_ARTWORK_URL(av.id); tbImg.alt = av.name;
      tbImg.onerror = () => { tbImg.src = POKE_SPRITE_URL(av.id); };
      cls.remove(tbImg, "hidden"); cls.add(tbFall, "hidden");
    } else {
      cls.add(tbImg, "hidden"); cls.remove(tbFall, "hidden");
    }
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
  const randomId = ALL_VALID_IDS[Math.floor(Math.random() * ALL_VALID_IDS.length)];
  const randomName = pokeName(randomId);
  const data = {
      username,
      avatar: avatarToString({ type: "pokemon", id: randomId, name: randomName }),
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
  async getSpins(uid, game) {
    const q = query(
      spinsCol(),
      where("uid","==",uid),
      where("game","==",game),
      orderBy("createdAt","desc"),
      limit(HISTORY_LIMIT),
    );
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
  async getPokemonMasters(n = 10) {
    const q = query(collection(db, "users"), orderBy("totalCaptures", "desc"), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  async addTrade(data) {
      return await addDoc(collection(db, "trades"), { ...data, createdAt: serverTimestamp(), status: "open" });
    },
    async getTrades(n = 30) {
        const q = query(collection(db, "trades"), where("status", "==", "open"), orderBy("createdAt", "desc"), limit(n));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      },
      async executeTrade(tradeId, buyerId, buyerName) {
        const ref = doc(db, "trades", tradeId);
        await updateDoc(ref, { status: "sold", buyerId, buyerName, soldAt: serverTimestamp() });
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
    Sound.dailyClaim();
    Toast.show(`+${DAILY_REWARD} daily coins claimed!`, "win", 3000);
render();
  };
  return { init:()=>render(), stop, render };
})();

// ═══════════════════════════════════════════════════
//  WEEKLY UPDATES RENDERER
// ═══════════════════════════════════════════════════
const WeeklyUpdates = {
  render() {
    const wrap = $("weekly-updates-list");
    if (!wrap) return;
    wrap.innerHTML = "";
    
    WEEKLY_UPDATES.forEach((update, idx) => {
      const isFirst = idx === 0;
      
      const card = document.createElement("div");
      card.className = "wu-card" + (isFirst ? " wu-card-latest" : "");
      
      card.innerHTML = `
        <div class="wu-card-header">
          <div class="wu-version-wrap">
            <span class="wu-version">${update.version}</span>
            ${update.badge === "latest"
              ? `<span class="wu-badge-latest"><i class="bi bi-star-fill"></i> LATEST</span>`
              : ""}
          </div>
          <span class="wu-date"><i class="bi bi-calendar3"></i> ${update.date}</span>
        </div>
        <ul class="wu-items">
          ${update.items.map(item => `
            <li class="wu-item">
              <span class="wu-item-icon" style="color:${item.color}">
                <i class="bi ${item.icon}"></i>
              </span>
              <span class="wu-item-text">${item.text}</span>
            </li>`).join("")}
        </ul>`;
      
      wrap.appendChild(card);
    });
  },
};

// ═══════════════════════════════════════════════════
//  HISTORY MANAGER — intercepts device/browser back
//  to close overlays instead of exiting the app
// ═══════════════════════════════════════════════════
const HistoryManager = {
  _active: null, // id of the currently pushed overlay, or null
  
  // Call this when an overlay opens
  push(overlayId) {
    this._active = overlayId;
    history.pushState({ overlay: overlayId }, "", "");
  },
  
  // Call this when an overlay closes programmatically
  // (so the fake history entry doesn't linger)
  pop() {
    if (this._active) {
      this._active = null;
      // Only go back if our state is actually on top
      if (history.state?.overlay) history.back();
    }
  },
  
  init() {
    window.addEventListener("popstate", (e) => {
      // Device/browser back was pressed
      if (this._active) {
        const id = this._active;
        this._active = null;
        this._closeOverlay(id);
      }
    });
  },
  
  _closeOverlay(id) {
    switch (id) {
      case "fruit":
        FruitMusic.stop();
        cls.add($("overlay-fruit"), "hidden");
        HomeMusic.play();
        break;
      case "lucky":
        LuckyMusic.stop();
        cls.add($("overlay-lucky"), "hidden");
        HomeMusic.play();
        break;
      case "capture":
        CaptureMusic.stop();
        CaptureGame._closeOverlay();
        HomeMusic.play();
        break;
      case "paer":
        PaerGame.closeFromBack();
        break;
    }
  },
};

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
  $("topbar-avatar")?.addEventListener("click", () => this.go("profile"));

    // Home quick-launch game pills
    $("hgp-fruit")?.addEventListener("click",   () => { this.go("games"); FruitGame.open(); });
    $("hgp-lucky")?.addEventListener("click",   () => { this.go("games"); LuckyGame.open(); });
    $("hgp-capture")?.addEventListener("click", () => { this.go("games"); CaptureGame.open(); });
    $("hgp-paer")?.addEventListener("click",    () => { this.go("games"); PaerGame.open(); });
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
//  POKÉMON AVATAR PICKER  (removed — avatars are now
//  set from the collection via long-press)
// ═══════════════════════════════════════════════════
const PokemonPicker = { init: () => {}, refresh: () => {} };

// ═══════════════════════════════════════════════════
//  PROFILE PAGE
// ═══════════════════════════════════════════════════
const ProfilePage = {
  _initialized: false,
  reset() { this._initialized = false; },
  init() {
    $("btn-signout")?.addEventListener("click", () => { Daily.stop(); signOut(auth); });

    // Confirm — reads _pendingAvatar set at open time, no cloning ever needed
    $("acm-confirm-btn")?.addEventListener("click", () => {
      if (this._pendingAvatar) {
        this._setAvatar(this._pendingAvatar.id, this._pendingAvatar.name);
      }
    });
    $("acm-cancel-btn")?.addEventListener("click", () => this._closeAvatarModal());
    $("avatar-confirm-modal")?.addEventListener("click", e => {
      if (e.target.id === "avatar-confirm-modal") this._closeAvatarModal();
    });
  },
  async refresh() {
    if (!State.user || !State.userData) return;

    // Always re-fetch from Firestore so counts reflect trades
    // that happened while the user was on another page/tab.
    try {
      const fresh = await DB.getUser(State.user.uid);
      if (fresh) {
        // Preserve local coin value (already authoritative from Coins module)
        fresh.coins = State.userData.coins ?? fresh.coins;
        Object.assign(State.userData, fresh);
      }
    } catch(e) {
      console.warn("Profile refresh: could not re-fetch user data", e);
    }

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
    this._renderCollection(d.pokemonCollection || []);
  },
  _renderCollection(collection) {
    const wrap    = $("collection-gallery"); if (!wrap) return;
    const countEl = $("collection-count");   if (countEl) countEl.textContent = collection.length;

    wrap.innerHTML = "";

    if (!collection.length) {
      wrap.innerHTML = `
        <div class="collection-empty">
          <i class="bi bi-collection"></i>
          <p>No Pokémon captured yet.</p>
          <p class="collection-empty-sub">Head to Games and try Capture a Pokémon!</p>
        </div>`;
      return;
    }

    const currentAvatarId = parseAvatar(State.userData?.avatar)?.id;

    // Split
    const legends = [...collection]
      .filter(p => p.tier === "t2" || TIER2_IDS.has(p.id))
      .sort((a, b) => a.id - b.id);
    const commons = [...collection]
      .filter(p => p.tier !== "t2" && !TIER2_IDS.has(p.id))
      .sort((a, b) => a.id - b.id);

    // ── Card builder ──────────────────────────────────
    const makeCard = (p, isLegend) => {
      const { id, name } = p;
      const isActive    = id === currentAvatarId;
      const cardCount   = p.count || 1;
      const reserved    = TradinPlaza.getReservedQty(id);
      const available   = Math.max(0, cardCount - reserved);
      const fullyListed = reserved > 0 && available === 0;
      const partListed  = reserved > 0 && available > 0;

      const card = document.createElement("div");
      card.className = "collection-card"
        + (isLegend    ? " legendary-card"   : "")
        + (isActive    ? " avatar-active"    : "")
        + (fullyListed ? " in-trade-full"    : "")
        + (partListed  ? " in-trade-partial" : "");

      card.innerHTML = `
        <div class="collection-card-img-wrap">
          <img src="${POKE_ARTWORK_URL(id)}" alt="${name}" loading="lazy"
            class="collection-card-img"
            onerror="this.src='${POKE_SPRITE_URL(id)}'"
            draggable="false" />
        </div>
        ${isLegend    ? `<span class="collection-legend-badge"><i class="bi bi-gem-fill"></i></span>` : ""}
        ${isActive    ? `<span class="collection-avatar-badge"><i class="bi bi-person-fill"></i></span>` : ""}
        ${fullyListed ? `<span class="collection-trade-badge"><i class="bi bi-shop-window"></i></span>` : ""}
        ${partListed  ? `<span class="collection-trade-badge partial"><i class="bi bi-shop-window"></i> ${reserved}</span>` : ""}
        ${cardCount > 1 ? `<span class="collection-count-badge">×${cardCount}</span>` : ""}
        <span class="collection-card-name">${name}</span>
        <span class="collection-card-id">#${String(id).padStart(3, "0")}</span>
        ${fullyListed ? `<span class="collection-trade-label">IN TRADING PLAZA</span>` : ""}
        <span class="collection-hold-hint">Hold to set avatar</span>`;

      // Long-press — whole card, no text-selection interference
      let holdTimer = null;
      let didFire   = false;
      const startHold = (e) => {
        didFire = false;
        e.preventDefault();
        holdTimer = setTimeout(() => { didFire = true; this._promptAvatar(id, name); }, 600);
      };
      const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
      card.addEventListener("mousedown",   startHold);
      card.addEventListener("mouseup",     cancelHold);
      card.addEventListener("mouseleave",  cancelHold);
      card.addEventListener("touchstart",  startHold, { passive: false });
      card.addEventListener("touchend",    cancelHold);
      card.addEventListener("touchcancel", cancelHold);
      card.addEventListener("touchmove",   cancelHold);
      card.addEventListener("contextmenu", (e) => e.preventDefault());
      return card;
    };

    // ── Paginated section builder ─────────────────────
    // PER_PAGE = 9 (3×3)
    const PER_PAGE = 9;

    const makeSection = (items, isLegend, sectionId) => {
      if (!items.length) return;

      let currentPage = 0;
      const totalPages = () => Math.ceil(items.length / PER_PAGE);

      // Header
      const header = document.createElement("div");
      header.className = "collection-section-header " + (isLegend ? "legendary-header" : "common-header");
      header.innerHTML = `
        <i class="bi bi-${isLegend ? "gem-fill" : "collection-fill"}"></i>
        ${isLegend ? "LEGENDARY & EPIC" : "COMMON"}
        <span class="csh-count" id="${sectionId}-count">${items.length}</span>`;
      wrap.appendChild(header);

      // Grid container
      const gridWrap = document.createElement("div");
      gridWrap.className = "collection-paged-section";
      gridWrap.id = sectionId;
      wrap.appendChild(gridWrap);

      const renderPage = () => {
        gridWrap.innerHTML = "";

        // 3×3 grid
        const grid = document.createElement("div");
        grid.className = "collection-subgrid-paged";
        const start = currentPage * PER_PAGE;
        const slice = items.slice(start, start + PER_PAGE);
        slice.forEach(p => grid.appendChild(makeCard(p, isLegend)));
        gridWrap.appendChild(grid);

        // Pagination controls — only if more than one page
        if (totalPages() > 1) {
          const pgBar = document.createElement("div");
          pgBar.className = "collection-pgbar";
          pgBar.innerHTML = `
            <button class="col-pg-btn" id="${sectionId}-prev" ${currentPage === 0 ? "disabled" : ""}>
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="col-pg-label">
              ${currentPage + 1} / ${totalPages()}
            </span>
            <button class="col-pg-btn" id="${sectionId}-next" ${currentPage >= totalPages() - 1 ? "disabled" : ""}>
              <i class="bi bi-chevron-right"></i>
            </button>`;
          gridWrap.appendChild(pgBar);

          pgBar.querySelector(`#${sectionId}-prev`).addEventListener("click", () => {
            if (currentPage > 0) { currentPage--; renderPage(); }
          });
          pgBar.querySelector(`#${sectionId}-next`).addEventListener("click", () => {
            if (currentPage < totalPages() - 1) { currentPage++; renderPage(); }
          });
        }
      };

      renderPage();
    };

    if (legends.length) makeSection(legends, true,  "col-section-legend");
    if (commons.length) makeSection(commons, false, "col-section-common");
  },

  _pendingAvatar: null,   // { id, name } — set when modal opens, read on confirm

  _promptAvatar(id, name) {
    const modal = $("avatar-confirm-modal"); if (!modal) return;
    const img   = $("acm-pokemon-img");
    const lbl   = $("acm-pokemon-name");
    if (img) {
      img.src     = POKE_ARTWORK_URL(id);
      img.onerror = () => { img.src = POKE_SPRITE_URL(id); };
    }
    if (lbl) lbl.textContent = name;

    // Store pending selection — confirm button reads this, no cloning needed
    this._pendingAvatar = { id, name };

    // Force-reset visibility state before reopening
    modal.classList.remove("visible");
    modal.classList.remove("hidden");
    // Let the browser paint the reset, then slide in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add("visible");
      });
    });
  },

  _closeAvatarModal() {
    const modal = $("avatar-confirm-modal"); if (!modal) return;
    modal.classList.remove("visible");
    // Use a short fixed timeout instead of transitionend to avoid stale listeners
    setTimeout(() => {
      modal.classList.add("hidden");
      this._pendingAvatar = null;
    }, 320);
  },

  async _setAvatar(id, name) {
    const str = avatarToString({ type:"pokemon", id, name });
    State.userData.avatar = str;
    await DB.updateUser(State.user.uid, { avatar:str });
    renderAvatarPreview({ type:"pokemon", id, name });
    this._closeAvatarModal();
    this._renderCollection(State.userData.pokemonCollection || []);
    Toast.show(`${name} is now your avatar!`, "win", 3000);
  },
};

// ═══════════════════════════════════════════════════
//  DASHBOARD PAGE
// ═══════════════════════════════════════════════════
const DashPage = {
  _activeGame:       "fruit",
  _leaderboardLoaded: false,
  _candidatesLoaded:  false,
  _activityLoaded:   { fruit: false, lucky: false },

  async refresh() {
    if (!State.user || !State.userData) return;
    const d = State.userData;
    if ($("stat-total-coins"))  $("stat-total-coins").textContent  = fmt.coins(d.coins);
    if ($("stat-fruit-spins"))  $("stat-fruit-spins").textContent  = fmt.coins(d.totalFruitSpins||0);
    if ($("stat-lucky-spins"))  $("stat-lucky-spins").textContent  = fmt.coins(d.totalLuckySpins||0);
    if ($("stat-captures"))     $("stat-captures").textContent     = fmt.coins(d.totalCaptures||0);
    if ($("stat-best-win"))     $("stat-best-win").textContent     = fmt.coins(d.bestWin||0);

    const tasks = [];
    if (!this._leaderboardLoaded) tasks.push(this.loadLeaderboard());
    if (!this._candidatesLoaded)  tasks.push(this.loadPokemonCandidates());
    if (!this._activityLoaded[this._activeGame]) tasks.push(this.loadActivity(this._activeGame));
    else this._renderActivityFromCache(this._activeGame);

    if (tasks.length) await Promise.all(tasks);
  },

  reset() {
    this._leaderboardLoaded  = false;
    this._candidatesLoaded   = false;
    this._activityLoaded     = { fruit: false, lucky: false };
  },

  async loadLeaderboard() {
    const list=$("leaderboard-list"); if(!list) return;
    list.innerHTML=`<div class="lb-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const entries = Cache.has("leaderboard")
        ? Cache.get("leaderboard")
        : await (async () => { const r = await DB.getLeaderboard(20); Cache.set("leaderboard", r); return r; })();
      this._leaderboardLoaded = true;
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
      const items = Cache.has("recentCaptures")
        ? Cache.get("recentCaptures")
        : await (async () => { const r = await DB.getRecentCaptures(3); Cache.set("recentCaptures", r); return r; })();
      this._candidatesLoaded = true;
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
    this._activeGame = game;
    document.querySelectorAll(".act-tab").forEach(t => cls.toggle(t,"act-tab-active",t.dataset.game===game));

    const cacheKey = `activity_${game}`;
    if (Cache.has(cacheKey)) {
      this._renderActivityFromCache(game);
      this._activityLoaded[game] = true;
      return;
    }

    const list=$("activity-list"); if(!list) return;
    list.innerHTML=`<div class="act-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getSpins(State.user.uid, game);
      Cache.set(cacheKey, items);
      this._activityLoaded[game] = true;
      this._renderActivityList(list, items, game);
    } catch(err) {
      console.error("Activity error:",err);
      list.innerHTML=`<div class="act-empty"><i class="bi bi-wifi-off"></i> Could not load activity.</div>`;
    }
  },

  _renderActivityFromCache(game) {
    document.querySelectorAll(".act-tab").forEach(t => cls.toggle(t,"act-tab-active",t.dataset.game===game));
    const list = $("activity-list"); if (!list) return;
    const cacheKey = `activity_${game}`;
    const items = Cache.get(cacheKey) ?? [];
    this._renderActivityList(list, items, game);
  },

  _renderActivityList(list, items, game) {
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML=`<div class="act-empty"><i class="bi bi-joystick"></i> No activity yet — go play!</div>`;
      return;
    }
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
    const notice = document.createElement("p");
    notice.className = "hist-session-notice";
    notice.innerHTML = `<i class="bi bi-info-circle"></i> Showing last ${HISTORY_LIMIT} plays · history clears each session`;
    list.appendChild(notice);
  },

  bindTabs() {
    document.querySelectorAll(".act-tab").forEach(t =>
      t.addEventListener("click", () => this.loadActivity(t.dataset.game)));
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
    $("back-fruit")?.addEventListener("click", () => {
      FruitMusic.stop();
      cls.add($("overlay-fruit"), "hidden");
      HomeMusic.play();
      HistoryManager.pop();
    });
    $("btn-fruit-mute")?.addEventListener("click", () => _toggleMute(FruitMusic, "fruit-mute-icon"));
    $("open-fruit")?.addEventListener("click",    () => this.open());
  },
  open() {
    cls.remove($("overlay-fruit"),"hidden"); FruitGrid.render(); FruitGrid.clearLit();
    cls.add($("fruit-result"),"hidden"); this._refreshCoins(); this._loadHistory();
    HomeMusic.stop();
    FruitMusic.play();
    HistoryManager.push("fruit");
  },
  _refreshCoins() { const el=$("fruit-coins-display"); if(el) el.textContent=fmt.coins(Coins.get()); },

  async _loadHistory() {
    const list=$("fruit-history"); if(!list||!State.user) return;
    const cacheKey = "history_fruit";
    if (Cache.has(cacheKey)) {
      this._renderHistory(list, Cache.get(cacheKey));
      return;
    }
    list.innerHTML = `<div class="fh-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getSpins(State.user.uid, "fruit");
      Cache.set(cacheKey, items);
      this._renderHistory(list, items);
    } catch {
      list.innerHTML = "";
    }
  },

  _renderHistory(list, items) {
    list.innerHTML = "";
    items.forEach(item => list.appendChild(this._buildHistItem(item)));
    if (items.length) {
      const notice = document.createElement("p");
      notice.className = "hist-session-notice";
      notice.innerHTML = `<i class="bi bi-info-circle"></i> Last ${HISTORY_LIMIT} spins · clears each session`;
      list.appendChild(notice);
    }
  },

  _buildHistItem(item) {
    const el=document.createElement("div"); el.className="fh-item";
    const sym=item.symbols||"?", won=item.coinsWon??0, cost=item.coinsCost??FRUIT_SPIN_COST;
    const net=won-cost, date=toDate(item.createdAt), isWin=net>=0;
    el.innerHTML=`<span class="fh-emoji">${sym}</span><span class="fh-label">${won>0?"Collected":"Bomb!"} · <i class="bi bi-clock"></i> ${date?fmt.time(date):"now"}</span><span class="${isWin?"fh-win":"fh-loss"}">${isWin?"+":""}${fmt.coins(net)}</span>`;
    return el;
  },

  _prependHist(symbol, coinsWon) {
    const list=$("fruit-history"); if(!list) return;
    const newItem = { symbols:symbol, coinsWon, coinsCost:FRUIT_SPIN_COST, createdAt:null };
    Cache.prepend("history_fruit", newItem);
    this._renderHistory(list, Cache.get("history_fruit"));
    Cache.prepend("activity_fruit", newItem);
    DashPage._activityLoaded["fruit"] = true;
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
    $("back-lucky")?.addEventListener("click", () => {
      LuckyMusic.stop();
      cls.add($("overlay-lucky"), "hidden");
      HomeMusic.play();
      HistoryManager.pop();
    });
    $("btn-lucky-mute")?.addEventListener("click", () => _toggleMute(LuckyMusic, "lucky-mute-icon"));
    $("open-lucky")?.addEventListener("click",     () => this.open());
    this._buildReels();
  },
  open() {
  cls.remove($("overlay-lucky"), "hidden");
  cls.add($("lucky-result"), "hidden");
  this._refreshCoins();
  this._loadHistory();
  this._resetReels();
  HomeMusic.stop();
  LuckyMusic.play();
  HistoryManager.push("lucky");
  },
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
    const cacheKey = "history_lucky";
    if (Cache.has(cacheKey)) {
      this._renderHistory(list, Cache.get(cacheKey));
      return;
    }
    list.innerHTML = `<div class="fh-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    try {
      const items = await DB.getSpins(State.user.uid, "lucky");
      Cache.set(cacheKey, items);
      this._renderHistory(list, items);
    } catch {
      list.innerHTML = "";
    }
  },

  _renderHistory(list, items) {
    list.innerHTML = "";
    items.forEach(item => list.appendChild(this._buildHistItem(item)));
    if (items.length) {
      const notice = document.createElement("p");
      notice.className = "hist-session-notice";
      notice.innerHTML = `<i class="bi bi-info-circle"></i> Last ${HISTORY_LIMIT} pulls · clears each session`;
      list.appendChild(notice);
    }
  },

  _buildHistItem(item) {
    const el=document.createElement("div"); el.className="fh-item";
    const syms=(item.symbols||"?-?-?").split(","), won=item.coinsWon??0, cost=item.coinsCost??LUCKY_PULL_COST;
    const net=won-cost, date=toDate(item.createdAt), isWin=net>=0;
    el.innerHTML=`<span class="fh-emoji">${syms.slice(0,3).join("")}</span><span class="fh-label">${won>0?`Won ${fmt.coins(won)}`:"No match"} · <i class="bi bi-clock"></i> ${date?fmt.time(date):"now"}</span><span class="${isWin?"fh-win":"fh-loss"}">${isWin?"+":""}${fmt.coins(net)}</span>`;
    return el;
  },

  _prependHist(symbols, coinsWon) {
    const list=$("lucky-history"); if(!list) return;
    const newItem = { symbols:symbols.join(","), coinsWon, coinsCost:LUCKY_PULL_COST, createdAt:null };
    Cache.prepend("history_lucky", newItem);
    this._renderHistory(list, Cache.get("history_lucky"));
    Cache.prepend("activity_lucky", newItem);
    DashPage._activityLoaded["lucky"] = true;
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
//  ARCADE MUSIC FACTORY — shared builder
// ═══════════════════════════════════════════════════
function _makeMusicPlayer({ volume=0.18, buildLoop }) {
  let _ctx        = null;
  let _masterGain = null;
  let _playing    = false;
  let _nodes      = [];
  let _loopHandle = null;

  function _ensureCtx() {
    if (_ctx) return;
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = volume;
    _masterGain.connect(_ctx.destination);
  }

  function _osc(freq, type, startT, dur, vol=1, detune=0) {
    const o = _ctx.createOscillator();
    const g = _ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0, startT);
    g.gain.linearRampToValueAtTime(vol, startT + 0.02);
    g.gain.setValueAtTime(vol, startT + dur - 0.06);
    g.gain.linearRampToValueAtTime(0, startT + dur);
    o.connect(g); g.connect(_masterGain);
    o.start(startT); o.stop(startT + dur + 0.05);
    _nodes.push(o);
  }

  function _schedule(startT) {
    if (!_playing) return;
    const loopDur = buildLoop({ ctx: _ctx, osc: _osc, masterGain: _masterGain, nodes: _nodes, startT });
    _loopHandle = setTimeout(() => _schedule(startT + loopDur), (loopDur - 0.3) * 1000);
  }

  function play() {
    if (_playing) return;
    _ensureCtx();
    if (_ctx.state === "suspended") _ctx.resume();
    _playing = true;
    _schedule(_ctx.currentTime + 0.1);
  }

  function stop() {
    if (!_playing) return;
    _playing = false;
    clearTimeout(_loopHandle);
    if (_masterGain) {
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, _ctx.currentTime);
      _masterGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.6);
    }
    setTimeout(() => {
      _nodes.forEach(n => { try { n.stop(); } catch(_) {} });
      _nodes = [];
      if (_masterGain) _masterGain.gain.value = volume;
    }, 700);
  }

  function isPlaying() { return _playing; }
  return { play, stop, isPlaying };
}

// ═══════════════════════════════════════════════════
//  FRUIT SPIN MUSIC — bouncy carnival major scale
// ═══════════════════════════════════════════════════
const FruitMusic = _makeMusicPlayer({
  volume: 0.16,
  buildLoop({ osc, startT }) {
    // C major pentatonic — bright, cheery
    const N = [523.3, 587.3, 659.3, 783.9, 880, 1046.5]; // C5 D5 E5 G5 A5 C6
    const BEAT = 0.22; // fast ~136bpm
    const BARS = 16;

    // Bouncy bassline — root + fifth alternating
    const BASS = [261.6, 392, 261.6, 349.2, 261.6, 392, 329.6, 261.6];
    BASS.forEach((f, i) => {
      osc(f, "square", startT + i * BEAT * 2, BEAT * 1.6, 0.18);
    });

    // Melody — playful arpeggio pattern
    const MEL = [0,2,4,5,4,2,1,0, 2,4,5,4,3,2,4,5];
    MEL.forEach((ni, b) => {
      osc(N[ni], "sine",     startT + b * BEAT, BEAT * 0.85, 0.38);
      osc(N[ni], "triangle", startT + b * BEAT, BEAT * 0.85, 0.10);
    });

    // Staccato chord stabs on beats 0, 4, 8, 12
    [0,4,8,12].forEach(b => {
      osc(523.3, "square", startT + b * BEAT, BEAT * 0.3, 0.09);
      osc(659.3, "square", startT + b * BEAT, BEAT * 0.3, 0.07);
      osc(783.9, "square", startT + b * BEAT, BEAT * 0.3, 0.06);
    });

    // Hi-hat tick every beat
    for (let b = 0; b < BARS; b++) {
      osc(2400, "square", startT + b * BEAT, 0.03, 0.025);
    }

    // Kick on 0 and 8
    [0, 8].forEach(b => {
      osc(100, "sine", startT + b * BEAT, 0.14, 0.45);
      osc(60,  "sine", startT + b * BEAT, 0.18, 0.25);
    });

    // Snare-like on 4 and 12
    [4, 12].forEach(b => {
      osc(200, "sawtooth", startT + b * BEAT, 0.06, 0.10);
      osc(350, "square",   startT + b * BEAT, 0.05, 0.07);
    });

    return BARS * BEAT;
  }
});

// ═══════════════════════════════════════════════════
//  LUCKY 777 MUSIC — smoky jazz Vegas lounge
// ═══════════════════════════════════════════════════
const LuckyMusic = _makeMusicPlayer({
  volume: 0.15,
  buildLoop({ osc, startT }) {
    // Jazz-flavored — dominant 7th chords, swing feel
    // Bb7 Eb7 F7 Bb7 (classic blues turnaround)
    const BEAT   = 0.38; // ~79bpm — lazy swing
    const SWING  = BEAT * 0.62; // swung 8th = long

    // Chord voicings [root, 3rd, 5th, 7th] in Hz
    const CHORDS = [
      [233.1, 293.7, 349.2, 415.3],   // Bb7
      [311.1, 392.0, 466.2, 554.4],   // Eb7
      [349.2, 440.0, 523.3, 622.3],   // F7
      [233.1, 293.7, 349.2, 415.3],   // Bb7
    ];

    // Comp chords — short stabs on beat 2 & 4 of each bar (swing)
    CHORDS.forEach((chord, ci) => {
      const barT = startT + ci * 4 * BEAT;
      [1, 3].forEach(beat => {
        chord.forEach(f => {
          osc(f,   "sine",     barT + beat * BEAT, BEAT * 0.5, 0.14);
          osc(f/2, "triangle", barT + beat * BEAT, BEAT * 0.5, 0.08);
        });
      });
    });

    // Walking bass — quarter notes with chromatic approach
    const BASS_PAT = [
      233.1,246.9,261.6,246.9,
      311.1,329.6,311.1,293.7,
      349.2,370.0,349.2,329.6,
      233.1,220.0,246.9,233.1,
    ];
    BASS_PAT.forEach((f, b) => {
      osc(f, "sine",   startT + b * BEAT, BEAT * 0.82, 0.32);
      osc(f, "triangle", startT + b * BEAT, BEAT * 0.6, 0.10);
    });

    // Melody — slow, bluesy, swung
    const MEL_HZ = [466.2,415.3,466.2,554.4,466.2,415.3,349.2,311.1,
                    415.3,466.2,415.3,349.2,311.1,349.2,415.3,466.2];
    MEL_HZ.forEach((f, b) => {
      const t = startT + b * SWING;
      osc(f, "sine",   t, SWING * 0.9, 0.28);
      osc(f, "sine",   t, SWING * 0.9, 0.08, 8); // slight detune for warmth
    });

    // Ride cymbal feel — triplet swing tick
    for (let b = 0; b < 16; b++) {
      osc(1800, "square", startT + b * SWING, 0.04, 0.022);
    }

    // Soft kick on 1 and 3
    [0, 2, 4, 6, 8, 10, 12, 14].filter(b => b % 4 === 0 || b % 4 === 2).forEach(b => {
      osc(90, "sine", startT + b * BEAT, 0.16, 0.28);
    });

    return 16 * BEAT;
  }
});

// ═══════════════════════════════════════════════════
//  PÆIR A PÆRA MUSIC — tense mysterious dungeon crawl
// ═══════════════════════════════════════════════════
const PaerMusic = _makeMusicPlayer({
  volume: 0.15,
  buildLoop({ osc, startT }) {
    // D natural minor — dark, suspenseful
    // D3 E3 F3 G3 A3 Bb3 C4 D4 F4 A4
    const N = [146.8,164.8,174.6,196.0,220.0,233.1,261.6,293.7,349.2,440.0];
    const BEAT = 0.52; // ~58bpm — slow, creeping tension
    const BARS = 16;

    // Drone pad — low D + A (power fifth) held throughout
    osc(73.4,  "sine",     startT, BARS * BEAT, 0.22);  // D2 drone
    osc(110.0, "sine",     startT, BARS * BEAT, 0.12);  // A2 fifth
    osc(73.4,  "triangle", startT, BARS * BEAT, 0.08, 3); // slight shimmer

    // Brooding bass movement — stepwise descent
    const BASS = [0,0,7,7, 6,6,5,5, 4,4,3,3, 2,1,0,0];
    BASS.forEach((ni, b) => {
      osc(N[ni],   "sine",   startT + b * BEAT, BEAT * 0.88, 0.28);
      osc(N[ni]/2, "sine",   startT + b * BEAT, BEAT * 0.88, 0.15);
    });

    // Sparse eerie melody — long notes, wide intervals
    const MEL = [
      [7,0,2.8],[9,3,1.8],[8,5,1.8],[7,7,2.8],
      [6,10,1.8],[4,12,2.8],[3,15,1],
    ];
    MEL.forEach(([ni, beat, dur]) => {
      const t = startT + beat * BEAT;
      osc(N[ni],   "sine",     t, dur * BEAT, 0.32);
      osc(N[ni]*2, "sine",     t, dur * BEAT, 0.08);  // upper octave ghost
      osc(N[ni],   "triangle", t, dur * BEAT, 0.10, -5);
    });

    // Tense inner rhythm — muted triplet pulse
    for (let b = 0; b < BARS; b++) {
      if (b % 3 === 0) {
        osc(180, "sawtooth", startT + b * BEAT, 0.06, 0.07);
        osc(120, "sine",     startT + b * BEAT, 0.10, 0.18);
      }
    }

    // Heartbeat kick — slow thud every 2 beats
    for (let b = 0; b < BARS; b += 2) {
      osc(55,  "sine", startT + b * BEAT,          0.22, 0.40);
      osc(45,  "sine", startT + b * BEAT + 0.14,   0.18, 0.22); // double-thud feel
    }

    // Eerie high shimmer — very quiet
    for (let b = 0; b < BARS; b += 4) {
      osc(1760, "sine", startT + b * BEAT, BEAT * 1.5, 0.03);
      osc(1318, "sine", startT + b * BEAT + BEAT, BEAT, 0.025);
    }

    return BARS * BEAT;
  }
});

// ═══════════════════════════════════════════════════
//  HOME / LOBBY MUSIC — warm retro ambient
// ═══════════════════════════════════════════════════
const HomeMusic = _makeMusicPlayer({
  volume: 0.13,
  buildLoop({ osc, startT }) {
    // Warm C major — friendly, welcoming arcade lobby feel
    const N = [130.8, 164.8, 196.0, 220.0, 261.6, 329.6, 392.0, 440.0, 523.3];
    const BEAT = 0.55; // ~109bpm — relaxed but alive
    const BARS = 16;

    // Slow pad chords — held long, soft
    const PADS = [[0,2,4],[2,4,6],[1,3,5],[0,2,5]];
    PADS.forEach((chord, ci) => {
      const t = startT + ci * 4 * BEAT;
      chord.forEach(ni => {
        osc(N[ni],   "sine",     t, 4 * BEAT * 0.92, 0.18);
        osc(N[ni]*2, "sine",     t, 4 * BEAT * 0.88, 0.06);
        osc(N[ni],   "triangle", t, 4 * BEAT * 0.90, 0.07, 4);
      });
    });

    // Gentle bass walk
    const BASS = [0,0,2,2, 1,1,0,0, 2,2,4,4, 0,0,1,2];
    BASS.forEach((ni, b) => {
      osc(N[ni]/2, "sine", startT + b * BEAT, BEAT * 0.8, 0.22);
    });

    // Simple melody — cheerful, singable
    const MEL = [4,5,6,7,6,5,4,2, 4,6,7,8,7,6,5,4];
    MEL.forEach((ni, b) => {
      osc(N[ni], "sine",     startT + b * BEAT, BEAT * 0.78, 0.26);
      osc(N[ni], "triangle", startT + b * BEAT, BEAT * 0.60, 0.08);
    });

    // Soft arpeggio layer — sparkle effect
    const ARP = [4,6,7,6, 4,6,8,6, 5,7,8,7, 4,5,6,7];
    ARP.forEach((ni, b) => {
      osc(N[ni]*2, "sine", startT + b * BEAT * 0.5, BEAT * 0.4, 0.08);
    });

    // Light kick every 4 beats
    for (let b = 0; b < BARS; b += 4) {
      osc(80, "sine", startT + b * BEAT, 0.16, 0.28);
      osc(55, "sine", startT + b * BEAT, 0.20, 0.16);
    }

    // Soft hi-hat
    for (let b = 0; b < BARS; b += 2) {
      osc(3200, "square", startT + b * BEAT, 0.03, 0.015);
    }

    return BARS * BEAT;
  }
});

// ═══════════════════════════════════════════════════
//  CAPTURE MUSIC — background BGM for capture overlay
// ═══════════════════════════════════════════════════
const CaptureMusic = (() => {
  let _ctx        = null;
  let _masterGain = null;
  let _playing    = false;
  let _nodes      = [];   // all active oscillator/buffer nodes
  let _loopHandle = null;

  // ── Boot AudioContext on first user gesture ────────
  function _ensureCtx() {
    if (_ctx) return;
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = 0.18;
    _masterGain.connect(_ctx.destination);
  }

  // ── Low-level tone helpers ─────────────────────────
  function _osc(freq, type, startT, dur, vol=1, detune=0) {
    const o = _ctx.createOscillator();
    const g = _ctx.createGain();
    o.type            = type;
    o.frequency.value = freq;
    o.detune.value    = detune;
    g.gain.setValueAtTime(0, startT);
    g.gain.linearRampToValueAtTime(vol, startT + 0.02);
    g.gain.setValueAtTime(vol, startT + dur - 0.06);
    g.gain.linearRampToValueAtTime(0, startT + dur);
    o.connect(g);
    g.connect(_masterGain);
    o.start(startT);
    o.stop(startT + dur + 0.05);
    _nodes.push(o);
  }

  function _pad(freq, startT, dur, vol=0.4) {
    // Lush pad = sine + slight detune twin for chorus feel
    _osc(freq, "sine",     startT, dur, vol,  0);
    _osc(freq, "sine",     startT, dur, vol * 0.5, 6);
    _osc(freq, "triangle", startT, dur, vol * 0.25, -4);
  }

  // ── Reverb-like convolver via noise burst ──────────
  function _makeReverb(dur=1.5) {
    const sr      = _ctx.sampleRate;
    const frames  = sr * dur;
    const buf     = _ctx.createBuffer(2, frames, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < frames; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.5);
      }
    }
    const conv = _ctx.createConvolver();
    conv.buffer = buf;
    conv.connect(_masterGain);
    return conv;
  }

  // ── Melodic sequence ───────────────────────────────
  // Pentatonic-ish mystery scale — feels like tall grass & adventure
  // Notes in Hz: C4 E4 G4 A4 B4 D5 E5 G5
  const NOTES = [261.6, 329.6, 392, 440, 493.9, 587.3, 659.3, 784];

  // Chord progression (indices into NOTES): i=0 iv=3 vi=5 v=4
  const CHORDS = [
    [0, 2, 3],   // C E G  — home
    [3, 5, 6],   // A D E  — lift
    [2, 4, 5],   // G B D  — tension
    [0, 2, 4],   // C G B  — resolve
  ];

  // Melody pattern over 4 bars (note index, beat offset, duration in beats)
  const MELODY = [
    [4,0,.9],[6,1,.9],[7,2,.9],[6,3,.9],
    [5,4,.9],[7,5,.9],[6,6,.9],[4,7,.9],
    [3,8,.9],[5,9,.9],[4,10,.9],[6,11,.9],
    [7,12,1.8],[4,14,.9],[6,15,.9],
  ];

  const BEAT     = 0.42;   // seconds per beat (≈143 bpm — upbeat but not frantic)
  const BAR      = 4;      // beats per bar
  const LOOP_LEN = 16;     // beats per full loop

  function _scheduleLoop(startT) {
    if (!_playing) return;
    const conv = _makeReverb(2);

    // ── Pads / chords ──
    CHORDS.forEach((chord, ci) => {
      const t = startT + ci * BAR * BEAT;
      chord.forEach(ni => _pad(NOTES[ni], t, BAR * BEAT * 0.9, 0.28));
      // Bass root — one octave down
      _osc(NOTES[chord[0]] / 2, "sine", t, BAR * BEAT * 0.85, 0.35);
    });

    // ── Melody ──
    MELODY.forEach(([ni, beat, dur]) => {
      const t   = startT + beat * BEAT;
      const vol = 0.55;
      _osc(NOTES[ni],     "sine",     t, dur * BEAT, vol);
      _osc(NOTES[ni] * 2, "sine",     t, dur * BEAT, vol * 0.12);  // octave shimmer
    });

    // ── Soft pulse / hi-hat feel ──
    for (let b = 0; b < LOOP_LEN; b++) {
      const t = startT + b * BEAT;
      // Kick-like thud on beats 0 & 8
      if (b % 8 === 0) {
        _osc(80, "sine", t, 0.18, 0.5);
        _osc(60, "sine", t, 0.22, 0.3);
      }
      // Soft tick on every 2nd beat
      if (b % 2 === 0) {
        _osc(1200, "square", t, 0.04, 0.04);
      }
    }

    // Schedule next loop
    const loopDur = LOOP_LEN * BEAT;
    _loopHandle = setTimeout(() => _scheduleLoop(startT + loopDur), (loopDur - 0.3) * 1000);
  }

  // ── Public API ─────────────────────────────────────
  function play() {
    if (_playing) return;
    _ensureCtx();
    if (_ctx.state === "suspended") _ctx.resume();
    _playing = true;
    _scheduleLoop(_ctx.currentTime + 0.1);
  }

  function stop() {
    if (!_playing) return;
    _playing = false;
    clearTimeout(_loopHandle);
    // Fade master gain to 0 then kill nodes
    if (_masterGain) {
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, _ctx.currentTime);
      _masterGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.6);
    }
    setTimeout(() => {
      _nodes.forEach(n => { try { n.stop(); } catch(_) {} });
      _nodes = [];
      if (_masterGain) _masterGain.gain.value = 0.18; // reset for next play
    }, 700);
  }

  function isPlaying() { return _playing; }

  return { play, stop, isPlaying };
})();

// ═══════════════════════════════════════════════════
//  TRADING PLAZA — marketplace for Pokémon
// ═══════════════════════════════════════════════════
const TradinPlaza = (() => {
      let _cache = null;
      let _loading = false;
      let _sellerMode = false;
      let _selectedPoke = null;
      let _sellQty = 1;
      let _sellPrice = 100;
      
      // ── Reserved quantity helpers ───────────────────────
      // Returns how many of a given pokemonId are currently listed by this user
      function _reservedQty(pokemonId) {
        const reserved = State.userData?.reservedInTrade || [];
        return reserved
          .filter(r => r.pokemonId === pokemonId)
          .reduce((s, r) => s + r.quantity, 0);
      }
      // Available = owned count minus what's already in trading plaza
      function _availableQty(pokemonId) {
        const col = State.userData?.pokemonCollection || [];
        const owned = (col.find(p => p.id === pokemonId)?.count) || 0;
        return Math.max(0, owned - _reservedQty(pokemonId));
      }
      // Add a reservation locally + persist
      async function _addReservation(pokemonId, quantity, tradeId) {
        const reserved = [...(State.userData?.reservedInTrade || [])];
        reserved.push({ pokemonId, quantity, tradeId });
        State.userData.reservedInTrade = reserved;
        await DB.updateUser(State.user.uid, { reservedInTrade: reserved });
      }
      // Remove a reservation locally + persist
      async function _removeReservation(tradeId) {
        const reserved = (State.userData?.reservedInTrade || [])
          .filter(r => r.tradeId !== tradeId);
        State.userData.reservedInTrade = reserved;
        await DB.updateUser(State.user.uid, { reservedInTrade: reserved });
      }
      // Permanently deduct from collection (called when someone buys your listing)
      async function _deductFromCollection(pokemonId, quantity) {
        const col = State.userData?.pokemonCollection || [];
        const idx = col.findIndex(p => p.id === pokemonId);
        if (idx === -1) return;
        const newCount = (col[idx].count || 1) - quantity;
        let newCol;
        if (newCount <= 0) {
          newCol = col.filter((_, i) => i !== idx);
        } else {
          newCol = col.map((p, i) => i === idx ? { ...p, count: newCount } : p);
        }
        State.userData.pokemonCollection = newCol;
        await DB.updateUser(State.user.uid, { pokemonCollection: newCol });
      }

  // ── Cache ───────────────────────────────────────────
  async function _load(force=false) {
    if (_cache && !force) return _cache;
    if (_loading) return [];
    _loading = true;
    try { _cache = await DB.getTrades(30); }
    catch(e) { console.error("Trades load error",e); _cache = []; }
    _loading = false;
    return _cache;
  }
  function invalidate() { _cache = null; }

  // ── Render plaza listings ───────────────────────────
  async function render(force=false) {
    const wrap = $("tp-listings"); if (!wrap) return;
    wrap.innerHTML = `<div class="tp-loading"><i class="bi bi-arrow-repeat"></i> Loading…</div>`;
    const trades = await _load(force);
    wrap.innerHTML = "";
    if (!trades.length) {
      wrap.innerHTML = `<div class="tp-empty"><i class="bi bi-shop"></i> No listings yet — be the first to sell!</div>`;
      return;
    }
    trades.forEach(t => {
      const isMe     = t.sellerId === State.user?.uid;
      const isLegend = t.pokemonTier==="t2" || TIER2_IDS.has(t.pokemonId);
      const card = document.createElement("div");
      card.className = "tp-card" + (isLegend?" tp-card-legend":"") + (isMe?" tp-card-mine":"");
      card.innerHTML = `
        <div class="tp-card-img-wrap${isLegend?" tp-legend-img":""}">
          <img src="${POKE_ARTWORK_URL(t.pokemonId)}" alt="${t.pokemonName}"
            onerror="this.src='${POKE_SPRITE_URL(t.pokemonId)}'"
            loading="lazy" class="tp-card-img" />
          ${isLegend?`<span class="tp-legend-gem"><i class="bi bi-gem-fill"></i></span>`:""}
        </div>
        <div class="tp-card-info">
          <span class="tp-card-name">${t.pokemonName}</span>
          <span class="tp-card-id">#${String(t.pokemonId).padStart(3,"0")} · ${isLegend?"Legendary":"Common"}</span>
          <span class="tp-card-qty">Qty: <strong>${t.quantity}</strong></span>
          <span class="tp-card-seller"><i class="bi bi-person-fill"></i> ${t.sellerName}</span>
        </div>
        <div class="tp-card-price-col">
          <span class="tp-card-price"><i class="bi bi-coin"></i> ${fmt.coins(t.totalPrice)}</span>
          <span class="tp-card-unit">${t.quantity>1?`${fmt.coins(t.priceEach)} ea`:"per unit"}</span>
          ${isMe
            ? `<button class="tp-cancel-btn" id="tp-cancel-${t.id}"><i class="bi bi-x-circle"></i> Remove</button>`
            : `<button class="tp-buy-btn" data-id="${t.id}"><i class="bi bi-bag-fill"></i> BUY</button>`
          }
        </div>`;
      if (isMe) {
        card.querySelector(`#tp-cancel-${t.id}`)?.addEventListener("click", () => _cancelListing(t));
      } else {
        card.querySelector(".tp-buy-btn")?.addEventListener("click", () => _promptBuy(t));
      }
      wrap.appendChild(card);
    });
  }

  // ── Sell flow ───────────────────────────────────────
  function openSellModal() {
  const modal = $("tp-sell-modal");
  if (!modal) {
    console.error("❌ tp-sell-modal element not found in DOM");
    Toast.show("Sell modal not found in page.", "loss");
    return;
  }
  
  const gallery = $("tp-sell-gallery");
  const controls = $("tp-sell-controls");
  console.log("✅ Modal found:", modal);
  console.log("Gallery found:", gallery);
  console.log("Controls found:", controls);
  
  const col = State.userData?.pokemonCollection || [];
  if (!col.length) {
    Toast.show("No Pokémon in your collection yet!", "loss");
    return;
  }
  
  _selectedPoke = null;
  _sellQty = 1;
  _sellPrice = 100;
  
  // Render gallery first, then open
  _renderSellGallery(col);
  _renderSellControls();
  
  modal.classList.remove("hidden");
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("visible")));
}

  function _closeSellModal() {
    const modal = $("tp-sell-modal"); if (!modal) return;
    modal.classList.remove("visible");
    setTimeout(() => modal.classList.add("hidden"), 320);
  }

  function _renderSellGallery(col) {
    const grid = $("tp-sell-gallery"); if (!grid) return;
    grid.innerHTML = "";

    if (!col.length) {
      grid.innerHTML = `<p class="tp-sell-pick-hint">No Pokémon in your collection yet.</p>`;
      return;
    }

    [...col].sort((a, b) => a.id - b.id).forEach(p => {
      const isLegend  = p.tier === "t2" || TIER2_IDS.has(p.id);
      const cardCount = p.count || 1;
      const reserved  = _reservedQty(p.id);

      const card = document.createElement("button");
      card.className = "tp-sell-poke" + (_selectedPoke?.id === p.id ? " selected" : "");

      card.innerHTML = `
        <img src="${POKE_ARTWORK_URL(p.id)}" alt="${p.name}"
          onerror="this.src='${POKE_SPRITE_URL(p.id)}'"
          loading="lazy" class="tp-sell-img" />
        ${isLegend   ? `<span class="tp-sell-gem"><i class="bi bi-gem-fill"></i></span>` : ""}
        ${cardCount > 1 ? `<span class="tp-sell-count">×${cardCount}</span>` : ""}
        ${reserved > 0  ? `<span class="tp-sell-reserved-label">Listed: ${reserved}</span>` : ""}
        <span class="tp-sell-name">${p.name}</span>`;

      card.addEventListener("click", () => {
        // Pass total count — user can sell any quantity they own
        _selectedPoke = { ...p, count: cardCount };
        _sellQty = 1;
        _renderSellGallery(col);
        _renderSellControls();
      });

      grid.appendChild(card);
    });
  }
  
  function _renderSellControls() {
    const wrap = $("tp-sell-controls"); if (!wrap) return;
    if (!_selectedPoke) {
      wrap.innerHTML = `<p class="tp-sell-pick-hint">← Select a Pokémon to list</p>`;
      return;
    }

    const maxQty = _selectedPoke.count || 1;  // total owned — always listable
    const total  = _sellPrice * _sellQty;

    wrap.innerHTML = `
      <div class="tp-sell-selected">
        <img src="${POKE_ARTWORK_URL(_selectedPoke.id)}" class="tp-sell-sel-img"
          onerror="this.src='${POKE_SPRITE_URL(_selectedPoke.id)}'" />
        <div>
          <p class="tp-sell-sel-name">${_selectedPoke.name}</p>
          <p class="tp-sell-sel-own">You own: <strong>${maxQty}</strong></p>
        </div>
      </div>
      <div class="tp-sell-row">
        <label class="tp-sell-label">PRICE PER UNIT <span class="tp-sell-min">(min 100)</span></label>
        <div class="tp-sell-price-wrap">
          <i class="bi bi-coin tp-price-icon"></i>
          <input id="tp-price-input" type="number" min="100" step="50"
            value="${_sellPrice}" class="tp-price-input" />
        </div>
      </div>
      ${maxQty > 1 ? `
      <div class="tp-sell-row">
        <label class="tp-sell-label">QUANTITY</label>
        <div class="tp-qty-wrap">
          <button class="tp-qty-btn" id="tp-qty-minus">−</button>
          <span class="tp-qty-val" id="tp-qty-display">${_sellQty}</span>
          <button class="tp-qty-btn" id="tp-qty-plus">+</button>
          <span class="tp-qty-max">/ ${maxQty}</span>
        </div>
      </div>` : ""}
      <div class="tp-sell-total">
        TOTAL <span id="tp-sell-total-val"><i class="bi bi-coin"></i> ${fmt.coins(total)}</span>
      </div>
      <button id="tp-confirm-list" class="tp-confirm-list-btn">
        <i class="bi bi-shop"></i> LIST IN MERCHANT
      </button>`;

    $("tp-price-input")?.addEventListener("input", e => {
      _sellPrice = Math.max(100, parseInt(e.target.value) || 100);
      _updateTotal();
    });
    $("tp-price-input")?.addEventListener("blur", e => {
      if (parseInt(e.target.value) < 100) e.target.value = 100;
      _sellPrice = Math.max(100, parseInt(e.target.value) || 100);
      _updateTotal();
    });
    $("tp-qty-minus")?.addEventListener("click", () => {
      if (_sellQty > 1) { _sellQty--; _updateQtyDisplay(); }
    });
    $("tp-qty-plus")?.addEventListener("click", () => {
      if (_sellQty < maxQty) { _sellQty++; _updateQtyDisplay(); }
    });
    $("tp-confirm-list")?.addEventListener("click", _submitListing);
  }

  function _updateQtyDisplay() {
    const d = $("tp-qty-display"); if (d) d.textContent = _sellQty;
    _updateTotal();
  }
  function _updateTotal() {
    const t = $("tp-sell-total-val");
    if (t) t.innerHTML = `<i class="bi bi-coin"></i> ${fmt.coins(_sellPrice * _sellQty)}`;
  }

async function _submitListing() {
    if (!_selectedPoke) return;
    if (_sellPrice < 100) { Toast.show("Minimum price is 100 coins!", "loss"); return; }

    // Validate quantity against total owned
const totalOwned = (_selectedPoke.count || 1);
if (_sellQty < 1 || _sellQty > totalOwned) {
  Toast.show("Invalid quantity.", "loss");
  return;
}

    const btn = $("tp-confirm-list");
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> Listing…`; }

    try {
      const tradeRef = await DB.addTrade({
        sellerId:    State.user.uid,
        sellerName:  State.userData.username || "Trainer",
        sellerAvatar:State.userData.avatar   || "",
        pokemonId:   _selectedPoke.id,
        pokemonName: _selectedPoke.name,
        pokemonTier: _selectedPoke.tier || "t1",
        quantity:    _sellQty,
        priceEach:   _sellPrice,
        totalPrice:  _sellPrice * _sellQty,
      });

      // Reserve the quantity so it can't be sold again until this listing resolves
      await _addReservation(_selectedPoke.id, _sellQty, tradeRef.id);

      Toast.show(`${_selectedPoke.name} listed in the merchant!`, "win", 3000);
      invalidate();
      _closeSellModal();
      render(true);
      ProfilePage.refresh();
      PokemonMasters.invalidate();
      PokemonMasters.render(true);
    } catch(e) {
      console.error("List error", e);
      Toast.show("Couldn't list item. Try again.", "loss");
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-shop"></i> LIST IN MERCHANT`; }
    }
  }
// ── Cancel own listing ──────────────────────────────
  async function _cancelListing(trade) {
    const btn = $(`tp-cancel-${trade.id}`);
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span>`; }
    try {
      // Mark trade as cancelled in Firestore
      const ref = doc(db, "trades", trade.id);
      await updateDoc(ref, { status: "cancelled", cancelledAt: serverTimestamp() });
      // Release the reservation
      await _removeReservation(trade.id);
      Toast.show(`${trade.pokemonName} removed from Trading Plaza.`, "info", 3000);
      invalidate();
      render(true);
      ProfilePage.refresh();
      PokemonMasters.invalidate();
      PokemonMasters.render(true);
    } catch(e) {
      console.error("Cancel listing error", e);
      Toast.show("Couldn't remove listing. Try again.", "loss");
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-x-circle"></i> Remove`; }
    }
  }

  // ── Buy flow ────────────────────────────────────────
  function _promptBuy(trade) {
    const modal = $("tp-buy-modal"); if (!modal) return;
    const isLegend = trade.pokemonTier==="t2" || TIER2_IDS.has(trade.pokemonId);
    $("tpbm-img").src        = POKE_ARTWORK_URL(trade.pokemonId);
    $("tpbm-img").onerror    = () => { $("tpbm-img").src = POKE_SPRITE_URL(trade.pokemonId); };
    $("tpbm-name").textContent  = trade.pokemonName;
    $("tpbm-seller").textContent= trade.sellerName;
    $("tpbm-price").textContent = fmt.coins(trade.totalPrice);
    $("tpbm-qty").textContent   = trade.quantity;

    const canAfford = Coins.get() >= trade.totalPrice;
    const confirmBtn = $("tpbm-confirm");
    if (confirmBtn) {
      confirmBtn.disabled  = !canAfford;
      confirmBtn.innerHTML = canAfford
        ? `<i class="bi bi-check-circle-fill"></i> YES, PURCHASE`
        : `<i class="bi bi-coin"></i> Need ${fmt.coins(trade.totalPrice)} coins`;
      const fresh = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(fresh, confirmBtn);
      if (canAfford) {
        fresh.addEventListener("click", () => _executeBuy(trade));
      }
    }
    modal.classList.remove("hidden");
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("visible")));
  }

  function _closeBuyModal() {
    const modal = $("tp-buy-modal"); if (!modal) return;
    modal.classList.remove("visible");
    setTimeout(() => modal.classList.add("hidden"), 320);
  }

async function _executeBuy(trade) {
    if (Coins.get() < trade.totalPrice) { Toast.show("Not enough coins!", "loss"); return; }
    const btn = $("tpbm-confirm");
    if (btn) { btn.disabled=true; btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> Purchasing…`; }

    try {
      await Coins.deduct(trade.totalPrice);
      await DB.executeTrade(trade.id, State.user.uid, State.userData.username||"Trainer");

      // ── If buyer is also the seller (edge case) skip collection add ──
      const isSelf = trade.sellerId === State.user.uid;

      if (!isSelf) {
        // Add pokemon to buyer's collection
        const col      = State.userData.pokemonCollection || [];
        const existing = col.find(p => p.id === trade.pokemonId);
        const newCol   = existing
          ? col.map(p => p.id===trade.pokemonId
              ? { ...p, count:(p.count||1)+trade.quantity }
              : p)
          : [...col, { id:trade.pokemonId, name:trade.pokemonName, tier:trade.pokemonTier, count:trade.quantity }];

        State.userData.pokemonCollection = newCol;
        await DB.updateUser(State.user.uid, {
          pokemonCollection: newCol,
          totalCaptures: (State.userData.totalCaptures||0) + trade.quantity,
        });
      }

// ── Deduct from seller's collection + release reservation ──
try {
  const sellerRef = doc(db, "users", trade.sellerId);
  const sellerSnap = await getDoc(sellerRef);
  
  if (sellerSnap.exists()) {
    const sellerData = sellerSnap.data();
    
    // 1. Remove from seller's pokemonCollection
    const sellerCol = sellerData.pokemonCollection || [];
    const idx = sellerCol.findIndex(p => p.id === trade.pokemonId);
    let newSellerCol = sellerCol;
    
    if (idx !== -1) {
      const newCount = (sellerCol[idx].count || 1) - trade.quantity;
      newSellerCol = newCount <= 0 ?
        sellerCol.filter((_, i) => i !== idx) :
        sellerCol.map((p, i) => i === idx ? { ...p, count: newCount } : p);
    }
    
    // 2. Remove the matching reservation entry
    const newReserved = (sellerData.reservedInTrade || [])
      .filter(r => r.tradeId !== trade.id);
    
    // 3. Write both fields together atomically
    await updateDoc(sellerRef, {
      pokemonCollection: newSellerCol,
      reservedInTrade: newReserved,
    });
    
    // 4. If the seller happens to be the current logged-in user,
    //    sync local State immediately so UI reflects the change
    if (trade.sellerId === State.user.uid) {
      State.userData.pokemonCollection = newSellerCol;
      State.userData.reservedInTrade = newReserved;
    }
  }
} catch (sellerErr) {
  console.error("Seller collection deduct error:", sellerErr);
  // Non-fatal — the trade coin transfer already completed above
}

Toast.show(`${trade.pokemonName} purchased! Check your collection.`, "win", 3500);
invalidate();
_closeBuyModal();
render(true);
ProfilePage.refresh();
PokemonMasters.invalidate();
PokemonMasters.render(true);
    } catch(e) {
      console.error("Buy error", e);
      Toast.show("Purchase failed. Try again.", "loss");
      if (btn) { btn.disabled=false; btn.innerHTML=`<i class="bi bi-check-circle-fill"></i> YES, PURCHASE`; }
    }
  }
  function init() {
    $("btn-tp-sell")?.addEventListener("click", openSellModal);
    $("tp-sell-modal")?.addEventListener("click", e => { if(e.target.id==="tp-sell-modal") _closeSellModal(); });
    $("tp-sell-close")?.addEventListener("click", _closeSellModal);
    $("tp-buy-modal")?.addEventListener("click",  e => { if(e.target.id==="tp-buy-modal")  _closeBuyModal(); });
    $("tpbm-cancel")?.addEventListener("click", _closeBuyModal);
$("tpbm-cancel-bottom")?.addEventListener("click", _closeBuyModal);
  }

  return { render, invalidate, init, getReservedQty: _reservedQty };
})();

// ═══════════════════════════════════════════════════
//  POKÉMON MASTERS — player collection leaderboard
// ═══════════════════════════════════════════════════
const PokemonMasters = (() => {
  let _cache     = null;   // cached masters array
  let _loading   = false;
  let _openIdx   = null;   // which accordion row is expanded

  async function load(force=false) {
    if (_cache && !force) return _cache;
    if (_loading) return null;
    _loading = true;
    try {
      _cache = await DB.getPokemonMasters(10);
    } catch(e) {
      console.error("Masters load error", e);
      _cache = [];
    }
    _loading = false;
    return _cache;
  }

  function invalidate() { _cache = null; }

  function _legendCount(col=[]) {
    return col.filter(p => p.tier==="t2" || TIER2_IDS.has(p.id)).length;
  }
  function _commonCount(col=[]) {
    return col.filter(p => p.tier!=="t2" && !TIER2_IDS.has(p.id)).length;
  }

  function _pokemonThumb(p) {
    const isLegend = p.tier==="t2" || TIER2_IDS.has(p.id);
    return `<div class="pm-thumb${isLegend?" pm-thumb-legend":""}" title="${p.name}">
      <img src="${POKE_ARTWORK_URL(p.id)}" alt="${p.name}"
        onerror="this.src='${POKE_SPRITE_URL(p.id)}'"
        loading="lazy" class="pm-thumb-img" />
      ${isLegend?`<span class="pm-thumb-gem"><i class="bi bi-gem-fill"></i></span>`:""}
    </div>`;
  }

  function _renderSection(masters) {
    const wrap = $("pm-list"); if (!wrap) return;

    if (!masters || !masters.length) {
      wrap.innerHTML = `<div class="pm-empty"><i class="bi bi-people"></i> No trainers yet — be the first!</div>`;
      return;
    }

    wrap.innerHTML = "";
    masters.forEach((user, idx) => {
      const col      = user.pokemonCollection || [];
      const legends  = col.filter(p => p.tier==="t2" || TIER2_IDS.has(p.id));
      const commons  = col.filter(p => p.tier!=="t2" && !TIER2_IDS.has(p.id));
      const isMe     = user.uid === State.user?.uid;
      const isOpen   = _openIdx === idx;
      const medals   = ["🥇","🥈","🥉"];
      const rank     = medals[idx] ?? `#${idx+1}`;

      const row = document.createElement("div");
      row.className = "pm-row" + (isMe?" pm-row-me":"") + (isOpen?" pm-row-open":"");
      row.innerHTML = `
        <button class="pm-header" data-idx="${idx}" aria-expanded="${isOpen}">
          <span class="pm-rank">${rank}</span>
          <span class="pm-avatar">${avatarHtml(user.avatar)}</span>
          <div class="pm-info">
            <span class="pm-username">${user.username||"Trainer"}${isMe?`<span class="pm-you">YOU</span>`:""}</span>
            <span class="pm-summary">
              ${legends.length?`<span class="pm-tag legend-tag"><i class="bi bi-gem-fill"></i> ${legends.length} Legendary</span>`:""}
              ${commons.length?`<span class="pm-tag common-tag"><i class="bi bi-collection-fill"></i> ${commons.length} Common</span>`:""}
              ${!col.length?`<span class="pm-tag empty-tag">No captures yet</span>`:""}
            </span>
          </div>
          <i class="bi bi-chevron-down pm-chevron ${isOpen?"open":""}"></i>
        </button>
        <div class="pm-body ${isOpen?"":"hidden"}">
          ${legends.length ? `
            <p class="pm-section-label legend-label"><i class="bi bi-gem-fill"></i> Legendary & Epic</p>
            <div class="pm-thumbs">${legends.map(_pokemonThumb).join("")}</div>` : ""}
          ${commons.length ? `
            <p class="pm-section-label common-label"><i class="bi bi-collection-fill"></i> Common</p>
            <div class="pm-thumbs">${commons.map(_pokemonThumb).join("")}</div>` : ""}
          ${!col.length ? `<p class="pm-no-captures">This trainer hasn't caught any Pokémon yet.</p>` : ""}
        </div>`;

      // Accordion toggle — pure DOM, zero extra reads
      row.querySelector(".pm-header").addEventListener("click", () => {
        _openIdx = isOpen ? null : idx;
        _renderSection(masters); // re-render with new open state
      });

      wrap.appendChild(row);
    });
  }

  async function render(force=false) {
    const wrap = $("pm-list"); if (!wrap) return;
    wrap.innerHTML = `<div class="pm-loading"><i class="bi bi-arrow-repeat"></i> Loading trainers…</div>`;
    const masters = await load(force);
    _renderSection(masters);
  }

  return { render, invalidate };
})();

// ═══════════════════════════════════════════════════
//  CAPTURE A POKÉMON — TWO-TIER SYSTEM
// ═══════════════════════════════════════════════════
const CaptureGame = {
  _tier:          "t1",
  _pickedBall:    null,
  _revealedPoke:  null,
  _wasFreeThrow:  false,

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

  init() {
    $("open-capture")?.addEventListener("click",        () => this.open());
    $("back-capture")?.addEventListener("click", () => {
      CaptureMusic.stop();
      this._closeOverlay();
      HomeMusic.play();
      HistoryManager.pop();
    });
    $("btn-capture-again")?.addEventListener("click",   () => this._resetForNewThrow());
    $("btn-capture-mute")?.addEventListener("click", () => {
      const icon = $("capture-mute-icon");
      if (CaptureMusic.isPlaying()) {
        CaptureMusic.stop();
        if (icon) { icon.className = "bi bi-music-note-beamed"; icon.style.opacity = "0.35"; }
      } else {
        CaptureMusic.play();
        if (icon) { icon.className = "bi bi-music-note-beamed"; icon.style.opacity = "1"; }
      }
    });
    $("btn-capture-howto")?.addEventListener("click",   () => this._showHowToModal());
    $("btn-howto-close")?.addEventListener("click",     () => this._closeHowToModal());
    $("capture-howto-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "capture-howto-modal") this._closeHowToModal();
    });
    document.querySelectorAll(".capture-tier-tab").forEach(btn => {
      btn.addEventListener("click", () => this._switchTier(btn.dataset.tier));
    });
  },

  open() {
  cls.remove($("overlay-capture"), "hidden");
  this._pickedBall = null;
  this._revealedPoke = null;
  this._wasFreeThrow = false;
  const revealEl = $("capture-reveal");
  if (revealEl) cls.add(revealEl, "hidden");
  const againWrap = $("capture-again-wrap");
  if (againWrap) cls.add(againWrap, "hidden");
  this._refreshCoins();
  this._renderTierTabs();
  this._renderState();
  this._showHowToModal();
  PokemonMasters.render();
  TradinPlaza.render();
  HomeMusic.stop();
  CaptureMusic.play();
  HistoryManager.push("capture");
  },

  _closeOverlay() {
    cls.add($("overlay-capture"), "hidden");
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

  _showHowToModal() {
    const modal = $("capture-howto-modal");
    if (!modal) return;
    cls.remove(modal, "hidden");
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

      if (statusEl) statusEl.innerHTML = this._tier === "t1" ?
  `<span class="capture-status-badge used"><i class="bi bi-check-circle-fill"></i> TODAY'S FREE THROW USED</span>
           <p class="capture-status-sub">Resets in <strong>${fmt.countdown(msLeft)}</strong> — or throw again for <strong>${fmt.coins(nextCost)} coins</strong></p>` :
  `<span class="capture-status-badge used-legendary"><i class="bi bi-check-circle-fill"></i> THIS PERIOD'S FREE THROW USED</span>
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

  async _persist(pokeId, pokeName_) {
    if (!State.user || !State.userData) return;
    PokemonMasters.invalidate();
    TradinPlaza.invalidate();
    const now = new Date();
    const collection = State.userData.pokemonCollection || [];
    const existing = collection.find(p => p.id === pokeId);
    const newCollection = existing ?
      collection.map(p => p.id === pokeId ?
        { ...p, count: (p.count || 1) + 1 } :
        p) :
      [...collection, { id: pokeId, name: pokeName_, tier: this._tier, count: 1 }];
      
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

    Cache.set("recentCaptures", null);
    DashPage._candidatesLoaded = false;
    PokemonMasters.invalidate();
    PokemonMasters.render(true);
    
    this._refreshCoins();
  },

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
//  PÆIR A PÆRA GAME
// ═══════════════════════════════════════════════════
const PaerGame = (() => {
  // ── State ──────────────────────────────────────────
  let _bank         = 0;
  let _phase        = "idle";  // idle | preview | play | renewing | done
  let _tiles        = [];
  let _timerSec     = PAER_DURATION_SEC;
  let _timerHandle  = null;
  let _wave         = 0;
  let _gifts        = [];
  let _giftId       = 0;

// Power-up state
  let _freezeSec    = 0;   // ❄️ seconds remaining
  let _starSec      = 0;   // ⭐/🌟 seconds remaining
  let _starMulti    = 1;   // current multiplier (1 = off, 2 = ⭐, 4 = 🌟)
  let _orbActive    = false; // 🧿 peek in progress

  // ── DOM helper ─────────────────────────────────────
  const el = (id) => document.getElementById(id);

  // ── Daily cost progression ─────────────────────────
  // Stored in userData: paerPlayCount (resets daily), paerLastPlayDate
  function _todayStr() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }
  function _getPlayCount() {
    if (!State.userData) return 0;
    const last = State.userData.paerLastPlayDate;
    if (last !== _todayStr()) return 0; // new day → reset
    return State.userData.paerPlayCount ?? 0;
  }
  function _currentCost() {
    // 50 × 2^playCount: 50, 100, 200, 400 …
    return PAER_COST_BASE * Math.pow(2, _getPlayCount());
  }
  async function _recordPlay() {
    if (!State.user || !State.userData) return;
    const today = _todayStr();
    const count = _getPlayCount() + 1;
    State.userData.paerPlayCount    = count;
    State.userData.paerLastPlayDate = today;
    await DB.updateUser(State.user.uid, {
      paerPlayCount:    count,
      paerLastPlayDate: today,
    });
  }

  // ── Tile definitions ───────────────────────────────
const TILE_DEFS = [
  { emoji: "💎", label: "Diamond", value: 1000, cls: "diamond", effect: "earn" }, // idx 0
  { emoji: "💰", label: "Gold Bag", value: 500, cls: "gold", effect: "earn" }, // idx 1
  { emoji: "💵", label: "Cash", value: 100, cls: "cash", effect: "earn" }, // idx 2
  { emoji: "💣", label: "Bomb", value: -100, cls: "bomb", effect: "burn" }, // idx 3 — −₱100
  { emoji: "💸", label: "Money Fly", value: -200, cls: "moneyfly", effect: "burn" }, // idx 4 — −₱200, wave 8+
  { emoji: "🎁", label: "Gift", value: 0, cls: "gift", effect: "gift" }, // idx 5
  { emoji: "❄️", label: "Freeze", value: 10, cls: "freeze", effect: "freeze" }, // idx 6 — wave 2+
  { emoji: "⭐", label: "Star", value: 25, cls: "star", effect: "star", multi: 2 }, // idx 7
  { emoji: "🧿", label: "Orb", value: 2, cls: "orb", effect: "orb" }, // idx 8
  { emoji: "🌟", label: "Superstar", value: 25, cls: "superstar", effect: "star", multi: 4 }, // idx 9
  { emoji: "🔥", label: "Fire", value: 0, cls: "fire", effect: "burnfreeze" }, // idx 10 — cancels ❄️ only
  { emoji: "🪙", label: "Coin", value: 300, cls: "coin300", effect: "earn" }, // idx 11 — wave 8+, replaces 💎
  { emoji: "🧨", label: "Firecracker", value: -50, cls: "firecracker", effect: "burn" }, // idx 12 — −₱50
];

  // ── Pool builder (wave-aware) ──────────────────────
function _buildPool(wave) {
  // Each slot in the 25-tile grid is assigned by weighted random draw
  // based on the current wave bracket.
  const pool = [];
  
  // ── Helper: weighted random pick from a table ──────
  function weightedDraw(table) {
    const total = table.reduce((s, r) => s + r.w, 0);
    let r = Math.random() * total;
    for (const row of table) { r -= row.w; if (r <= 0) return row.idx; }
    return table[table.length - 1].idx;
  }
  
  if (wave === 0) {
    // ── Wave 1: 90% earn [💰💵], 10% hazard [💣🧨] ──
    const table = [
      { idx: 1, w: 50 }, // 💰 Gold Bag
      { idx: 2, w: 40 }, // 💵 Cash
      { idx: 3, w: 6 }, // 💣 −₱100
      { idx: 12, w: 4 }, // 🧨 −₱50
    ];
    for (let i = 0; i < 25; i++) pool.push(weightedDraw(table));
    
  } else if (wave <= 7) {
    // ── Wave 2–8: 80% earn, 15% hazard, 5% power-up ──
    const table = [
      { idx: 1, w: 45 }, // 💰
      { idx: 2, w: 35 }, // 💵
      { idx: 3, w: 9 }, // 💣
      { idx: 12, w: 6 }, // 🧨
      { idx: 0, w: 2 }, // 💎
      { idx: 6, w: 1 }, // ❄️
      { idx: 7, w: 2 }, // ⭐
    ];
    for (let i = 0; i < 25; i++) pool.push(weightedDraw(table));
    
    // 🎁 rare gift — replace one random slot (1% effective chance per tile ≈ guaranteed ~every 4 waves)
    if (Math.random() < 0.25) pool[Math.floor(Math.random() * 25)] = 5;
    
  } else {
    // ── Wave 8+: 70% earn, 15% hazard, 10% power-up+danger, 4% rare, 1% gift ──
    const table = [
      { idx: 11, w: 35 }, // 🪙 ₱300 (replaces 💎)
      { idx: 2, w: 35 }, // 💵
      { idx: 3, w: 9 }, // 💣
      { idx: 12, w: 6 }, // 🧨
      { idx: 0, w: 3 }, // 💎
      { idx: 4, w: 4 }, // 💸 −₱200
      { idx: 6, w: 2 }, // ❄️
      { idx: 7, w: 2 }, // ⭐
      { idx: 10, w: 1 }, // 🔥 cancel ❄️
      { idx: 8, w: 2 }, // 🧿
      { idx: 9, w: 2 }, // 🌟
    ];
    for (let i = 0; i < 25; i++) pool.push(weightedDraw(table));
    
    // 🎁 1% chance to inject one gift tile
    if (Math.random() < 0.01 * 25) pool[Math.floor(Math.random() * 25)] = 5;
  }
  
  // Safety: always exactly 25 tiles
  while (pool.length < 25) pool.push(3);
  pool.length = 25;
  
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

  function _buildTiles(wave) {
    return _buildPool(wave).map((typeIdx, id) => ({ id, typeIdx, revealed: false }));
  }

  // ── Coin/bank display ──────────────────────────────
  function _refreshCoins() {
    const d = el("paer-coins-display");
    if (d) d.textContent = fmt.coins(Coins.get());
  }
  function _refreshBank() {
    const d = el("paer-bank-display");
    if (d) d.textContent = `₱${fmt.coins(_bank)}`;
    const hint = el("paer-cashout-hint");
    if (hint) {
      const blocks = Math.floor(_bank / PAER_CASHOUT_BLOCK);
      hint.textContent = blocks > 0 ? `= 🪙 ${blocks * PAER_CASHOUT_COINS} coins ready` : "";
    }
    _refreshCashoutTiers();
  }
  function _refreshCashoutTiers() {
    const wrap = el("paer-cashout-tiers"); if (!wrap) return;
    wrap.innerHTML = "";
    PAER_CASHOUT_TIERS.forEach(tier => {
      const canUse = _bank >= tier.need;
      const row = document.createElement("div");
      row.className = "paer-cashout-row" + (canUse ? " available" : "");
      row.innerHTML = `
        <div class="pct-info">
          <span class="pct-amount">₱${fmt.coins(tier.need)}</span>
          <span class="pct-arrow">→ 🪙 ${tier.coins} coins</span>
        </div>
        ${canUse
          ? `<button class="btn-paer-convert" data-need="${tier.need}" data-coins="${tier.coins}">CONVERT</button>`
          : `<span class="pct-locked"><i class="bi bi-lock-fill"></i> Need ₱${fmt.coins(tier.need - _bank)} more</span>`
        }`;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll(".btn-paer-convert").forEach(btn => {
      btn.addEventListener("click", () => _cashout(+btn.dataset.need, +btn.dataset.coins));
    });
  }

  // ── Power-up status bar ────────────────────────────
  // Renders the three stacked power-up indicators + current phase label
  function _renderPowerBar() {
    const bar = el("paer-power-bar"); if (!bar) return;
    const parts = [];

    if (_freezeSec > 0)
  parts.push(`<span class="ppb-pill freeze-pill"><span class="ppb-emoji">❄️</span><span class="ppb-txt">${_freezeSec}s frozen · 💣💸 immune · watch 🔥!</span></span>`);
    if (_starSec > 0) {
      const isSuper = _starMulti >= 4;
      parts.push(`<span class="ppb-pill ${isSuper ? "superstar-pill" : "star-pill"}"><span class="ppb-emoji">${isSuper ? "🌟" : "⭐"}</span><span class="ppb-txt">×${_starMulti} for ${_starSec}s</span></span>`);
    }
    if (_orbActive)
      parts.push(`<span class="ppb-pill orb-pill"><span class="ppb-emoji">🧿</span><span class="ppb-txt">Peeking…</span></span>`);

    bar.innerHTML = parts.join("");
  }

  function _setStatus(html) {
    const s = el("paer-status"); if (s) s.innerHTML = html;
  }

  // ── Timer ──────────────────────────────────────────
  function _startTimer() {
  _timerSec = PAER_DURATION_SEC;
  _tickTimer();
  _timerHandle = setInterval(() => {
    if (_freezeSec > 0) {
      _freezeSec--;
      _renderPowerBar();
      if (_freezeSec === 0) {
        _setFrostOverlay(false); // frost lifts when freeze expires
        _tickTimer();
      }
      return;
    }
    _timerSec--;
    _tickTimer();
    if (_timerSec <= 0) _timeUp();
  }, 1000);
}
  function _tickTimer() {
    const mm  = String(Math.floor(_timerSec / 60)).padStart(2, "0");
    const ss  = String(_timerSec % 60).padStart(2, "0");
    const td  = el("paer-time-display");
    const bar = el("paer-timer-bar");
    if (td) {
      td.textContent = `${mm}:${ss}`;
      td.className   = "paer-time-display" + (_timerSec <= 20 && _freezeSec === 0 ? " urgent" : _freezeSec > 0 ? " frozen" : "");
    }
    if (bar) {
      const pct = (_timerSec / PAER_DURATION_SEC) * 100;
      bar.style.width  = `${pct}%`;
      bar.className    = "paer-timer-bar"
        + (_freezeSec > 0    ? " frozen"
          : _timerSec <= 20  ? " urgent"
          : _timerSec <= 45  ? " warning" : "");
    }
  }
  function _stopTimer() { clearInterval(_timerHandle); _timerHandle = null; }

// ── ❄️ Freeze (+ burn immunity while active) ───────
  // ── Frost overlay on the grid ──────────────────────
function _setFrostOverlay(active) {
  const grid = el("paer-grid");
  if (!grid) return;
  if (active) {
    cls.add(grid, "frosted");
  } else {
    cls.remove(grid, "frosted");
  }
}

// ── ❄️ Freeze (+ burn immunity while active) ───────
function _applyFreeze(secs) {
  _freezeSec += secs;
  _setFrostOverlay(true);
  _renderPowerBar();
  _tickTimer();
  _showPopup(`❄️ +${secs}s freeze!`, "freeze");
  Toast.show(`❄️ Frozen ${secs}s — immune to 💣💸!`, "info", 2500);
}

  // ── ⭐ / 🌟 Star multiplier ────────────────────────
  // multi: 2 for ⭐, 4 for 🌟
  // Rules:
  //   • If nothing active → start fresh with this multi & duration
  //   • If same or lower multi active → just add duration, keep higher multi
  //   • If higher multi already active → just add duration, keep higher multi
  //   (multi never decreases mid-run; duration always stacks)
  function _applyStar(secs, multi) {
    const emoji = multi >= 4 ? "🌟" : "⭐";
    const label = `×${multi}`;

    if (_starSec > 0) {
      // Keep the higher multiplier, always stack duration
      _starMulti = Math.max(_starMulti, multi);
      _starSec  += secs;
      _renderPowerBar();
      _showPopup(`${emoji} +${secs}s added!`, multi >= 4 ? "superstar" : "star");
      Toast.show(`${emoji} ${label} extended to ${_starSec}s!`, "win", 2000);
      return;
    }

    _starSec   = secs;
    _starMulti = multi;
    _renderPowerBar();
    _showPopup(`${emoji} ${label} ACTIVE!`, multi >= 4 ? "superstar" : "star");
    Toast.show(`${emoji} ${label} money for ${secs}s!`, "win", 2500);

    const tick = setInterval(() => {
      if (_starSec <= 0) {
        clearInterval(tick);
        _starSec   = 0;
        _starMulti = 1;
        _renderPowerBar();
        return;
      }
      _starSec--;
      _renderPowerBar();
    }, 1000);
  }

// ── Helper: are there any unrevealed earn tiles? ───
  function _noEarnersLeft() {
    return !_tiles.some(t => !t.revealed && TILE_DEFS[t.typeIdx].effect === "earn");
  }

// ── 🧿 Orb (peek all tiles) ────────────────────────
  async function _applyOrb() {
    if (_orbActive) return; // already peeking
    _orbActive = true;
    _renderPowerBar();
    _showPopup("🧿 Peeking!", "orb");
    Toast.show("🧿 Tiles revealed for 2 seconds!", "info", 2200);

    // Reveal unrevealed tiles visually only (don't set revealed:true)
    const gridEl = el("paer-grid"); if (!gridEl) return;
    gridEl.querySelectorAll(".paer-tile:not(.revealed)").forEach(btn => {
      const id   = +btn.dataset.id;
      const tile = _tiles.find(t => t.id === id);
      if (!tile) return;
      const def  = TILE_DEFS[tile.typeIdx];
      btn.classList.add("peeking");
      btn.innerHTML = `<span class="paer-tile-emoji">${def.emoji}</span>${_tileSubLabel(def)}`;
    });

    await sleep(2000);

    // Flip back tiles that are still unflipped (player didn't tap them)
    gridEl.querySelectorAll(".paer-tile.peeking").forEach(btn => {
      btn.classList.remove("peeking");
      btn.innerHTML = `<span class="paer-tile-back">❓</span>`;
    });
    _orbActive = false;
    _renderPowerBar();

    // After peek ends, check if any earn tiles are still unrevealed.
    // If none remain, there's nothing worth tapping → auto-renew.
    if (_phase === "play" && _noEarnersLeft()) {
      _scheduleRenewal();
    }
  }

  // ── Tile rendering ─────────────────────────────────
function _tileSubLabel(def) {
  if (def.effect === "earn") return `<span class="paer-tile-val ${def.cls}-val">+₱${fmt.coins(def.value)}</span>`;
  if (def.effect === "burn") return `<span class="paer-tile-val burn-val">−₱${fmt.coins(Math.abs(def.value))}</span>`;
  if (def.effect === "burnfreeze") return `<span class="paer-tile-val burnfreeze-val">−₱${fmt.coins(Math.abs(def.value))} ❌❄️</span>`;
  if (def.effect === "gift") return `<span class="paer-tile-val gift-val">COLLECT!</span>`;
  if (def.effect === "freeze") return `<span class="paer-tile-val freeze-val">+${def.value}s ❄️</span>`;
  if (def.effect === "star") return `<span class="paer-tile-val ${def.cls === 'superstar' ? 'superstar-val' : 'star-val'}">×${def.multi} ${def.value}s</span>`;
  if (def.effect === "orb") return `<span class="paer-tile-val orb-val">PEEK</span>`;
  return "";
}
  function _renderGrid(interactive) {
    const grid = el("paer-grid"); if (!grid) return;
    grid.innerHTML = "";
    _tiles.forEach(tile => {
      const def = TILE_DEFS[tile.typeIdx];
      const btn = document.createElement("button");
      btn.className  = "paer-tile" + (tile.revealed ? ` revealed ${def.cls}` : "");
      btn.disabled   = tile.revealed || !interactive;
      btn.dataset.id = tile.id;
      btn.setAttribute("aria-label", tile.revealed ? def.label : "Hidden tile");
      btn.innerHTML  = tile.revealed
        ? `<span class="paer-tile-emoji">${def.emoji}</span>${_tileSubLabel(def)}`
        : `<span class="paer-tile-back">❓</span>`;
      btn.addEventListener("click", () => _flipTile(tile.id));
      grid.appendChild(btn);
    });
  }

  // ── Flip a tile ────────────────────────────────────
  function _flipTile(id) {
    if (_phase !== "play") return;
    const tile = _tiles.find(t => t.id === id);
    if (!tile || tile.revealed) return;
    tile.revealed = true;

    const def = TILE_DEFS[tile.typeIdx];
    const btn = el("paer-grid")?.querySelector(`[data-id="${id}"]`);
    if (btn) {
      btn.disabled  = true;
      btn.className = `paer-tile revealed ${def.cls} flip-in`;
      btn.innerHTML = `<span class="paer-tile-emoji">${def.emoji}</span>${_tileSubLabel(def)}`;
      setTimeout(() => btn.classList.remove("flip-in"), 450);
    }

    if (def.effect === "earn") {
      const multi  = _starSec > 0 ? _starMulti : 1;
      const earned = def.value * multi;
      _bank += earned;
      _refreshBank();
      const starEmoji = _starMulti >= 4 ? "🌟" : "⭐";
      _showPopup(
        multi > 1 ? `${starEmoji}×${multi} +₱${fmt.coins(earned)}` : `+₱${fmt.coins(earned)}`,
        def.cls
      );
      Sound.win();

    } else if (def.effect === "burn") {
  if (_freezeSec > 0) {
    // ❄️ immunity — no deduction
    _showPopup(`❄️ IMMUNE!`, "freeze");
    Toast.show(`❄️ Freeze blocked ${def.emoji}!`, "info", 1800);
  } else {
    _bank = Math.max(0, _bank + def.value);
    _refreshBank();
    _showPopup(`${def.emoji} −₱${fmt.coins(Math.abs(def.value))}`, def.cls);
    Sound.bomb();
  }
  
} else if (def.effect === "burnfreeze") {
  // 🔥 always deducts AND cancels ❄️ freeze + immunity
  _bank = Math.max(0, _bank + def.value);
  _refreshBank();
  if (_freezeSec > 0) {
    _freezeSec = 0;
    _renderPowerBar();
    _tickTimer(); // immediately restores normal timer display
    _setFrostOverlay(false);
    Toast.show(`🔥 Freeze CANCELLED! −₱${fmt.coins(Math.abs(def.value))}`, "loss", 2500);
    _showPopup(`🔥 FREEZE GONE!`, "fire");
  } else {
    _showPopup(`🔥 −₱${fmt.coins(Math.abs(def.value))}`, "fire");
    Toast.show(`🔥 −₱${fmt.coins(Math.abs(def.value))}`, "loss", 1800);
  }
  Sound.bomb();

    } else if (def.effect === "gift") {
      _collectGift();
      Sound.capture();

    } else if (def.effect === "freeze") {
      _applyFreeze(def.value);
      Sound.win();

    } else if (def.effect === "star") {
      _applyStar(def.value, def.multi);
      Sound.jackpot();

    } else if (def.effect === "orb") {
      _applyOrb();
      Sound.capture();
    }

// Trigger renewal if:
    // (a) all 25 tiles are flipped, OR
    // (b) no earn tiles remain unrevealed (orb already showed the board,
    //     no point forcing the player to tap junk)
    if (_phase === "play" && (_tiles.every(t => t.revealed) || _noEarnersLeft())) {
      _scheduleRenewal();
    }
  }

  // ── Renewal ────────────────────────────────────────
  async function _scheduleRenewal() {
    _phase = "renewing";
    _wave++;

    await sleep(500);
    if (_phase !== "renewing") return;

    _setStatus(`<div class="paer-phase-badge shuffle-badge"><i class="bi bi-arrow-repeat"></i> WAVE ${_wave + 1} — RESHUFFLING…</div>`);
    cls.add(el("paer-grid"), "shuffling");

    const gridEl = el("paer-grid");
    if (gridEl) {
      [...gridEl.querySelectorAll(".paer-tile")].forEach((b, i) => {
        setTimeout(() => {
          b.className = "paer-tile resetting";
          b.innerHTML = `<span class="paer-tile-back">❓</span>`;
          b.disabled  = true;
        }, i * 18);
      });
    }

    await sleep(550 + 25 * 25);

    _tiles = _buildTiles(_wave);
    await sleep(300);

    cls.remove(el("paer-grid"), "shuffling");
    _phase = "play";
    _renderGrid(true);
    _setStatus(`<div class="paer-phase-badge play-badge wave-badge"><i class="bi bi-hand-index-fill"></i> WAVE ${_wave + 1} — TAP TILES!</div>`);
    _renderPowerBar();
  }

  // ── Gift system ────────────────────────────────────
  function _collectGift() {
    const options = [100, 200, 300, 400, 500];
    const coins   = options[Math.floor(Math.random() * options.length)];
    const id      = ++_giftId;
    _gifts.push({ id, coins, opened: false });
    _renderGiftTray();
    Toast.show("🎁 Gift collected! Open after the vault seals.", "win", 3000);
  }

  function _renderGiftTray() {
    const tray = el("paer-gift-tray"); if (!tray) return;
    if (_gifts.length === 0) { cls.add(tray, "hidden"); tray.innerHTML = ""; return; }
    cls.remove(tray, "hidden");
    const isPlaying = _phase === "play" || _phase === "renewing" || _phase === "preview";
    tray.innerHTML = `
      <span class="pgt-label"><i class="bi bi-gift-fill"></i> GIFTS</span>
      <div class="pgt-boxes" id="pgt-boxes"></div>`;
    const boxes = el("pgt-boxes");
    _gifts.forEach(g => {
      const box = document.createElement("button");
      box.className  = "pgt-box" + (g.opened ? " opened" : " sealed");
      box.dataset.id = g.id;
      box.disabled   = g.opened || isPlaying;
      box.innerHTML  = g.opened
        ? `<span>🎁</span><span class="pgt-val">🪙${g.coins}</span>`
        : `<span>🎁</span><span class="pgt-val">${isPlaying ? "⏳" : "TAP!"}</span>`;
      box.addEventListener("click", () => _openGift(g.id));
      boxes.appendChild(box);
    });
  }

  function _openGift(id) {
    if (_phase === "play" || _phase === "renewing" || _phase === "preview") {
      Toast.show("Open gifts after the vault seals!", "info", 2000);
      return;
    }
    const gift = _gifts.find(g => g.id === id);
    if (!gift || gift.opened) return;
    gift.opened = true;
    Coins.add(gift.coins);
    _refreshCoins();
    Toast.show(`🎁 Gift opened — +${gift.coins} coins!`, "win", 3500);
    _renderGiftTray();
  }

  // ── Earn popup ─────────────────────────────────────
  function _showPopup(text, cls_) {
    const wrap = el("paer-popup-layer"); if (!wrap) return;
    const popup = document.createElement("div");
    popup.className = `paer-earn-popup ${cls_}`;
    popup.textContent = text;
    wrap.appendChild(popup);
    setTimeout(() => popup.remove(), 1300);
  }

  // ── Time up ────────────────────────────────────────
// ── Time up ────────────────────────────────────────
  function _timeUp() {
  if (_phase === "done") return;
  _stopTimer();
  PaerMusic.stop();
  _phase = "done";
  _freezeSec = 0;
  _starSec = 0;
  _starMulti = 1;
  _setFrostOverlay(false);
  _renderPowerBar();

    _tiles.forEach(t => { t.revealed = true; });
    _renderGrid(false);
    _renderGiftTray();

    if (State.user && State.userData) {
      const newBest = Math.max(State.userData.bestWin || 0, _bank);
      State.userData.bestWin = newBest;
      DB.updateUser(State.user.uid, { bestWin: newBest }).catch(() => {});
    }

    _showResultModal();
    Toast.show(`Vault sealed! Bank: ₱${fmt.coins(_bank)}`, "info", 3500);
  }

  // ── Result modal ───────────────────────────────────
function _showResultModal() {
    const modal = el("paer-result-modal"); if (!modal) return;
    const giftCount  = _gifts.filter(g => !g.opened).length;
    const nextCost   = _currentCost(); // already recorded this play, so this IS next cost
    const canAfford  = Coins.get() >= nextCost;

    el("prm-bank").textContent  = `₱${fmt.coins(_bank)}`;
    el("prm-wave").textContent  = `Wave ${_wave + 1}`;

    const giftNote = el("prm-gift-note");
    if (giftNote) {
      giftNote.innerHTML = giftCount > 0
        ? `<i class="bi bi-gift-fill"></i> <strong>${giftCount}</strong> gift${giftCount > 1 ? "s" : ""} waiting — close and tap them above!`
        : "";
      giftNote.className = giftCount > 0 ? "prm-gift-note visible" : "prm-gift-note";
    }

    // Update Play Again button with next cost
    const againBtn = el("btn-prm-again");
    if (againBtn) {
      if (canAfford) {
        againBtn.disabled = false;
        againBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> PLAY AGAIN — <i class="bi bi-coin"></i> ${fmt.coins(nextCost)}`;
      } else {
        againBtn.disabled = true;
        againBtn.innerHTML = `<i class="bi bi-coin"></i> Need ${fmt.coins(nextCost)} coins`;
      }
    }

    // Show cost reset note
    const resetNote = el("prm-reset-note");
    if (resetNote) {
      resetNote.innerHTML = `<i class="bi bi-clock"></i> Cost resets to <strong>${fmt.coins(PAER_COST_BASE)} coins</strong> tomorrow`;
    }

    cls.remove(modal, "hidden");
    requestAnimationFrame(() => requestAnimationFrame(() => cls.add(modal, "visible")));
  }
  
  function _closeResultModal() {
    const modal = el("paer-result-modal"); if (!modal) return;
    cls.remove(modal, "visible");
    modal.addEventListener("transitionend", () => {
      if (!cls.has(modal, "visible")) cls.add(modal, "hidden");
    }, { once: true });
  }

  // ── Game start sequence ────────────────────────────
  async function _startGame() {
    const cost = _currentCost();
    if (Coins.get() < cost) { Toast.show(`Need ${fmt.coins(cost)} coins!`, "loss"); return; }
    const btn = el("btn-paer-start");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> OPENING…`; }

    await Coins.deduct(cost);
    await _recordPlay();
    _refreshCoins();

    _wave   = 0;
    _gifts  = [];
    _giftId = 0;
    _freezeSec = 0;
    _starSec   = 0;
    _orbActive = false;
    _tiles  = _buildTiles(0);
    _phase  = "preview";

    cls.add(el("paer-start-wrap"),    "hidden");
    cls.remove(el("paer-grid-wrap"),  "hidden");
    cls.remove(el("paer-timer-wrap"), "hidden");
    cls.remove(el("paer-power-bar"),  "hidden");
    _renderGiftTray();
    _renderPowerBar();
    _setStatus(`<div class="paer-phase-badge preview-badge"><i class="bi bi-eye-fill"></i> MEMORISE THE VAULT</div>`);

    // Reveal all for PAER_REVEAL_MS
    _renderGrid(false);
    const gridEl = el("paer-grid");
    if (gridEl) {
      _tiles.forEach(t => {
        const def = TILE_DEFS[t.typeIdx];
        const b   = gridEl.querySelector(`[data-id="${t.id}"]`);
        if (b) {
          b.className = `paer-tile revealed ${def.cls}`;
          b.innerHTML = `<span class="paer-tile-emoji">${def.emoji}</span>${_tileSubLabel(def)}`;
          b.disabled  = true;
        }
      });
    }

    await sleep(PAER_REVEAL_MS);

    // Flip all back + shuffle
    _tiles.forEach(t => { t.revealed = false; });
    _renderGrid(false);
    _setStatus(`<div class="paer-phase-badge shuffle-badge"><i class="bi bi-arrow-repeat"></i> SHUFFLING…</div>`);
    cls.add(el("paer-grid"), "shuffling");

    await sleep(PAER_SHUFFLE_MS);

    const idxArr = _tiles.map(t => t.typeIdx);
    for (let i = idxArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxArr[i], idxArr[j]] = [idxArr[j], idxArr[i]];
    }
    _tiles.forEach((t, i) => { t.typeIdx = idxArr[i]; });
    cls.remove(el("paer-grid"), "shuffling");

    await sleep(300);

    _phase = "play";
_renderGrid(true);
_setStatus(`<div class="paer-phase-badge play-badge"><i class="bi bi-hand-index-fill"></i> WAVE 1 — TAP TILES!</div>`);
_startTimer();
HomeMusic.stop();
PaerMusic.play();

    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<i class="bi bi-lightning-charge-fill"></i> ENTER VAULT — <i class="bi bi-coin"></i> 5`;
    }
  }

  // ── Reset to idle ──────────────────────────────────
function _resetToIdle() {
  _stopTimer();
  _phase = "idle";
  _wave = 0;
  _tiles = [];
  _gifts = [];
  _giftId = 0;
  _freezeSec = 0;
  _starSec = 0;
  _starMulti = 1;
  _orbActive = false;
  _setFrostOverlay(false);
  _closeResultModal();
  cls.remove(el("paer-start-wrap"), "hidden");
  cls.add(el("paer-grid-wrap"), "hidden");
  cls.add(el("paer-timer-wrap"), "hidden");
  cls.add(el("paer-power-bar"), "hidden");
  _setStatus("");
  _refreshCoins();
  _refreshBank();
  _renderGiftTray();
  _renderPowerBar();
  _refreshStartBtn();
}

function _refreshStartBtn() {
  const cost = _currentCost();
  const canAfford = Coins.get() >= cost;
  const btn = el("btn-paer-start");
  if (!btn) return;
  btn.disabled = !canAfford;
  btn.innerHTML = canAfford ?
    `<i class="bi bi-lightning-charge-fill"></i> ENTER VAULT — <i class="bi bi-coin"></i> ${fmt.coins(cost)}` :
    `<i class="bi bi-coin"></i> Need ${fmt.coins(cost)} coins`;
}
  // ── Cash out ───────────────────────────────────────
  function _cashout(needed, coinsGained) {
    if (_bank < needed) return;
    _bank -= needed;
    _refreshBank();
    Coins.add(coinsGained);
    _refreshCoins();
    Toast.show(`+${coinsGained} coins from vault bank!`, "win", 3000);
  }

  // ── How-to modal ───────────────────────────────────
  function _showHowTo() {
    const m = el("paer-howto-modal"); if (!m) return;
    cls.remove(m, "hidden");
    requestAnimationFrame(() => requestAnimationFrame(() => cls.add(m, "visible")));
  }
  function _closeHowTo() {
    const m = el("paer-howto-modal"); if (!m) return;
    cls.remove(m, "visible");
    m.addEventListener("transitionend", () => {
      if (!cls.has(m, "visible")) cls.add(m, "hidden");
    }, { once: true });
  }

  // ── Cash-out accordion ─────────────────────────────
  function _initAccordion() {
    const toggle = el("btn-paer-cashout-toggle");
    const body   = el("paer-cashout-body");
    const chev   = el("pca-chevron");
    if (!toggle || !body) return;
    const fresh = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(fresh, toggle);
    fresh.addEventListener("click", () => {
      const open = !cls.has(body, "hidden");
      cls.toggle(body, "hidden", open);
      fresh.setAttribute("aria-expanded", String(!open));
      if (chev) chev.style.transform = open ? "" : "rotate(180deg)";
    });
  }

  // ── Open overlay ───────────────────────────────────
  function open() {
  cls.remove(el("overlay-paer"), "hidden");
  _bank = 0;
  _gifts = [];
  _giftId = 0;
  _freezeSec = 0;
  _starSec = 0;
  _starMulti = 1;
  _orbActive = false;
  _resetToIdle();
  _initAccordion();
  if (!el("paer-popup-layer")) {
    const lay = document.createElement("div");
    lay.id = "paer-popup-layer";
    lay.className = "paer-popup-layer";
    el("overlay-paer")?.appendChild(lay);
  }
  _showHowTo();
  HistoryManager.push("paer");
  }

  // ── Boot init ──────────────────────────────────────
  function init() {
    el("open-paer")?.addEventListener("click", open);
    el("back-paer")?.addEventListener("click", () => {
      _stopTimer();
      PaerMusic.stop();
      cls.add(el("overlay-paer"), "hidden");
      HomeMusic.play();
      const m = el("paer-howto-modal");
      if (m) { cls.remove(m, "visible"); cls.add(m, "hidden"); }
      const r = el("paer-result-modal");
      if (r) { cls.remove(r, "visible"); cls.add(r, "hidden"); }
      HistoryManager.pop();
    });
    el("btn-paer-start")?.addEventListener("click", _startGame);
    el("btn-paer-mute")?.addEventListener("click", () => _toggleMute(PaerMusic, "paer-mute-icon"));
el("btn-paer-howto")?.addEventListener("click", _showHowTo);
    el("btn-paer-howto-close")?.addEventListener("click", _closeHowTo);
    el("paer-howto-modal")?.addEventListener("click", e => {
      if (e.target.id === "paer-howto-modal") _closeHowTo();
    });
    el("btn-prm-close")?.addEventListener("click", _closeResultModal);
    el("btn-prm-again")?.addEventListener("click", () => { _closeResultModal(); setTimeout(_resetToIdle, 320); });
    el("btn-prm-close-bottom")?.addEventListener("click", _closeResultModal);
    el("paer-result-modal")?.addEventListener("click", e => {
      if (e.target.id === "paer-result-modal") _closeResultModal();
    });
  }

  function closeFromBack() {
    _stopTimer();
    PaerMusic.stop();
    cls.add(el("overlay-paer"), "hidden");
    HomeMusic.play();
    const m = el("paer-howto-modal");
    if (m) { cls.remove(m, "visible"); cls.add(m, "hidden"); }
    const r = el("paer-result-modal");
    if (r) { cls.remove(r, "visible"); cls.add(r, "hidden"); }
  }

  return { init, open, closeFromBack };;
})();

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
    dailyClaim: () => {
      try {
        const c = ctx();
        // Ascending fanfare — 4 bright notes
        [[523.3,0],[659.3,0.12],[783.9,0.24],[1046.5,0.38]].forEach(([f,delay]) => {
          setTimeout(() => {
            const o=c.createOscillator(), g=c.createGain();
            o.type="sine"; o.frequency.value=f; g.gain.value=.22;
            o.connect(g); g.connect(c.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+.45);
            o.stop(c.currentTime+.5);
          }, delay * 1000);
        });
        // Coin shimmer underneath
        setTimeout(() => {
          const o=c.createOscillator(), g=c.createGain();
          o.type="triangle"; o.frequency.value=1800; g.gain.value=.10;
          o.connect(g); g.connect(c.destination); o.start();
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+.6);
          o.stop(c.currentTime+.65);
        }, 500);
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
    WeeklyUpdates.render();
    Router.init();
    Router.go("home");
    HomeMusic.play();
    Screens.splashOut(() => {
      cls.remove($("screen-signin"),"active");
      cls.remove($("app"),"hidden");
    });
  },
  onSignedOut() {
    State.user = State.userData = null;
    Daily.stop();
    HomeMusic.stop();
    ProfilePage.reset();
    DashPage.reset();
    Cache.clear();
    cls.add($("overlay-fruit"),   "hidden");
    cls.add($("overlay-lucky"),   "hidden");
    cls.add($("overlay-capture"), "hidden");
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
function _toggleMute(player, iconId) {
  const icon = $(iconId);
  if (player.isPlaying()) {
    player.stop();
    if (icon) icon.style.opacity = "0.35";
  } else {
    player.play();
    if (icon) icon.style.opacity = "1";
  }
}

const boot = () => {
  Screens.show("screen-splash");
  HistoryManager.init();
  AuthScreen.init();
  DashPage.bindTabs();
  ProfilePage.init();
  FruitGame.init();
  LuckyGame.init();
  CaptureGame.init();
  PaerGame.init();
  TradinPlaza.init();
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

/**
 * rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }

    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }

    match /spins/{spinId} {
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow read: if request.auth != null
                  && resource.data.uid == request.auth.uid;
    }

    match /captures/{captureId} {
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow read: if request.auth != null;
    }

    match /trades/{tradeId} {
      // Anyone logged in can read all open listings
      allow read: if request.auth != null;

      // Only the seller can create a listing (sellerId must match their uid)
      allow create: if request.auth != null
                    && request.resource.data.sellerId == request.auth.uid;

      // Only the buyer can mark it as sold (status → "sold", buyerId must match)
      allow update: if request.auth != null
                    && resource.data.status == "open"
                    && request.resource.data.status == "sold"
                    && request.resource.data.buyerId == request.auth.uid;

      // No deletes
      allow delete: if false;
    }

  }
}
 */
