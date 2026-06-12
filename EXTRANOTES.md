# 🎮 Arcade 2026 — New Game Implementation Plan

## Quick Reference Checklist
> Use this every time you add a new game. Check off each step as you complete it.

---

## 1. Codebase Pattern Analysis

### How your existing games are structured (the pattern to follow):

```
GameNameGame = {
  init()        → called once in boot(), binds buttons and builds initial UI
  open()        → called when player opens the overlay, resets state + loads history
  pull/spin()   → core game loop: deduct coins → animate → evaluate → pay out → log
  _loadHistory()     → fetches last 10–20 spins from Firestore on open
  _buildHistItem()   → returns a DOM element for one history row
  _prependHist()     → inserts a new row at the top of the history list
  _refreshCoins()    → updates the in-overlay coin display
}
```

Both `FruitGame` and `LuckyGame` follow this exact shape. Stick to it.

---

## 2. Step-by-Step Implementation Checklist

### STEP 1 — Define game constants (at the top of app.js near other constants)

```js
// Cost per play
const NEWGAME_COST = 15;  // pick a number that fits game balance

// Symbols, payouts, weights — whatever your game needs
const NEWGAME_SYMBOLS = [...];
const NEWGAME_PAYOUTS = { ... };
```

**Things to decide:**
- [ ] How much does one play cost? (balance: Fruit=5, Lucky=10)
- [ ] What are the winning conditions?
- [ ] What symbols/items exist?
- [ ] Are there weighted probabilities? (see `weightedPick()` — reuse it!)
- [ ] What's the maximum possible payout? (keep bestWin tracking in mind)

---

### STEP 2 — Add Firestore spin logging (nothing to change in DB object)

`DB.logSpin(uid, game, symbols, coinsWon, coinsCost)` already accepts any game name string.
Use `"newgame"` (or whatever you call it) as the `game` parameter — it will just work.

**Firestore indexes needed:**
- If you query by a new field, add a composite index in Firebase Console:
  `spins` collection → `uid ASC` + `game ASC` + `createdAt DESC`
  *(already exists for fruit/lucky, same index covers any game name)*

---

### STEP 3 — Add user stats fields in DB.createUser()

```js
// In DB.createUser(), add new stat fields:
const data = {
  ...existing fields...,
  totalNewGamePlays: 0,   // ← add this
};
```

Also update these locations that read/write stats:
- [ ] `DB.createUser()` — add initial value (default 0)
- [ ] Inside your game's play function — increment after each play
- [ ] `ProfilePage.refresh()` — display it in account info
- [ ] `DashPage.refresh()` — display it in the stats grid
- [ ] `Auth.onSignedIn()` / `Coins.set()` — no changes needed here

---

### STEP 4 — HTML: Add the game card to the Games page

```html
<!-- In #page-games .games-grid -->
<div class="game-select-card" id="open-newgame">
  <div class="gsc-badge newgame"><i class="bi bi-play-fill"></i> PLAY</div>
  <div class="gsc-icon">🎯</div>  <!-- pick an emoji -->
  <h3 class="gsc-name">NEW GAME NAME</h3>
  <p class="gsc-desc">Short description of the game mechanic.</p>
  <div class="gsc-cost"><i class="bi bi-coin"></i> 15 coins per play</div>
  <button class="btn-play newgame"><i class="bi bi-play-circle-fill"></i> PLAY NOW</button>
</div>
```

Also add a shortcut card to the Home page game list:
```html
<!-- In .home-game-grid -->
<div class="home-game-card" data-nav="games">
  <div class="hgc-icon">🎯</div>
  <div class="hgc-info">
    <span class="hgc-name">NEW GAME NAME</span>
    <span class="hgc-desc">One-line description</span>
  </div>
  <i class="bi bi-chevron-right hgc-arrow"></i>
</div>
```

---

### STEP 5 — HTML: Add the full-screen overlay

Copy the Lucky 777 overlay structure as your template. Key IDs to rename:

| Lucky 777 ID           | Your new game ID              |
|------------------------|-------------------------------|
| `overlay-lucky`        | `overlay-newgame`             |
| `back-lucky`           | `back-newgame`                |
| `lucky-coins-display`  | `newgame-coins-display`       |
| `btn-lucky-pull`       | `btn-newgame-play`            |
| `lucky-result`         | `newgame-result`              |
| `lucky-history`        | `newgame-history`             |

The overlay must have `class="game-overlay hidden"` at start.

---

### STEP 6 — CSS: Style the new game

Minimum CSS additions needed:

```css
/* Badge color variant */
.gsc-badge.newgame { background: var(--green); color: #000; }  /* pick a color */
.btn-play.newgame   { background: var(--green); box-shadow: 0 0 20px rgba(57,255,20,.3); }

/* Play button */
.btn-spin-newgame {
  padding: 16px 48px;
  background: var(--green);   /* or any CSS var */
  color: #000;
  border: none;
  border-radius: 50px;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all .2s;
  box-shadow: 0 0 30px rgba(57,255,20,.4);
  display: flex; align-items: center; gap: 10px;
}
.btn-spin-newgame:hover:not(:disabled) { transform: scale(1.05); filter: brightness(1.1); }
.btn-spin-newgame:disabled { opacity: .45; cursor: not-allowed; transform: none; }

/* Result display */
.newgame-result { /* copy .lucky-result styles, tweak border color */ }
```

**Reuse existing CSS variables** — don't define new colors unless necessary:
`--cyan`, `--magenta`, `--gold`, `--green` are already available.

---

### STEP 7 — JavaScript: Write the game module

```js
const NewGame = {
  init() {
    $("btn-newgame-play")?.addEventListener("click", () => this.play());
    $("back-newgame")?.addEventListener("click",     () => cls.add($("overlay-newgame"), "hidden"));
    $("open-newgame")?.addEventListener("click",     () => this.open());
    // Build any static UI here (grids, reels, etc.)
  },
  open() {
    cls.remove($("overlay-newgame"), "hidden");
    cls.add($("newgame-result"), "hidden");
    this._refreshCoins();
    this._loadHistory();
    // Reset any animated state
  },
  _refreshCoins() {
    const el = $("newgame-coins-display");
    if (el) el.textContent = fmt.coins(Coins.get());
  },
  async _loadHistory() {
    const list = $("newgame-history");
    if (!list || !State.user) return;
    try {
      const items = await DB.getSpins(State.user.uid, "newgame", 10);
      list.innerHTML = "";
      items.forEach(item => list.appendChild(this._buildHistItem(item)));
    } catch {}
  },
  _buildHistItem(item) {
    const el = document.createElement("div");
    el.className = "fh-item";   // reuse existing class!
    const won  = item.coinsWon ?? 0;
    const cost = item.coinsCost ?? NEWGAME_COST;
    const net  = won - cost;
    const date = toDate(item.createdAt);
    const isWin = net >= 0;
    el.innerHTML = `
      <span class="fh-emoji">${item.symbols || "🎯"}</span>
      <span class="fh-label">${won > 0 ? `Won ${fmt.coins(won)}` : "No win"} · 
        <i class="bi bi-clock"></i> ${date ? fmt.time(date) : "now"}</span>
      <span class="${isWin ? "fh-win" : "fh-loss"}">${isWin ? "+" : ""}${fmt.coins(net)}</span>`;
    return el;
  },
  _prependHist(symbols, coinsWon) {
    const list = $("newgame-history");
    if (!list) return;
    const el = this._buildHistItem({ symbols, coinsWon, coinsCost: NEWGAME_COST, createdAt: null });
    list.prepend(el);
    while (list.children.length > 15) list.lastChild?.remove();
  },
  async play() {
    if (State.newGamePlaying) return;           // guard flag
    if (Coins.get() < NEWGAME_COST) { Toast.show("Not enough coins!", "loss"); return; }
    State.newGamePlaying = true;

    const btn = $("btn-newgame-play");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> PLAYING…`; }
    cls.add($("newgame-result"), "hidden");

    await Coins.deduct(NEWGAME_COST);
    this._refreshCoins();

    // ── YOUR GAME LOGIC HERE ──
    const result  = /* ... */;
    const coinsWon = /* ... */;
    // ── END GAME LOGIC ──

    // Show result
    const resultEl = $("newgame-result");
    if (resultEl) {
      resultEl.innerHTML = coinsWon > 0
        ? `${result} <i class="bi bi-plus-circle-fill"></i> ${fmt.coins(coinsWon)} coins!`
        : `${result} No win. Try again!`;
      resultEl.className = "newgame-result" + (coinsWon <= 0 ? " loss" : "");
      cls.remove(resultEl, "hidden");
    }

    // Sound + Toast
    if (coinsWon > 0) { Sound.win(); Toast.show(`+${fmt.coins(coinsWon)} coins!`, "win"); }
    else              { Sound.bomb(); Toast.show("No luck this time!", "loss"); }

    // Payout
    if (coinsWon > 0) { await Coins.add(coinsWon); this._refreshCoins(); }

    // Update user stats
    const newPlays  = (State.userData.totalNewGamePlays || 0) + 1;
    const newBest   = Math.max(State.userData.bestWin || 0, coinsWon);
    State.userData.totalNewGamePlays = newPlays;
    State.userData.bestWin = newBest;
    await DB.updateUser(State.user.uid, { totalNewGamePlays: newPlays, bestWin: newBest });

    // Log to Firestore
    DB.logSpin(State.user.uid, "newgame", result, coinsWon, NEWGAME_COST).catch(() => {});
    this._prependHist(result, coinsWon);

    State.newGamePlaying = false;
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-play-fill"></i> PLAY`; }
  },
};
```

---

### STEP 8 — Wire everything into boot()

```js
// In the State object — add a guard flag:
const State = {
  ...existing...,
  newGamePlaying: false,   // ← add this
};

// In boot():
const boot = () => {
  ...existing...
  NewGame.init();   // ← add this line
};
```

---

### STEP 9 — Add to Dashboard activity tabs

In `index.html`, add a new tab button:
```html
<button class="act-tab" data-game="newgame">🎯 New Game</button>
```

The `DashPage.loadActivity()` function already handles any game name string — no JS changes needed for the activity feed.

---

### STEP 10 — Add stat display to Dashboard and Profile

**Dashboard** (`DashPage.refresh()`):
```js
if ($("stat-newgame-plays")) $("stat-newgame-plays").textContent = fmt.coins(d.totalNewGamePlays || 0);
```
Add the stat card HTML in `#page-dashboard .stat-grid`:
```html
<div class="stat-card">
  <i class="bi bi-controller stat-icon"></i>
  <span class="stat-val" id="stat-newgame-plays">0</span>
  <span class="stat-lbl">New Game Plays</span>
</div>
```

**Profile** (`ProfilePage.refresh()`):
```js
if ($("acc-newgame-plays")) $("acc-newgame-plays").textContent = fmt.coins(d.totalNewGamePlays || 0);
```
Add the row HTML in `.account-info`:
```html
<div class="account-row">
  <span class="acc-label"><i class="bi bi-controller"></i> New Game Plays</span>
  <span class="acc-val" id="acc-newgame-plays">—</span>
</div>
```

---

## 3. Existing Utilities to Reuse (Don't Reinvent)

| Utility | What it does | How to use |
|---|---|---|
| `weightedPick(items, total)` | Weighted random selection | Pass array with `.weight` field |
| `sleep(ms)` | Async delay for animations | `await sleep(500)` |
| `fmt.coins(n)` | Format numbers with commas | Display anywhere |
| `Toast.show(msg, type, ms)` | Show notification | types: `win`, `loss`, `jackpot`, `info` |
| `Sound.win/bomb/jackpot/tick/reelSpin` | Play audio cues | Call directly |
| `Coins.deduct(n)` | Safely remove coins | Returns false if insufficient |
| `Coins.add(n)` | Add coins + refresh UI | Second param `false` skips DB write |
| `DB.logSpin(uid, game, symbols, won, cost)` | Firestore logging | Use any `game` string |
| `DB.getSpins(uid, game, count)` | Fetch history | Use same `game` string |
| `cls.add/remove/toggle/has` | DOM class helpers | Safer than classList direct |
| `toDate(v)` | Normalize Firestore timestamps | Always use this, never `new Date(v)` directly |

---

## 4. Game Balance Considerations

| Factor | Fruit Spin | Lucky 777 | Your new game |
|---|---|---|---|
| Cost per play | 5 | 10 | Pick: 5 / 10 / 15 / 20 |
| Minimum payout | 1 | 5 | ≥ 1 if win |
| Max payout | 100 | 500 | Scale with cost |
| House edge | ~15% | ~20% | Aim for 10–25% |
| Play speed | ~4s | ~2.2s | — |

**Simple house edge formula:**
```
Edge = 1 - (sum of all symbol_payout × symbol_probability)
```
Test it in a spreadsheet before coding.

---

## 5. Common Pitfalls to Avoid

- ❌ **Don't forget the spinning guard flag** (`State.newGamePlaying`) — without it, rapid clicks will double-deduct coins
- ❌ **Don't call `DB.updateUser` inside a loop** — batch all stat changes into one `updateDoc` call
- ❌ **Don't skip `await Coins.deduct()`** — always check the return value (false = insufficient funds)
- ❌ **Don't hardcode coin values in multiple places** — define one constant at the top
- ❌ **Don't forget `cls.add(overlay, "hidden")` on sign-out** — add it to `Auth.onSignedOut()`
- ❌ **Don't forget mobile sizing** — test at 375px width, add `@media (max-width: 400px)` overrides if needed
- ✅ **Always add `role="dialog"` and `aria-label` to new overlays** (accessibility)
- ✅ **Always add `role="status"` and `aria-live="polite"` to result elements** (screen readers)

---

## 6. Sign-Out Cleanup

In `Auth.onSignedOut()`, add:
```js
cls.add($("overlay-newgame"), "hidden");
```
This prevents the overlay staying open after logout.

---

## 7. Full File Change Summary

| File | What to add/change |
|---|---|
| `app.js` | Constants, State flag, NewGame module, boot() call, DashPage stats, ProfilePage stats, Auth.onSignedOut cleanup |
| `index.html` | Game card in #page-games, home shortcut card, full overlay markup, stat card, profile account row, activity tab |
| `style.css` | Badge color, play button style, result display style, mobile overrides |

---

## 8. Game Ideas That Fit the Architecture Well

These all work with `weightedPick()`, `DB.logSpin()`, and the existing overlay pattern:

| Game | Mechanic | Cost | Complexity |
|---|---|---|---|
| **Number Guess** | Pick 1–10, reveal random number | 8 | Low |
| **Card Draw** | Draw from a 52-card deck, beat the dealer card | 12 | Medium |
| **Coin Flip** | Double or nothing | 5 | Very low |
| **Dice Roll** | Roll 2 dice, specific combos pay out | 8 | Low |
| **Scratch Card** | Reveal 6 hidden tiles, match 3 to win | 15 | Medium |
| **Wheel Spin** | Spinning prize wheel with weighted segments | 10 | Medium |
| **Bingo** | Mark a 3×3 board, random number calls | 20 | High |

---

*Last updated: Arcade 2026 codebase — June 2026*
