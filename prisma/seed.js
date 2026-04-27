"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    const root = await prisma.usuario.upsert({
        where: { login: 'd927014' },
        create: {
            login: 'd854440',
            nome: 'Bruno Luiz Vieira',
            email: 'blvieira@prefeitura.sp.gov.br',
            status: true,
            permissao: 'DEV',
        },
        update: {
            login: 'd854440',
            nome: 'Bruno Luiz Vieira',
            email: 'blvieira@prefeitura.sp.gov.br',
            status: true,
            permissao: 'DEV',
        },
    });
    console.log(root);
    const senhaPortaria = bcryptjs_1.hashSync('Portari@SB', 10);
    const portaria = await prisma.usuario.upsert({
        where: { login: 'Portaria' },
        create: {
            login: 'Portaria',
            nome: 'Portaria',
            email: 'portaria@agendamento.local',
            status: true,
            permissao: 'PORTARIA',
            senha: senhaPortaria,
        },
        update: {
            nome: 'Portaria',
            email: 'portaria@agendamento.local',
            status: true,
            permissao: 'PORTARIA',
            senha: senhaPortaria,
        },
    });
    console.log(portaria);
    await seedEstrutura();
    await seedArthurSaboyaCoordCapUsuarioTeste();
}

async function seedEstrutura() {
    const siglas = [
      'GAB/SMUL',
      'ATAJ',
      'ATECC',
      'RESID',
      'RESID/DRVE',
      'RESID/DRGP',
      'RESID/DRH',
      'COMIN',
      'COMIN/DCIMP',
      'COMIN/DCIGP',
      'SERVIN',
      'SERVIN/DSIMP',
      'SERVIN/DSIGP',
      'PARHIS',
      'PARHIS/DHGP',
      'PARHIS/DHMP',
      'PARHIS/DPS',
      'PARHIS/DHPP',
      'CONTRU',
      'CONTRU/DACESS',
      'CONTRU/DSUS',
      'CONTRU/DLR',
      'CONTRU/DINS',
      'CASE',
      'CASE/DCAD',
      'CASE/DLE',
      'CASE/DDU',
      'CAP',
      'PLANURB',
      'PLANURB/DOT',
      'PLANURB/DMA',
      'PLANURB/DART',
      'DEUSO',
      'DEUSO/DMUS',
      'DEUSO/DNUS',
      'DEUSO/DSIZ',
      'GEOINFO',
      'GEOINFO/DSIG',
      'GEOINFO/DAG',
      'GEOINFO/DAD',
      'CEPEUC',
      'CEPEUC/DVF',
      'ILUME',
      'GTEC',
      'CAEPP',
      'CAEPP/DERPP',
      'CAEPP/DECPP',
      'CAEPP/DESPP',
      'COSH',
    ];

    const coordenadoriasMap = new Map();

    for (const sigla of siglas) {
        let coordenadoriaSigla;
        let divisaoSigla;

        if (sigla.includes("/")) {
            const [coord] = sigla.split("/");
            coordenadoriaSigla = coord;
            divisaoSigla = sigla;
        } else {
            coordenadoriaSigla = sigla;
            divisaoSigla = `${sigla}/G`;
        }

        if (!coordenadoriasMap.has(coordenadoriaSigla)) {
            const coord = await prisma.coordenadoria.upsert({
                where: { sigla: coordenadoriaSigla },
                create: { sigla: coordenadoriaSigla },
                update: {},
            });
            coordenadoriasMap.set(coordenadoriaSigla, coord);
        }

        const coordenadoria = coordenadoriasMap.get(coordenadoriaSigla);

        await prisma.divisao.upsert({
            where: { sigla: divisaoSigla },
            create: {
                sigla: divisaoSigla,
                coordenadoriaId: coordenadoria.id,
            },
            update: {
                coordenadoriaId: coordenadoria.id,
            },
        });
    }
}

/** Mesmo UUID usado em `DIVISAO_ID_PRE_PROJETOS` no `.env` quando não definido no ambiente. */
const DIVISAO_ARTHUR_SABOYA_ID_PADRAO =
    "bd1faee4-8a4c-4259-847a-fc73d7d36bea";

/**
 * Coordenadoria CAP, divisão Sala Arthur Saboya (ligada ao CAP) e usuário de teste (login teste / teste01).
 */
async function seedArthurSaboyaCoordCapUsuarioTeste() {
    const coordCap = await prisma.coordenadoria.upsert({
        where: { sigla: "CAP" },
        create: {
            sigla: "CAP",
            nome: "Coordenadoria de Apoio ao Planejamento",
            email: "cap@agendamento.local",
            status: true,
        },
        update: {
            nome: "Coordenadoria de Apoio ao Planejamento",
            email: "cap@agendamento.local",
            status: true,
        },
    });
    console.log("Coordenadoria CAP:", coordCap.sigla, coordCap.id);

    const divisaoArthurId = (
        process.env.DIVISAO_ID_PRE_PROJETOS || DIVISAO_ARTHUR_SABOYA_ID_PADRAO
    ).trim();

    const divisaoArthur = await prisma.divisao.upsert({
        where: { sigla: "ARTHUR_SABOYA" },
        create: {
            id: divisaoArthurId,
            sigla: "ARTHUR_SABOYA",
            nome: "Sala Arthur Saboya",
            coordenadoriaId: coordCap.id,
            status: true,
        },
        update: {
            nome: "Sala Arthur Saboya",
            coordenadoriaId: coordCap.id,
            status: true,
        },
    });
    console.log("Divisão Arthur Saboya:", divisaoArthur.sigla, divisaoArthur.id);

    const senhaTeste = bcryptjs_1.hashSync("teste01", 10);
    const usuarioTeste = await prisma.usuario.upsert({
        where: { login: "teste" },
        create: {
            login: "teste",
            nome: "Usuário de teste",
            email: "teste@agendamento.local",
            senha: senhaTeste,
            permissao: "PONTO_FOCAL",
            status: true,
            divisaoId: divisaoArthur.id,
        },
        update: {
            nome: "Usuário de teste",
            email: "teste@agendamento.local",
            senha: senhaTeste,
            permissao: "PONTO_FOCAL",
            status: true,
            divisaoId: divisaoArthur.id,
        },
    });
    console.log("Usuário de teste:", usuarioTeste.login, "(senha: teste01)");
}

main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map