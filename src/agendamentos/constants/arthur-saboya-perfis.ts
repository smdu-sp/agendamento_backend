/** Perfis da Sala Arthur Saboya (técnico e administrador local). */

export const PERMISSOES_TECNICO_ARTHUR_SABOYA = [
  'ARTHUR_SABOYA',
  'ADM_ARTHUR_SABOYA',
] as const;

export type PermissaoTecnicoArthurSaboya =
  (typeof PERMISSOES_TECNICO_ARTHUR_SABOYA)[number];

export function isTecnicoArthurSaboya(permissao: string | undefined | null): boolean {
  if (!permissao) return false;
  return (PERMISSOES_TECNICO_ARTHUR_SABOYA as readonly string[]).includes(
    permissao,
  );
}

export function isAdmArthurSaboya(permissao: string | undefined | null): boolean {
  return permissao === 'ADM_ARTHUR_SABOYA';
}

/** Pode concluir chamados e operar como staff da sala (exceto DEV global). */
export function podeOperarComoStaffArthurSaboya(
  permissao: string | undefined | null,
): boolean {
  return isTecnicoArthurSaboya(permissao);
}

/** Pode ser selecionado como técnico de atendimento da Sala Arthur Saboya. */
export function podeSerTecnicoAtendimentoArthurSaboya(
  permissao: string | undefined | null,
): boolean {
  return isTecnicoArthurSaboya(permissao);
}

export const STATUS_QUE_PERMITEM_CONCLUSAO_CHAMADO = [
  'SOLICITADO',
  'AGUARDANDO_DATA',
  'AGENDAMENTO_CRIADO',
] as const;

export function statusPermiteConclusaoChamadoArthurSaboya(
  status: string | undefined | null,
): boolean {
  if (!status) return false;
  return (STATUS_QUE_PERMITEM_CONCLUSAO_CHAMADO as readonly string[]).includes(
    status,
  );
}

/** Quem pode marcar chamado/atendimento como solucionado (fechar ticket). */
export function podeConcluirChamadoArthurSaboya(
  permissao: string | undefined | null,
): boolean {
  return (
    podeOperarComoStaffArthurSaboya(permissao) || permissao === 'DEV'
  );
}
