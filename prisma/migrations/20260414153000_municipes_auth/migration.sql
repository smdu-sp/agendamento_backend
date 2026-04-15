-- CreateTable
CREATE TABLE `municipes_contas` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha_hash` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_login` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `municipes_contas_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `municipes_tokens_redefinicao_senha` (
    `id` VARCHAR(191) NOT NULL,
    `conta_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `utilizado_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `municipes_tokens_redefinicao_senha_conta_id_token_hash_idx`(`conta_id`, `token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `municipes_tokens_redefinicao_senha` ADD CONSTRAINT `municipes_tokens_redefinicao_senha_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `municipes_contas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
