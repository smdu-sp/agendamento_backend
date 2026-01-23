import { Coordenadoria } from '@prisma/client';

export type CoordenadoriaResponseDTO = Coordenadoria;

export interface CoordenadoriaPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: CoordenadoriaResponseDTO[];
}
