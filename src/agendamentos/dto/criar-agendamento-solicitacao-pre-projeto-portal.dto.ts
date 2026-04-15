import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CriarAgendamentoSolicitacaoPreProjetoPortalDto {
  @ApiProperty({ description: 'Data e hora do atendimento na coordenadoria' })
  @IsDateString()
  dataHora: string;

  @ApiProperty({ description: 'Coordenadoria de destino' })
  @IsUUID()
  coordenadoriaId: string;
}
