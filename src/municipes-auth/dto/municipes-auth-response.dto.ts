import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MunicipeTokenResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiPropertyOptional({
    description: 'Indica se o e-mail de confirmação foi enviado com sucesso.',
  })
  emailEnviado?: boolean;
}

export class SolicitarRedefinicaoResponseDto {
  @ApiProperty()
  mensagem: string;

  @ApiPropertyOptional()
  linkRedefinicao?: string;
}
