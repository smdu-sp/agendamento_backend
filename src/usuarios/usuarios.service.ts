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
import { $Enums, Prisma, Usuario } from '@prisma/client';

/** Contexto do usuário logado (sem senha) para autorização. */
type UsuarioLogadoContext = Pick<Usuario, 'permissao' | 'divisaoId'>;
import { AppService } from 'src/app.service';
import { SguService } from 'src/prisma/sgu.service';
import { LdapExternoService } from 'src/ldap-externo/ldap-externo.service';
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
    private ldapExterno: LdapExternoService,
  ) {}

  private normalizarSigla(valor: string): string {
    return String(valor || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private readonly permissoesConhecidas = [
    'DEV',
    'ADM',
    'TEC',
    'ARTHUR_SABOYA',
    'ADM_ARTHUR_SABOYA',
    'USR',
    'PONTO_FOCAL',
    'COORDENADOR',
    'PORTARIA',
    'DIRETOR',
  ] as const;

  private sanitizarDivisaoId(
    divisaoId?: string | null,
  ): string | null | undefined {
    if (divisaoId === undefined) return undefined;
    const valor = String(divisaoId).trim();
    return valor || null;
  }

  private normalizarPermissao(
    permissao: unknown,
  ): $Enums.Permissao | undefined {
    if (typeof permissao !== 'string') return undefined;
    const valor = permissao.trim();
    if (!valor) return undefined;
    const permissoesValidas = Object.values($Enums.Permissao) as string[];
    if (permissoesValidas.includes(valor)) {
      return valor as $Enums.Permissao;
    }
    if ((this.permissoesConhecidas as readonly string[]).includes(valor)) {
      return valor as $Enums.Permissao;
    }
    return undefined;
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

  private mapearErroPersistenciaUsuario(error: unknown): never {
    const mensagem = String(
      error && typeof error === 'object' && 'message' in error
        ? (error as { message?: unknown }).message
        : error,
    );
    if (
      mensagem.includes('ADM_ARTHUR_SABOYA') ||
      mensagem.includes("Data truncated for column 'permissao'") ||
      /permissao.*enum/i.test(mensagem)
    ) {
      throw new BadRequestException(
        'O banco ainda não aceita a permissão Administrador Arthur Saboya. Aplique a migration do enum Permissao (ADM_ARTHUR_SABOYA).',
      );
    }
    if (
      (error as { code?: string })?.code === 'P2003' ||
      mensagem.includes('Foreign key constraint')
    ) {
      throw new BadRequestException(
        'Divisão inválida ou inexistente para o usuário.',
      );
    }
    throw error;
  }

  private async obterDivisaoArthurSaboyaId(): Promise<string> {
    const divisaoIdEnv = process.env.DIVISAO_ID_PRE_PROJETOS?.trim();
    if (divisaoIdEnv) {
      const divisaoEnv = await this.prisma.divisao.findUnique({
        where: { id: divisaoIdEnv },
        select: { id: true },
      });
      if (divisaoEnv?.id) return divisaoEnv.id;
    }

    const divisaoArthur = await this.prisma.divisao.findFirst({
      where: {
        status: true,
        coordenadoria: { sigla: 'CAP' },
        OR: [
          { sigla: 'ARTHUR_SABOYA' },
          { sigla: 'ATHURSABOYA' },
          { nome: { contains: 'Arthur Saboya' } },
        ],
      },
      select: { id: true },
    });
    if (divisaoArthur?.id) return divisaoArthur.id;

    throw new NotFoundException(
      'Divisão padrão do Arthur Saboya não encontrada (CAP/ATHURSABOYA).',
    );
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
    const permissaoReal = (usuarioLogado as any)?.permissaoReal as string | undefined;
    const isDevRealOuEfetivo =
      usuarioLogado?.permissao === 'DEV' || permissaoReal === 'DEV';
    if (
      usuarioLogado &&
      !isDevRealOuEfetivo &&
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
    return this.prisma.usuario.findMany({
      where: {
        status: true,
        permissao: { in: ['ARTHUR_SABOYA', 'ADM_ARTHUR_SABOYA'] },
      },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, login: true, email: true },
    });
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
    const permissaoSolicitada =
      this.normalizarPermissao(createUsuarioDto.permissao) ??
      $Enums.Permissao.PORTARIA;
    const permissao = this.validaPermissaoCriador(
      permissaoSolicitada,
      usuarioLogado.permissao,
    );

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
    } else if (
      permissao === 'ARTHUR_SABOYA' ||
      permissao === 'ADM_ARTHUR_SABOYA'
    ) {
      divisaoId = await this.obterDivisaoArthurSaboyaId();
    } else if (!divisaoId && permissao === 'TEC') {
      divisaoId = await this.inferirDivisaoIdPorLoginNoSgu(createUsuarioDto.login);
    }
    const usuario: Usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        permissao,
        divisaoId: this.sanitizarDivisaoId(divisaoId) ?? undefined,
      },
    }).catch((error) => this.mapearErroPersistenciaUsuario(error));
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
    const permissaoFiltro =
      permissao && permissao !== ''
        ? this.normalizarPermissao(permissao)
        : undefined;
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
      ...(permissaoFiltro && { permissao: permissaoFiltro }),
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
      nome,
      nomeSocial,
      login,
      email,
      status,
      avatar,
    } = updateUsuarioDto;
    const divisaoDtoInformada =
      divisaoDto !== undefined && String(divisaoDto).trim() !== ''
        ? String(divisaoDto).trim()
        : undefined;
    // Ponto Focal e Coordenador não podem alterar a divisão do usuário
    let divisaoIdFinal =
      usuarioLogado.permissao === 'PONTO_FOCAL' ||
      usuarioLogado.permissao === 'COORDENADOR'
        ? usuarioAntes.divisaoId
        : divisaoDtoInformada !== undefined
          ? divisaoDtoInformada
          : usuarioAntes.divisaoId;
    const permissaoDtoNormalizada = this.normalizarPermissao(permissaoDto);
    const permissaoAnteriorNormalizada = this.normalizarPermissao(
      usuarioAntes.permissao,
    );
    const permissaoBase =
      permissaoDtoNormalizada ?? permissaoAnteriorNormalizada;
    if (!permissaoBase) {
      throw new BadRequestException('Permissão inválida.');
    }
    const permissaoValida = this.validaPermissaoCriador(
      permissaoBase,
      usuarioLogado.permissao,
    );
    if (
      permissaoValida === 'ARTHUR_SABOYA' ||
      permissaoValida === 'ADM_ARTHUR_SABOYA'
    ) {
      divisaoIdFinal = await this.obterDivisaoArthurSaboyaId();
    }
    const dataAtualizacao: Prisma.UsuarioUncheckedUpdateInput = {
      permissao: permissaoValida,
      divisaoId: this.sanitizarDivisaoId(divisaoIdFinal),
    };
    if (nome !== undefined) dataAtualizacao.nome = nome;
    if (nomeSocial !== undefined) {
      dataAtualizacao.nomeSocial = nomeSocial.trim() || null;
    }
    if (login !== undefined) dataAtualizacao.login = login;
    if (email !== undefined) dataAtualizacao.email = email;
    if (status !== undefined) dataAtualizacao.status = status;
    if (avatar !== undefined) dataAtualizacao.avatar = avatar?.trim() || null;

    await this.prisma.usuario
      .update({
        data: dataAtualizacao,
        where: { id },
      })
      .catch((error) => this.mapearErroPersistenciaUsuario(error));
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

    const ldapUsuario = await this.ldapExterno.buscarPorLogin(login);
    if (!ldapUsuario) {
      throw new NotFoundException('Usuário não encontrado no LDAP.');
    }
    const { nome, email } = ldapUsuario;
    if (!nome || !email) {
      throw new NotFoundException('Dados do usuário incompletos no LDAP.');
    }

    return { login, nome, email: email.toLowerCase() };
  }

  async atualizarUltimoLogin(id: string) {
    await this.prisma.usuario.update({
      where: { id },
      data: { ultimoLogin: new Date() },
    });
  }
}
