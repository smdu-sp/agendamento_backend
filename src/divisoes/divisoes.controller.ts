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
import { DivisoesService } from './divisoes.service';
import { CreateDivisaoDto } from './dto/create-divisao.dto';
import { UpdateDivisaoDto } from './dto/update-divisao.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DivisaoPaginadoResponseDTO,
  DivisaoResponseDTO,
} from './dto/divisao-response.dto';

@ApiTags('Divisões')
@ApiBearerAuth()
@Controller('divisoes')
export class DivisoesController {
  constructor(private readonly divisoesService: DivisoesService) {}

  @Permissoes('ADM')
  @Post('criar')
  criar(@Body() dto: CreateDivisaoDto): Promise<DivisaoResponseDTO> {
    return this.divisoesService.criar(dto);
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
    @Query('coordenadoriaId') coordenadoriaId?: string,
  ): Promise<DivisaoPaginadoResponseDTO> {
    return this.divisoesService.buscarTudo(
      +pagina,
      +limite,
      busca,
      status,
      coordenadoriaId,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<DivisaoResponseDTO> {
    return this.divisoesService.buscarPorId(id);
  }

  @Get('lista-completa')
  listaCompleta(
    @Query('coordenadoriaId') coordenadoriaId?: string,
  ): Promise<DivisaoResponseDTO[]> {
    return this.divisoesService.listaCompleta(coordenadoriaId);
  }

  @Permissoes('ADM')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateDivisaoDto,
  ): Promise<DivisaoResponseDTO> {
    return this.divisoesService.atualizar(id, dto);
  }

  @Permissoes('ADM')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<{ desativado: boolean }> {
    return this.divisoesService.excluir(id);
  }
}
