# Champion of Champions scorecard

A small phone-first web app for Paul and Beccs to track Bastard, Switch and Rummy matches, runs and the Champion of Champions title. It runs on Firebase Hosting + Firestore on the free Spark plan.

## How it works

- **Matches** are first to N hands (N is a setting, 3 by default, stored on each match so changing it never rewrites history). A match in progress is saved after every hand, syncs live to both phones, and can sit for weeks.
- **Runs, titles and reigns are never stored.** `src/logic/replay.ts` replays the list of completed matches in order every time the data changes, so deleting a match or undoing the winning hand recalculates everything. If a deletion leaves a repeated game inside a run, that match restarts the winner's run at 1.
- **Abandoning** a match deletes it outright.
- **Dealer** rotates every hand, carrying on across matches. There is a manual switch.
- **Periods** (week, month, year) use Brisbane time (UTC+10, no daylight saving). Weeks start Monday. A match counts in the period it *finished* in.
- **Access** is one shared Firebase Auth account. The passcode is that account's password: it never appears in the code and is checked by Firebase. `firestore.rules` only lets that one account's UID read or write.

```
src/logic/     pure rules: replay, game picker, labels, stats, Brisbane periods (+ tests)
src/data/      Firestore store, plus an in-browser store for demo mode
src/ui/        React screens
firestore.rules
```

## Run it locally

```bash
npm install
npm test            # unit tests for the run/title logic
npm run demo        # try the whole app with no Firebase; passcode is demo123
```

To test against local Firebase emulators (needs Java): `npm run emulators` in one terminal, `npm run dev:emulators` in another. Create the login user in the emulator UI at http://127.0.0.1:4000/auth with email `scorecard@example.com`, then put that user's UID into a copy of the rules if you want rules enforced.

## Deploy to Firebase (first time)

You need Node.js 20 or newer on your computer and a Google account. Everything below stays on the free Spark plan; you never need to add billing.

### 1. Create the Firebase project

1. Go to https://console.firebase.google.com and click **Create a project**. You can pick your existing Google Cloud project from the list or make a new one.
2. Google Analytics is not needed; switch it off.
3. Check the plan shown at the bottom left of the console says **Spark**.

### 2. Turn on Firestore

1. **Build > Firestore Database > Create database**.
2. Location: **australia-southeast1 (Sydney)**. This can't be changed later.
3. Start in **production mode** (everything locked; our rules get deployed in step 7).

### 3. Create the shared login

1. **Build > Authentication > Get started**. Under **Sign-in method**, enable **Email/Password** (leave "Email link" off).
2. **Users > Add user**. Email: anything, e.g. `scorecard@yourdomain.com` (it never receives mail). Password: **your passcode**. Make it at least 8 characters and not a word from your life; a short passphrase like `three-jacks-wild` is good.
3. Copy the new user's **User UID** from the users list.
4. Go to **Authentication > Settings > User actions** and **untick "Enable create (sign-up)"**, then save. This stops anyone creating their own account with your public config. If your console doesn't show this option, it's OK to skip: the rules already refuse every account except yours, so this is a second lock, not the main one.

### 4. Register the web app

1. **Project settings** (gear icon) **> General > Your apps > Web (`</>`)**. Nickname: `scorecard`. Don't tick Firebase Hosting here.
2. Copy the `firebaseConfig` values it shows.

### 5. Configure the code

```bash
git clone https://github.com/mailpaulthere/scorecard.git
cd scorecard
npm install
cp .env.example .env.local
cp .firebaserc.example .firebaserc
```

- In `.env.local`, fill in `apiKey`, `authDomain`, `projectId`, `appId` from step 4 and `VITE_LOGIN_EMAIL` from step 3. (These are not secrets; Firebase web config is public by design.)
- In `.firebaserc`, replace `your-project-id` with your project ID.
- In `firestore.rules`, replace `REPLACE_WITH_SCORECARD_UID` with the UID from step 3. Commit this change; the UID isn't secret either.

### 6. Log in to the Firebase CLI

```bash
npx firebase login
```

### 7. Deploy

```bash
npm run deploy
```

This runs the tests, builds, and deploys the site and the Firestore rules. When it finishes it prints your URL, e.g. `https://your-project-id.web.app`.

### 8. Install on both phones

- **iPhone (Safari):** open the URL, tap **Share > Add to Home Screen**, then open it from the home screen and enter the passcode. Use the home screen app from then on: it's remembered there, and it has its own storage separate from Safari.
- **Android (Chrome):** open the URL, tap the menu **> Install app** (or **Add to Home screen**), open it, enter the passcode.

### Updating later

Pull or edit the code, then `npm run deploy` again. Phones pick up the new version the next time the app is opened with a connection.

## Security notes, honestly

- The passcode is only as strong as its length. Firebase slows down repeated wrong guesses, but that is not a hard lockout, so don't use a 4-digit PIN.
- Anyone holding an unlocked phone that's signed in can use the app. **Settings > Sign out** forgets the device.
- To change the passcode: Firebase console **> Authentication > Users >** (⋮) **> Reset password** is email-based, which won't work for a fake address. Instead, delete the user, add a new one with the new password, put the **new UID** in `firestore.rules`, and `npm run deploy`. Data is not lost (it isn't tied to the user). Every phone will need the new passcode.
- Recording a hand needs a connection (it's a transaction, so two phones tapping at once can't double-count a hand). With no signal, the app shows an error and you can tap again once you're back online.

## Costs

Expected cost is $0. Every app open reads every match once (roughly one read per match). The free tier allows 50,000 reads a day, so this stays free until you've played many thousands of matches. If that ever becomes a problem, older matches can be bundled into yearly documents.
