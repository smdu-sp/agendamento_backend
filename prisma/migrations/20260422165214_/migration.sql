-- DropForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` DROP FOREIGN KEY `fk_spp_municipe_conta`;

-- DropForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` DROP FOREIGN KEY `fk_pp_asm_municipe`;

-- DropForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` DROP FOREIGN KEY `fk_pp_asm_solicitacao`;

-- DropForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` DROP FOREIGN KEY `fk_pp_asm_usuario`;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_municipeContaId_fkey` FOREIGN KEY (`municipeContaId`) REFERENCES `municipes_contas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_mensagens_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_mensagens_municipeCo_fkey` FOREIGN KEY (`municipeContaId`) REFERENCES `municipes_contas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_mensagens_solicitaca_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `solicitacoes_pre_projeto_arthur_saboya`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `solicitacoes_pre_projeto_arthur_saboya_mensagens_solicitacao_idx` ON `solicitacoes_pre_projeto_arthur_saboya_mensagens`(`solicitacaoId`);
DROP INDEX `idx_pp_asm_solicitacao` ON `solicitacoes_pre_projeto_arthur_saboya_mensagens`;
