/*
  Warnings:

  - You are about to drop the column `dataInicio` on the `agendamentos` table. All the data in the column will be lost.
  - Added the required column `dataHora` to the `agendamentos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `agendamentos` DROP COLUMN `dataInicio`,
    ADD COLUMN `dataHora` DATETIME(3) NOT NULL,
    ADD COLUMN `duracao` INTEGER NULL DEFAULT 60,
    ADD COLUMN `tecnicoRF` VARCHAR(191) NULL,
    MODIFY `dataFim` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `coordenadorias` ADD COLUMN `nome` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `coordenadoriaId` VARCHAR(191) NULL,
    MODIFY `permissao` ENUM('DEV', 'ADM', 'TEC', 'USR', 'PONTO_FOCAL') NOT NULL DEFAULT 'USR';

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
