-- CreateTable
CREATE TABLE `solicitacoes_pre_projeto_arthur_saboya` (
    `id` VARCHAR(191) NOT NULL,
    `protocolo` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `formacaoValor` VARCHAR(191) NOT NULL,
    `formacaoOutro` VARCHAR(191) NULL,
    `formacaoTexto` VARCHAR(255) NOT NULL,
    `naturezaValor` VARCHAR(191) NOT NULL,
    `naturezaOutro` VARCHAR(191) NULL,
    `naturezaTexto` VARCHAR(500) NOT NULL,
    `duvida` TEXT NOT NULL,
    `coordenadoriaId` VARCHAR(191) NULL,
    `divisaoId` VARCHAR(191) NULL,

    UNIQUE INDEX `solicitacoes_pre_projeto_arthur_saboya_protocolo_key`(`protocolo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_coordenadoriaId_fkey` FOREIGN KEY (`coordenadoriaId`) REFERENCES `coordenadorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `solicitacoes_pre_projeto_arthur_saboya_divisaoId_fkey` FOREIGN KEY (`divisaoId`) REFERENCES `divisoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
