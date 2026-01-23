import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCoordenadoriaDto {
  @ApiProperty({ description: 'Sigla da coordenadoria (ex: COHAB, SMUL)' })
  @MinLength(2, { message: 'Sigla deve ter ao menos 2 caracteres.' })
  @IsString({ message: 'Sigla deve ser texto.' })
  sigla: string;

  @ApiProperty({ description: 'Nome completo da coordenadoria' })
  @IsOptional()
  @IsString({ message: 'Nome deve ser texto.' })
  nome?: string;

  @ApiProperty({ description: 'Status da coordenadoria' })
  @IsBoolean({ message: 'Status inválido!' })
  @IsOptional()
  status?: boolean;
}
