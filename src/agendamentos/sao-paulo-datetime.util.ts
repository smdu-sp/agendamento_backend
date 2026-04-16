/**
 * Converte data/hora civil em Brasília (America/Sao_Paulo, UTC−3, sem horário de verão desde 2019)
 * para um `Date` com o instante UTC correto em JavaScript.
 */
export function instanteCivilSaoPaulo(
  ano: number,
  mesIndex0: number,
  dia: number,
  hora: number,
  minuto: number,
  segundo: number,
): Date {
  return new Date(
    Date.UTC(ano, mesIndex0, dia, hora + 3, minuto, segundo),
  );
}
