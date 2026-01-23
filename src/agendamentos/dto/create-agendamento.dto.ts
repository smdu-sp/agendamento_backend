import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAgendamentoDto {
  @ApiProperty({ description: 'Nome do munícipe' })
  @IsOptional()
  @IsString()
  municipe?: string;

  @ApiProperty({ description: 'RG do munícipe' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiProperty({ description: 'CPF do munícipe' })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({ description: 'Número do processo' })
  @IsOptional()
  @IsString()
  processo?: string;

  @ApiProperty({ description: 'Data e hora do agendamento' })
  @IsDateString()
  dataHora: string;

  @ApiProperty({ description: 'Data e hora de fim (opcional, calculado automaticamente se não fornecido)' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiProperty({ description: 'Duração em minutos (padrão 60 minutos)' })
  @IsOptional()
  duracao?: number;

  @ApiProperty({ description: 'Resumo do agendamento' })
  @IsOptional()
  @IsString()
  resumo?: string;

  @ApiProperty({ description: 'ID do motivo' })
  @IsOptional()
  @IsString()
  motivoId?: string;

  @ApiProperty({ description: 'ID da coordenadoria' })
  @IsOptional()
  @IsString()
  coordenadoriaId?: string;

  @ApiProperty({ description: 'ID do técnico' })
  @IsOptional()
  @IsString()
  tecnicoId?: string;

  @ApiProperty({ description: 'RF do técnico da planilha' })
  @IsOptional()
  @IsString()
  tecnicoRF?: string;

  @ApiProperty({ description: 'Email do munícipe' })
  @IsOptional()
  @IsString()
  email?: string;
}
