-- CreateTable
CREATE TABLE `apoio_tecnico_unidade_rede` (
    `id` VARCHAR(191) NOT NULL,
    `loginRede` VARCHAR(191) NOT NULL,
    `siglaUnidade` VARCHAR(191) NOT NULL,
    `divisaoId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `apoio_tecnico_unidade_rede_loginRede_key`(`loginRede`),
    INDEX `apoio_tecnico_unidade_rede_siglaUnidade_idx`(`siglaUnidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `apoio_tecnico_unidade_rede` ADD CONSTRAINT `apoio_tecnico_unidade_rede_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
