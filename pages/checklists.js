// pages/checklists.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { collection, getDocs, doc, getDoc, onSnapshot, query, where, documentId } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

export default function Checklists() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [autorizado, setAutorizado] = useState(null); // null = ainda checando

  const [postos, setPostos] = useState([]);
  const [postosPermitidos, setPostosPermitidos] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  // verifica em tempo real se o módulo "checklist" está liberado pra esse usuário
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "usuarios", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setAutorizado(false);
        return;
      }
      const data = snap.data();
      const liberado = data?.rolePortal === "super_admin" || data?.modulos?.checklist === true;
      setAutorizado(liberado);
      if (!liberado) {
        alert("Você não tem acesso ao módulo de Checklist.");
        router.replace("/");
      }
    });
    return () => unsub();
  }, [user, router]);

  useEffect(() => {
    if (!user || autorizado !== true) return;

    (async () => {
      try {
        setLoading(true);

        // 1) Perfil do usuário
        const usnap = await getDoc(doc(db, "usuarios", user.uid));
        const data = usnap.exists() ? usnap.data() : {};
        const rolePortal = data?.rolePortal || null;

        setRole(rolePortal);

        const permitidos = Array.isArray(data?.postosPermitidos)
          ? data.postosPermitidos.map(String)
          : [];

        setPostosPermitidos(permitidos);

        // 2) Lista postos permitidos
        let list = [];

        if (rolePortal === "super_admin") {
          const snap = await getDocs(collection(db, "postos"));
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } else {
          const chunks = [];
          for (let i = 0; i < permitidos.length; i += 10) chunks.push(permitidos.slice(i, i + 10));

          for (const part of chunks) {
            const qy = query(collection(db, "postos"), where(documentId(), "in", part));
            const snap = await getDocs(qy);
            list.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        }

        if (rolePortal !== "super_admin") {
          list = list.filter((p) => {
            const codigo = String(p.codigoPosto || p.id);
            return permitidos.includes(codigo);
          });
        }

        list.sort((a, b) =>
          String(a.codigoPosto || a.id).localeCompare(String(b.codigoPosto || b.id))
        );

        setPostos(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, autorizado]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const userLabel = useMemo(() => {
    if (!user?.email) return "—";
    return `${user.email} • ${role ? role : "—"}`;
  }, [user, role]);

  if (autorizado !== true) {
    return (
      <div className="container">
        <div className="card cardPad">
          <p className="helper">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="pageTitle">
        <div>
          <h1 className="h1">Postos</h1>
          <div className="sub">{userLabel}</div>
        </div>

        <div className="topActions">
          <button className="btn2" onClick={() => router.push("/")}>⬅ Voltar</button>
          <button className="btn btnRed" onClick={sair}>⎋ Sair</button>
        </div>
      </div>

      <div className="card cardPad">
        {loading ? (
          <div className="row">
            <span className="badge">
              <span className="dot" /> Carregando postos...
            </span>
          </div>
        ) : postos.length === 0 ? (
          <div className="toast warn">
            Nenhum posto disponível para este usuário.
            {role !== "super_admin" ? (
              <div style={{ marginTop: 6 }} className="muted">
                Peça ao super_admin liberar algum código em <b>postosPermitidos</b>.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="cardsGrid">
            {postos.map((p) => {
              const codigo = String(p.codigoPosto || p.id);
              const nome = p.nome || p.nomePosto || "Sem nome";

              return (
                <Link key={codigo} href={`/postos/${encodeURIComponent(codigo)}`} className="postCard">
                  <div className="postCardTitle">{nome}</div>
                  <div className="postCardSub">Código: {codigo}</div>
                  <div className="postCardHint">Abrir checklists →</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}