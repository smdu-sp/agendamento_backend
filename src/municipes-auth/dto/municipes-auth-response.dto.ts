import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MunicipeTokenResponseDto {
  @ApiPropertyOptional({
    description:
      'Nulo quando o e-mail informado já possui conta — nenhuma sessão é criada nesse caso.',
    nullable: true,
  })
  access_token: string | null;

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
