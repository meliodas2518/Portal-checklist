// pages/admin.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

export default function Admin() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [ok, setOk] = useState(false);

  const [uid, setUid] = useState("");
  const [rolePortal, setRolePortal] = useState("admin");
  const [postos, setPostos] = useState(""); // "2883,4067,5473"
  const [loading, setLoading] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const usnap = await getDoc(doc(db, "usuarios", user.uid));
      const role = usnap.exists() ? usnap.data()?.rolePortal : null;

      if (role !== "super_admin") {
        alert("Somente super_admin.");
        router.replace("/");
        return;
      }
      setOk(true);
    })();
  }, [user, router]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const salvar = async () => {
    if (loading) return;

    try {
      setLoading(true);

      if (!BACKEND_URL) {
        throw new Error(
          "NEXT_PUBLIC_BACKEND_URL não configurado no .env (portal)."
        );
      }

      if (!uid.trim()) {
        alert("Informe o UID");
        return;
      }

      if (!auth.currentUser) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const lista = postos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const token = await auth.currentUser.getIdToken(true);

      const payload = {
        targetUid: uid.trim(),
        rolePortal,
        postosPermitidos: rolePortal === "super_admin" ? [] : lista,
      };

      const resp = await fetch(`${BACKEND_URL}/portal/set-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // nem todo erro vem como JSON
      let json = null;
      try {
        json = await resp.json();
      } catch {}

      if (!resp.ok) {
        throw new Error(json?.error || `Falha ao salvar (${resp.status})`);
      }

      alert("Acesso atualizado ✅");
    } catch (e) {
      alert(e?.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  if (!ok) return <div className="container"><p>Carregando...</p></div>;

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Admin do Portal</h2>
          <small className="muted">{user?.email}</small>
        </div>
        <div className="row">
          <button className="btn2" onClick={() => router.push("/")}>
            Voltar
          </button>
          <button className="btn" onClick={sair}>
            Sair
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <p className="muted">
          Aqui você define <b>rolePortal</b> e <b>postosPermitidos</b> em{" "}
          <code>usuarios/{"{uid}"}</code>.
        </p>

        <label className="label">UID do usuário (documento em usuarios)</label>
        <input
          className="input"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
        />

        <label className="label">Role</label>
        <select
          className="input"
          value={rolePortal}
          onChange={(e) => setRolePortal(e.target.value)}
        >
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>

        <label className="label">
          Postos permitidos (somente admin) — separados por vírgula
        </label>
        <input
          className="input"
          placeholder="2883, 4067, 5473"
          value={postos}
          onChange={(e) => setPostos(e.target.value)}
          disabled={rolePortal === "super_admin"}
        />

        <button className="btn" onClick={salvar} disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
