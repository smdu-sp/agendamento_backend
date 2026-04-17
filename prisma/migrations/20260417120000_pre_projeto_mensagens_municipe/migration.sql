-- Recuperação de migração parcial: coluna pode já existir; tabela pode não existir.
-- Índices/FK com nomes curtos (limite MySQL 64 caracteres).

-- 1) Coluna municipeContaId (só se ainda não existir)
SET @db := DATABASE();
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya'
        AND COLUMN_NAME = 'municipeContaId') > 0,
    'SELECT 1',
    'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD COLUMN `municipeContaId` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Tabela de mensagens
CREATE TABLE IF NOT EXISTS `solicitacoes_pre_projeto_arthur_saboya_mensagens` (
    `id` VARCHAR(191) NOT NULL,
    `solicitacaoId` VARCHAR(191) NOT NULL,
    `autor` ENUM('MUNICIPE', 'PONTO_FOCAL', 'SISTEMA') NOT NULL,
    `corpo` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuarioId` VARCHAR(191) NULL,
    `municipeContaId` VARCHAR(191) NULL,

    INDEX `idx_pp_asm_solicitacao`(`solicitacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) FK municipe na solicitação (só se não existir)
SET @fk1 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya'
    AND CONSTRAINT_NAME = 'fk_spp_municipe_conta'
);
SET @sqlfk1 := IF(@fk1 > 0, 'SELECT 1',
  'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD CONSTRAINT `fk_spp_municipe_conta` FOREIGN KEY (`municipeContaId`) REFERENCES `municipes_contas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
PREPARE stmt FROM @sqlfk1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) FKs na tabela de mensagens
SET @fk2 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya_mensagens'
    AND CONSTRAINT_NAME = 'fk_pp_asm_solicitacao'
);
SET @sqlfk2 := IF(@fk2 > 0, 'SELECT 1',
  'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `fk_pp_asm_solicitacao` FOREIGN KEY (`solicitacaoId`) REFERENCES `solicitacoes_pre_projeto_arthur_saboya`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);
PREPARE stmt FROM @sqlfk2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk3 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya_mensagens'
    AND CONSTRAINT_NAME = 'fk_pp_asm_usuario'
);
SET @sqlfk3 := IF(@fk3 > 0, 'SELECT 1',
  'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `fk_pp_asm_usuario` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
PREPARE stmt FROM @sqlfk3;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk4 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya_mensagens'
    AND CONSTRAINT_NAME = 'fk_pp_asm_municipe'
);
SET @sqlfk4 := IF(@fk4 > 0, 'SELECT 1',
  'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya_mensagens` ADD CONSTRAINT `fk_pp_asm_municipe` FOREIGN KEY (`municipeContaId`) REFERENCES `municipes_contas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
PREPARE stmt FROM @sqlfk4;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Histórico: primeira mensagem só onde ainda não há nenhuma linha para a solicitação
INSERT INTO `solicitacoes_pre_projeto_arthur_saboya_mensagens` (`id`, `solicitacaoId`, `autor`, `corpo`, `criadoEm`, `usuarioId`, `municipeContaId`)
SELECT UUID(), s.`id`, 'MUNICIPE', s.`duvida`, s.`criadoEm`, NULL, NULL
FROM `solicitacoes_pre_projeto_arthur_saboya` s
WHERE NOT EXISTS (
  SELECT 1 FROM `solicitacoes_pre_projeto_arthur_saboya_mensagens` m WHERE m.`solicitacaoId` = s.`id` LIMIT 1
);
