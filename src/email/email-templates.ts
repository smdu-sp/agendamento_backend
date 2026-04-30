export type EventoEmailTipo =
  | 'cadastro'
  | 'novo-chamado'
  | 'nova-mensagem'
  | 'agendamento-confirmado'
  | 'tecnico-atribuido'
  | 'cancelamento'
  | 'redefinicao-senha';

const CORES_EVENTO: Record<EventoEmailTipo, string> = {
  'cadastro': '#16A34A',
  'novo-chamado': '#0A3299',
  'nova-mensagem': '#D97706',
  'agendamento-confirmado': '#EA580C',
  'tecnico-atribuido': '#4F46E5',
  'cancelamento': '#DC2626',
  'redefinicao-senha': '#4B5563',
};

interface ListaItem {
  label: string;
  valor: string;
}

interface BotaoCta {
  texto: string;
  url: string;
}

export interface BuildEmailOptions {
  evento: EventoEmailTipo;
  titulo: string;
  saudacao: string;
  paragrafos: string[];
  lista?: ListaItem[];
  botao?: BotaoCta;
}

export function buildEmailHtml(opts: BuildEmailOptions): string {
  const cor = CORES_EVENTO[opts.evento];

  const listaHtml = opts.lista?.length
    ? `<ul style="padding:0 0 0 20px;margin:16px 0;">
        ${opts.lista
          .map(
            (item) =>
              `<li style="margin-bottom:6px;color:#374151;font-size:15px;">
                <strong>${item.label}:</strong> ${item.valor}
              </li>`,
          )
          .join('')}
      </ul>`
    : '';

  const botaoHtml = opts.botao
    ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${opts.botao.url}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:12px 28px;background:${cor};color:#ffffff;
                  text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
          ${opts.botao.texto}
        </a>
      </div>`
    : '';

  const paragrafosHtml = opts.paragrafos
    .map((p) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;">${p}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#0A3299;padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:0.3px;">
                Portal de Agendamentos
              </p>
              <p style="margin:4px 0 0;color:#93C5FD;font-size:12px;">
                SMUL — Prefeitura de São Paulo
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:${cor};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 20px;color:#111827;font-size:20px;font-weight:bold;">
                ${opts.titulo}
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">${opts.saudacao}</p>
              ${paragrafosHtml}
              ${listaHtml}
              ${botaoHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E4E4E7;">
              <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;">
                Este é um e-mail automático. Por favor, não responda a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
