-- Separação: Tipo de Agendamento (ex-motivo) e Motivos de não atendimento

-- 1. Renomear tabela motivos -> tipos_agendamento
RENAME TABLE `motivos` TO `tipos_agendamento`;

-- 2. Em agendamentos: dropar FK antiga, renomear coluna motivoId -> tipoAgendamentoId, recriar FK
ALTER TABLE `agendamentos` DROP FOREIGN KEY `agendamentos_motivoId_fkey`;
ALTER TABLE `agendamentos` CHANGE COLUMN `motivoId` `tipoAgendamentoId` VARCHAR(191) NULL;
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_tipoAgendamentoId_fkey` 
  FOREIGN KEY (`tipoAgendamentoId`) REFERENCES `tipos_agendamento`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- 3. Criar tabela motivos (motivos de não atendimento)
CREATE TABLE `motivos` (
    `id` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `motivos_texto_key`(`texto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Adicionar motivoNaoAtendimentoId em agendamentos
ALTER TABLE `agendamentos` ADD COLUMN `motivoNaoAtendimentoId` VARCHAR(191) NULL;
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_motivoNaoAtendimentoId_fkey` 
  FOREIGN KEY (`motivoNaoAtendimentoId`) REFERENCES `motivos`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
