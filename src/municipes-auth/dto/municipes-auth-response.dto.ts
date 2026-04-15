import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MunicipeTokenResponseDto {
  @ApiProperty()
  access_token: string;
}

export class SolicitarRedefinicaoResponseDto {
  @ApiProperty()
  mensagem: string;

  @ApiPropertyOptional()
  linkRedefinicao?: string;
}
