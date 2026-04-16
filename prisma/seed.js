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