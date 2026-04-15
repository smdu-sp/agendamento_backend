-- RemoveColumn: campos exclusivos do fluxo pré-projetos (Arthur Saboya), agora em solicitacoes_pre_projeto_arthur_saboya
ALTER TABLE `agendamentos`
DROP COLUMN `formacao`,
DROP COLUMN `naturezaDuvida`,
DROP COLUMN `duvida`;
