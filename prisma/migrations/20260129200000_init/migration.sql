-- CreateTable
CREATE TABLE `coordenadorias` (
    `id` VARCHAR(191) NOT NULL,
    `sigla` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `coordenadorias_sigla_key`(`sigla`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(255) NULL,
    `permissao` ENUM(
        'DEV',
        'ADM',
        'TEC',
        'PONTO_FOCAL',
        'COORDENADOR',
        'PORTARIA'
    ) NOT NULL DEFAULT 'PORTARIA',
    `status` BOOLEAN NOT NULL DEFAULT true,
    `avatar` TEXT NULL,
    `ultimoLogin` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nomeSocial` VARCHAR(191) NULL,
    `coordenadoriaId` VARCHAR(191) NULL,
    UNIQUE INDEX `usuarios_login_key`(`login`),
    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `tipos_agendamento` (
    `id` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `tipos_agendamento_texto_key`(`texto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `motivos` (
    `id` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `motivos_texto_key`(`texto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `agendamentos` (
    `id` VARCHAR(191) NOT NULL,
    `municipe` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `processo` VARCHAR(191) NULL,
    `dataHora` DATETIME(3) NOT NULL,
    `dataFim` DATETIME(3) NULL,
    `importado` BOOLEAN NOT NULL DEFAULT false,
    `resumo` TEXT NULL,
    `tipoAgendamentoId` VARCHAR(191) NULL,
    `motivoNaoAtendimentoId` VARCHAR(191) NULL,
    `coordenadoriaId` VARCHAR(191) NULL,
    `tecnicoId` VARCHAR(191) NULL,
    `tecnicoRF` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `status` ENUM(
        'SOLICITADO',
        'AGENDADO',
        'CANCELADO',
        'CONCLUIDO',
        'ATENDIDO',
        'NAO_REALIZADO'
    ) NOT NULL DEFAULT 'SOLICITADO',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `usuarios`
ADD CONSTRAINT `usuarios_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE
SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `agendamentos`
ADD CONSTRAINT `agendamentos_tipoAgendamentoId_fkey` FOREIGN KEY (`tipoAgendamentoId`) REFERENCES `tipos_agendamento`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `agendamentos`
ADD CONSTRAINT `agendamentos_motivoNaoAtendimentoId_fkey` FOREIGN KEY (`motivoNaoAtendimentoId`) REFERENCES `motivos`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `agendamentos`
ADD CONSTRAINT `agendamentos_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `agendamentos`
ADD CONSTRAINT `agendamentos_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;