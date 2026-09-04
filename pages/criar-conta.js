// pages/criar-conta.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";

function gerarCodigoAleatorio() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Mesma lógica do app: tenta criar o posto com um código livre, sem fazer
// getDoc antes (as rules do Firestore bloqueiam leitura antes do perfil
// existir), então tenta setDoc e se colidir tenta outro código.
async function criarPostoComCodigoLivre(nomePosto, uid) {
  for (let tentativas = 0; tentativas < 40; tentativas++) {
    const codigo = gerarCodigoAleatorio();
    const postoRef = doc(db, "postos", String(codigo));

    try {
      await setDoc(postoRef, {
        nome: nomePosto.trim(),
        nomePosto: nomePosto.trim(),
        codigoPosto: String(codigo),
        criadoEm: serverTimestamp(),
        criadoPorUid: uid,
      });
      return String(codigo);
    } catch (e) {
      continue;
    }
  }
  throw new Error("Não foi possível gerar um código de posto livre. Tente novamente.");
}

export default function CriarConta() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [nomePosto, setNomePosto] = useState("");
  const [indicadorUid, setIndicadorUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // suporte a link de indicação: /criar-conta?indicador=UID
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.indicador) setIndicadorUid(String(router.query.indicador));
  }, [router.isReady, router.query]);

  const mensagemDeErro = (err) => {
    switch (err?.code) {
      case "auth/email-already-in-use":
        return "Este e-mail já está em uso.";
      case "auth/weak-password":
        return "Senha fraca (mínimo 6 caracteres).";
      case "auth/invalid-email":
        return "E-mail inválido.";
      default:
        return err?.message || "Falha ao criar conta.";
    }
  };

  const criarConta = async () => {
    setErro("");

    if (!email || !senha || !telefone || !nomePosto) {
      setErro("Preencha todos os campos.");
      return;
    }

    try {
      setLoading(true);

      // 1) cria no Auth
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);

      // garante o token pronto antes de escrever no Firestore
      await cred.user.getIdToken(true);

      // 2) cria o posto com código livre
      const codigoPosto = await criarPostoComCodigoLivre(nomePosto, cred.user.uid);

      // 3) cria o perfil /usuarios/{uid}
      //    -> autorizado: true (diferente do app, que nasce bloqueado
      //       aguardando aprovação manual). No portal, quem se cadastra já
      //       consegue entrar e ver o dashboard, mas os módulos (checklist e
      //       análise) só liberam depois que ele assinar um plano.
      const userRef = doc(db, "usuarios", cred.user.uid);

      const novoUsuario = {
        email: email.trim(),
        telefone: String(telefone || ""),
        nomePosto: nomePosto.trim(),
        codigoPosto: String(codigoPosto),

        plano: "pendente",
        acessosPermitidos: 1,
        autorizado: true,

        criadoEm: serverTimestamp(),
        vencimento: new Date(), // já "vencido" até ele assinar um plano

        rolePortal: "admin",
        postosPermitidos: [String(codigoPosto)],

        modulos: {
          analise: false,
          checklist: false,
        },

        trialUsado: false,
        trialAtivo: false,
        trialTipo: null,
        trialInicio: null,
        trialFim: null,
      };

      await setDoc(userRef, novoUsuario);

      // 4) indicação (opcional, se veio ?indicador=UID na URL)
      if (indicadorUid) {
        try {
          const indicRef = doc(db, "indicacoes", String(indicadorUid));
          const indicSnap = await getDoc(indicRef);

          if (!indicSnap.exists()) {
            await setDoc(indicRef, {
              uids: [cred.user.uid],
              criadoEm: serverTimestamp(),
            });
          } else {
            await updateDoc(indicRef, {
              uids: arrayUnion(cred.user.uid),
              atualizadoEm: serverTimestamp(),
            });
          }
        } catch (e) {
          console.log("indicacao falhou:", e?.message || e);
        }
      }

      // conta criada e já logada -> manda direto pro dashboard, onde vai
      // aparecer o aviso de plano vencido e o link pra assinar
      router.replace("/");
    } catch (err) {
      console.log("criarConta erro:", err);
      setErro(mensagemDeErro(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrap">
      <div className="card authCard">
        <h1 className="authTitle">Criar Conta</h1>
        <p className="authSubtitle">Crie sua conta para acessar pelo portal.</p>

        <div className="authForm">
          <label className="label">E-mail</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label className="label">Senha</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="botaoOlho"
            >
              {mostrarSenha ? "🙈" : "👁️"}
            </button>
          </div>

          <label className="label">Telefone</label>
          <input
            className="input"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
          />

          <label className="label">Nome do Posto</label>
          <input
            className="input"
            value={nomePosto}
            onChange={(e) => setNomePosto(e.target.value)}
          />

          {erro && <div className="erroLogin">{erro}</div>}

          <button
            className="btn btnBlue"
            onClick={criarConta}
            disabled={loading}
            style={{ width: "100%", marginTop: 14 }}
          >
            {loading ? "Criando..." : "Finalizar cadastro"}
          </button>

          <button
            type="button"
            className="botaoVoltarLogin"
            onClick={() => router.push("/login")}
          >
            Já tenho conta — entrar
          </button>
        </div>
      </div>

      <style jsx>{`
        .erroLogin {
          color: #ff6b6b;
          font-size: 14px;
          margin-top: 10px;
        }
        .botaoOlho {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
        }
        .botaoVoltarLogin {
          width: 100%;
          margin-top: 12px;
          background: transparent;
          color: #93c5fd;
          border: 1px solid rgba(147, 197, 253, 0.4);
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }
        .botaoVoltarLogin:hover {
          background: rgba(147, 197, 253, 0.08);
        }
      `}</style>
    </div>
  );
}