// pages/login.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebaseClient";
import { linkSuporteWhatsapp } from "../lib/support";

function mensagemDeErro(erro) {
  const codigo = erro?.code || "";
  switch (codigo) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou senha inválidos.";
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifique sua internet.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoNaoAutorizado, setAvisoNaoAutorizado] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.motivo === "nao_autorizado") {
      setAvisoNaoAutorizado(true);
    }
  }, [router.isReady, router.query]);

  const entrar = async () => {
    setErro("");
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.replace("/");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setLoading(false);
    }
  };

  const abrirWhatsapp = () => {
    window.open(linkSuporteWhatsapp("Olá, preciso de ajuda para acessar o portal."), "_blank");
  };

  return (
    <div className="authWrap">
      <div className="card authCard">
        <h1 className="authTitle">Portal de Checklists</h1>
        <p className="authSubtitle">Entre com o mesmo usuário do app.</p>

        {avisoNaoAutorizado && (
          <div className="avisoNaoAutorizado">
            Usuário não autorizado. Contate o suporte.
          </div>
        )}

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
            onKeyDown={(e) => e.key === "Enter" && entrar()}
          />

          {erro && <div className="erroLogin">{erro}</div>}

          <button className="btn btnBlue" onClick={entrar} disabled={loading} style={{ width: "100%", marginTop: 14 }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button className="botaoSuporte" onClick={abrirWhatsapp}>
            💬 Falar com o suporte no WhatsApp
          </button>

          <button
            type="button"
            className="botaoCriarConta"
            onClick={() => router.push("/criar-conta")}
          >
            Não tem conta? Criar conta
          </button>
        </div>
      </div>

      <style jsx>{`
        .botaoCriarConta {
          width: 100%;
          margin-top: 10px;
          background: transparent;
          color: #93c5fd;
          border: 1px solid rgba(147, 197, 253, 0.4);
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }
        .botaoCriarConta:hover {
          background: rgba(147, 197, 253, 0.08);
        }
        .avisoNaoAutorizado {
          background: #4a1414;
          border: 1px solid #c62828;
          color: #ffcdd2;
          padding: 12px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .erroLogin {
          color: #ff6b6b;
          font-size: 14px;
          margin-top: 10px;
        }
        .botaoSuporte {
          width: 100%;
          margin-top: 12px;
          background: #1fae5a;
          color: #fff;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
        }
        .botaoSuporte:hover {
          background: #17954b;
        }
      `}</style>
    </div>
  );
}