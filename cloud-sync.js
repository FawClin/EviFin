// EviFin cloud adapter. Not activated until the application explicitly calls createCloudSync.
// All remote writes require Google authentication and explicit per-session enablement.
// This module does not alter the existing v6 localStorage plan.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

const config = {
  apiKey: 'AIzaSyAreNCW0mHy3wUD2cHyKUJDXHxa4p1rut4',
  authDomain: 'evifin.firebaseapp.com',
  projectId: 'evifin',
  storageBucket: 'evifin.firebasestorage.app',
  messagingSenderId: '21621986214',
  appId: '1:21621986214:web:dde2aa2a87d1638c2c7567'
};
const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const META = 'evifin_cloud_sync_baseline_v1_';
const LIMIT = 900000;
const encoder = new TextEncoder();
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');
const baselineKey = uid => META + uid;
const readBaseline = uid => {
  try { return JSON.parse(localStorage.getItem(baselineKey(uid)) || 'null'); } catch { return null; }
};
const saveBaseline = (uid, revision, hash) => localStorage.setItem(baselineKey(uid), JSON.stringify({revision, hash}));
const assertPayload = value => {
  if (typeof value !== 'string' || !value.length || encoder.encode(value).length > LIMIT) throw new Error('Invalid or oversized plan snapshot');
  JSON.parse(value);
  return value;
};
export function createCloudSync({readLocal, restoreLocal, onStatus = () => {}}) {
  if (typeof readLocal !== 'function' || typeof restoreLocal !== 'function') throw new TypeError('Local plan callbacks required');
  let user = auth.currentUser;
  let enabled = false;
  let busy = false;
  const notify = () => onStatus({signedIn: !!user, email: user?.email || null, enabled, busy});
  const unsubscribe = onAuthStateChanged(auth, next => {
    if (user?.uid !== next?.uid) enabled = false;
    user = next;
    notify();
  });
  function requireEnabled() {
    if (!user || !enabled || busy) throw new Error('Sign in and enable sync first');
    return user.uid;
  }
  async function login() {
    await signInWithPopup(auth, new GoogleAuthProvider());
    // Signing in never reads, writes, or replaces financial data.
  }
  async function logout() { enabled = false; await signOut(auth); notify(); }
  function enable() {
    if (!user) throw new Error('Sign in first');
    enabled = true; notify();
  }
  function disable() { enabled = false; notify(); }
  async function inspect() {
    const uid = requireEnabled();
    const snap = await getDocFromServer(doc(db, 'evifinPlans', uid));
    return snap.exists() ? {exists:true, revision:snap.data().revision, updatedAt:snap.data().updatedAt} : {exists:false};
  }
  async function upload({confirm, resolveConflict} = {}) {
    const uid = requireEnabled();
    const payload = assertPayload(readLocal());
    const hash = await digest(payload);
    const ref = doc(db, 'evifinPlans', uid);
    const before = await getDocFromServer(ref);
    const revision = before.exists() ? before.data().revision : 0;
    const base = readBaseline(uid);
    if (before.exists() && (!base || base.revision !== revision)) {
      // Never silently overwrite cloud data from an unrecognized or stale device.
      if (typeof resolveConflict !== 'function' || await resolveConflict({uid, email:user.email, remoteRevision:revision, knownRevision:base?.revision ?? null}) !== 'overwrite') {
        throw new Error('Cloud revision conflict: restore or explicitly resolve before upload');
      }
    }
    if (typeof confirm !== 'function' || await confirm({uid, email:user.email, revision, creates:!before.exists()}) !== true) return {cancelled:true};
    busy = true; notify();
    try {
      const result = await runTransaction(db, async tx => {
        const current = await tx.get(ref);
        if (current.exists() !== before.exists() || (current.exists() && current.data().revision !== revision)) {
          throw new Error('Cloud changed during upload; no changes written');
        }
        // Check the local snapshot has not changed in another tab during confirmation.
        if (await digest(assertPayload(readLocal())) !== hash) throw new Error('Local plan changed during upload');
        tx.set(ref, {payload, revision:revision + 1, updatedAt:serverTimestamp()});
        return revision + 1;
      });
      saveBaseline(uid, result, hash);
      return {uploaded:true, revision:result};
    } finally { busy = false; notify(); }
  }
  async function restore({confirm} = {}) {
    const uid = requireEnabled();
    const snap = await getDocFromServer(doc(db, 'evifinPlans', uid));
    if (!snap.exists()) throw new Error('No cloud snapshot for this account');
    const {payload, revision} = snap.data();
    assertPayload(payload);
    const localBefore = assertPayload(readLocal());
    const localHash = await digest(localBefore);
    if (typeof confirm !== 'function' || await confirm({uid, email:user.email, revision}) !== true) return {cancelled:true};
    if (await digest(assertPayload(readLocal())) !== localHash) throw new Error('Local plan changed during restore');
    // restoreLocal MUST validate and create a local recovery copy before replacement.
    await restoreLocal(payload);
    saveBaseline(uid, revision, await digest(payload));
    return {restored:true, revision};
  }
  function dispose() { unsubscribe(); enabled = false; }
  notify();
  return {login, logout, enable, disable, inspect, upload, restore, dispose};
}
