import { ApiProperty } from '@nestjs/swagger';

export class PreProjetoSolicitacaoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description:
      'Protocolo amigável (ex.: PP-XXXXXXXX), igual ao exibido no portal.',
  })
  protocolo: string;
}
