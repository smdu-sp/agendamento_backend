import { Motivo } from '@prisma/client';

export type MotivoResponseDTO = Motivo;

export interface MotivoPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: MotivoResponseDTO[];
}
