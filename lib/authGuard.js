// lib/authGuard.js
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebaseClient";

/**
 * Garante que o usuário está logado E autorizado (campo "autorizado" no
 * Firestore != false). Escuta em tempo real: se o admin revogar o acesso
 * enquanto a pessoa está usando o portal, ela é deslogada na hora e
 * mandada pro login com uma mensagem explicando o motivo.
 */
export function requireAuth(router, setUser) {
  let unsubUserDoc = null;

  const unsubAuth = onAuthStateChanged(auth, (u) => {
    // limpa o listener do Firestore anterior, se existir
    if (unsubUserDoc) {
      unsubUserDoc();
      unsubUserDoc = null;
    }

    if (!u) {
      router.replace("/login");
      return;
    }

    unsubUserDoc = onSnapshot(doc(db, "usuarios", u.uid), (snap) => {
      const data = snap.exists() ? snap.data() : null;

      if (!data || data.autorizado === false) {
        signOut(auth).finally(() => {
          router.replace("/login?motivo=nao_autorizado");
        });
        return;
      }

      setUser(u);
    });
  });

  // unsubscribe combinado: desliga tanto o auth listener quanto o do Firestore
  return () => {
    unsubAuth();
    if (unsubUserDoc) unsubUserDoc();
  };
}