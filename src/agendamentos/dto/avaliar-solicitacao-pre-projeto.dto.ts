import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AvaliarSolicitacaoPreProjetoDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @ApiPropertyOptional({
    description: 'Comentário opcional de elogio/reclamação sobre o atendimento.',
    example: 'Atendimento muito atencioso e rápido.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}
