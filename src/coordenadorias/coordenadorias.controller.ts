import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CoordenadoriasService } from './coordenadorias.service';
import { CreateCoordenadoriaDto } from './dto/create-coordenadoria.dto';
import { UpdateCoordenadoriaDto } from './dto/update-coordenadoria.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Usuario } from '@prisma/client';
import {
  CoordenadoriaPaginadoResponseDTO,
  CoordenadoriaResponseDTO,
} from './dto/coordenadoria-response.dto';

@ApiTags('Coordenadorias')
@ApiBearerAuth()
@Controller('coordenadorias')
export class CoordenadoriasController {
  constructor(private readonly coordenadoriasService: CoordenadoriasService) {}

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(
    @Body() createCoordenadoriaDto: CreateCoordenadoriaDto,
  ): Promise<CoordenadoriaResponseDTO> {
    return this.coordenadoriasService.criar(createCoordenadoriaDto);
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<CoordenadoriaPaginadoResponseDTO> {
    return this.coordenadoriasService.buscarTudo(
      +pagina,
      +limite,
      busca,
      status,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Get('buscar-por-id/:id')
  buscarPorId(
    @Param('id') id: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<CoordenadoriaResponseDTO> {
    return this.coordenadoriasService.buscarPorId(id, usuario);
  }

  @Get('lista-completa')
  listaCompleta(): Promise<CoordenadoriaResponseDTO[]> {
    return this.coordenadoriasService.listaCompleta();
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() updateCoordenadoriaDto: UpdateCoordenadoriaDto,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<CoordenadoriaResponseDTO> {
    return this.coordenadoriasService.atualizar(
      id,
      updateCoordenadoriaDto,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<{ desativado: boolean }> {
    return this.coordenadoriasService.excluir(id);
  }
}
