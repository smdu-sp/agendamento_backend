import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SolicitarRedefinicaoSenhaDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
