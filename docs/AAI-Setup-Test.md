# Bill reading — console setup (TEST project only)

Project: **splitease-test-2026**. Do not touch splitease-7bb6c (live) — that happens at release, with your yes.
Open everything in the Claude app's built-in browser. You type your own Google password.

## 1 · reCAPTCHA key — now "Google Cloud Fraud Defense" (≈3 min)
reCAPTCHA Classic (v3) is deprecated, so we use its replacement, **Fraud Defense** (= reCAPTCHA Enterprise).
Free up to 10,000 checks a month, **no billing needed**, and **no secret key** at all.
1. Go to **console.cloud.google.com/security/fraud-defense** (or search "Fraud Defense" in the top bar).
2. Top bar project picker → **splitease-test-2026**. If asked, click **Enable** for the reCAPTCHA Enterprise API.
3. **Create key** (may say *Create key* / *Keys → + Create*):
   - Display name: `SplitEase test web`
   - Platform: **Website** (Web)
   - Domains: `localhost`, `splitease-test-2026.web.app`, `splitease-test-2026.firebaseapp.com`
   - Leave "Use checkbox challenge" **off**, leave WAF / Express **off**.
   - Create.
4. Copy the **Key ID** (starts with `6L…`) and paste it to me in chat — it's public.
   (If you see your earlier key `6LfaO9…` already listed there, you can reuse it instead of making a new one — just tell me.)

## 2 · Firebase AI Logic — done ✓
You already switched it on. The per-user rate limit setting doesn't exist there any more — skip it.

## 3 · Turn on App Check (≈2 min)
1. **console.firebase.google.com** → **splitease-test-2026** → left menu **App Check** (under *Security*). Click **Get started** if shown.
2. **Apps** tab → your web app → choose **reCAPTCHA Enterprise** (not "reCAPTCHA") → paste the **Key ID** from step 1 → **Save**.
3. Same row → **⋮** menu → **Manage debug tokens** → **Add debug token**:
   - Name: `Mac localhost`
   - Value: open `test-data/appcheck-debug-token.txt`, copy the one line, paste → **Save**.
   - (git-ignored; I'll delete the file after.)
4. **APIs** tab → **Firebase AI Logic** → **Enforce** → confirm.
   - Leave **Cloud Firestore** as **Unenforced**. Don't touch it.

## 4 · Tell me
Say "done" (plus the Key ID if it's a new one). Screenshot anything that looks different and I'll guide you.
