import { PartialType } from '@nestjs/swagger';
import { CreateAgendamentoDto } from './create-agendamento.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { StatusAgendamento } from '@prisma/client';

export class UpdateAgendamentoDto extends PartialType(CreateAgendamentoDto) {
  @ApiProperty({ description: 'Status do agendamento', enum: StatusAgendamento })
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @ApiProperty({ description: 'Duração em minutos' })
  @IsOptional()
  @IsNumber()
  duracao?: number;
}
