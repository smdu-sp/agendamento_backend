-- CreateTable enum-like column for solicitacao status
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya`
ADD COLUMN `status` ENUM('SOLICITADO', 'RESPONDIDO', 'AGUARDANDO_DATA', 'AGENDAMENTO_CRIADO') NOT NULL DEFAULT 'SOLICITADO',
ADD COLUMN `agendamentoId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `solicitacoes_pre_projeto_arthur_saboya_agendamentoId_key` ON `solicitacoes_pre_projeto_arthur_saboya`(`agendamentoId`);

ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya`
ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_agendamentoId_fkey` FOREIGN KEY (`agendamentoId`) REFERENCES `agendamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
