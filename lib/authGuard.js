// lib/authGuard.js
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseClient";

export function requireAuth(router, setUser) {
  // retorna o unsubscribe (IMPORTANTE)
  return onAuthStateChanged(auth, (u) => {
    if (!u) router.replace("/login");
    else setUser(u);
  });
}
