import { ApiProperty } from '@nestjs/swagger';
import { Permissao } from '@prisma/client';

export class CoordenadoriaResumoDTO {
  @ApiProperty()
  id: string;
  @ApiProperty()
  sigla: string;
  @ApiProperty({ required: false })
  nome?: string | null;
}

export class UsuarioResponseDTO {
  @ApiProperty()
  id: string;
  @ApiProperty()
  nome: string;
  @ApiProperty()
  nomeSocial?: string;
  @ApiProperty()
  login: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  status: boolean;
  @ApiProperty()
  avatar: string;
  @ApiProperty()
  permissao: Permissao;
  @ApiProperty()
  ultimoLogin: Date;
  @ApiProperty()
  criadoEm: Date;
  @ApiProperty()
  atualizadoEm: Date;
  @ApiProperty({ required: false })
  coordenadoriaId?: string | null;
  @ApiProperty({ type: CoordenadoriaResumoDTO, required: false })
  coordenadoria?: CoordenadoriaResumoDTO | null;
}

export class UsuarioPaginadoResponseDTO {
  @ApiProperty()
  total: number;
  @ApiProperty()
  pagina: number;
  @ApiProperty()
  limite: number;
  @ApiProperty()
  data?: UsuarioResponseDTO[];
}

export class BuscarNovoResponseDTO {
  @ApiProperty()
  login: string;
  @ApiProperty()
  nome: string;
  @ApiProperty()
  email: string;
}

export class BuscarFuncionariosResponseDTO {
  @ApiProperty()
  administrativos: UsuarioResponseDTO[];
  @ApiProperty()
  tecnicos: UsuarioResponseDTO[];
}

export class UsuarioDesativadoResponseDTO {
  @ApiProperty()
  desativado: boolean;
}

export class UsuarioAutorizadoResponseDTO {
  @ApiProperty()
  autorizado: boolean;
}
