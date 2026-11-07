import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { addHand, newMatch, reopen, switchDealer, undoHand } from '../logic/match';
import type { CompletedMatch, LiveMatch } from '../logic/types';
import { DEFAULT_TARGET, StaleError, type AuthApi, type Snapshot, type Store } from './store';

const env = import.meta.env;

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

/**
 * The shared login. The email is not a secret (it is in the bundle); the passcode is the
 * account's password, checked by Firebase Auth and never stored in the frontend.
 */
const LOGIN_EMAIL: string = env.VITE_LOGIN_EMAIL;

const auth = getAuth(app);
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// `npm run dev:emulators` talks to local Firebase emulators instead of the real project.
if (env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const liveRef = doc(db, 'live', 'current');
const settingsRef = doc(db, 'settings', 'app');
const matchesCol = collection(db, 'matches');

export const firebaseAuth: AuthApi = {
  onChange: (cb) => onAuthStateChanged(auth, (u) => cb(!!u)),
  signIn: async (passcode) => {
    await signInWithEmailAndPassword(auth, LOGIN_EMAIL, passcode);
  },
  signOut: () => signOut(auth),
};

export const firebaseStore: Store = {
  subscribe(cb, onError) {
    const s: Snapshot = { matches: [], live: null, target: DEFAULT_TARGET, ready: false };
    const got = { m: false, l: false, t: false };
    const emit = () => cb({ ...s, ready: got.m && got.l && got.t });
    const unsubs = [
      onSnapshot(
        matchesCol,
        (q) => {
          s.matches = q.docs.map((d) => ({ ...(d.data() as Omit<CompletedMatch, 'id'>), id: d.id }));
          got.m = true;
          emit();
        },
        onError,
      ),
      onSnapshot(
        liveRef,
        (d) => {
          s.live = d.exists() ? (d.data() as LiveMatch) : null;
          got.l = true;
          emit();
        },
        onError,
      ),
      onSnapshot(
        settingsRef,
        (d) => {
          s.target = (d.exists() && (d.data().target as number)) || DEFAULT_TARGET;
          got.t = true;
          emit();
        },
        onError,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  },

  async startMatch(game, dealer) {
    await runTransaction(db, async (tx) => {
      const [live, settings] = await Promise.all([tx.get(liveRef), tx.get(settingsRef)]);
      if (live.exists()) throw new Error('A match is already in progress.');
      const target = (settings.exists() && (settings.data().target as number)) || DEFAULT_TARGET;
      tx.set(liveRef, newMatch(game, target, dealer, Date.now()));
    });
  },

  async recordHand(winner, seenHands) {
    return runTransaction(db, async (tx) => {
      const d = await tx.get(liveRef);
      if (!d.exists()) throw new StaleError();
      const live = d.data() as LiveMatch;
      if (live.hands.length !== seenHands) throw new StaleError();
      const r = addHand(live, winner, Date.now());
      if (r.completed) {
        const ref = doc(matchesCol);
        tx.set(ref, r.completed);
        tx.delete(liveRef);
        return ref.id;
      }
      tx.set(liveRef, r.live);
      return null;
    });
  },

  async undoHand(seenHands) {
    await runTransaction(db, async (tx) => {
      const d = await tx.get(liveRef);
      if (!d.exists()) throw new StaleError();
      const live = d.data() as LiveMatch;
      if (live.hands.length !== seenHands) throw new StaleError();
      tx.set(liveRef, undoHand(live));
    });
  },

  async switchDealer() {
    await runTransaction(db, async (tx) => {
      const d = await tx.get(liveRef);
      if (!d.exists()) throw new StaleError();
      tx.set(liveRef, switchDealer(d.data() as LiveMatch));
    });
  },

  async abandon() {
    await deleteDoc(liveRef);
  },

  async reopenMatch(id) {
    const ref = doc(matchesCol, id);
    await runTransaction(db, async (tx) => {
      const [live, m] = await Promise.all([tx.get(liveRef), tx.get(ref)]);
      if (live.exists()) throw new Error('Another match has already started.');
      if (!m.exists()) throw new Error('That match no longer exists.');
      tx.set(liveRef, reopen({ ...(m.data() as Omit<CompletedMatch, 'id'>), id }));
      tx.delete(ref);
    });
  },

  async deleteMatch(id) {
    await deleteDoc(doc(matchesCol, id));
  },

  async setTarget(n) {
    await setDoc(settingsRef, { target: n }, { merge: true });
  },
};
