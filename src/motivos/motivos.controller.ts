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
import { MotivosService } from './motivos.service';
import { CreateMotivoDto } from './dto/create-motivo.dto';
import { UpdateMotivoDto } from './dto/update-motivo.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  MotivoPaginadoResponseDTO,
  MotivoResponseDTO,
} from './dto/motivo-response.dto';

@ApiTags('Motivos')
@ApiBearerAuth()
@Controller('motivos')
export class MotivosController {
  constructor(private readonly motivosService: MotivosService) {}

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(@Body() createMotivoDto: CreateMotivoDto): Promise<MotivoResponseDTO> {
    return this.motivosService.criar(createMotivoDto);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
  ): Promise<MotivoPaginadoResponseDTO> {
    return this.motivosService.buscarTudo(+pagina, +limite, busca, status);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<MotivoResponseDTO> {
    return this.motivosService.buscarPorId(id);
  }

  @Get('lista-completa')
  listaCompleta(): Promise<MotivoResponseDTO[]> {
    return this.motivosService.listaCompleta();
  }

  @Permissoes('ADM', 'DEV')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() updateMotivoDto: UpdateMotivoDto,
  ): Promise<MotivoResponseDTO> {
    return this.motivosService.atualizar(id, updateMotivoDto);
  }

  @Permissoes('ADM', 'DEV')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<{ desativado: boolean }> {
    return this.motivosService.excluir(id);
  }
}
