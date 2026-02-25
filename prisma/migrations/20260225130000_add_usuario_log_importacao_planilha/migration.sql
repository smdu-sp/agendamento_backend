-- AlterTable
ALTER TABLE `log_importacao_planilha` ADD COLUMN `usuarioId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `log_importacao_planilha` ADD CONSTRAINT `log_importacao_planilha_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
