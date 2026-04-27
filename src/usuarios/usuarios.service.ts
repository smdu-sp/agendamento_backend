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
type UsuarioLogadoContext = Pick<Usuario, 'permissao' | 'divisaoId'>;
import { AppService } from 'src/app.service';
import { Client as LdapClient } from 'ldapts';
import { SguService } from 'src/prisma/sgu.service';
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
    private sgu: SguService,
  ) {}

  private normalizarSigla(valor: string): string {
    return String(valor || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private async inferirDivisaoIdPorLoginNoSgu(
    login: string | undefined,
  ): Promise<string | undefined> {
    const loginLimpo = String(login || '')
      .trim()
      .toLowerCase();
    if (!loginLimpo) return undefined;

    const siglaSgu = await this.sgu.buscarSiglaUnidadePorUsuarioRede(loginLimpo);
    if (!siglaSgu) return undefined;

    const siglaNormalizada = this.normalizarSigla(siglaSgu);
    if (!siglaNormalizada) return undefined;

    const divisoes = await this.prisma.divisao.findMany({
      where: { status: true },
      select: { id: true, sigla: true },
    });
    const match = divisoes.find(
      (d) => this.normalizarSigla(d.sigla) === siglaNormalizada,
    );
    return match?.id;
  }

  /**
   * Preenche `divisaoId` do técnico/DEV a partir do SGU (sigla da unidade → divisão local).
   * Opcionalmente, se `coordenadoriaIdImportacao` for informado e o SGU não achar unidade,
   * usa a primeira divisão ativa dessa coordenadoria (útil na importação de planilha).
   */
  async vincularDivisaoTecnicoPorLoginSeDisponivel(
    login: string | undefined,
    coordenadoriaIdImportacao?: string,
  ): Promise<string | null> {
    const loginLimpo = String(login || '')
      .trim()
      .toLowerCase();
    if (!loginLimpo) return null;

    const usuario = await this.prisma.usuario.findUnique({
      where: { login: loginLimpo },
      select: { id: true, permissao: true, divisaoId: true },
    });
    if (!usuario) return null;
    if (usuario.divisaoId) return usuario.divisaoId;
    if (usuario.permissao !== 'TEC' && usuario.permissao !== 'DEV') return null;

    let divisaoIdInferida =
      await this.inferirDivisaoIdPorLoginNoSgu(loginLimpo);
    if (!divisaoIdInferida && coordenadoriaIdImportacao?.trim()) {
      const divCoord = await this.prisma.divisao.findFirst({
        where: {
          coordenadoriaId: coordenadoriaIdImportacao.trim(),
          status: true,
        },
        orderBy: { sigla: 'asc' },
        select: { id: true },
      });
      divisaoIdInferida = divCoord?.id;
    }
    if (!divisaoIdInferida) return null;

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { divisaoId: divisaoIdInferida },
    });
    return divisaoIdInferida;
  }

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
    divisaoId: true,
    divisao: {
      select: {
        id: true,
        sigla: true,
        nome: true,
        coordenadoriaId: true,
        coordenadoria: { select: { id: true, sigla: true, nome: true } },
      },
    },
  };

  async listaCompleta(
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<UsuarioResponseDTO[]> {
    const where =
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR') &&
      usuarioLogado.divisaoId
        ? { divisaoId: usuarioLogado.divisaoId }
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
        where: {
          status: true,
          OR: [
            { permissao: 'TEC' },
            { permissao: 'DEV', divisaoId: { not: null } },
          ],
        },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      });
    if (!lista || lista.length == 0)
      throw new ForbiddenException('Nenhum técnico encontrado.');
    return lista;
  }

  async buscarTecnicosPorCoordenadoria(
    coordenadoriaId: string,
  ): Promise<{ id: string; nome: string; login: string; email: string }[]> {
    return this.prisma.usuario.findMany({
      where: {
        status: true,
        divisao: { coordenadoriaId },
        OR: [
          { permissao: 'TEC' },
          { permissao: 'DEV', divisaoId: { not: null } },
        ],
      },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, login: true, email: true },
    });
  }

  async buscarTecnicosPorDivisao(
    divisaoId: string,
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<{ id: string; nome: string; login: string; email: string }[]> {
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR')
    ) {
      if (usuarioLogado.divisaoId !== divisaoId) {
        throw new ForbiddenException(
          'Você só pode buscar técnicos da sua divisão.',
        );
      }
    }

    const lista: { id: string; nome: string; login: string; email: string }[] =
      await this.prisma.usuario.findMany({
        where: {
          status: true,
          divisaoId,
          OR: [
            { permissao: 'TEC' },
            { permissao: 'DEV', divisaoId: { not: null } },
          ],
        },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, login: true, email: true },
      });
    return lista;
  }

  async buscarTecnicosArthurSaboya(
    usuarioLogado?: UsuarioLogadoContext,
  ): Promise<{ id: string; nome: string; login: string; email: string }[]> {
    const divisaoArthur = process.env.DIVISAO_ID_PRE_PROJETOS?.trim();
    if (!divisaoArthur) {
      return [];
    }
    return this.buscarTecnicosPorDivisao(divisaoArthur, usuarioLogado);
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
          'Já existe cadastro para este usuário. Contate um administrador para alterar a divisão desta pessoa.',
        );
      }
      if (loguser) throw new ForbiddenException('Login já cadastrado.');
      throw new ForbiddenException('Email já cadastrado.');
    }
    let { permissao } = createUsuarioDto;
    permissao = this.validaPermissaoCriador(permissao, usuarioLogado.permissao);

    // Ponto Focal e Coordenador só podem criar usuários na sua divisão
    let divisaoId = createUsuarioDto.divisaoId;
    if (
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
    ) {
      if (!usuarioLogado.divisaoId) {
        throw new ForbiddenException(
          'Usuário sem divisão atribuída não pode criar usuários.',
        );
      }
      divisaoId = usuarioLogado.divisaoId;
    } else if (!divisaoId && permissao === 'TEC') {
      divisaoId = await this.inferirDivisaoIdPorLoginNoSgu(createUsuarioDto.login);
    }
    const usuario: Usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        permissao,
        divisaoId,
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
        usuarioLogado.divisaoId && {
          divisaoId: usuarioLogado.divisaoId,
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
        divisaoId: true,
        divisao: {
          select: {
            id: true,
            sigla: true,
            nome: true,
            coordenadoriaId: true,
            coordenadoria: { select: { id: true, sigla: true, nome: true } },
          },
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
    // Ponto Focal e Coordenador só podem ver usuários da sua divisão
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR') &&
      usuario.divisaoId !== usuarioLogado.divisaoId
    ) {
      throw new ForbiddenException(
        'Você só pode acessar usuários da sua divisão.',
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
    // Ponto Focal e Coordenador só podem editar usuários da sua divisão
    if (
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
    ) {
      if (usuarioAntes.divisaoId !== usuarioLogado.divisaoId) {
        throw new ForbiddenException(
          'Você só pode editar usuários da sua divisão.',
        );
      }
    }
    if (usuarioAntes.permissao === 'TEC' && id !== usuarioAntes.id)
      throw new ForbiddenException(
        'Operação não autorizada para este usuário.',
      );
    const {
      permissao: permissaoDto,
      divisaoId: divisaoDto,
      ...rest
    } = updateUsuarioDto;
    // Ponto Focal e Coordenador não podem alterar a divisão do usuário
    const divisaoIdFinal =
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
        ? usuarioAntes.divisaoId
        : divisaoDto !== undefined
          ? divisaoDto
          : usuarioAntes.divisaoId;
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
        divisaoId: divisaoIdFinal,
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
      select: { divisaoId: true },
    });
    if (!usuarioAlvo) throw new NotFoundException('Usuário não encontrado.');
    // Ponto Focal e Coordenador só podem desativar usuários da sua divisão
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR')
    ) {
      if (usuarioAlvo.divisaoId !== usuarioLogado.divisaoId) {
        throw new ForbiddenException(
          'Você só pode desativar usuários da sua divisão.',
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
      const usuario = await client.search(
        process.env.LDAP_BASE_DN || process.env.LDAP_BASE,
        {
          filter: `(&(name=${nome_busca})(company=SMUL))`,
          scope: 'sub',
          attributes: ['name', 'mail', 'sAMAccountName'],
        },
      );
      const { name, mail, samaccountname } = usuario.searchEntries[0];
      const nome = name.toString();
      const email = mail.toString().toLowerCase();
      const login = samaccountname.toString().toLowerCase();
      return { nome, email, login };
    } catch (error) {
      throw new InternalServerErrorException(
        'Não foi possível buscar o usuário.',
      );
    } finally {
      try {
        await client.unbind();
      } catch {
        // Ignora erro ao fechar
      }
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

    let nome: string, email: string;
    try {
      await client.bind(
        `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
        process.env.PASS_LDAP,
      );

      const usuario = await client.search(ldapBase, {
        filter: `(&(sAMAccountName=${login})(company=SMUL))`,
        scope: 'sub',
        attributes: ['name', 'mail', 'sAMAccountName'],
      });

      if (!usuario.searchEntries || usuario.searchEntries.length === 0) {
        throw new NotFoundException('Usuário não encontrado no LDAP.');
      }

      const { name, mail } = usuario.searchEntries[0];
      if (!name || !mail) {
        throw new NotFoundException('Dados do usuário incompletos no LDAP.');
      }

      nome = name.toString();
      email = mail.toString().toLowerCase();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erro ao buscar usuário no LDAP:', error);
      throw new InternalServerErrorException(
        'Não foi possível buscar o usuário no LDAP.',
      );
    } finally {
      try {
        await client.unbind();
      } catch {
        // Ignora erro ao fechar
      }
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
