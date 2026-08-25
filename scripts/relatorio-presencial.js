/**
 * Relatório: agendamentos de atendimento presencial (jan-jul/2026) por coordenadoria,
 * separados por processo físico e eletrônico.
 *
 * Uso:
 *   1) Abra o túnel SSH (em outro terminal, deixe rodando):
 *        ssh -N -L 3306:127.0.0.1:3306 smul@10.20.29.4
 *   2) Rode este script de dentro de agendamento_backend:
 *        node ..\..\..\AppData\Local\Temp\claude\...\relatorio-presencial.js
 *      (ou copie o arquivo para agendamento_backend/scripts/ e rode `node scripts/relatorio-presencial.js`)
 */
const { PrismaClient } = require('@prisma/client');

// Senha "102Mir@030" -> "@" precisa virar %40 para a URL não quebrar.
const PROD_URL = 'mysql://sel:102Mir%40030@127.0.0.1:3306/SMUL_agendamentos';

const prisma = new PrismaClient({ datasources: { db: { url: PROD_URL } } });

const DATA_INICIO = '2026-01-01 00:00:00';
const DATA_FIM = '2026-07-31 23:59:59';
const REGEX_DIGITAL = '^[0-9]{4}[.][0-9]{4}/[0-9]{7}-[0-9]$';

async function main() {
  // 1) Confere qual(is) tipo(s) de agendamento contam como "presencial"
  const tipos = await prisma.$queryRawUnsafe(`
    SELECT id, texto FROM tipos_agendamento WHERE texto LIKE '%presencial%'
  `);
  console.log('Tipos de agendamento considerados "presencial":', tipos);
  if (!tipos.length) {
    console.error('Nenhum tipo com "presencial" no texto. Ajuste o filtro manualmente.');
    process.exit(1);
  }

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      COALESCE(c.nome, c.sigla, 'Sem coordenadoria') AS coordenadoria,
      SUM(CASE WHEN a.processo IS NOT NULL AND TRIM(a.processo) REGEXP ? THEN 1 ELSE 0 END) AS eletronicos,
      SUM(CASE WHEN a.processo IS NULL OR TRIM(a.processo) NOT REGEXP ? THEN 1 ELSE 0 END) AS fisicos,
      COUNT(*) AS total
    FROM agendamentos a
    JOIN tipos_agendamento ta ON ta.id = a.tipoAgendamentoId
    LEFT JOIN coordenadorias c ON c.id = a.coordenadoriaId
    WHERE ta.texto LIKE '%presencial%'
      AND a.dataHora BETWEEN ? AND ?
    GROUP BY coordenadoria
    ORDER BY total DESC
    `,
    REGEX_DIGITAL,
    REGEX_DIGITAL,
    DATA_INICIO,
    DATA_FIM,
  );

  console.table(rows);

  const csv = [
    'Coordenadoria;Eletronicos;Fisicos;Total',
    ...rows.map((r) => `${r.coordenadoria};${r.eletronicos};${r.fisicos};${r.total}`),
  ].join('\n');
  require('fs').writeFileSync('relatorio-presencial.csv', csv, 'utf8');
  console.log('\nCSV salvo em relatorio-presencial.csv (abra no Excel).');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
