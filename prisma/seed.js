"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    const root = await prisma.usuario.upsert({
        where: { login: 'd927014' },
        create: {
            login: 'd927014',
            nome: 'Victor Alexander Menezes de Abreu',
            email: 'vmabreu@prefeitura.sp.gov.br',
            status: true,
            permissao: 'DEV',
        },
        update: {
            login: 'd927014',
            nome: 'Victor Alexander Menezes de Abreu',
            email: 'vmabreu@prefeitura.sp.gov.br',
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