import {
  BadRequestException,
  ForbiddenException,
  Global,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, Permissao, Usuario } from '@prisma/client';

/** Contexto do usuário logado (sem senha) para autorização. */
type UsuarioLogadoContext = Pick<Usuario, 'permissao' | 'coordenadoriaId'>;
import { AppService } from 'src/app.service';
import { Client as LdapClient } from 'ldapts';
import {
  BuscarNovoResponseDTO,
  UsuarioAutorizadoResponseDTO,
  UsuarioPaginadoResponseDTO,
  UsuarioResponseDTO,
} from './dto/usuario-response.dto';

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
  ): $Enums.Permissao {
    if (
      permissao === $Enums.Permissao.DEV &&
      permissaoCriador === $Enums.Permissao.ADM
    )
      permissao = $Enums.Permissao.ADM;
    // Ponto Focal e Coordenador só podem atribuir USR, PONTO_FOCAL e TEC
    const permissoesCoord = ['USR', 'PONTO_FOCAL', 'TEC'] as $Enums.Permissao[];
    if (
      (permissaoCriador === 'PONTO_FOCAL' ||
        permissaoCriador === 'COORDENADOR') &&
      !permissoesCoord.includes(permissao)
    ) {
      throw new ForbiddenException(
        'Ponto Focal e Coordenador só podem atribuir permissões: Usuário, Ponto Focal e Técnico.',
      );
    }
    return permissao;
  }

  async permitido(id: string, permissoes: string[]): Promise<boolean> {
    if (!id || id === '') throw new BadRequestException('ID vazio.');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { permissao: true },
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.permissao === 'DEV') return true;
    return permissoes.some((permissao) => permissao === usuario.permissao);
  }

  private readonly selectUsuarioSemSenha = {
    id: true,
    nome: true,
    login: true,
    email: true,
    permissao: true,
    status: true,
    avatar: true,
    ultimoLogin: true,
    criadoEm: true,
    atualizadoEm: true,
    nomeSocial: true,
    coordenadoriaId: true,
    coordenadoria: {
      select: { id: true, sigla: true, nome: true },
    },
  };

  async listaCompleta(
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<UsuarioResponseDTO[]> {
    const where =
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR') &&
      usuarioLogado.coordenadoriaId
        ? { coordenadoriaId: usuarioLogado.coordenadoriaId }
        : {};
    const lista = await this.prisma.usuario.findMany({
      where,
      select: this.selectUsuarioSemSenha,
      orderBy: { nome: 'asc' },
    });
    if (!lista || lista.length == 0)
      throw new ForbiddenException('Nenhum usuário encontrado.');
    return lista as UsuarioResponseDTO[];
  }

  async buscarTecnicos(): Promise<{ id: string; nome: string }[]> {
    const lista: { id: string; nome: string }[] =
      await this.prisma.usuario.findMany({
        where: { permissao: 'TEC', status: true },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      });
    if (!lista || lista.length == 0)
      throw new ForbiddenException('Nenhum técnico encontrado.');
    return lista;
  }

  async buscarTecnicosPorCoordenadoria(
    coordenadoriaId: string,
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<{ id: string; nome: string; login: string }[]> {
    // Ponto focal e coordenador só podem buscar técnicos da sua própria coordenadoria
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR')
    ) {
      if (usuarioLogado.coordenadoriaId !== coordenadoriaId) {
        throw new ForbiddenException(
          'Você só pode buscar técnicos da sua coordenadoria.',
        );
      }
    }

    const lista: { id: string; nome: string; login: string }[] =
      await this.prisma.usuario.findMany({
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
    usuarioLogado: UsuarioLogadoContext,
  ): Promise<UsuarioResponseDTO> {
    const loguser = await this.buscarPorLogin(createUsuarioDto.login);
    const emailuser: UsuarioResponseDTO = await this.buscarPorEmail(
      createUsuarioDto.email,
    );
    const jaCadastrado = !!loguser || !!emailuser;
    if (jaCadastrado) {
      const isPontoFocalOuCoordenador =
        usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR';
      if (isPontoFocalOuCoordenador) {
        throw new ForbiddenException(
          'Já existe cadastro para este usuário. Contate um administrador para alterar a coordenadoria desta pessoa.',
        );
      }
      if (loguser) throw new ForbiddenException('Login já cadastrado.');
      throw new ForbiddenException('Email já cadastrado.');
    }
    // Ponto Focal e Coordenador só podem criar usuários na sua coordenadoria
    let coordenadoriaId = createUsuarioDto.coordenadoriaId;
    if (
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
    ) {
      if (!usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Usuário sem coordenadoria atribuída não pode criar usuários.',
        );
      }
      coordenadoriaId = usuarioLogado.coordenadoriaId;
    }
    let { permissao } = createUsuarioDto;
    permissao = this.validaPermissaoCriador(permissao, usuarioLogado.permissao);
    const usuario: Usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        permissao,
        coordenadoriaId,
      },
    });
    if (!usuario)
      throw new InternalServerErrorException(
        'Não foi possível criar o usuário, tente novamente.',
      );
    return usuario;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
    permissao?: string,
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<UsuarioPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
      ...(usuarioLogado &&
        (usuarioLogado.permissao === 'PONTO_FOCAL' ||
          usuarioLogado.permissao === 'COORDENADOR') &&
        usuarioLogado.coordenadoriaId && {
          coordenadoriaId: usuarioLogado.coordenadoriaId,
        }),
      ...(busca && {
        OR: [
          { nome: { contains: busca } },
          { nomeSocial: { contains: busca } },
          { login: { contains: busca } },
          { email: { contains: busca } },
        ],
      }),
      ...(status &&
        status !== '' && {
          status:
            status === 'ATIVO'
              ? true
              : status === 'INATIVO'
                ? false
                : undefined,
        }),
      ...(permissao && permissao !== '' && { permissao: Permissao[permissao] }),
    };
    const total: number = await this.prisma.usuario.count({
      where: searchParams,
    });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const usuarios = await this.prisma.usuario.findMany({
      where: searchParams,
      orderBy: { nome: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        permissao: true,
        status: true,
        avatar: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        nomeSocial: true,
        coordenadoriaId: true,
        coordenadoria: {
          select: { id: true, sigla: true, nome: true },
        },
      },
    });
    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: usuarios as UsuarioResponseDTO[],
    };
  }

  async buscarPorId(
    id: string,
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<UsuarioResponseDTO> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: this.selectUsuarioSemSenha,
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    // Ponto Focal e Coordenador só podem ver usuários da sua coordenadoria
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR') &&
      usuario.coordenadoriaId !== usuarioLogado.coordenadoriaId
    ) {
      throw new ForbiddenException(
        'Você só pode acessar usuários da sua coordenadoria.',
      );
    }
    return usuario as UsuarioResponseDTO;
  }

  async buscarPorEmail(email: string): Promise<UsuarioResponseDTO> {
    return await this.prisma.usuario.findUnique({ where: { email } });
  }

  async buscarPorLogin(login: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { login } });
  }

  async atualizar(
    usuario: UsuarioLogadoContext & { id: string },
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioResponseDTO> {
    const usuarioLogado = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: this.selectUsuarioSemSenha,
    });
    if (!usuarioLogado) throw new ForbiddenException('Usuário não encontrado.');
    if (updateUsuarioDto.login) {
      const usuarioExistente = await this.buscarPorLogin(
        updateUsuarioDto.login,
      );
      if (usuarioExistente && usuarioExistente.id !== id)
        throw new ForbiddenException('Login já cadastrado.');
    }
    const usuarioAntes = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuarioAntes) throw new NotFoundException('Usuário não encontrado.');
    // Ponto Focal e Coordenador só podem editar usuários da sua coordenadoria
    if (
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
    ) {
      if (usuarioAntes.coordenadoriaId !== usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Você só pode editar usuários da sua coordenadoria.',
        );
      }
    }
    if (usuarioAntes.permissao === 'TEC' && id !== usuarioAntes.id)
      throw new ForbiddenException(
        'Operação não autorizada para este usuário.',
      );
    const {
      permissao: permissaoDto,
      coordenadoriaId: coordDto,
      ...rest
    } = updateUsuarioDto;
    // Ponto Focal e Coordenador não podem alterar a coordenadoria do usuário
    const coordenadoriaIdFinal =
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
        ? usuarioAntes.coordenadoriaId
        : coordDto !== undefined
          ? coordDto
          : usuarioAntes.coordenadoriaId;
    const permissaoFinal =
      permissaoDto && permissaoDto.toString().trim() !== ''
        ? this.validaPermissaoCriador(permissaoDto, usuarioLogado.permissao)
        : usuarioAntes.permissao;
    // Garante valor válido do enum (evita '' no Prisma; corrige registros com permissao vazia no banco)
    const permissaoValida =
      permissaoFinal && permissaoFinal.toString().trim() !== ''
        ? permissaoFinal
        : usuarioAntes.permissao &&
            usuarioAntes.permissao.toString().trim() !== ''
          ? usuarioAntes.permissao
          : $Enums.Permissao.PORTARIA;
    await this.prisma.usuario.update({
      data: {
        ...rest,
        permissao: permissaoValida,
        coordenadoriaId: coordenadoriaIdFinal,
      },
      where: { id },
    });
    return this.buscarPorId(id, usuarioLogado);
  }

  async excluir(
    id: string,
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<{ desativado: boolean }> {
    const usuarioAlvo = await this.prisma.usuario.findUnique({
      where: { id },
      select: { coordenadoriaId: true },
    });
    if (!usuarioAlvo) throw new NotFoundException('Usuário não encontrado.');
    // Ponto Focal e Coordenador só podem desativar usuários da sua coordenadoria
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR')
    ) {
      if (usuarioAlvo.coordenadoriaId !== usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Você só pode desativar usuários da sua coordenadoria.',
        );
      }
    }
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: this.selectUsuarioSemSenha,
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.status !== true)
      throw new ForbiddenException('Usuário inativo.');
    return usuario as UsuarioResponseDTO;
  }

  async buscarPorNome(
    nome_busca: string,
  ): Promise<{ nome: string; email: string; login: string }> {
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });
    try {
      await client.bind(
        `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
        process.env.PASS_LDAP,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível buscar o usuário.',
      );
    }
    let nome: string, email: string, login: string;
    try {
      const usuario = await client.search(
        process.env.LDAP_BASE_DN || process.env.LDAP_BASE,
        {
          filter: `(&(name=${nome_busca})(company=SMUL))`,
          scope: 'sub',
          attributes: ['name', 'mail'],
        },
      );
      const { name, mail, samaccountname } = usuario.searchEntries[0];
      nome = name.toString();
      email = mail.toString().toLowerCase();
      login = samaccountname.toString().toLowerCase();
      return { nome, email, login };
    } catch (error) {
      await client.unbind();
      throw new InternalServerErrorException(
        'Não foi possível buscar o usuário.',
      );
    }
  }

  async buscarNovo(login: string): Promise<BuscarNovoResponseDTO> {
    const usuarioExiste = await this.buscarPorLogin(login);
    if (usuarioExiste && usuarioExiste.status === true)
      throw new ForbiddenException('Login já cadastrado.');
    if (usuarioExiste && usuarioExiste.status !== true) {
      const usuarioReativado = await this.prisma.usuario.update({
        where: { id: usuarioExiste.id },
        data: { status: true },
      });
      return usuarioReativado;
    }
    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER,
    });

    const ldapBase = process.env.LDAP_BASE_DN || process.env.LDAP_BASE;
    if (!ldapBase) {
      throw new InternalServerErrorException(
        'LDAP_BASE_DN não configurado no ambiente.',
      );
    }

    try {
      await client.bind(
        `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
        process.env.PASS_LDAP,
      );
    } catch (error) {
      console.error('Erro ao conectar no LDAP:', error);
      throw new InternalServerErrorException(
        'Não foi possível conectar ao servidor LDAP.',
      );
    }

    let nome: string, email: string;
    try {
      const usuario = await client.search(ldapBase, {
        filter: `(&(sAMAccountName=${login})(company=SMUL))`,
        scope: 'sub',
        attributes: ['name', 'mail', 'sAMAccountName'],
      });

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
      throw new InternalServerErrorException(
        'Não foi possível buscar o usuário no LDAP.',
      );
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
