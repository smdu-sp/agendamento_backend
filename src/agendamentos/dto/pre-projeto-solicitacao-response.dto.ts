import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreProjetoSolicitacaoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description:
      'Protocolo amigável (ex.: AS-202604001), igual ao exibido no portal.',
  })
  protocolo: string;

  @ApiPropertyOptional({
    description: 'Indica se o e-mail de confirmação foi enviado com sucesso.',
  })
  emailEnviado?: boolean;
}
