import { PartialType } from '@nestjs/swagger';
import { CreateTipoAgendamentoDto } from './create-tipo-agendamento.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTipoAgendamentoDto extends PartialType(CreateTipoAgendamentoDto) {
  @ApiProperty({ description: 'Texto do tipo de agendamento' })
  @MinLength(2, { message: 'Texto deve ter ao menos 2 caracteres.' })
  @IsOptional()
  @IsString()
  texto?: string;

  @ApiProperty({ description: 'Status do tipo de agendamento' })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
