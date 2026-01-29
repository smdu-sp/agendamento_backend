-- Execute este script no MySQL para que a opção COORDENADOR apareça no banco.
-- 1) Migra USR para PORTARIA (se existir)
UPDATE `usuarios`
SET `permissao` = 'PORTARIA'
WHERE `permissao` = 'USR';
-- 2) Atualiza o enum da coluna permissao para incluir COORDENADOR e remover USR
ALTER TABLE `usuarios`
MODIFY COLUMN `permissao` ENUM(
        'DEV',
        'ADM',
        'TEC',
        'PONTO_FOCAL',
        'COORDENADOR',
        'PORTARIA'
    ) NOT NULL DEFAULT 'PORTARIA';