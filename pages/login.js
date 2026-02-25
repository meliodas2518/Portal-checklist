// pages/login.js
import { useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.replace("/");
    } catch (e) {
      alert(e?.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrap">
      <div className="card authCard">
        <h1 className="authTitle">Portal de Checklists</h1>
        <p className="authSubtitle">Entre com o mesmo usuário do app.</p>

        <div className="authForm">
          <label className="label">E-mail</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label className="label">Senha</label>
          <input
            className="input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />

          <button className="btn btnBlue" onClick={entrar} disabled={loading} style={{ width: "100%", marginTop: 14 }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
