// pages/index.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [modulos, setModulos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const usnap = await getDoc(doc(db, "usuarios", user.uid));
        const data = usnap.exists() ? usnap.data() : {};
        setRole(data?.rolePortal || null);
        setModulos(data?.modulos || {});
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const userLabel = useMemo(() => {
    if (!user?.email) return "—";
    return `${user.email} • ${role ? role : "—"}`;
  }, [user, role]);

  // super_admin sempre enxerga tudo, mesmo sem os campos de módulo setados
  const podeChecklist = role === "super_admin" || modulos?.checklist === true;
  const podeAnalise = role === "super_admin" || modulos?.analise === true;

  return (
    <div className="container">
      <div className="pageTitle">
        <div>
          <h1 className="h1">Postos</h1>
          <div className="sub">{userLabel}</div>
        </div>

        <div className="topActions">
          <button className="btn btnRed" onClick={sair}>⎋ Sair</button>
        </div>
      </div>

      <div className="card cardPad">
        {loading ? (
          <div className="row">
            <span className="badge">
              <span className="dot" /> Carregando...
            </span>
          </div>
        ) : (
          <div className="cardsGrid">
            {podeChecklist && (
              <Link href="/checklists" className="postCard">
                <div className="postCardTitle">📋 Checklist</div>
                <div className="postCardSub">Ver checklists preenchidos por posto</div>
                <div className="postCardHint">Abrir →</div>
              </Link>
            )}

            {podeAnalise && (
              <Link href="/analise-combustivel" className="postCard">
                <div className="postCardTitle">⛽ Análise de Combustível</div>
                <div className="postCardSub">Calculadora de conformidade</div>
                <div className="postCardHint">Abrir →</div>
              </Link>
            )}

            {role === "super_admin" && (
              <Link href="/admin" className="postCard">
                <div className="postCardTitle">⚙️ Admin</div>
                <div className="postCardSub">Gerenciar usuários e postos</div>
                <div className="postCardHint">Abrir →</div>
              </Link>
            )}

            {!podeChecklist && !podeAnalise && role !== "super_admin" && (
              <div className="toast warn">
                Nenhum módulo liberado para este usuário. Peça ao administrador
                para habilitar em <b>modulos.checklist</b> / <b>modulos.analise</b>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}