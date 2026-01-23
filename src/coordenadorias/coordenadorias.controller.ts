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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Permissoes('ADM', 'DEV')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
  ): Promise<CoordenadoriaPaginadoResponseDTO> {
    return this.coordenadoriasService.buscarTudo(
      +pagina,
      +limite,
      busca,
      status,
    );
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<CoordenadoriaResponseDTO> {
    return this.coordenadoriasService.buscarPorId(id);
  }

  @Get('lista-completa')
  listaCompleta(): Promise<CoordenadoriaResponseDTO[]> {
    return this.coordenadoriasService.listaCompleta();
  }

  @Permissoes('ADM')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() updateCoordenadoriaDto: UpdateCoordenadoriaDto,
  ): Promise<CoordenadoriaResponseDTO> {
    return this.coordenadoriasService.atualizar(id, updateCoordenadoriaDto);
  }

  @Permissoes('ADM', 'DEV')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<{ desativado: boolean }> {
    return this.coordenadoriasService.excluir(id);
  }
}
