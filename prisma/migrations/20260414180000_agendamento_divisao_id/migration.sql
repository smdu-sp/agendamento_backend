-- AlterTable
ALTER TABLE `agendamentos` ADD COLUMN `divisaoId` VARCHAR(191) NULL;

-- Preenche divisão a partir do técnico já vinculado
UPDATE `agendamentos` a
INNER JOIN `usuarios` u ON u.`id` = a.`tecnicoId`
SET a.`divisaoId` = u.`divisaoId`
WHERE a.`tecnicoId` IS NOT NULL AND u.`divisaoId` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
