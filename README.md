# inscribetick.com — $TICK website

A static website: HTML, CSS and one JavaScript file. No server, no database, no third-party scripts.

```
public/            ← the folder that goes live
  index.html
  styles.css
  config.js        ← the ONLY file you need to edit
  app.js           ← built from src/ (do not edit directly)
  _headers         ← security rules for Cloudflare
  TICK_Whitepaper.pdf
  assets/          ← artwork, X preview image, favicons, fonts
src/               ← source code for app.js
```

## How it works

- **While `tickMint` in `config.js` is empty:** the site runs in *coming soon* mode. The hero counter ticks and the mint button is disabled.
- **Once `tickMint` holds the TickMint address:** the site reads the contract automatically: countdown to the mint, live progress, price in HYPE, all three contract addresses, wallet connection, minting 1–10 inscribes, a *Build the pool* button after the mint ends, and a refund button if the safety net ever opens.

---

## First-time setup (GitHub + Cloudflare Pages)

### 1. Secure your accounts first (required)
Anyone who takes over one of these accounts can replace the mint page with a fake one. Turn on **2FA with an authenticator app** for:
- your GitHub account,
- your Cloudflare account,
- the registrar account where you bought inscribetick.com (also turn on *domain lock*),
- the email address used for all of the above.

### 2. Upload to GitHub
1. Create an account at github.com.
2. Click **New repository** → name: `inscribetick-website` → choose **Public** (so anyone can inspect the code) → **Create repository**.
3. On the repository page, click **uploading an existing file**.
4. Unzip this package and drag the **contents** of the `tick-website` folder (`public`, `src`, `tools`, `package.json`, `package-lock.json`, `README.md`, `.gitignore`) onto the page.
5. Click **Commit changes**.

### 3. Connect Cloudflare Pages
1. Create an account at dash.cloudflare.com.
2. Open **Workers & Pages** → **Create application**. On that screen, look for the small link for **Pages** (it reads roughly "Looking to deploy Pages? Get started").
3. Choose **Import an existing Git repository** → connect your GitHub account → select `inscribetick-website` → **Begin setup**.
4. Build settings:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `exit 0`
   - Build output directory: `public`
5. **Save and Deploy.** Within a minute the site is live on a temporary `….pages.dev` address. Open it and check it.

### 4. Connect inscribetick.com
1. In the Cloudflare dashboard: **Add a domain** → `inscribetick.com` → choose the **Free** plan.
2. Cloudflare gives you **two nameservers**. In your registrar account, replace the domain's nameservers with those two and save.
3. Wait until Cloudflare shows the domain as **Active** (usually minutes, at most 24 hours).
4. Back in the Pages project → **Custom domains** → **Set up a custom domain** → `inscribetick.com`. Repeat for `www.inscribetick.com`. Cloudflare creates the DNS records and HTTPS certificate automatically.

Done: inscribetick.com is live in *coming soon* mode.

---

## After the contracts are deployed

On GitHub, open `public/config.js` → click the pencil icon (Edit) → fill in:

```js
tickMint: "0xTICKMINT_ADDRESS",
rpcUrl: "https://YOUR-ALCHEMY-RPC-URL",   // recommended for mint day
explorerUrl: "https://EXPLORER-URL",      // once the official explorer is live
xHandle: "yourXhandle",
```

Click **Commit changes**. Cloudflare deploys the new version automatically in about a minute. Only `tickMint` is required; the TickToken and TickLocker addresses are read from the contract.

> Double-check the TickMint address before committing. A wrong address means people send HYPE to the wrong contract.

## Changing code in `src/`

Requires Node.js on your computer:

```bash
npm install
npm run build      # regenerates public/app.js
```

Then upload the new `public/app.js` to GitHub.

## Notes

- Supported wallets: any browser wallet (Rabby, MetaMask, OKX, etc.) and the built-in browser of mobile wallet apps. WalletConnect (scanning a QR code from a phone on desktop) is not included yet; it can be added later with a WalletConnect project ID.
- Mint open/close times on the site follow the visitor's device clock, but the contract always enforces the real rules.
- Fonts (Anton, IBM Plex) are under the SIL Open Font License; the licenses are in `public/assets/fonts/`.
