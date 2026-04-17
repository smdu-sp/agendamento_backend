import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutorMensagemPreProjetoArthurSaboya } from '@prisma/client';
import { SolicitacaoPreProjetoListItemDto } from './solicitacao-pre-projeto-paginado.dto';

export class SolicitacaoPreProjetoMensagemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AutorMensagemPreProjetoArthurSaboya })
  autor: AutorMensagemPreProjetoArthurSaboya;

  @ApiProperty()
  corpo: string;

  @ApiProperty()
  criadoEm: Date;

  @ApiPropertyOptional({
    description: 'Nome exibido (técnico/ponto focal ou munícipe, conforme o autor).',
  })
  nomeRemetente?: string | null;
}

export class SolicitacaoPreProjetoDetalheComMensagensDto extends SolicitacaoPreProjetoListItemDto {
  @ApiProperty({ type: [SolicitacaoPreProjetoMensagemDto] })
  mensagens: SolicitacaoPreProjetoMensagemDto[];
}
