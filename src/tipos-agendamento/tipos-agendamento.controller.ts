import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TiposAgendamentoService } from './tipos-agendamento.service';
import { CreateTipoAgendamentoDto } from './dto/create-tipo-agendamento.dto';
import { UpdateTipoAgendamentoDto } from './dto/update-tipo-agendamento.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  TipoAgendamentoPaginadoResponseDTO,
  TipoAgendamentoResponseDTO,
} from './dto/tipo-agendamento-response.dto';

@ApiTags('Tipos de Agendamento')
@ApiBearerAuth()
@Controller('tipos-agendamento')
export class TiposAgendamentoController {
  constructor(private readonly service: TiposAgendamentoService) {}

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(@Body() dto: CreateTipoAgendamentoDto): Promise<TipoAgendamentoResponseDTO> {
    return this.service.criar(dto);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
  ): Promise<TipoAgendamentoPaginadoResponseDTO> {
    return this.service.buscarTudo(+pagina || 1, +limite || 10, busca, status);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<TipoAgendamentoResponseDTO> {
    return this.service.buscarPorId(id);
  }

  @Get('lista-completa')
  listaCompleta(): Promise<TipoAgendamentoResponseDTO[]> {
    return this.service.listaCompleta();
  }

  @Permissoes('ADM', 'DEV')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateTipoAgendamentoDto,
  ): Promise<TipoAgendamentoResponseDTO> {
    return this.service.atualizar(id, dto);
  }

  @Permissoes('ADM', 'DEV')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<{ desativado: boolean }> {
    return this.service.excluir(id);
  }
}
