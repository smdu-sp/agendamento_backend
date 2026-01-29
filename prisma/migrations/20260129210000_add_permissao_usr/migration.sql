-- Adiciona permissão USR ao enum Permissao (usuário sem permissão de ver nada)
ALTER TABLE `usuarios`
MODIFY COLUMN `permissao` ENUM(
        'DEV',
        'ADM',
        'TEC',
        'USR',
        'PONTO_FOCAL',
        'COORDENADOR',
        'PORTARIA'
    ) NOT NULL DEFAULT 'PORTARIA';