import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTipoAgendamentoDto {
  @ApiProperty({ description: 'Texto do tipo de agendamento' })
  @MinLength(2, { message: 'Texto deve ter ao menos 2 caracteres.' })
  @IsString({ message: 'Texto deve ser texto.' })
  texto: string;

  @ApiProperty({ description: 'Status do tipo de agendamento' })
  @IsBoolean({ message: 'Status inválido!' })
  @IsOptional()
  status?: boolean;
}
