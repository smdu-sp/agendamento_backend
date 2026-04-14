import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PRE_PROJETO_FORMACAO_VALORES,
  PRE_PROJETO_NATUREZA_VALORES,
} from '../constants/pre-projetos-form';

const formacaoLista = [...PRE_PROJETO_FORMACAO_VALORES];
const naturezaLista = [...PRE_PROJETO_NATUREZA_VALORES];

/** Corpo JSON igual ao estado do formulário em `pre-projetos/page.tsx`. */
export class CreateAgendamentoPreProjetoDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  nome: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  @MaxLength(191)
  email: string;

  @ApiProperty({ enum: formacaoLista })
  @IsString()
  @IsIn(formacaoLista)
  formacao: string;

  @ApiPropertyOptional({
    description: 'Obrigatório quando formacao é "outra".',
  })
  @ValidateIf((o: CreateAgendamentoPreProjetoDto) => o.formacao === 'outra')
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  formacaoOutro?: string;

  @ApiProperty({ enum: naturezaLista })
  @IsString()
  @IsIn(naturezaLista)
  naturezaDuvida: string;

  @ApiPropertyOptional({
    description: 'Obrigatório quando naturezaDuvida é "outra".',
  })
  @ValidateIf(
    (o: CreateAgendamentoPreProjetoDto) => o.naturezaDuvida === 'outra',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  naturezaOutro?: string;

  @ApiProperty({ description: 'Texto da dúvida (campo descricao no front).' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  descricao: string;
}
