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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { Usuario } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BuscarNovoResponseDTO, UsuarioAutorizadoResponseDTO, UsuarioDesativadoResponseDTO, UsuarioPaginadoResponseDTO, UsuarioResponseDTO } from './dto/usuario-response.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(
    @UsuarioAtual() usuario: Usuario,
    @Body() createUsuarioDto: CreateUsuarioDto,
  ): Promise<UsuarioResponseDTO> {
    return this.usuariosService.criar(createUsuarioDto, usuario);
  }

  @Permissoes('ADM')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
    @Query('permissao') permissao?: string,
  ): Promise<UsuarioPaginadoResponseDTO> {
    return this.usuariosService.buscarTudo(+pagina, +limite, busca, status, permissao);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<UsuarioResponseDTO> {
    return this.usuariosService.buscarPorId(id);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'USR')
  @Patch('atualizar/:id')
  atualizar(
    @UsuarioAtual() usuario: Usuario,
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto
  ): Promise<UsuarioResponseDTO> {
    return this.usuariosService.atualizar(usuario, id, updateUsuarioDto);
  }

  @Permissoes('ADM', 'DEV')
  @Get('lista-completa')
  listaCompleta(): Promise<UsuarioResponseDTO[]> {
    return this.usuariosService.listaCompleta();
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-tecnicos')
  buscarTecnicos(): Promise<{ id: string, nome: string }[]> {
    return this.usuariosService.buscarTecnicos();
  }

  @Get('buscar-tecnicos-por-coordenadoria/:coordenadoriaId')
  buscarTecnicosPorCoordenadoria(
    @Param('coordenadoriaId') coordenadoriaId: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ id: string, nome: string, login: string }[]> {
    return this.usuariosService.buscarTecnicosPorCoordenadoria(coordenadoriaId, usuario);
  }

  @Permissoes('ADM', 'DEV')
  @Delete('desativar/:id')
  excluir(@Param('id') id: string): Promise<UsuarioDesativadoResponseDTO> {
    return this.usuariosService.excluir(id);
  }

  @Permissoes('ADM', 'DEV')
  @Patch('autorizar/:id')
  autorizarUsuario(@Param('id') id: string): Promise<UsuarioAutorizadoResponseDTO> {
    return this.usuariosService.autorizaUsuario(id);
  }

  @Get('valida-usuario')
  validaUsuario(@UsuarioAtual() usuario: Usuario): Promise<UsuarioResponseDTO> {
    return this.usuariosService.validaUsuario(usuario.id);
  }

  @Permissoes('ADM', 'DEV')
  @Get('buscar-novo/:login')
  buscarNovo(@Param('login') login: string): Promise<BuscarNovoResponseDTO> {
    return this.usuariosService.buscarNovo(login);
  }
}
