// Google sign-in goes through Firebase Auth; our API verifies the resulting ID token. Unset keys hide the button.
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const googleConfigured = !!(cfg.apiKey && cfg.projectId);

/** Opens the Google popup and returns a Firebase ID token. Throws with code "auth/popup-closed-by-user" if dismissed. */
export async function googleIdToken(): Promise<string> {
  const { getApp, getApps, initializeApp } = await import("firebase/app");
  const { GoogleAuthProvider, getAuth, signInWithPopup } = await import("firebase/auth");
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const r = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  return r.user.getIdToken();
}
