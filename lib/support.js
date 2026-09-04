// lib/support.js

// troque pelo número real do suporte, com DDI+DDD, só dígitos
export const NUMERO_SUPORTE = "5577988516266";

export function linkSuporteWhatsapp(mensagem = "Olá, preciso de ajuda com o portal.") {
  return `https://wa.me/${NUMERO_SUPORTE}?text=${encodeURIComponent(mensagem)}`;
}