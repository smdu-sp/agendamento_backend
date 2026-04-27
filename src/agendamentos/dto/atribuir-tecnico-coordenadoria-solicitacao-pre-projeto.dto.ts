import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AtribuirTecnicoCoordenadoriaSolicitacaoPreProjetoDto {
  @ApiProperty({
    description: 'ID do técnico da coordenadoria que assumirá o atendimento em dupla.',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'tecnicoId deve ser um UUID válido' })
  tecnicoId: string;
}
