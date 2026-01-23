import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateMotivoDto {
  @ApiProperty({ description: 'Texto do motivo' })
  @MinLength(3, { message: 'Texto deve ter ao menos 3 caracteres.' })
  @IsString({ message: 'Texto deve ser texto.' })
  texto: string;

  @ApiProperty({ description: 'Status do motivo' })
  @IsBoolean({ message: 'Status inválido!' })
  @IsOptional()
  status?: boolean;
}
