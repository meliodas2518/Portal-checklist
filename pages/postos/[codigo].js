// pages/postos/[codigo].js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { requireAuth } from "../../lib/authGuard";
import { auth, db } from "../../lib/firebaseClient";
import { signOut } from "firebase/auth";

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export default function PostoPage() {
  const router = useRouter();
  const { codigo } = router.query;

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [ok, setOk] = useState(false);

  const [posto, setPosto] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  // permissão
  useEffect(() => {
    if (!user || !codigo) return;

    (async () => {
      const usnap = await getDoc(doc(db, "usuarios", user.uid));
      if (!usnap.exists()) {
        alert("Usuário sem perfil no Firestore.");
        router.replace("/login");
        return;
      }

      const u = usnap.data();
      setRole(u.rolePortal || null);

      if (u.rolePortal === "super_admin") {
        setOk(true);
        return;
      }

      const permitidos = Array.isArray(u.postosPermitidos) ? u.postosPermitidos : [];
      const allowed = permitidos.map(String).includes(String(codigo));
      if (!allowed) {
        alert("Você não tem acesso a este posto.");
        router.replace("/");
        return;
      }

      setOk(true);
    })();
  }, [user, codigo, router]);

  // carrega posto + runs
  useEffect(() => {
    if (!ok || !codigo) return;

    (async () => {
      setLoading(true);

      const psnap = await getDoc(doc(db, "postos", String(codigo)));
      if (psnap.exists()) setPosto({ id: psnap.id, ...psnap.data() });

      const qy = query(
        collection(db, "postos", String(codigo), "checklists"),
        orderBy("finalizadoEm", "desc")
      );

      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRuns(list);

      setLoading(false);
    })();
  }, [ok, codigo]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const titulo = useMemo(() => {
    if (!posto) return `Posto ${codigo || ""}`;
    return posto.nome || posto.nomePosto || `Posto ${codigo}`;
  }, [posto, codigo]);

  return (
    <div className="container">
      {/* Header igual padrão */}
      <div className="topbar">
        <div>
          <h1 className="h1" style={{ margin: 0 }}>{titulo}</h1>
          <div className="sub">
            Código: <b>{codigo}</b> • <b>{role || "sem rolePortal"}</b>
          </div>
        </div>

        <div className="topActions">
          <button className="btn2" onClick={() => router.push("/")}>⬅ Voltar</button>
          <button className="btn btnRed" onClick={sair}>Sair</button>
        </div>
      </div>

      <div className="card cardPad">
        {loading ? (
          <p className="helper">Carregando...</p>
        ) : runs.length === 0 ? (
          <p className="helper">Nenhum checklist encontrado.</p>
        ) : (
          <div className="grid">
            {runs.map((r) => {
              const fim = toDate(r.finalizadoEm);
              const ini = toDate(r.iniciadoEm);

              const href = `/postos/${encodeURIComponent(String(codigo))}/checklists/${encodeURIComponent(String(r.id))}`;

              return (
                <Link key={r.id} href={href} className="postCard">
                  <div className="postCardTitle">
                    {r.tipo === "diario" ? "📋 Diário" : "📅 Mensal"} • {r.data || "—"}
                  </div>

                  <div className="postCardSub">
                    Início: {ini ? ini.toLocaleString("pt-BR") : "—"} <br />
                    Final: {fim ? fim.toLocaleString("pt-BR") : "—"}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <span className="pill">{r.usuario || "—"}</span>
                  </div>

                  <div className="postCardHint">Abrir checklist →</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}