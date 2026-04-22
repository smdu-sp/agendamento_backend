-- Adiciona colunas de avaliação na solicitação de pré-projeto (idempotente)
SET @db := DATABASE();

SET @sql1 := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya'
        AND COLUMN_NAME = 'avaliacaoNota') > 0,
    'SELECT 1',
    'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD COLUMN `avaliacaoNota` INTEGER NULL'
  )
);
PREPARE stmt FROM @sql1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql2 := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya'
        AND COLUMN_NAME = 'avaliacaoComentario') > 0,
    'SELECT 1',
    'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD COLUMN `avaliacaoComentario` TEXT NULL'
  )
);
PREPARE stmt FROM @sql2; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql3 := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'solicitacoes_pre_projeto_arthur_saboya'
        AND COLUMN_NAME = 'avaliacaoEm') > 0,
    'SELECT 1',
    'ALTER TABLE `solicitacoes_pre_projeto_arthur_saboya` ADD COLUMN `avaliacaoEm` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @sql3; EXECUTE stmt; DEALLOCATE PREPARE stmt;
