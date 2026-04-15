-- DropIndex
DROP INDEX `agendamentos_coordenadoriaId_fkey` ON `agendamentos`;

-- DropIndex
DROP INDEX `agendamentos_divisaoId_fkey` ON `agendamentos`;

-- DropIndex
DROP INDEX `agendamentos_motivoNaoAtendimentoId_fkey` ON `agendamentos`;

-- DropIndex
DROP INDEX `agendamentos_tecnicoId_fkey` ON `agendamentos`;

-- DropIndex
DROP INDEX `agendamentos_tipoAgendamentoId_fkey` ON `agendamentos`;

-- DropIndex
DROP INDEX `divisoes_coordenadoriaId_fkey` ON `divisoes`;

-- DropIndex
DROP INDEX `log_importacao_outlook_usuarioId_fkey` ON `log_importacao_outlook`;

-- DropIndex
DROP INDEX `log_importacao_planilha_usuarioId_fkey` ON `log_importacao_planilha`;

-- DropIndex
DROP INDEX `usuarios_divisaoId_fkey` ON `usuarios`;

-- CreateTable
CREATE TABLE `solicitacoes_pre_projeto_arthur_saboya` (
    `id` VARCHAR(191) NOT NULL,
    `protocolo` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `formacaoValor` VARCHAR(191) NOT NULL,
    `formacaoOutro` VARCHAR(191) NULL,
    `formacaoTexto` VARCHAR(255) NOT NULL,
    `naturezaValor` VARCHAR(191) NOT NULL,
    `naturezaOutro` VARCHAR(191) NULL,
    `naturezaTexto` VARCHAR(500) NOT NULL,
    `duvida` TEXT NOT NULL,
    `coordenadoriaId` VARCHAR(191) NULL,
    `divisaoId` VARCHAR(191) NULL,

    UNIQUE INDEX `solicitacoes_pre_projeto_arthur_saboya_protocolo_key`(`protocolo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_tipoAgendamentoId_fkey` FOREIGN KEY (`tipoAgendamentoId`) REFERENCES `tipos_agendamento`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_motivoNaoAtendimentoId_fkey` FOREIGN KEY (`motivoNaoAtendimentoId`) REFERENCES `motivos`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `divisoes` ADD CONSTRAINT `divisoes_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_importacao_planilha` ADD CONSTRAINT `log_importacao_planilha_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_importacao_outlook` ADD CONSTRAINT `log_importacao_outlook_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `municipes_tokens_redefinicao_senha` ADD CONSTRAINT `municipes_tokens_redefinicao_senha_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `municipes_contas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
