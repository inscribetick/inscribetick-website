# inscribetick.com — $TICK website

A static website: HTML, CSS and one JavaScript file. No server, no database, no third-party scripts. Hosted on GitHub Pages and deployed automatically on every push to `main`.

```
public/            ← the folder that goes live
  index.html
  styles.css
  config.js        ← the ONLY file you need to edit
  app.js           ← built from src/ (do not edit directly)
  TICK_Whitepaper.pdf
  assets/          ← artwork, X preview image, favicons, fonts
src/               ← source code for app.js
.github/workflows/pages.yml   ← publishes public/ to GitHub Pages
```

## How it works

- **While `tickMint` in `config.js` is empty:** the site runs in *coming soon* mode. The hero counter ticks and the mint button is disabled.
- **Once `tickMint` holds the TickMint address:** the site reads the contract automatically: countdown to the mint, live progress, price in HYPE, all three contract addresses, wallet connection, minting 1–10 inscribes, a *Build the pool* button after the mint ends, and a refund button if the safety net ever opens.

Intro: every time the site is opened, a short animated intro (drawn live by `intro.js`, no video file) plays before the page, with *Skip intro* and *Enter $TICK* buttons. Links with a section anchor (e.g. `/#mint`) skip it. `assets/intro-landscape.mp4` is a recorded copy for social posts, rendered from `tools/intro.html`.

Security: the page carries its own Content-Security-Policy (scripts only from this site) and refuses to run inside a frame on another site.

---

## Going live on GitHub Pages

### 1. Secure your accounts (required)
Anyone who takes over these accounts can replace the mint page with a fake one. Turn on **2FA with an authenticator app** for:
- the GitHub account that owns this repository,
- the registrar account for inscribetick.com (also turn on *domain lock* and keep WHOIS privacy on),
- the email address used for both.

### 2. Repository visibility
GitHub Pages on a free account only publishes **public** repositories. Either:
- make this repository public: **Settings → General → Danger Zone → Change visibility → Public**, or
- keep it private with a paid GitHub plan that includes Pages for private repositories.

The website is public either way; this only controls who can see the source code.

### 3. Turn on GitHub Pages
**Settings → Pages → Build and deployment → Source: GitHub Actions.**

Then open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs on every push to `main`; use **Run workflow** to start the first deployment manually. When it finishes, the site is live at the address shown on the Settings → Pages screen.

### 4. Verify the domain (prevents domain takeover)
For an **organization**: **Organization settings → Pages → Add a domain**. For a **personal account**: **your profile Settings → Pages → Add a domain**.

Enter `inscribetick.com`. GitHub shows a **TXT record**; add it at your registrar's DNS settings, wait a few minutes, then click **Verify**.

### 5. Point inscribetick.com at GitHub Pages
At your registrar's DNS settings, remove any existing parking/forwarding records for the root domain and `www`, then add:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | `OWNER.github.io` (the account that owns this repo, no repository name) |

### 6. Connect the domain in the repository
**Settings → Pages → Custom domain → `inscribetick.com` → Save.** Once the DNS check passes (minutes to a few hours), tick **Enforce HTTPS**.

With a GitHub Actions workflow, no `CNAME` file is needed in the repository; the custom domain lives in the Pages settings.

---

## Free-claim list (500 × 50,000 TICK)

Before the final deployment:

1. Put the selected winners in a text file, one per line (each line must contain one `0x…` address; handles or links on the same line are ignored).
2. Build the list:
   ```bash
   node tools/build-claims.mjs winners.txt
   ```
   This writes `public/claims.json` and prints the claim root. Duplicates, lines without an address and mistyped addresses (bad checksum) are reported and skipped. Maximum 500 wallets.
3. Commit `public/claims.json`. The deploy console (Final mode) reads it and puts its root into the contract. After deployment the list can never change.

The site rebuilds the Merkle tree in the visitor's browser and only enables claiming if it matches the root stored in the contract.

## After the contracts are deployed

Edit `public/config.js`:

```js
tickMint: "0xTICKMINT_ADDRESS",
rpcUrl: "https://YOUR-ALCHEMY-RPC-URL",   // recommended for mint day
explorerUrl: "https://EXPLORER-URL",      // once the official explorer is live
xHandle: "yourXhandle",
```

Commit to `main`. The workflow redeploys in about a minute. Only `tickMint` is required; the TickToken and TickLocker addresses are read from the contract.

> Double-check the TickMint address before committing. A wrong address means people send HYPE to the wrong contract.

## Changing code in `src/`

Requires Node.js:

```bash
npm install
npm run build      # regenerates public/app.js
```

Commit the new `public/app.js` together with your `src/` changes.

## Notes

- Supported wallets: any browser wallet (Rabby, MetaMask, OKX, etc.) and the built-in browser of mobile wallet apps. WalletConnect (scanning a QR code from a phone on desktop) is not included yet; it can be added later with a WalletConnect project ID.
- Mint open/close times on the site follow the visitor's device clock, but the contract always enforces the real rules.
- GitHub Pages has no built-in DDoS protection beyond GitHub's own network. If needed later, a CDN such as Cloudflare can be placed in front of the domain without moving the hosting.
- Fonts (Anton, IBM Plex) are under the SIL Open Font License; the licenses are in `public/assets/fonts/`.
