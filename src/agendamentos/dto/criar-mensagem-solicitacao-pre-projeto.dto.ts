import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CriarMensagemSolicitacaoPreProjetoDto {
  @ApiProperty({ example: 'Segue a orientação solicitada…' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  texto: string;
}
