-- Execute no banco SMUL_agendamentos para habilitar a importação Outlook.
-- Ex.: mysql -u root -p SMUL_agendamentos < prisma/apply-outlook-columns.sql
-- Ou execute cada bloco no seu cliente MySQL (HeidiSQL, DBeaver, etc.).
-- Se aparecer "Duplicate column" ou "Duplicate key", ignore esse bloco e siga.

-- 1) Colunas na tabela agendamentos
ALTER TABLE `agendamentos`
  ADD COLUMN `importadoOutlook` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `tecnicoResponsavelPlanilha` VARCHAR(255) NULL;

-- 2) Tabela de log da importação Outlook (se ainda não existir)
CREATE TABLE IF NOT EXISTS `log_importacao_outlook` (
  `id` VARCHAR(191) NOT NULL,
  `dataHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `total` INTEGER NOT NULL DEFAULT 0,
  `usuarioId` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Chave estrangeira (ignore erro se já existir)
ALTER TABLE `log_importacao_outlook`
  ADD CONSTRAINT `log_importacao_outlook_usuarioId_fkey`
  FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
