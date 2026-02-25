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
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <small className="muted">
            Código: {codigo} • {role || "sem rolePortal"}
          </small>
        </div>
        <div className="row">
          <button className="btn2" onClick={() => router.push("/")}>Voltar</button>
          <button className="btn" onClick={sair}>Sair</button>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : runs.length === 0 ? (
        <p>Nenhum checklist encontrado.</p>
      ) : (
        <div className="grid">
          {runs.map((r) => {
            const fim = toDate(r.finalizadoEm);
            const ini = toDate(r.iniciadoEm);

            const href = `/postos/${encodeURIComponent(String(codigo))}/checklists/${encodeURIComponent(String(r.id))}`;

            return (
              <Link key={r.id} href={href} className="card cardHover" style={{ display: "block" }}>
                <div style={{ fontWeight: 900 }}>
                  {r.tipo === "diario" ? "📋 Diário" : "📅 Mensal"} • {r.data || "—"}
                </div>
                <small className="muted">
                  Início: {ini ? ini.toLocaleString("pt-BR") : "—"} <br />
                  Final: {fim ? fim.toLocaleString("pt-BR") : "—"}
                </small>
                <div style={{ marginTop: 10 }}>
                  <span className="pill">{r.usuario || "—"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
