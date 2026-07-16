-- Garante ADM_ARTHUR_SABOYA no ENUM (corrige ambientes em que a migration
-- 20260706120000 ficou marcada como aplicada sem alterar a coluna).
ALTER TABLE `usuarios` MODIFY COLUMN `permissao` ENUM('DEV','ADM','TEC','ARTHUR_SABOYA','ADM_ARTHUR_SABOYA','USR','PONTO_FOCAL','COORDENADOR','PORTARIA','DIRETOR') NOT NULL DEFAULT 'PORTARIA';
