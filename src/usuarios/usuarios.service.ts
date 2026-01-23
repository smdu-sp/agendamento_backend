import {
  BadRequestException,
  ForbiddenException,
  Global,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, Permissao, Usuario } from '@prisma/client';
import { AppService } from 'src/app.service';
import { Client as LdapClient } from 'ldapts';
import { BuscarNovoResponseDTO, UsuarioAutorizadoResponseDTO, UsuarioPaginadoResponseDTO, UsuarioResponseDTO } from './dto/usuario-response.dto';

@Global()
@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  validaPermissaoCriador(
    permissao: $Enums.Permissao,
    permissaoCriador: $Enums.Permissao,
  ) {
    if (
      permissao === $Enums.Permissao.DEV &&
      permissaoCriador === $Enums.Permissao.ADM
    )
      permissao = $Enums.Permissao.ADM;
    return permissao;
  }

  async permitido(id: string, permissoes: string[]): Promise<boolean> {
    if (!id || id === '') throw new BadRequestException('ID vazio.');
    const usuario = await this.prisma.usuario.findUnique({ 
      where: { id },
      select: { permissao: true }
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.permissao === 'DEV') return true;
    return permissoes.some(permissao => permissao === usuario.permissao);
  }

  async listaCompleta(): Promise<UsuarioResponseDTO[]> {
    const lista: Usuario[] = await this.prisma.usuario.findMany({
      orderBy: { nome: 'asc' },
    });
    if (!lista || lista.length == 0) throw new ForbiddenException('Nenhum usuário encontrado.');
    return lista;
  }

  async buscarTecnicos(): Promise<{ id: string, nome: string }[]> {
    const lista: { id: string, nome: string }[] = await this.prisma.usuario.findMany({
      where: { permissao: 'TEC', status: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });
    if (!lista || lista.length == 0) throw new ForbiddenException('Nenhum técnico encontrado.');
    return lista;
  }

  async buscarTecnicosPorCoordenadoria(
    coordenadoriaId: string,
    usuarioLogado?: Usuario,
  ): Promise<{ id: string, nome: string, login: string }[]> {
    // Se for ponto focal, só pode buscar técnicos da sua própria coordenadoria
    if (usuarioLogado && usuarioLogado.permissao === 'PONTO_FOCAL') {
      if (usuarioLogado.coordenadoriaId !== coordenadoriaId) {
        throw new ForbiddenException('Você só pode buscar técnicos da sua coordenadoria.');
      }
    }

    const lista: { id: string, nome: string, login: string }[] = await this.prisma.usuario.findMany({
      where: { 
        permissao: 'TEC', 
        status: true,
        coordenadoriaId,
      },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, login: true },
    });
    return lista;
  }

  async criar(
    createUsuarioDto: CreateUsuarioDto,
    usuarioLogado: Usuario
  ): Promise<UsuarioResponseDTO> {
    const loguser: UsuarioResponseDTO = await this.buscarPorLogin(createUsuarioDto.login);
    if (loguser) throw new ForbiddenException('Login já cadastrado.');
    const emailuser: UsuarioResponseDTO = await this.buscarPorEmail(createUsuarioDto.email);
    if (emailuser) throw new ForbiddenException('Email já cadastrado.');
    let { permissao } = createUsuarioDto;
    permissao = this.validaPermissaoCriador(permissao, usuarioLogado.permissao);
    const usuario: Usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        permissao
      },
    });
    if (!usuario) throw new InternalServerErrorException('Não foi possível criar o usuário, tente novamente.');
    return usuario;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
    permissao?: string
  ): Promise<UsuarioPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
      ...(busca && { OR: [
        { nome: { contains: busca }},
        { nomeSocial: { contains: busca }},
        { login: { contains: busca }},
        { email: { contains: busca }},
      ]}),
      ...(status && status !== '' && { 
        status: status === 'ATIVO' ? true : (status === 'INATIVO' ? false : undefined) 
      }),
      ...(permissao && permissao !== '' && { permissao: Permissao[permissao] }),
    };
    const total: number = await this.prisma.usuario.count({ where: searchParams });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const usuarios: Usuario[] = await this.prisma.usuario.findMany({
      where: searchParams,
      orderBy: { nome: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: usuarios,
    };
  }

  async buscarPorId(id: string): Promise<UsuarioResponseDTO> {
    const usuario: Usuario = await this.prisma.usuario.findUnique({ where: { id }});
    return usuario;
  }

  async buscarPorEmail(email: string): Promise<UsuarioResponseDTO> {
    return await this.prisma.usuario.findUnique({ where: { email }});
  }

  async buscarPorLogin(login: string): Promise<UsuarioResponseDTO> {
    return await this.prisma.usuario.findUnique({ where: { login }});
  }


  async atualizar(
    usuario: Usuario,
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioResponseDTO> {
    const usuarioLogado = await this.buscarPorId(usuario.id);
    if (updateUsuarioDto.login) {
      const usuario = await this.buscarPorLogin(updateUsuarioDto.login);
      if (usuario && usuario.id !== id) throw new ForbiddenException('Login já cadastrado.');
    }
    const usuarioAntes = await this.prisma.usuario.findUnique({ where: { id }});
    if (['TEC', 'USR'].includes(usuarioAntes.permissao) && id !== usuarioAntes.id) throw new ForbiddenException('Operação não autorizada para este usuário.');
    let { permissao } = updateUsuarioDto;
    permissao = permissao && permissao.toString() !== '' ? this.validaPermissaoCriador(permissao, usuarioLogado.permissao) : usuarioAntes.permissao;
    const usuarioAtualizado: Usuario = await this.prisma.usuario.update({
      data: {
        ...updateUsuarioDto,
        permissao
      },
      where: { id },
    });
    return usuarioAtualizado;
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.usuario.update({
      data: { status: false },
      where: { id },
    });
    return { desativado: true };
  }

  async autorizaUsuario(id: string): Promise<UsuarioAutorizadoResponseDTO> {
    const autorizado: Usuario = await this.prisma.usuario.update({
      where: { id },
      data: { status: true },
    });
    if (autorizado && autorizado.status === true) return { autorizado: true };
    throw new ForbiddenException('Erro ao autorizar o usuário.');
  }

  async validaUsuario(id: string): Promise<UsuarioResponseDTO> {
    const usuario: Usuario = await this.prisma.usuario.findUnique({ where: { id }});
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.status !== true) throw new ForbiddenException('Usuário inativo.');
    return usuario;
  }

  async buscarPorNome(nome_busca: string): Promise<{ nome: string, email: string, login: string }> {
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });
    try {
      await client.bind(`${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`, process.env.PASS_LDAP);
    } catch (error) {
      throw new InternalServerErrorException('Não foi possível buscar o usuário.');
    }
    let nome: string, email: string, login: string;
    try {
      const usuario = await client.search(
        process.env.LDAP_BASE_DN || process.env.LDAP_BASE,
        {
          filter: `(&(name=${nome_busca})(company=SMUL))`,
          scope: 'sub',
          attributes: ['name', 'mail'],
        }
      );
      const { name, mail, samaccountname } = usuario.searchEntries[0];
      nome = name.toString();
      email = mail.toString().toLowerCase();
      login = samaccountname.toString().toLowerCase();
      return { nome, email, login };
    } catch (error) {
      await client.unbind();
      throw new InternalServerErrorException('Não foi possível buscar o usuário.');
    }
  }

  async buscarNovo(login: string): Promise<BuscarNovoResponseDTO> {
    const usuarioExiste = await this.buscarPorLogin(login);
    if (usuarioExiste && usuarioExiste.status === true) throw new ForbiddenException('Login já cadastrado.');
    if (usuarioExiste && usuarioExiste.status !== true){
      const usuarioReativado = await this.prisma.usuario.update({ 
        where: { id: usuarioExiste.id }, 
        data: { status: true } 
      });
      return usuarioReativado;
    }
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });
    
    const ldapBase = process.env.LDAP_BASE_DN || process.env.LDAP_BASE;
    if (!ldapBase) {
      throw new InternalServerErrorException('LDAP_BASE_DN não configurado no ambiente.');
    }
    
    try {
      await client.bind(`${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`, process.env.PASS_LDAP);
    } catch (error) {
      console.error('Erro ao conectar no LDAP:', error);
      throw new InternalServerErrorException('Não foi possível conectar ao servidor LDAP.');
    }
    
    let nome: string, email: string;
    try {
      const usuario = await client.search(
        ldapBase,
        {
          filter: `(&(sAMAccountName=${login})(company=SMUL))`,
          scope: 'sub',
          attributes: ['name', 'mail', 'sAMAccountName'],
        }
      );
      
      if (!usuario.searchEntries || usuario.searchEntries.length === 0) {
        await client.unbind();
        throw new NotFoundException('Usuário não encontrado no LDAP.');
      }
      
      const { name, mail } = usuario.searchEntries[0];
      if (!name || !mail) {
        await client.unbind();
        throw new NotFoundException('Dados do usuário incompletos no LDAP.');
      }
      
      nome = name.toString();
      email = mail.toString().toLowerCase();
      await client.unbind();
    } catch (error) {
      try {
        await client.unbind();
      } catch (unbindError) {
        // Ignora erro de unbind se já foi feito
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erro ao buscar usuário no LDAP:', error);
      throw new InternalServerErrorException('Não foi possível buscar o usuário no LDAP.');
    }
    if (!nome || !email) throw new NotFoundException('Usuário não encontrado.');
    return { login, nome, email };
  }

  async atualizarUltimoLogin(id: string) {
    await this.prisma.usuario.update({
      where: { id },
      data: { ultimoLogin: new Date() },
    });
  }
}
