-- AlterTable
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya`
ADD COLUMN `tecnicoArthurId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `solicitacoes_pre_projeto_arthur_saboya_tecnicoArthurId_idx` ON `solicitacoes_pre_projeto_arthur_saboya`(`tecnicoArthurId`);

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya`
ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_tecnicoArthurId_fkey`
FOREIGN KEY (`tecnicoArthurId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
