-- AlterTable
ALTER TABLE `agendamentos` ADD COLUMN `importadoOutlook` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tecnicoResponsavelPlanilha` VARCHAR(255) NULL;
