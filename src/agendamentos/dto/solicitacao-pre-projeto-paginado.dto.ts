import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusSolicitacaoPreProjeto } from '@prisma/client';

export class SolicitacaoPreProjetoListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  protocolo: string;

  @ApiProperty()
  criadoEm: Date;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  formacaoValor: string;

  @ApiPropertyOptional()
  formacaoOutro?: string | null;

  @ApiProperty()
  formacaoTexto: string;

  @ApiProperty()
  naturezaValor: string;

  @ApiPropertyOptional()
  naturezaOutro?: string | null;

  @ApiProperty()
  naturezaTexto: string;

  @ApiProperty()
  duvida: string;

  @ApiProperty({ enum: StatusSolicitacaoPreProjeto })
  status: StatusSolicitacaoPreProjeto;

  @ApiPropertyOptional()
  agendamentoId?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  avaliacaoNota?: number | null;

  @ApiPropertyOptional()
  avaliacaoComentario?: string | null;

  @ApiPropertyOptional()
  avaliacaoEm?: Date | null;

  @ApiPropertyOptional()
  dataAgendamento?: Date | null;

  /** E-mail da coordenadoria vinculada à divisão (ou da solicitação), para resposta institucional. */
  @ApiPropertyOptional()
  emailContatoDivisao?: string | null;

  @ApiPropertyOptional()
  coordenadoriaId?: string | null;

  @ApiPropertyOptional()
  divisaoId?: string | null;

  /** Rótulo para exibição: sigla e nome da coordenadoria da solicitação ou da divisão. */
  @ApiPropertyOptional()
  coordenadoriaTexto?: string | null;
}

export class SolicitacaoPreProjetoPaginadoDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  @ApiProperty({ type: [SolicitacaoPreProjetoListItemDto] })
  data: SolicitacaoPreProjetoListItemDto[];
}
