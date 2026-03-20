-- CreateTable
CREATE TABLE `divisoes` (
    `id` VARCHAR(191) NOT NULL,
    `sigla` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `coordenadoriaId` VARCHAR(191) NULL,

    UNIQUE INDEX `divisoes_sigla_key`(`sigla`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: adiciona divisaoId em usuarios
ALTER TABLE `usuarios` ADD COLUMN `divisaoId` VARCHAR(191) NULL;

-- Migrar dados existentes: atribui divisaoId com base no coordenadoriaId atual (se existir)
-- (A divisao correspondente não existe ainda; isso apenas preserva a referência caso seja necessário migrar manualmente)

-- RemoveColumn: remove coordenadoriaId de usuarios
ALTER TABLE `usuarios` DROP FOREIGN KEY IF EXISTS `usuarios_coordenadoriaId_fkey`;
ALTER TABLE `usuarios` DROP COLUMN `coordenadoriaId`;

-- AddForeignKey
ALTER TABLE `divisoes` ADD CONSTRAINT `divisoes_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
