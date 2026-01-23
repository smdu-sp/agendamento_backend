import { ApiProperty } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({ description: 'Nome do usuário com ao menos 10 caracteres.' })
  @MinLength(10, { message: 'Nome tem de ter ao menos 10 caracteres.' })
  @IsString({ message: 'Tem de ser texto.' })
  nome: string;

  @ApiProperty({ description: 'Nome social com ao menos 10 caracteres.' })
  @IsOptional()
  @MinLength(10, { message: 'Nome social tem de ter ao menos 10 caracteres.' })
  @IsString({ message: 'Tem de ser texto.' })
  nomeSocial?: string;

  @ApiProperty({ description: 'Login com ao menos 7 caracteres.' })
  @IsString({ message: 'Login inválido!' })
  @MinLength(7, { message: 'Login tem de ter ao menos 7 caracteres.' })
  login: string;

  @ApiProperty({ description: 'E-mail com ao menos 7 caracteres.' })
  @IsString({ message: 'Login inválido!' })
  @IsEmail({}, { message: 'Login tem de ter ao menos 7 caracteres.' })
  email: string;

  @ApiProperty({ description: 'Enums do tipo:', enum: $Enums.Permissao })
  @IsEnum($Enums.Permissao, { message: 'Escolha uma permissão válida.' })
  permissao?: $Enums.Permissao;

  @ApiProperty({ description: 'Status do usuário' })
  @IsBoolean({ message: 'Status inválido!' })
  @IsOptional()
  status?: boolean;

  @ApiProperty({ description: 'URL para Avatar de Usuário' })
  @IsOptional()
  @IsString({ message: 'Tem de ser texto.' })
  avatar?: string;

  @ApiProperty({ description: 'ID da Coordenadoria' })
  @IsOptional()
  @IsString({ message: 'ID da coordenadoria inválido.' })
  coordenadoriaId?: string;
}
