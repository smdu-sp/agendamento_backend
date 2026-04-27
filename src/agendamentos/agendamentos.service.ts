import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { CreateAgendamentoPreProjetoDto } from './dto/create-agendamento-pre-projeto.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { PreProjetoSolicitacaoResponseDto } from './dto/pre-projeto-solicitacao-response.dto';
import {
  SolicitacaoPreProjetoListItemDto,
  SolicitacaoPreProjetoPaginadoDto,
} from './dto/solicitacao-pre-projeto-paginado.dto';
import {
  SolicitacaoPreProjetoDetalheComMensagensDto,
  SolicitacaoPreProjetoMensagemDto,
} from './dto/solicitacao-pre-projeto-detalhe.dto';
import { CriarAgendamentoSolicitacaoPreProjetoPortalDto } from './dto/criar-agendamento-solicitacao-pre-projeto-portal.dto';
import {
  PRE_PROJETO_FORMACAO_LABEL,
  PRE_PROJETO_NATUREZA_LABEL,
  PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO,
} from './constants/pre-projetos-form';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  Agendamento,
  AutorMensagemPreProjetoArthurSaboya,
  Prisma,
  StatusAgendamento,
  StatusSolicitacaoPreProjeto,
  Usuario,
} from '@prisma/client';
import { AppService } from 'src/app.service';
import {
  AgendamentoPaginadoResponseDTO,
  AgendamentoResponseDTO,
} from './dto/agendamento-response.dto';
import {
  DashboardResponseDTO,
  DashboardPorMesDTO,
  DashboardPorAnoDTO,
  DashboardPorDiaDTO,
  DashboardPorSemanaDTO,
  DashboardMotivoNaoRealizacaoDTO,
} from './dto/dashboard-response.dto';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { CoordenadoriasService } from 'src/coordenadorias/coordenadorias.service';
import { EmailService } from 'src/email/email.service';
import { instanteCivilSaoPaulo } from './sao-paulo-datetime.util';
import type { MunicipeJwtPayload } from 'src/auth/guards/municipe-jwt-auth.guard';

@Injectable()
export class AgendamentosService {
  private readonly logger = new Logger(AgendamentosService.name);

  /** Cache do id do tipo "Pré-projetos (Arthur Saboya)" para filtros de ponto focal. */
  private preProjetoTipoAgendamentoId: string | null | undefined = undefined;

  constructor(
    private prisma: PrismaService,
    private app: AppService,
    private usuariosService: UsuariosService,
    private coordenadoriasService: CoordenadoriasService,
    private emailService: EmailService,
    private jwtService: JwtService,
  ) {}

  /** UUID da coordenadoria responsável pelas solicitações públicas de pré-projetos (env). */
  private coordenadoriaPreProjetosEnv(): string | undefined {
    const v = process.env.COORDENADORIA_ID_PRE_PROJETOS?.trim();
    return v || undefined;
  }

  /** UUID da divisão (ex.: Sala Arthur Saboya) em que a solicitação pública de pré-projetos é classificada (env). */
  private divisaoPreProjetosEnv(): string | undefined {
    const v = process.env.DIVISAO_ID_PRE_PROJETOS?.trim();
    return v || undefined;
  }

  /** Só retorna id se existir em `divisoes` (evita P2003 com UUID inválido no .env). */
  private async resolverDivisaoIdPreProjetos(): Promise<string | undefined> {
    const id = this.divisaoPreProjetosEnv();
    if (!id) return undefined;
    const row = await this.prisma.divisao.findUnique({
      where: { id },
      select: { id: true },
    });
    if (row) return row.id;
    this.logger.warn(
      `DIVISAO_ID_PRE_PROJETOS="${id}" não encontrado em divisoes; solicitação será salva sem divisaoId.`,
    );
    return undefined;
  }

  /** Só retorna id se existir em `coordenadorias`. */
  private async resolverCoordenadoriaIdPreProjetos(): Promise<
    string | undefined
  > {
    const id = this.coordenadoriaPreProjetosEnv();
    if (!id) return undefined;
    const row = await this.prisma.coordenadoria.findUnique({
      where: { id },
      select: { id: true },
    });
    if (row) return row.id;
    this.logger.warn(
      `COORDENADORIA_ID_PRE_PROJETOS="${id}" não encontrado em coordenadorias; solicitação será salva sem coordenadoriaId.`,
    );
    return undefined;
  }

  private async getPreProjetoTipoAgendamentoId(): Promise<string | null> {
    if (this.preProjetoTipoAgendamentoId !== undefined) {
      return this.preProjetoTipoAgendamentoId;
    }
    const t = await this.prisma.tipoAgendamento.findUnique({
      where: { texto: PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO },
      select: { id: true },
    });
    this.preProjetoTipoAgendamentoId = t?.id ?? null;
    return this.preProjetoTipoAgendamentoId;
  }

  /**
   * Converte RF para login (ex: 8544409 -> d854440)
   */
  private rfParaLogin(rf: string): string | null {
    if (!rf || rf.length < 6) return null;
    // Pega os primeiros 6 dígitos e adiciona "d" no início
    const seisDigitos = rf.substring(0, 6);
    return `d${seisDigitos}`;
  }

  /**
   * Padroniza nome do munícipe: primeira letra de cada palavra em maiúscula, demais em minúscula
   * Ex: "AMANDA CELLI FILHO" -> "Amanda Celli Filho"
   * Ex: "joão da silva" -> "João Da Silva"
   */
  private padronizarNome(nome: string | null): string | null {
    if (!nome || typeof nome !== 'string') return nome;

    // Remove espaços extras e divide em palavras
    const palavras = nome.trim().split(/\s+/);

    // Capitaliza primeira letra de cada palavra e deixa o resto em minúscula
    const palavrasFormatadas = palavras.map((palavra) => {
      if (!palavra) return palavra;
      // Primeira letra em maiúscula, resto em minúscula
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    });

    // Junta as palavras com espaço
    return palavrasFormatadas.join(' ');
  }

  /**
   * Busca ou cria técnico baseado no RF da planilha
   * @param rf - RF do técnico
   * @param coordenadoriaId - ID da coordenadoria (opcional, será atribuída ao técnico se fornecido)
   * @param emailPlanilha - Email do técnico da planilha (opcional, usado na criação se LDAP falhar)
   */
  private async buscarOuCriarTecnicoPorRF(
    rf: string,
    coordenadoriaId?: string,
    emailPlanilha?: string,
  ): Promise<string | null> {
    if (!rf) return null;

    const login = this.rfParaLogin(rf);
    if (!login) return null;

    try {
      // Busca usuário existente pelo login (independente da permissão)
      const usuario = await this.usuariosService.buscarPorLogin(login);
      if (usuario) {
        await this.usuariosService.vincularDivisaoTecnicoPorLoginSeDisponivel(
          login,
          coordenadoriaId,
        );
        return usuario.id;
      }

      // Se não existe, tenta buscar no LDAP e criar automaticamente
      let dadosLDAP: { login: string; nome: string; email: string } | null =
        null;

      try {
        dadosLDAP = await this.usuariosService.buscarNovo(login);
        // Se encontrou no LDAP mas tem email na planilha, usa o da planilha (mais atualizado)
        if (dadosLDAP && emailPlanilha) {
          dadosLDAP.email = emailPlanilha;
        }
      } catch (error) {
        // Se não encontrou no LDAP, cria usuário básico com permissão TEC
        console.log(
          `Técnico com RF ${rf} não encontrado no LDAP. Criando usuário básico...`,
        );

        // Cria nome baseado no login (ex: d854440 -> D854440)
        const nomeBasico = login.charAt(0).toUpperCase() + login.slice(1);
        // Usa email da planilha se disponível, senão cria email básico
        const emailFinal = emailPlanilha || `${login}@smul.prefeitura.sp.gov.br`;

        dadosLDAP = {
          login: login,
          nome: nomeBasico,
          email: emailFinal,
        };
      }

      // Cria o técnico com permissão TEC e coordenadoria (seja do LDAP ou básico)
      if (dadosLDAP) {
        try {
          const novoTecnico = await this.usuariosService.criar(
            {
              nome: dadosLDAP.nome,
              login: dadosLDAP.login,
              email: dadosLDAP.email,
              permissao: 'TEC' as any,
              status: true,
            },
            { permissao: 'ADM' } as Usuario, // Admin temporário para criação
          );
          console.log(
            `Técnico ${dadosLDAP.nome} (${dadosLDAP.login}) criado automaticamente com permissão TEC`,
          );
          await this.usuariosService.vincularDivisaoTecnicoPorLoginSeDisponivel(
            dadosLDAP.login,
            coordenadoriaId,
          );
          return novoTecnico.id;
        } catch (error) {
          console.log(
            `Erro ao criar técnico ${dadosLDAP.login}:`,
            error.message,
          );
        }
      }
    } catch (error) {
      console.log(`Erro ao buscar/criar técnico com RF ${rf}:`, error.message);
    }

    return null;
  }

  /** Divisão do usuário técnico, quando houver vínculo; caso contrário null. */
  private async divisaoIdDoTecnico(
    tecnicoId: string | null,
  ): Promise<string | null> {
    if (!tecnicoId) return null;
    const u = await this.prisma.usuario.findUnique({
      where: { id: tecnicoId },
      select: { divisaoId: true },
    });
    return u?.divisaoId ?? null;
  }

  private async coordenadoriaIdDoUsuarioLogado(
    usuario?: Usuario,
  ): Promise<string | undefined> {
    if (!usuario) return undefined;
    const coordViaToken = (usuario as any).divisao?.coordenadoriaId as
      | string
      | undefined;
    if (coordViaToken) return coordViaToken;
    const divisaoId = (usuario as any).divisaoId as string | undefined;
    if (!divisaoId) return undefined;
    const d = await this.prisma.divisao.findUnique({
      where: { id: divisaoId },
      select: { coordenadoriaId: true },
    });
    return d?.coordenadoriaId ?? undefined;
  }

  private usuarioPodeSerTecnicoAtribuido(usuario: {
    permissao: string;
    divisaoId?: string | null;
  }): boolean {
    return (
      usuario.permissao === 'TEC' ||
      (usuario.permissao === 'DEV' && !!usuario.divisaoId)
    );
  }

  /**
   * Técnico vinculado à divisão da Sala Arthur Saboya (`DIVISAO_ID_PRE_PROJETOS`)
   * enxerga agendamentos em que é o técnico atribuído ou em que `divisaoId` é a da Arthur.
   * Demais técnicos: apenas agendamentos em que são o técnico atribuído.
   * DEV personificando TEC (`permissaoReal === 'DEV'`): mesma visão que “por divisão”
   * da unidade cadastrada no perfil, sem ampliar pelo modo Arthur nem por `tecnicoId`.
   */
  private escopoListaAgendamentosParaTec(usuario: Usuario):
    | { modo: 'dev_impersona_tec'; divisaoId: string }
    | { modo: 'dev_impersona_tec_sem_divisao' }
    | { modo: 'arthur'; divisaoArthurId: string; usuarioId: string }
    | { modo: 'proprio'; usuarioId: string } {
    const permReal = (usuario as any).permissaoReal as string | undefined;
    if (usuario.permissao === 'TEC' && permReal === 'DEV') {
      const divisaoDev = (usuario as any).divisaoId as string | null | undefined;
      if (!divisaoDev) {
        return { modo: 'dev_impersona_tec_sem_divisao' };
      }
      return { modo: 'dev_impersona_tec', divisaoId: divisaoDev };
    }
    const divisaoArthur = this.divisaoPreProjetosEnv();
    const divisaoUsuario = (usuario as any).divisaoId as string | undefined;
    if (
      divisaoArthur &&
      divisaoUsuario &&
      divisaoUsuario === divisaoArthur
    ) {
      return {
        modo: 'arthur',
        divisaoArthurId: divisaoArthur,
        usuarioId: usuario.id,
      };
    }
    return { modo: 'proprio', usuarioId: usuario.id };
  }

  /**
   * Busca tipo de agendamento por texto; se não existir, cadastra automaticamente.
   */
  private async buscarOuCriarTipoPorTexto(
    texto: string,
  ): Promise<string | undefined> {
    const t = String(texto).trim();
    if (!t) return undefined;
    const existente = await this.prisma.tipoAgendamento.findUnique({
      where: { texto: t },
    });
    if (existente) return existente.id;
    const novo = await this.prisma.tipoAgendamento.create({
      data: { texto: t, status: true },
    });
    return novo.id;
  }

  /**
   * Calcula dataFim baseado em dataHora + duracao
   */
  private calcularDataFim(dataHora: Date, duracao: number = 60): Date {
    const dataFim = new Date(dataHora);
    dataFim.setMinutes(dataFim.getMinutes() + duracao);
    return dataFim;
  }

  private formatarDataHoraSaoPaulo(data: Date): string {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(data);
    const byType = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return `${byType('day')}/${byType('month')}/${byType('year')} às ${byType('hour')}:${byType('minute')}`;
  }

  private static readonly REGEX_SOLUCIONADO_COM_AUTOR =
    /^Status do chamado alterado para Solucionado por .+ em (\d{2}\/\d{2}\/\d{4}, às \d{2}:\d{2})$/;

  private formatarMensagemSolucionadoParaMunicipe(corpo: string): string {
    const texto = String(corpo || '').trim();
    const match = texto.match(AgendamentosService.REGEX_SOLUCIONADO_COM_AUTOR);
    if (!match?.[1]) return corpo;
    return `Status do chamado alterado para Solucionado em ${match[1]}`;
  }

  /**
   * Pré-projetos Arthur Saboya: fluxo em `solicitacoes_pre_projeto_arthur_saboya` / portal Pedidos,
   * não na listagem nem no dashboard de `agendamentos`.
   */
  private static whereExcluirPreProjetoArthurNaListaAgendamentos(): Prisma.AgendamentoWhereInput {
    return {
      NOT: {
        tipoAgendamento: { texto: PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO },
      },
    };
  }

  async criar(
    createAgendamentoDto: CreateAgendamentoDto,
  ): Promise<AgendamentoResponseDTO> {
    const { tipoAgendamentoTexto, ...restDto } = createAgendamentoDto;
    let tipoAgendamentoId = restDto.tipoAgendamentoId;
    if (tipoAgendamentoTexto?.trim()) {
      if (
        tipoAgendamentoTexto.trim() === PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO
      ) {
        throw new BadRequestException(
          'Pedidos de pré-projetos (Arthur Saboya) são tratados apenas no menu Pedidos Arthur Saboya, não na criação de agendamentos.',
        );
      }
      tipoAgendamentoId = await this.buscarOuCriarTipoPorTexto(
        tipoAgendamentoTexto.trim(),
      );
    }
    if (tipoAgendamentoId) {
      const tipoRow = await this.prisma.tipoAgendamento.findUnique({
        where: { id: tipoAgendamentoId },
        select: { texto: true },
      });
      if (tipoRow?.texto?.trim() === PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO) {
        throw new BadRequestException(
          'Pedidos de pré-projetos (Arthur Saboya) são tratados apenas no menu Pedidos Arthur Saboya, não na criação de agendamentos.',
        );
      }
    }

    let tecnicoId = restDto.tecnicoId;

    // Se tem tecnicoRF mas não tem tecnicoId, tenta buscar/criar técnico
    if (restDto.tecnicoRF && !tecnicoId) {
      tecnicoId = await this.buscarOuCriarTecnicoPorRF(
        restDto.tecnicoRF,
        restDto.coordenadoriaId,
      );
    }

    const dataHora = new Date(restDto.dataHora);
    const dataFim = restDto.dataFim
      ? new Date(restDto.dataFim)
      : this.calcularDataFim(dataHora, 60);

    // Impede duplicata: mesmo processo + mesma data/hora
    const processoTrim = restDto.processo?.trim();
    if (processoTrim) {
      const existente = await this.prisma.agendamento.findFirst({
        where: {
          processo: processoTrim,
          dataHora,
        },
      });
      if (existente) {
        throw new BadRequestException(
          'Já existe um agendamento com este processo e data/hora.',
        );
      }
    }

    const statusInicial = processoTrim
      ? StatusAgendamento.AGENDADO
      : StatusAgendamento.SOLICITADO;

    const divisaoId = await this.divisaoIdDoTecnico(tecnicoId ?? null);

    const agendamento: Agendamento = await this.prisma.agendamento.create({
      data: {
        ...restDto,
        tipoAgendamentoId,
        status: statusInicial,
        municipe: restDto.municipe
          ? this.padronizarNome(restDto.municipe)
          : null,
        tecnicoId,
        divisaoId,
        dataHora,
        dataFim,
      },
      include: {
        tipoAgendamento: true,
        motivoNaoAtendimento: true,
        coordenadoria: true,
        tecnico: {
          select: {
            id: true,
            nome: true,
            login: true,
            divisao: {
              select: {
                sigla: true,
              },
            },
          },
        },
      },
    });

    return agendamento as AgendamentoResponseDTO;
  }

  /**
   * Protocolo no formato AS-AAAAMMNNN (N = 001..999), sequencial por mês.
   */
  private async gerarProtocoloPreProjetoArthurSaboya(
    tx: Prisma.TransactionClient,
    dataRef: Date,
  ): Promise<string> {
    const ano = dataRef.getFullYear();
    const mes = String(dataRef.getMonth() + 1).padStart(2, '0');
    const prefixo = `AS-${ano}${mes}`;
    const ultimo = await tx.solicitacaoPreProjetoArthurSaboya.findFirst({
      where: { protocolo: { startsWith: prefixo } },
      orderBy: { protocolo: 'desc' },
      select: { protocolo: true },
    });
    const atual = ultimo?.protocolo?.slice(prefixo.length) ?? '000';
    const numero = Number.parseInt(atual, 10);
    const proximo = Number.isFinite(numero) ? numero + 1 : 1;
    if (proximo > 999) {
      throw new BadRequestException(
        'Limite mensal de protocolos Arthur Saboya atingido (999).',
      );
    }
    return `${prefixo}${String(proximo).padStart(3, '0')}`;
  }

  /**
   * Cadastro público alinhado ao formulário `Arthur Saboya/app/pre-projetos/page.tsx`.
   * Persiste em `solicitacoes_pre_projeto_arthur_saboya` (não em `agendamentos`).
   * Se `Authorization: Bearer` for JWT de munícipe válido e o e-mail coincidir com o formulário,
   * vincula `municipeContaId` para consulta no portal.
   */
  async criarSolicitacaoPreProjetos(
    dto: CreateAgendamentoPreProjetoDto,
    authorization?: string,
  ): Promise<PreProjetoSolicitacaoResponseDto> {
    const formacaoTexto =
      dto.formacao === 'outra'
        ? (dto.formacaoOutro ?? '').trim()
        : PRE_PROJETO_FORMACAO_LABEL[
            dto.formacao as keyof typeof PRE_PROJETO_FORMACAO_LABEL
          ];
    const naturezaTexto =
      dto.naturezaDuvida === 'outra'
        ? (dto.naturezaOutro ?? '').trim()
        : PRE_PROJETO_NATUREZA_LABEL[
            dto.naturezaDuvida as keyof typeof PRE_PROJETO_NATUREZA_LABEL
          ];

    const coordPreProjetos = await this.resolverCoordenadoriaIdPreProjetos();
    const divisaoPreProjetos = await this.resolverDivisaoIdPreProjetos();

    const emailForm = dto.email.trim().toLowerCase();
    const municipeContaId = await this.resolverMunicipeContaIdParaAbertura(
      authorization,
      emailForm,
    );

    const id = randomUUID();

    const row = await this.prisma.$transaction(async (tx) => {
      const protocolo = await this.gerarProtocoloPreProjetoArthurSaboya(
        tx,
        new Date(),
      );
      const created = await tx.solicitacaoPreProjetoArthurSaboya.create({
        data: {
          id,
          protocolo,
          nome: this.padronizarNome(dto.nome.trim()) || dto.nome.trim(),
          email: emailForm,
          formacaoValor: dto.formacao,
          formacaoOutro:
            dto.formacao === 'outra' ? (dto.formacaoOutro ?? '').trim() : null,
          formacaoTexto,
          naturezaValor: dto.naturezaDuvida,
          naturezaOutro:
            dto.naturezaDuvida === 'outra'
              ? (dto.naturezaOutro ?? '').trim()
              : null,
          naturezaTexto,
          duvida: dto.descricao.trim(),
          ...(coordPreProjetos ? { coordenadoriaId: coordPreProjetos } : {}),
          ...(divisaoPreProjetos ? { divisaoId: divisaoPreProjetos } : {}),
          ...(municipeContaId ? { municipeContaId } : {}),
        },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: created.id,
          autor: AutorMensagemPreProjetoArthurSaboya.MUNICIPE,
          corpo: created.duvida,
          municipeContaId,
        },
      });
      return created;
    });

    return { id: row.id, protocolo: row.protocolo };
  }

  private async resolverMunicipeContaIdParaAbertura(
    authorization: string | undefined,
    emailFormulario: string,
  ): Promise<string | null> {
    const tokenInfo = this.verificarTokenMunicipeOpcional(authorization);
    if (!tokenInfo) return null;
    if (tokenInfo.email !== emailFormulario) {
      throw new BadRequestException(
        'O e-mail do formulário deve ser o mesmo da conta logada no portal.',
      );
    }
    const conta = await this.prisma.municipeConta.findUnique({
      where: { id: tokenInfo.sub },
      select: { id: true, email: true, status: true },
    });
    if (!conta?.status || conta.email !== emailFormulario) {
      throw new BadRequestException('Sessão de munícipe inválida.');
    }
    return conta.id;
  }

  private verificarTokenMunicipeOpcional(
    authorization?: string,
  ): { sub: string; email: string } | null {
    if (!authorization?.trim().toLowerCase().startsWith('bearer ')) {
      return null;
    }
    const token = authorization.slice(7).trim();
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<{
        sub?: string;
        email?: string;
        escopo?: string;
      }>(token, { secret: process.env.JWT_SECRET });
      if (payload?.escopo !== 'MUNICIPE' || !payload.sub || !payload.email) {
        return null;
      }
      return {
        sub: payload.sub,
        email: String(payload.email).trim().toLowerCase(),
      };
    } catch {
      return null;
    }
  }

  private escopoWhereMunicipe(m: MunicipeJwtPayload) {
    return {
      OR: [
        { municipeContaId: m.id },
        { AND: [{ municipeContaId: null }, { email: m.email }] },
      ],
    } satisfies Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput;
  }

  async listarMinhasSolicitacoesPreProjetosMunicipe(
    municipe: MunicipeJwtPayload,
    pagina: number,
    limite: number,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    return this.listarSolicitacoesPreProjetoComWhere(
      pagina,
      limite,
      undefined,
      this.escopoWhereMunicipe(municipe),
    );
  }

  async obterSolicitacaoDetalheMunicipe(
    id: string,
    municipe: MunicipeJwtPayload,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const row = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst({
      where: {
        AND: [{ id }, this.escopoWhereMunicipe(municipe)],
      },
      select: this.solicitacaoPortalDetalheSelect(),
    });
    if (!row) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    return this.mapSolicitacaoDetalheComMensagens(row, true);
  }

  async adicionarMensagemMunicipeNaSolicitacao(
    id: string,
    municipe: MunicipeJwtPayload,
    texto: string,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const corpo = texto.trim();
    if (!corpo) {
      throw new BadRequestException('Mensagem vazia.');
    }
    const existe = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst(
      {
        where: {
          AND: [{ id }, this.escopoWhereMunicipe(municipe)],
        },
        select: { id: true, status: true },
      },
    );
    if (!existe) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (existe.status === StatusSolicitacaoPreProjeto.RESPONDIDO) {
      throw new BadRequestException(
        'Este chamado já foi marcado como solucionado e não aceita novas mensagens.',
      );
    }
    await this.prisma.solicitacaoPreProjetoArthurSaboyaMensagem.create({
      data: {
        solicitacaoId: id,
        autor: AutorMensagemPreProjetoArthurSaboya.MUNICIPE,
        corpo,
        municipeContaId: municipe.id,
      },
    });
    return this.obterSolicitacaoDetalheMunicipe(id, municipe);
  }

  async marcarSolicitacaoMunicipeComoSolucionada(
    id: string,
    municipe: MunicipeJwtPayload,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const existe = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst({
      where: {
        AND: [{ id }, this.escopoWhereMunicipe(municipe)],
      },
      select: { id: true, status: true },
    });
    if (!existe) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (existe.status === StatusSolicitacaoPreProjeto.RESPONDIDO) {
      return this.obterSolicitacaoDetalheMunicipe(id, municipe);
    }

    const nomeMunicipe = municipe.nome?.trim() || 'Munícipe';
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id },
        data: { status: StatusSolicitacaoPreProjeto.RESPONDIDO },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo: `Chamado marcado como solucionado por ${nomeMunicipe}.`,
          municipeContaId: municipe.id,
        },
      });
    });

    return this.obterSolicitacaoDetalheMunicipe(id, municipe);
  }

  private async notificarCancelamentoAtendimentoMunicipe(params: {
    solicitacaoId: string;
    protocolo: string;
    nomeMunicipe: string;
    emailMunicipe: string;
    coordenadoriaId: string | null;
    tecnicoArthurId: string | null;
    agendamentoTecnicoId: string | null;
    dataAgendamento?: Date | null;
  }): Promise<void> {
    const caixaArthurSaboya = 'saboya_atendimento@prefeitura.sp.gov.br';
    const destinatarios = new Set<string>([caixaArthurSaboya]);

    if (params.coordenadoriaId) {
      const pontosFocais = await this.prisma.usuario.findMany({
        where: {
          status: true,
          permissao: 'PONTO_FOCAL',
          divisao: { coordenadoriaId: params.coordenadoriaId },
          email: { not: null },
        },
        select: { email: true },
      });
      for (const pf of pontosFocais) {
        const email = pf.email?.trim();
        if (email) destinatarios.add(email);
      }
    }

    const idsTecnicos = [params.tecnicoArthurId, params.agendamentoTecnicoId].filter(
      (v): v is string => !!v,
    );
    if (idsTecnicos.length > 0) {
      const tecnicos = await this.prisma.usuario.findMany({
        where: {
          id: { in: idsTecnicos },
          status: true,
          email: { not: null },
        },
        select: { email: true },
      });
      for (const tecnico of tecnicos) {
        const email = tecnico.email?.trim();
        if (email) destinatarios.add(email);
      }
    }

    try {
      await this.emailService.enviarNotificacaoCancelamentoAtendimentoArthurSaboya(
        {
          protocolo: params.protocolo,
          nomeMunicipe: params.nomeMunicipe,
          emailMunicipe: params.emailMunicipe,
          dataAgendamento: params.dataAgendamento ?? null,
          destinatarios: Array.from(destinatarios),
        },
      );
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de cancelamento da solicitação ${params.solicitacaoId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async cancelarAtendimentoSolicitacaoMunicipe(
    id: string,
    municipe: MunicipeJwtPayload,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const solicitacao = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst({
      where: {
        AND: [{ id }, this.escopoWhereMunicipe(municipe)],
      },
      select: {
        id: true,
        status: true,
        protocolo: true,
        nome: true,
        email: true,
        coordenadoriaId: true,
        tecnicoArthurId: true,
        dataAgendamento: true,
        agendamento: { select: { tecnicoId: true } },
      },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (solicitacao.status === StatusSolicitacaoPreProjeto.RESPONDIDO) {
      throw new BadRequestException(
        'Este chamado já foi solucionado e não pode ser cancelado.',
      );
    }
    if (solicitacao.status !== StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO) {
      throw new BadRequestException(
        'Somente atendimentos já agendados podem ser cancelados.',
      );
    }

    const nomeMunicipe = municipe.nome?.trim() || 'Munícipe';
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id },
        data: {
          status: StatusSolicitacaoPreProjeto.AGUARDANDO_DATA,
          dataAgendamento: null,
          agendamentoId: null,
        },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo:
            `Atendimento cancelado pelo munícipe ${nomeMunicipe}. ` +
            'A solicitação voltou para Aguardando data/hora.',
          municipeContaId: municipe.id,
        },
      });
    });

    await this.notificarCancelamentoAtendimentoMunicipe({
      solicitacaoId: solicitacao.id,
      protocolo: solicitacao.protocolo,
      nomeMunicipe: solicitacao.nome,
      emailMunicipe: solicitacao.email,
      coordenadoriaId: solicitacao.coordenadoriaId ?? null,
      tecnicoArthurId: solicitacao.tecnicoArthurId ?? null,
      agendamentoTecnicoId: solicitacao.agendamento?.tecnicoId ?? null,
      dataAgendamento: solicitacao.dataAgendamento ?? null,
    });

    return this.obterSolicitacaoDetalheMunicipe(id, municipe);
  }

  async avaliarSolicitacaoPreProjetoMunicipe(
    id: string,
    municipe: MunicipeJwtPayload,
    nota: number,
    comentario?: string,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const solicitacao = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst({
      where: {
        AND: [{ id }, this.escopoWhereMunicipe(municipe)],
      },
      select: { id: true, status: true, avaliacaoNota: true },
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (solicitacao.status !== StatusSolicitacaoPreProjeto.RESPONDIDO) {
      throw new BadRequestException(
        'A avaliação só pode ser registrada após o chamado ser marcado como solucionado.',
      );
    }
    if (solicitacao.avaliacaoNota !== null) {
      throw new BadRequestException('A avaliação deste chamado já foi registrada.');
    }
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      throw new BadRequestException('A nota deve ser um número inteiro entre 1 e 5.');
    }

    const comentarioLimpo = comentario?.trim() || null;
    const estrelasLabel = `${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`;
    const complementoComentario = comentarioLimpo
      ? ` Comentário: ${comentarioLimpo}`
      : '';

    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id },
        data: {
          avaliacaoNota: nota,
          avaliacaoComentario: comentarioLimpo,
          avaliacaoEm: new Date(),
        },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo: `Avaliação registrada pelo munícipe: ${estrelasLabel}.${complementoComentario}`,
          municipeContaId: municipe.id,
        },
      });
    });

    return this.obterSolicitacaoDetalheMunicipe(id, municipe);
  }

  async obterSolicitacaoPortalDetalheComMensagens(
    refUuidOuProtocolo: string,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const s = await this.assertSolicitacaoPortalArthurSaboya(refUuidOuProtocolo, usuario);
    const row = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      {
        where: { id: s.id },
        select: this.solicitacaoPortalDetalheSelect(),
      },
    );
    return this.mapSolicitacaoDetalheComMensagens(row);
  }

  async adicionarMensagemPortalArthurSaboya(
    refUuidOuProtocolo: string,
    texto: string,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoDetalheComMensagensDto> {
    const corpo = texto.trim();
    if (!corpo) {
      throw new BadRequestException('Mensagem vazia.');
    }
    const divSala = this.divisaoPreProjetosEnv();
    const divUser = (usuario as any).divisaoId as string | undefined;
    if (!divSala) {
      throw new ForbiddenException(
        'Divisão da Sala Arthur Saboya não configurada no sistema.',
      );
    }
    const podeComoStaffInterno =
      usuario.permissao === 'DEV' || usuario.permissao === 'ADM';
    const podeComoTecnicoSala =
      (usuario.permissao === 'TEC' || usuario.permissao === 'ARTHUR_SABOYA') &&
      !!divUser &&
      divUser === divSala;
    if (!podeComoStaffInterno && !podeComoTecnicoSala) {
      throw new ForbiddenException(
        'Somente o técnico da Sala Arthur Saboya (ou perfil administrativo autorizado) pode enviar mensagens neste chamado.',
      );
    }

    const id = await this.resolverIdSolicitacaoPreProjetoPortalRef(refUuidOuProtocolo);
    const s = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUnique({
      where: { id },
      select: { id: true, status: true, divisaoId: true },
    });
    if (!s) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    const divisaoSolicitacao = s.divisaoId ?? divSala;
    if (divisaoSolicitacao !== divSala) {
      throw new ForbiddenException(
        'Apenas chamados da Sala Arthur Saboya aceitam mensagem do técnico da Sala Arthur.',
      );
    }
    if (s.status === StatusSolicitacaoPreProjeto.RESPONDIDO) {
      throw new BadRequestException(
        'Este chamado já foi marcado como solucionado e não aceita novas mensagens.',
      );
    }
    await this.prisma.solicitacaoPreProjetoArthurSaboyaMensagem.create({
      data: {
        solicitacaoId: s.id,
        autor: AutorMensagemPreProjetoArthurSaboya.PONTO_FOCAL,
        corpo,
        usuarioId: usuario.id,
      },
    });
    const row = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      {
        where: { id: s.id },
        select: this.solicitacaoPortalDetalheSelect(),
      },
    );
    return this.mapSolicitacaoDetalheComMensagens(row);
  }

  private solicitacaoPortalDetalheSelect(): Prisma.SolicitacaoPreProjetoArthurSaboyaSelect {
    return {
      ...this.solicitacaoPortalListSelect(),
      mensagens: {
        orderBy: { criadoEm: 'asc' },
        select: {
          id: true,
          autor: true,
          corpo: true,
          criadoEm: true,
          usuario: { select: { nome: true } },
          municipeConta: { select: { nome: true } },
        },
      },
    };
  }

  private mapSolicitacaoDetalheComMensagens(
    r: unknown,
    ocultarNomeEquipeNoPortalMunicipe: boolean = false,
  ): SolicitacaoPreProjetoDetalheComMensagensDto {
    const full = r as {
      mensagens: Array<{
        id: string;
        autor: AutorMensagemPreProjetoArthurSaboya;
        corpo: string;
        criadoEm: Date;
        usuario: { nome: string } | null;
        municipeConta: { nome: string } | null;
      }>;
    } & Record<string, unknown>;
    const { mensagens, ...rest } = full;
    const base = this.mapSolicitacaoRowToListItem(rest);
    const nomeSolic = base.nome;
    const mensagensDto: SolicitacaoPreProjetoMensagemDto[] = mensagens.map(
      (m) => {
        const corpoSistema = ocultarNomeEquipeNoPortalMunicipe
          ? this.formatarMensagemSolucionadoParaMunicipe(m.corpo)
          : m.corpo;
        return {
          id: m.id,
          autor: m.autor,
          corpo:
            m.autor === AutorMensagemPreProjetoArthurSaboya.SISTEMA
              ? corpoSistema
              : m.corpo,
          criadoEm: m.criadoEm,
          nomeRemetente:
            m.autor === AutorMensagemPreProjetoArthurSaboya.SISTEMA
              ? 'Sistema'
              : m.autor === AutorMensagemPreProjetoArthurSaboya.PONTO_FOCAL
                ? ocultarNomeEquipeNoPortalMunicipe
                  ? 'Arthur Saboya'
                  : m.usuario?.nome ?? 'Equipe'
                : m.municipeConta?.nome ?? nomeSolic,
        };
      },
    );
    return { ...base, mensagens: mensagensDto };
  }

  /**
   * Lista solicitações de pré-projetos (tabela dedicada). Recorte por permissão
   * alinhado ao de agendamentos (exceto TEC).
   */
  async buscarSolicitacoesPreProjetosArthurSaboya(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    usuarioLogado?: Usuario,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const andParts: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput[] = [];

    if (busca?.trim()) {
      const b = busca.trim();
      andParts.push({
        OR: [
          { nome: { contains: b } },
          { email: { contains: b } },
          { protocolo: { contains: b } },
          { duvida: { contains: b } },
        ],
      });
    }

    if (usuarioLogado) {
      const perm = usuarioLogado.permissao;
      const permReal = (usuarioLogado as any).permissaoReal as
        | string
        | undefined;
      const isAdmOuDevRealOuEfetivo =
        perm === 'ADM' ||
        perm === 'DEV' ||
        permReal === 'ADM' ||
        permReal === 'DEV';
      if (perm === 'PONTO_FOCAL') {
        const divId = (usuarioLogado as any).divisaoId as string | undefined;
        const coordId = (usuarioLogado as any).divisao?.coordenadoriaId as
          | string
          | undefined;
        if (!divId && !coordId) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        const orPerm: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput[] = [];
        if (divId) orPerm.push({ divisaoId: divId });
        if (coordId) orPerm.push({ coordenadoriaId: coordId });
        andParts.push({ OR: orPerm });
      } else if (perm === 'COORDENADOR') {
        const coordId = (usuarioLogado as any).divisao?.coordenadoriaId as
          | string
          | undefined;
        if (!coordId) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        andParts.push({ coordenadoriaId: coordId });
      } else if (perm === 'DIRETOR') {
        const divId = (usuarioLogado as any).divisaoId as string | undefined;
        if (!divId) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        andParts.push({ divisaoId: divId });
      } else if (!isAdmOuDevRealOuEfetivo && perm !== 'PORTARIA') {
        return { total: 0, pagina: 0, limite: 0, data: [] };
      }
    }

    const where: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    const total = await this.prisma.solicitacaoPreProjetoArthurSaboya.count({
      where,
    });
    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    const data = await this.prisma.solicitacaoPreProjetoArthurSaboya.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data,
    };
  }

  /**
   * Lista pedidos de pré-projetos para o portal interno da Sala Arthur Saboya.
   * Apenas perfis autorizados no portal Arthur Saboya.
   */
  async buscarSolicitacoesPreProjetosPortalArthurSaboya(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    usuarioLogado?: Usuario,
    statusFiltro?: StatusSolicitacaoPreProjeto,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    if (!usuarioLogado) {
      throw new ForbiddenException('Autenticação necessária.');
    }
    const perm = usuarioLogado.permissao;
    const permReal = (usuarioLogado as any).permissaoReal as
      | string
      | undefined;
    const divSala = this.divisaoPreProjetosEnv();

    const divUser = (usuarioLogado as any).divisaoId as string | undefined;
    const isDevRealOuEfetivo = perm === 'DEV' || permReal === 'DEV';
    const isAdmRealOuEfetivo = perm === 'ADM' || permReal === 'ADM';
    const isAdmSalaArthur =
      isAdmRealOuEfetivo &&
      !!divSala &&
      !!divUser &&
      divUser === divSala;

    if (isDevRealOuEfetivo || isAdmSalaArthur) {
      return this.listarSolicitacoesPreProjetoComWhere(
        pagina,
        limite,
        busca,
        {},
        statusFiltro,
      );
    }

    if (perm === 'TEC' || perm === 'ARTHUR_SABOYA') {
      if (divSala && divUser && divUser === divSala) {
        return this.listarSolicitacoesPreProjetoComWhere(
          pagina,
          limite,
          busca,
          {
            divisaoId: divSala,
          },
          statusFiltro,
        );
      }
      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuarioLogado);
      if (!coordId) {
        throw new ForbiddenException(
          'Acesso restrito a usuários vinculados a uma coordenadoria.',
        );
      }
      return this.listarSolicitacoesPreProjetoComWhere(
        pagina,
        limite,
        busca,
        {
          coordenadoriaId: coordId,
        },
        statusFiltro ?? StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO,
      );
    }

    if (perm === 'PONTO_FOCAL') {
      if (divSala && divUser && divUser === divSala) {
        return this.listarSolicitacoesPreProjetoComWhere(
          pagina,
          limite,
          busca,
          {
            divisaoId: divSala,
          },
          statusFiltro,
        );
      }
      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuarioLogado);
      if (!coordId) {
        throw new ForbiddenException(
          'Acesso restrito a usuários vinculados a uma coordenadoria.',
        );
      }
      return this.listarSolicitacoesPreProjetoComWhere(
        pagina,
        limite,
        busca,
        {
          coordenadoriaId: coordId,
        },
        statusFiltro ?? StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO,
      );
    }

    if (perm === 'COORDENADOR') {
      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuarioLogado);
      if (!coordId) {
        throw new ForbiddenException(
          'Acesso restrito a usuários vinculados a uma coordenadoria.',
        );
      }
      return this.listarSolicitacoesPreProjetoComWhere(
        pagina,
        limite,
        busca,
        {
          coordenadoriaId: coordId,
        },
        statusFiltro ?? StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO,
      );
    }

    if (!isAdmRealOuEfetivo) {
      throw new ForbiddenException(
        'Sem permissão para acessar o portal de pré-projetos.',
      );
    }
    return this.listarSolicitacoesPreProjetoComWhere(
      pagina,
      limite,
      busca,
      {},
      statusFiltro,
    );
  }

  private solicitacaoPortalListSelect(): Prisma.SolicitacaoPreProjetoArthurSaboyaSelect {
    return {
      id: true,
      protocolo: true,
      criadoEm: true,
      nome: true,
      email: true,
      formacaoValor: true,
      formacaoOutro: true,
      formacaoTexto: true,
      naturezaValor: true,
      naturezaOutro: true,
      naturezaTexto: true,
      duvida: true,
      status: true,
      agendamentoId: true,
      avaliacaoNota: true,
      avaliacaoComentario: true,
      avaliacaoEm: true,
      dataAgendamento: true,
      coordenadoriaId: true,
      divisaoId: true,
      tecnicoArthurId: true,
      tecnicoArthur: {
        select: {
          nome: true,
          email: true,
        },
      },
      divisao: {
        select: {
          coordenadoria: {
            select: { id: true, email: true, sigla: true, nome: true },
          },
        },
      },
      coordenadoria: { select: { id: true, email: true, sigla: true, nome: true } },
    };
  }

  private static formatCoordenadoriaLabel(
    c: { sigla: string; nome?: string | null } | null | undefined,
  ): string | null {
    if (!c?.sigla?.trim()) return null;
    const sigla = c.sigla.trim();
    const nome = c.nome?.trim();
    return nome ? `${sigla} — ${nome}` : sigla;
  }

  /**
   * O Prisma pode incluir `agendamento` no payload por causa da relação 1:1;
   * não repassamos isso ao DTO da API.
   */
  private mapSolicitacaoRowToListItem(r: unknown): SolicitacaoPreProjetoListItemDto {
    const row = r as {
      divisao?: {
        coordenadoria?: {
          id: string;
          email?: string | null;
          sigla: string;
          nome?: string | null;
        } | null;
      } | null;
      coordenadoria?: {
        id: string;
        email?: string | null;
        sigla: string;
        nome?: string | null;
      } | null;
      tecnicoArthur?: {
        nome?: string | null;
        email?: string | null;
      } | null;
      agendamento?: unknown;
    } & Omit<
      SolicitacaoPreProjetoListItemDto,
      | 'emailContatoDivisao'
      | 'coordenadoriaTexto'
      | 'tecnicoArthurNome'
      | 'tecnicoArthurEmail'
    >;
    const { divisao, coordenadoria, tecnicoArthur, agendamento: _ag, ...rest } =
      row;
    const coordenadoriaTexto =
      AgendamentosService.formatCoordenadoriaLabel(coordenadoria) ??
      AgendamentosService.formatCoordenadoriaLabel(divisao?.coordenadoria) ??
      null;
    return {
      ...rest,
      coordenadoriaId:
        rest.coordenadoriaId ??
        coordenadoria?.id ??
        divisao?.coordenadoria?.id ??
        null,
      emailContatoDivisao:
        divisao?.coordenadoria?.email?.trim() ||
        coordenadoria?.email?.trim() ||
        null,
      tecnicoArthurNome: tecnicoArthur?.nome?.trim() || null,
      tecnicoArthurEmail: tecnicoArthur?.email?.trim() || null,
      coordenadoriaTexto,
    };
  }

  private async listarSolicitacoesPreProjetoComWhere(
    pagina: number,
    limite: number,
    busca: string | undefined,
    escopo: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput,
    statusFiltro?: StatusSolicitacaoPreProjeto,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const andParts: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput[] = [];
    if (busca?.trim()) {
      const b = busca.trim();
      andParts.push({
        OR: [
          { nome: { contains: b } },
          { email: { contains: b } },
          { protocolo: { contains: b } },
          { duvida: { contains: b } },
        ],
      });
    }
    if (escopo && Object.keys(escopo).length > 0) {
      andParts.push(escopo);
    }
    if (statusFiltro) {
      andParts.push({ status: statusFiltro });
    }

    const where: Prisma.SolicitacaoPreProjetoArthurSaboyaWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    const total = await this.prisma.solicitacaoPreProjetoArthurSaboya.count({
      where,
    });
    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    const sel = this.solicitacaoPortalListSelect();
    const rows = await this.prisma.solicitacaoPreProjetoArthurSaboya.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
      select: sel,
    });

    const data = rows.map((row) => this.mapSolicitacaoRowToListItem(row));

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data,
    };
  }

  /** Id da solicitação (UUID) — se não casar, trata `ref` como `protocolo` (ex.: AS-202604001). */
  private static readonly REF_UUID_SOLICITACAO =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Resolve referência da URL (UUID da solicitação ou `protocolo` único) para o id interno.
   */
  private async resolverIdSolicitacaoPreProjetoPortalRef(
    ref: string,
  ): Promise<string> {
    const raw = ref?.trim() ?? '';
    if (!raw) {
      throw new BadRequestException('Identificador do chamado inválido.');
    }
    if (AgendamentosService.REF_UUID_SOLICITACAO.test(raw)) {
      return raw;
    }
    const protocolo = raw.toUpperCase();
    const row = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUnique({
      where: { protocolo },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    return row.id;
  }

  /**
   * Garante que a solicitação existe e que o usuário pode operá-la no portal Arthur Saboya.
   */
  private async assertSolicitacaoPortalArthurSaboya(
    refUuidOuProtocolo: string,
    usuario: Usuario,
  ) {
    const id = await this.resolverIdSolicitacaoPreProjetoPortalRef(refUuidOuProtocolo);
    const row = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        protocolo: true,
        status: true,
        divisaoId: true,
        coordenadoriaId: true,
        agendamentoId: true,
        duvida: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    const perm = usuario.permissao;
    const permReal = (usuario as any).permissaoReal as string | undefined;
    const divSala = this.divisaoPreProjetosEnv();
    const divUser = (usuario as any).divisaoId as string | undefined;
    const isDevRealOuEfetivo = perm === 'DEV' || permReal === 'DEV';
    const isAdmRealOuEfetivo = perm === 'ADM' || permReal === 'ADM';
    const isAdmSalaArthur =
      isAdmRealOuEfetivo &&
      !!divSala &&
      !!divUser &&
      divUser === divSala;
    if (isDevRealOuEfetivo || isAdmSalaArthur || isAdmRealOuEfetivo) {
      return row;
    }

    if (perm === 'PONTO_FOCAL') {
      if (divSala && divUser && divUser === divSala) {
        if (row.divisaoId !== divSala) {
          throw new ForbiddenException(
            'Esta solicitação não pertence à divisão do portal.',
          );
        }
        return row;
      }

      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuario);
      if (!coordId || !row.coordenadoriaId || row.coordenadoriaId !== coordId) {
        throw new ForbiddenException(
          'Sem permissão para operar solicitações fora da sua coordenadoria.',
        );
      }
      return row;
    }

    if (perm === 'COORDENADOR') {
      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuario);
      if (!coordId || !row.coordenadoriaId || row.coordenadoriaId !== coordId) {
        throw new ForbiddenException(
          'Sem permissão para operar solicitações fora da sua coordenadoria.',
        );
      }
      return row;
    }

    if (perm === 'TEC' || perm === 'ARTHUR_SABOYA') {
      if (divSala && divUser && divUser === divSala) {
        if (row.divisaoId !== divSala) {
          throw new ForbiddenException(
            'Esta solicitação não pertence à divisão da Sala Arthur Saboya.',
          );
        }
        return row;
      }
      const coordId = await this.coordenadoriaIdDoUsuarioLogado(usuario);
      if (!coordId || !row.coordenadoriaId || row.coordenadoriaId !== coordId) {
        throw new ForbiddenException(
          'Sem permissão para operar solicitações fora da sua coordenadoria.',
        );
      }
      return row;
    }

    throw new ForbiddenException('Sem permissão para esta operação.');
  }

  async portalArthurSaboyaConfirmarRespostaEnviada(
    refUuidOuProtocolo: string,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoListItemDto> {
    if (usuario.permissao !== 'ARTHUR_SABOYA') {
      throw new ForbiddenException(
        'Apenas o perfil Arthur_saboya pode marcar chamado como solucionado.',
      );
    }
    const s = await this.assertSolicitacaoPortalArthurSaboya(refUuidOuProtocolo, usuario);
    if (
      s.status !== StatusSolicitacaoPreProjeto.SOLICITADO &&
      s.status !== StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO
    ) {
      throw new BadRequestException(
        'Só é possível concluir solicitações com status Solicitado ou Agendamento criado.',
      );
    }
    const nomeResponsavel =
      usuario.nomeSocial?.trim() || usuario.nome?.trim() || 'Equipe Arthur Saboya';
    const dataHoraTexto = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id: s.id },
        data: { status: StatusSolicitacaoPreProjeto.RESPONDIDO },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: s.id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo:
            `Status do chamado alterado para Solucionado por ${nomeResponsavel} ` +
            `em ${dataHoraTexto.replace(' ', ', às ')}`,
        },
      });
    });
    const sel = this.solicitacaoPortalListSelect();
    const r = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      { where: { id: s.id }, select: sel },
    );
    return this.mapSolicitacaoRowToListItem(r);
  }

  async portalArthurSaboyaMarcarAguardandoData(
    refUuidOuProtocolo: string,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoListItemDto> {
    const s = await this.assertSolicitacaoPortalArthurSaboya(refUuidOuProtocolo, usuario);
    if (
      s.status !== StatusSolicitacaoPreProjeto.SOLICITADO &&
      s.status !== StatusSolicitacaoPreProjeto.RESPONDIDO
    ) {
      throw new BadRequestException(
        'Só é possível marcar como aguardando data a partir de Solicitado ou Respondido.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id: s.id },
        data: { status: StatusSolicitacaoPreProjeto.AGUARDANDO_DATA },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: s.id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo:
            'Status do chamado alterado para Aguardando data/hora para envio à coordenadoria.',
        },
      });
    });
    const sel = this.solicitacaoPortalListSelect();
    const r = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      { where: { id: s.id }, select: sel },
    );
    return this.mapSolicitacaoRowToListItem(r);
  }

  async portalArthurSaboyaCriarAgendamentoDaSolicitacao(
    refUuidOuProtocolo: string,
    dto: CriarAgendamentoSolicitacaoPreProjetoPortalDto,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoListItemDto> {
    const s = await this.assertSolicitacaoPortalArthurSaboya(refUuidOuProtocolo, usuario);
    if (
      s.status !== StatusSolicitacaoPreProjeto.SOLICITADO &&
      s.status !== StatusSolicitacaoPreProjeto.AGUARDANDO_DATA
    ) {
      throw new BadRequestException(
        'Só é possível registrar agendamento a partir de Solicitado ou Aguardando data (não após solucionado).',
      );
    }
    const coord = await this.prisma.coordenadoria.findUnique({
      where: { id: dto.coordenadoriaId },
      select: { id: true },
    });
    if (!coord) {
      throw new BadRequestException('Coordenadoria inválida.');
    }
    const dataHora = new Date(dto.dataHora);
    if (Number.isNaN(dataHora.getTime())) {
      throw new BadRequestException('Data e hora inválidas.');
    }
    const divisaoId =
      s.divisaoId ?? this.divisaoPreProjetosEnv() ?? undefined;
    if (!divisaoId) {
      throw new BadRequestException(
        'Divisão da Sala Arthur Saboya não configurada para esta solicitação.',
      );
    }
    const tecnicoArthur = await this.prisma.usuario.findUnique({
      where: { id: dto.tecnicoId },
      select: { id: true, permissao: true, status: true, divisaoId: true },
    });
    if (!tecnicoArthur || !tecnicoArthur.status) {
      throw new BadRequestException('Técnico da Sala Arthur Saboya inválido.');
    }
    if (!this.usuarioPodeSerTecnicoAtribuido(tecnicoArthur)) {
      throw new BadRequestException(
        'Técnico da Sala Arthur Saboya deve ser técnico ou DEV com unidade.',
      );
    }
    if (tecnicoArthur.divisaoId !== divisaoId) {
      throw new BadRequestException(
        'O técnico informado não pertence à divisão da Sala Arthur Saboya.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoPreProjetoArthurSaboya.update({
        where: { id: s.id },
        data: {
          status: StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO,
          coordenadoriaId: dto.coordenadoriaId,
          dataAgendamento: dataHora,
          agendamentoId: null,
          tecnicoArthurId: dto.tecnicoId,
        },
      });
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: s.id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo:
            'Agendamento efetuado. Verifique as informações no seu e-mail.',
        },
      });
    });
    const sel = this.solicitacaoPortalListSelect();
    const r = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      { where: { id: s.id }, select: sel },
    );
    return this.mapSolicitacaoRowToListItem(r);
  }

  async portalArthurSaboyaAtribuirTecnicoCoordenadoria(
    refUuidOuProtocolo: string,
    tecnicoId: string,
    usuario: Usuario,
  ): Promise<SolicitacaoPreProjetoListItemDto> {
    const s = await this.assertSolicitacaoPortalArthurSaboya(refUuidOuProtocolo, usuario);
    if (s.status !== StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO) {
      throw new BadRequestException(
        'Só é possível atribuir técnico da coordenadoria quando o chamado já foi encaminhado.',
      );
    }
    if (!s.coordenadoriaId) {
      throw new BadRequestException(
        'A solicitação ainda não possui coordenadoria definida.',
      );
    }

    const tecnicoCoord = await this.prisma.usuario.findUnique({
      where: { id: tecnicoId },
      select: {
        id: true,
        nome: true,
        login: true,
        permissao: true,
        status: true,
        divisaoId: true,
        divisao: { select: { coordenadoriaId: true } },
      },
    });
    if (!tecnicoCoord || !tecnicoCoord.status) {
      throw new BadRequestException('Técnico da coordenadoria inválido.');
    }
    if (!this.usuarioPodeSerTecnicoAtribuido(tecnicoCoord)) {
      throw new BadRequestException(
        'Técnico da coordenadoria deve ser técnico ou DEV com unidade.',
      );
    }
    if (tecnicoCoord.divisao?.coordenadoriaId !== s.coordenadoriaId) {
      throw new BadRequestException(
        'O técnico informado não pertence à coordenadoria do chamado.',
      );
    }

    const solDetalhes = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow({
      where: { id: s.id },
      select: { dataAgendamento: true, agendamentoId: true, nome: true, email: true },
    });

    if (!solDetalhes.dataAgendamento) {
      throw new BadRequestException(
        'A solicitação não possui data de agendamento definida.',
      );
    }

    const tipoId = await this.getPreProjetoTipoAgendamentoId();
    const nomeTecnico = tecnicoCoord.nome ?? tecnicoCoord.login;

    await this.prisma.$transaction(async (tx) => {
      if (solDetalhes.agendamentoId) {
        await tx.agendamento.update({
          where: { id: solDetalhes.agendamentoId },
          data: {
            tecnicoId,
            divisaoId: tecnicoCoord.divisaoId,
          },
        });
      } else {
        const novoAgendamento = await tx.agendamento.create({
          data: {
            municipe: solDetalhes.nome,
            email: solDetalhes.email,
            processo: s.protocolo,
            dataHora: solDetalhes.dataAgendamento,
            dataFim: this.calcularDataFim(solDetalhes.dataAgendamento, 60),
            coordenadoriaId: s.coordenadoriaId,
            divisaoId: tecnicoCoord.divisaoId,
            tecnicoId,
            tipoAgendamentoId: tipoId ?? undefined,
            status: StatusAgendamento.AGENDADO,
          },
        });
        await tx.solicitacaoPreProjetoArthurSaboya.update({
          where: { id: s.id },
          data: { agendamentoId: novoAgendamento.id },
        });
      }
      await tx.solicitacaoPreProjetoArthurSaboyaMensagem.create({
        data: {
          solicitacaoId: s.id,
          autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
          corpo: `Técnico da coordenadoria atribuído: ${nomeTecnico}.`,
          usuarioId: usuario.id,
        },
      });
    });

    const sel = this.solicitacaoPortalListSelect();
    const r = await this.prisma.solicitacaoPreProjetoArthurSaboya.findUniqueOrThrow(
      { where: { id: s.id }, select: sel },
    );
    return this.mapSolicitacaoRowToListItem(r);
  }

  /**
   * Mesmo padrão do front: `^\d{4}\.\d{4}/\d{7}-\d$` (após trim).
   * Usa `[.]` no literal SQL para evitar escapes; o padrão vai como literal (não placeholder),
   * pois em alguns drivers o REGEXP com parâmetro preparado não filtra corretamente.
   */
  private static readonly REGEX_PROCESSO_DIGITAL_SQL =
    '^[0-9]{4}[.][0-9]{4}/[0-9]{7}-[0-9]$';

  private montarWhereSqlBuscarTudo(
    busca: string | undefined,
    status: string | undefined,
    dataInicio: string | undefined,
    dataFim: string | undefined,
    filtroCoordenadoria: string | undefined,
    coordenadoriaId: string | undefined,
    tecnicoId: string | undefined,
    /** Técnico Arthur: (tecnicoId = usuário OU divisaoId = Arthur). */
    tecArthurDivisaoOpcional: string | undefined,
    filtroDivisaoTecnico: string | undefined,
    filtroPFCoordSemTecnico: string | undefined,
    filtroPFDivisaoArthurEncaminhado: string | undefined,
    /** Exclui agendamentos do tipo pré-projetos Arthur da lista (fluxo separado). */
    preProjetoTipoAgendamentoIdExcluir: string | null,
    tipoProcesso: 'DIGITAL' | 'FISICO',
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    const regexLiteral = Prisma.raw(
      `'${AgendamentosService.REGEX_PROCESSO_DIGITAL_SQL}'`,
    );

    if (busca) {
      const p = `%${busca}%`;
      parts.push(
        Prisma.sql`(COALESCE(municipe,'') LIKE ${p} OR COALESCE(processo,'') LIKE ${p} OR COALESCE(cpf,'') LIKE ${p})`,
      );
    }
    if (status && status !== '') {
      parts.push(Prisma.sql`status = ${status as StatusAgendamento}`);
    }
    if (dataInicio && dataFim) {
      parts.push(
        Prisma.sql`dataHora >= ${new Date(dataInicio + 'T00:00:00.000Z')} AND dataHora <= ${new Date(dataFim + 'T23:59:59.999Z')}`,
      );
    }
    if (filtroCoordenadoria) {
      parts.push(Prisma.sql`coordenadoriaId = ${filtroCoordenadoria}`);
    }
    if (coordenadoriaId && !filtroDivisaoTecnico) {
      parts.push(Prisma.sql`coordenadoriaId = ${coordenadoriaId}`);
    }
    if (tecArthurDivisaoOpcional && tecnicoId) {
      parts.push(
        Prisma.sql`(tecnicoId = ${tecnicoId} OR divisaoId = ${tecArthurDivisaoOpcional})`,
      );
    } else if (tecnicoId) {
      parts.push(Prisma.sql`tecnicoId = ${tecnicoId}`);
    }
    if (filtroDivisaoTecnico) {
      const porDivisaoAg = Prisma.sql`divisaoId = ${filtroDivisaoTecnico}`;
      const porArthurEncaminhado =
        filtroPFCoordSemTecnico && filtroPFDivisaoArthurEncaminhado
          ? Prisma.sql`(coordenadoriaId = ${filtroPFCoordSemTecnico} AND divisaoId = ${filtroPFDivisaoArthurEncaminhado})`
          : null;
      if (filtroPFCoordSemTecnico) {
        parts.push(
          Prisma.sql`(tecnicoId IN (SELECT id FROM usuarios WHERE divisaoId = ${filtroDivisaoTecnico}) OR (coordenadoriaId = ${filtroPFCoordSemTecnico} AND tecnicoId IS NULL) OR ${porDivisaoAg}${porArthurEncaminhado ? Prisma.sql` OR ${porArthurEncaminhado}` : Prisma.empty})`,
        );
      } else {
        parts.push(
          Prisma.sql`(tecnicoId IN (SELECT id FROM usuarios WHERE divisaoId = ${filtroDivisaoTecnico}) OR ${porDivisaoAg})`,
        );
      }
    }
    if (tipoProcesso === 'DIGITAL') {
      parts.push(
        Prisma.sql`processo IS NOT NULL AND TRIM(processo) REGEXP ${regexLiteral}`,
      );
    } else {
      parts.push(
        Prisma.sql`(processo IS NULL OR TRIM(processo) NOT REGEXP ${regexLiteral})`,
      );
    }
    if (preProjetoTipoAgendamentoIdExcluir) {
      parts.push(
        Prisma.sql`(tipoAgendamentoId IS NULL OR tipoAgendamentoId <> ${preProjetoTipoAgendamentoIdExcluir})`,
      );
    }

    return parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
    dataInicio?: string,
    dataFim?: string,
    coordenadoriaId?: string,
    tecnicoId?: string,
    tipoProcesso?: string,
    usuarioLogado?: Usuario,
  ): Promise<AgendamentoPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Filtros baseados na permissão do usuário
    let filtroCoordenadoria: string | undefined;
    let filtroDivisaoTecnico: string | undefined;
    let filtroPFCoordSemTecnico: string | undefined;
    let escopoTecLista:
      | ReturnType<AgendamentosService['escopoListaAgendamentosParaTec']>
      | undefined;
    if (usuarioLogado) {
      if (usuarioLogado.permissao === 'PONTO_FOCAL') {
        // Ponto Focal: técnico da sua divisão OU solicitação sem técnico da mesma coordenadoria
        const divisaoIdLogado = (usuarioLogado as any).divisaoId;
        if (!divisaoIdLogado) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        filtroDivisaoTecnico = divisaoIdLogado;
        filtroPFCoordSemTecnico =
          (usuarioLogado as any).divisao?.coordenadoriaId ?? undefined;
      } else if (usuarioLogado.permissao === 'COORDENADOR') {
        // Coordenador vê agendamentos da sua coordenadoria (via divisão)
        const coordIdLogado = (usuarioLogado as any).divisao?.coordenadoriaId;
        if (!coordIdLogado) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        filtroCoordenadoria = coordIdLogado;
      } else if (usuarioLogado.permissao === 'DIRETOR') {
        // Diretor vê apenas agendamentos cujo técnico pertence à sua divisão
        const divisaoIdLogado = (usuarioLogado as any).divisaoId;
        if (!divisaoIdLogado) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        filtroDivisaoTecnico = divisaoIdLogado;
      } else if (usuarioLogado.permissao === 'TEC') {
        const escTecLista = this.escopoListaAgendamentosParaTec(usuarioLogado);
        if (escTecLista.modo === 'dev_impersona_tec_sem_divisao') {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        if (escTecLista.modo === 'dev_impersona_tec') {
          filtroDivisaoTecnico = escTecLista.divisaoId;
          tecnicoId = undefined;
        } else {
          escopoTecLista = escTecLista;
          tecnicoId = escTecLista.usuarioId;
        }
      } else if (usuarioLogado.permissao === 'DEV') {
        // DEV com unidade vê processos da própria coordenadoria; sem unidade mantém visão global.
        const coordIdLogado = await this.coordenadoriaIdDoUsuarioLogado(
          usuarioLogado,
        );
        if (coordIdLogado) {
          filtroCoordenadoria = coordIdLogado;
        }
      }
      // ADM, PORTARIA e DEV sem unidade veem todos
    }

    const envCoordPre = this.coordenadoriaPreProjetosEnv();
    const envDivPre = this.divisaoPreProjetosEnv();

    let pontoFocalWhere: Prisma.AgendamentoWhereInput | undefined;
    if (filtroDivisaoTecnico) {
      if (filtroPFCoordSemTecnico) {
        const orBranches: Prisma.AgendamentoWhereInput[] = [
          { tecnico: { divisaoId: filtroDivisaoTecnico } },
          { divisaoId: filtroDivisaoTecnico },
          { coordenadoriaId: filtroPFCoordSemTecnico, tecnicoId: null },
        ];
        if (envDivPre) {
          orBranches.push({
            coordenadoriaId: filtroPFCoordSemTecnico,
            divisaoId: envDivPre,
          });
        }
        pontoFocalWhere = { OR: orBranches };
      } else {
        pontoFocalWhere = {
          OR: [
            { tecnico: { divisaoId: filtroDivisaoTecnico } },
            { divisaoId: filtroDivisaoTecnico },
          ],
        };
      }
    }

    const filtrosPrincipais: Prisma.AgendamentoWhereInput = {
      ...(busca && {
        OR: [
          { municipe: { contains: busca } },
          { processo: { contains: busca } },
          { cpf: { contains: busca } },
        ],
      }),
      ...(status &&
        status !== '' && {
          status: status as StatusAgendamento,
        }),
      ...(dataInicio &&
        dataFim && {
          dataHora: {
            gte: new Date(dataInicio + 'T00:00:00.000Z'),
            lte: new Date(dataFim + 'T23:59:59.999Z'),
          },
        }),
      ...(filtroCoordenadoria && {
        coordenadoriaId: filtroCoordenadoria,
      }),
      ...(coordenadoriaId && !filtroDivisaoTecnico && {
        coordenadoriaId,
      }),
      ...(escopoTecLista?.modo === 'arthur' && {
        OR: [
          { tecnicoId: escopoTecLista.usuarioId },
          { divisaoId: escopoTecLista.divisaoArthurId },
        ],
      }),
      ...(escopoTecLista?.modo === 'proprio' && {
        tecnicoId: escopoTecLista.usuarioId,
      }),
      ...(tecnicoId && !escopoTecLista && {
        tecnicoId,
      }),
      ...pontoFocalWhere,
    };

    const searchParams: Prisma.AgendamentoWhereInput = {
      AND: [
        filtrosPrincipais,
        AgendamentosService.whereExcluirPreProjetoArthurNaListaAgendamentos(),
      ],
    };

    const tipoFiltro =
      tipoProcesso === 'DIGITAL' || tipoProcesso === 'FISICO'
        ? tipoProcesso
        : undefined;

    if (tipoFiltro) {
      const preProjetoTipoIdExcluir =
        await this.getPreProjetoTipoAgendamentoId();
      const whereSql = this.montarWhereSqlBuscarTudo(
        busca,
        status,
        dataInicio,
        dataFim,
        filtroCoordenadoria,
        coordenadoriaId,
        tecnicoId,
        escopoTecLista?.modo === 'arthur'
          ? escopoTecLista.divisaoArthurId
          : undefined,
        filtroDivisaoTecnico,
        usuarioLogado?.permissao === 'PONTO_FOCAL'
          ? filtroPFCoordSemTecnico
          : undefined,
        usuarioLogado?.permissao === 'PONTO_FOCAL' ? envDivPre : undefined,
        preProjetoTipoIdExcluir ?? null,
        tipoFiltro,
      );

      const countRows = await this.prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM agendamentos WHERE ${whereSql}
      `;
      const total = Number(countRows[0]?.c ?? 0);
      if (total === 0) {
        return { total: 0, pagina: 0, limite: 0, data: [] };
      }
      [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

      const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM agendamentos WHERE ${whereSql}
        ORDER BY dataHora ASC
        LIMIT ${limite} OFFSET ${(pagina - 1) * limite}
      `;
      const ids = idRows.map((r) => r.id);
      if (ids.length === 0) {
        return { total, pagina, limite, data: [] };
      }

      const agendamentos: Agendamento[] = await this.prisma.agendamento.findMany(
        {
          where: { id: { in: ids } },
          orderBy: { dataHora: 'asc' },
          include: {
            tipoAgendamento: true,
            motivoNaoAtendimento: true,
            coordenadoria: true,
            tecnico: {
              select: {
                id: true,
                nome: true,
                login: true,
                email: true,
                divisao: {
                  select: {
                    sigla: true,
                  },
                },
              },
            },
          },
        },
      );

      agendamentos.forEach((ag) => {
        ag.cpf = this.mascararCPF(ag.cpf);
      });

      return {
        total,
        pagina: +pagina,
        limite: +limite,
        data: agendamentos as AgendamentoResponseDTO[],
      };
    }

    const total: number = await this.prisma.agendamento.count({
      where: searchParams,
    });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    const agendamentos: Agendamento[] = await this.prisma.agendamento.findMany({
      where: searchParams,
      orderBy: { dataHora: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        tipoAgendamento: true,
        motivoNaoAtendimento: true,
        coordenadoria: true,
        tecnico: {
          select: {
            id: true,
            nome: true,
            login: true,
            email: true,
            divisao: {
              select: {
                sigla: true,
              },
            },
          },
        },
      },
    });

    agendamentos.forEach((agendamento) => {
      agendamento.cpf = this.mascararCPF(agendamento.cpf);
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: agendamentos as AgendamentoResponseDTO[],
    };
  }
  mascararCPF(cpf: string): string {
    if (!cpf) return '';
    const cpfCensurado = cpf.substring(0, 3) + '.***.***-' + cpf.substring(9, 11);
    return cpfCensurado;
  }

  /**
   * Busca agendamentos do dia atual
   */
  async buscarDoDia(
    usuarioLogado?: Usuario,
  ): Promise<AgendamentoResponseDTO[]> {
    const agora = new Date();
    const spParts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(agora);
    const spAno = Number(spParts.find((p) => p.type === 'year')!.value);
    const spMes = Number(spParts.find((p) => p.type === 'month')!.value) - 1;
    const spDia = Number(spParts.find((p) => p.type === 'day')!.value);
    const hoje = instanteCivilSaoPaulo(spAno, spMes, spDia, 0, 0, 0);
    const amanha = instanteCivilSaoPaulo(spAno, spMes, spDia + 1, 0, 0, 0);

    let filtroCoordenadoria: string | undefined;
    let filtroTecnico: string | undefined;
    let filtroDivisaoTecnicoDia: string | undefined;
    let filtroPFCoordDia: string | undefined;
    let escopoTecDia:
      | ReturnType<AgendamentosService['escopoListaAgendamentosParaTec']>
      | undefined;

    if (usuarioLogado) {
      if (usuarioLogado.permissao === 'PONTO_FOCAL') {
        const divisaoIdLogado = (usuarioLogado as any).divisaoId;
        if (divisaoIdLogado) filtroDivisaoTecnicoDia = divisaoIdLogado;
        filtroPFCoordDia =
          (usuarioLogado as any).divisao?.coordenadoriaId ?? undefined;
      } else if (usuarioLogado.permissao === 'COORDENADOR') {
        filtroCoordenadoria = (usuarioLogado as any).divisao?.coordenadoriaId;
      } else if (usuarioLogado.permissao === 'DIRETOR') {
        const divisaoIdLogado = (usuarioLogado as any).divisaoId;
        if (divisaoIdLogado) filtroDivisaoTecnicoDia = divisaoIdLogado;
      } else if (usuarioLogado.permissao === 'TEC') {
        const escTecDia = this.escopoListaAgendamentosParaTec(usuarioLogado);
        if (escTecDia.modo === 'dev_impersona_tec_sem_divisao') {
          return [];
        }
        if (escTecDia.modo === 'dev_impersona_tec') {
          filtroDivisaoTecnicoDia = escTecDia.divisaoId;
        } else {
          escopoTecDia = escTecDia;
          if (escTecDia.modo === 'proprio') {
            filtroTecnico = escTecDia.usuarioId;
          }
        }
      } else if (usuarioLogado.permissao === 'DEV') {
        const coordIdLogado = await this.coordenadoriaIdDoUsuarioLogado(
          usuarioLogado,
        );
        if (coordIdLogado) filtroCoordenadoria = coordIdLogado;
      }
    }

    const whereClause: any = {
      dataHora: {
        gte: hoje,
        lt: amanha,
      },
      status: {
        not: 'CANCELADO',
      },
    };

    if (filtroCoordenadoria) {
      whereClause.coordenadoriaId = filtroCoordenadoria;
    }

    if (
      filtroDivisaoTecnicoDia &&
      usuarioLogado?.permissao === 'PONTO_FOCAL' &&
      filtroPFCoordDia
    ) {
      const envDivPre = this.divisaoPreProjetosEnv();
      const orBranches: Prisma.AgendamentoWhereInput[] = [
        { tecnico: { divisaoId: filtroDivisaoTecnicoDia } },
        { divisaoId: filtroDivisaoTecnicoDia },
        { coordenadoriaId: filtroPFCoordDia, tecnicoId: null },
      ];
      if (envDivPre) {
        orBranches.push({
          coordenadoriaId: filtroPFCoordDia,
          divisaoId: envDivPre,
        });
      }
      whereClause.OR = orBranches;
    } else if (filtroDivisaoTecnicoDia) {
      whereClause.OR = [
        { tecnico: { divisaoId: filtroDivisaoTecnicoDia } },
        { divisaoId: filtroDivisaoTecnicoDia },
      ];
    }

    if (escopoTecDia?.modo === 'arthur') {
      whereClause.OR = [
        { tecnicoId: escopoTecDia.usuarioId },
        { divisaoId: escopoTecDia.divisaoArthurId },
      ];
    } else if (filtroTecnico) {
      whereClause.tecnicoId = filtroTecnico;
    }

    const whereDiaFinal: Prisma.AgendamentoWhereInput = {
      AND: [
        whereClause as Prisma.AgendamentoWhereInput,
        AgendamentosService.whereExcluirPreProjetoArthurNaListaAgendamentos(),
      ],
    };

    const agendamentos = await this.prisma.agendamento.findMany({
      where: whereDiaFinal,
      orderBy: { dataHora: 'asc' },
      include: {
        tipoAgendamento: true,
        motivoNaoAtendimento: true,
        coordenadoria: true,
        tecnico: {
          select: {
            id: true,
            nome: true,
            login: true,
            divisao: {
              select: {
                sigla: true,
              },
            },
          },
        },
      },
    });

    return agendamentos as AgendamentoResponseDTO[];
  }

  async buscarPorId(id: string): Promise<AgendamentoResponseDTO> {
    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id },
      include: {
        tipoAgendamento: true,
        motivoNaoAtendimento: true,
        coordenadoria: true,
        tecnico: {
          select: {
            id: true,
            nome: true,
            login: true,
            divisao: {
              select: {
                sigla: true,
              },
            },
          },
        },
      },
    });
    if (!agendamento)
      throw new NotFoundException('Agendamento não encontrado.');
    return agendamento as AgendamentoResponseDTO;
  }

  async atualizar(
    id: string,
    updateAgendamentoDto: UpdateAgendamentoDto,
    usuarioLogado?: Usuario,
  ): Promise<AgendamentoResponseDTO> {
    // Busca o agendamento atual para validações
    const agendamentoAtual = await this.prisma.agendamento.findUnique({
      where: { id },
      select: {
        coordenadoriaId: true,
        status: true,
        dataHora: true,
        processo: true,
        tipoAgendamento: { select: { texto: true } },
      },
    });

    if (!agendamentoAtual) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    // Validação: Ponto Focal e Coordenador só podem atualizar agendamentos da sua coordenadoria
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR')
    ) {
      const coordLogado = (usuarioLogado as any).divisao?.coordenadoriaId;
      if (!coordLogado) {
        throw new ForbiddenException(
          'Você não possui coordenadoria atribuída.',
        );
      }
      if (agendamentoAtual.coordenadoriaId !== coordLogado) {
        throw new ForbiddenException(
          'Você só pode atualizar agendamentos da sua coordenadoria.',
        );
      }
      if (
        updateAgendamentoDto.coordenadoriaId &&
        updateAgendamentoDto.coordenadoriaId !== coordLogado
      ) {
        throw new ForbiddenException(
          'Você não pode alterar a coordenadoria do agendamento.',
        );
      }
    }

    let tecnicoId = updateAgendamentoDto.tecnicoId;

    if (tecnicoId) {
      const tecnico = await this.prisma.usuario.findUnique({
        where: { id: tecnicoId },
        select: {
          permissao: true,
          divisaoId: true,
          divisao: { select: { coordenadoriaId: true } },
        },
      });

      if (!tecnico) {
        throw new NotFoundException('Técnico não encontrado.');
      }

      if (!this.usuarioPodeSerTecnicoAtribuido(tecnico)) {
        throw new ForbiddenException(
          'Somente técnicos ou DEV com unidade podem ser atribuídos.',
        );
      }

      // Ponto Focal e Coordenador só podem atribuir técnico/DEV da própria coordenadoria
      if (
        usuarioLogado &&
        (usuarioLogado.permissao === 'PONTO_FOCAL' ||
          usuarioLogado.permissao === 'COORDENADOR')
      ) {
        if (
          tecnico.divisao?.coordenadoriaId !==
          (usuarioLogado as any).divisao?.coordenadoriaId
        ) {
          throw new ForbiddenException(
            'Você só pode atribuir técnicos da sua coordenadoria.',
          );
        }
      }
    }

    // Busca o agendamento atual para obter a coordenadoria se não fornecida no DTO
    let coordenadoriaIdParaTecnico: string | undefined =
      updateAgendamentoDto.coordenadoriaId;
    if (!coordenadoriaIdParaTecnico) {
      coordenadoriaIdParaTecnico =
        agendamentoAtual?.coordenadoriaId || undefined;
    }

    // Se tem tecnicoRF mas não tem tecnicoId, tenta buscar/criar técnico
    if (updateAgendamentoDto.tecnicoRF && !tecnicoId) {
      tecnicoId = await this.buscarOuCriarTecnicoPorRF(
        updateAgendamentoDto.tecnicoRF,
        coordenadoriaIdParaTecnico,
      );

      // Validação adicional: se o técnico foi criado/buscado por RF, verifica se é da coordenadoria
      if (
        usuarioLogado &&
        (usuarioLogado.permissao === 'PONTO_FOCAL' ||
          usuarioLogado.permissao === 'COORDENADOR') &&
        tecnicoId
      ) {
        const tecnico = await this.prisma.usuario.findUnique({
          where: { id: tecnicoId },
          select: { divisao: { select: { coordenadoriaId: true } } },
        });

        if (
          tecnico &&
          tecnico.divisao?.coordenadoriaId !==
            (usuarioLogado as any).divisao?.coordenadoriaId
        ) {
          throw new ForbiddenException(
            'O técnico encontrado não pertence à sua coordenadoria.',
          );
        }
      }
    }

    const { tipoAgendamentoTexto, ...restUpdate } = updateAgendamentoDto;
    let tipoAgendamentoId = restUpdate.tipoAgendamentoId;
    if (tipoAgendamentoTexto?.trim()) {
      tipoAgendamentoId = await this.buscarOuCriarTipoPorTexto(
        tipoAgendamentoTexto.trim(),
      );
    }

    const dataAtualizacao: any = {
      ...restUpdate,
      tipoAgendamentoId,
      municipe: restUpdate.municipe
        ? this.padronizarNome(restUpdate.municipe)
        : undefined,
      tecnicoId,
    };

    if (updateAgendamentoDto.dataHora) {
      const dataHora = new Date(updateAgendamentoDto.dataHora);
      dataAtualizacao.dataHora = dataHora;

      // Se não forneceu dataFim, recalcula baseado na nova dataHora (60 min)
      if (!updateAgendamentoDto.dataFim) {
        dataAtualizacao.dataFim = this.calcularDataFim(dataHora, 60);
      }
    }

    if (updateAgendamentoDto.dataFim) {
      dataAtualizacao.dataFim = new Date(updateAgendamentoDto.dataFim);
    }

    // Ao marcar como ATENDIDO ou AGENDADO, limpa o motivo de não atendimento
    if (
      updateAgendamentoDto.status === 'ATENDIDO' ||
      updateAgendamentoDto.status === 'AGENDADO'
    ) {
      dataAtualizacao.motivoNaoAtendimentoId = null;
    }

    if (
      'tecnicoId' in updateAgendamentoDto ||
      'tecnicoRF' in updateAgendamentoDto
    ) {
      dataAtualizacao.divisaoId = await this.divisaoIdDoTecnico(
        tecnicoId ?? null,
      );
    }

    const agendamentoAtualizado = await this.prisma.agendamento.update({
      data: dataAtualizacao,
      where: { id },
      include: {
        tipoAgendamento: true,
        motivoNaoAtendimento: true,
        coordenadoria: true,
        tecnico: {
          select: {
            id: true,
            nome: true,
            login: true,
            divisao: {
              select: {
                sigla: true,
              },
            },
          },
        },
      },
    });

    const tipoPreArthur =
      (agendamentoAtual.tipoAgendamento?.texto ?? '').trim() ===
      PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO;
    const passouParaAgendado =
      updateAgendamentoDto.status === StatusAgendamento.AGENDADO &&
      agendamentoAtual.status === StatusAgendamento.SOLICITADO;
    if (tipoPreArthur && passouParaAgendado) {
      const proc = (agendamentoAtualizado.processo ?? '').trim().toUpperCase();
      const sol = await this.prisma.solicitacaoPreProjetoArthurSaboya.findFirst({
        where: {
          OR: [
            { agendamentoId: id },
            ...(proc.startsWith('PP-') || proc.startsWith('AS-')
              ? [{ protocolo: proc }]
              : []),
          ],
        },
        select: { id: true },
      });
      if (sol) {
        const dataRef = agendamentoAtualizado.dataHora;
        await this.prisma.solicitacaoPreProjetoArthurSaboyaMensagem.create({
          data: {
            solicitacaoId: sol.id,
            autor: AutorMensagemPreProjetoArthurSaboya.SISTEMA,
            corpo: `O atendimento técnico foi agendado para o dia ${this.formatarDataHoraSaoPaulo(
              dataRef,
            )}. O atendimento será realizado de forma online, por meio do link enviado para o seu e-mail. Caso não possa comparecer, solicitamos que cancele o agendamento pelo botão Cancelar Atendimento.`,
          },
        });
      }
    }

    return agendamentoAtualizado as AgendamentoResponseDTO;
  }

  async excluir(id: string): Promise<{ excluido: boolean }> {
    await this.prisma.agendamento.delete({ where: { id } });
    return { excluido: true };
  }

  /**
   * Importa agendamentos de uma planilha Excel
   * A planilha deve ter colunas: RF (do técnico), Munícipe, RG, CPF, Processo, Data/Hora, etc.
   */
  async importarPlanilha(
    dadosPlanilha: any[],
    coordenadoriaId?: string,
    usuario?: Usuario,
  ): Promise<{ importados: number; erros: number; duplicados: number }> {
    let importados = 0;
    let erros = 0;
    let duplicados = 0;
    let linhasPuladas = 0; // Contador de linhas puladas sem erro

    console.log(`📊 Total de linhas na planilha: ${dadosPlanilha.length}`);

    if (!dadosPlanilha || !Array.isArray(dadosPlanilha)) {
      throw new Error('Dados da planilha inválidos');
    }

    // Log dos cabeçalhos encontrados na primeira linha para debug
    if (dadosPlanilha.length > 0) {
      const cabecalhos = Object.keys(dadosPlanilha[0]);
      console.log('Cabeçalhos encontrados na primeira linha:', cabecalhos);
      console.log('Total de cabeçalhos:', cabecalhos.length);

      // Verifica se os cabeçalhos esperados estão presentes (linha 9: A, C, D, H, I, J, K, L, M, N, Q)
      const cabecalhosEsperados = [
        'Nro. Processo',
        'Nro. Protocolo',
        'CPF',
        'Requerente',
        'E-mail Munícipe',
        'Tipo Agendamento',
        'Local de Atendimento',
        'RF Técnico',
        'Técnico',
        'E-mail Técnico',
        'Agendado para',
      ];
      const cabecalhosEncontrados = cabecalhosEsperados.filter((cab) =>
        cabecalhos.some((c) =>
          c.toLowerCase().includes(cab.toLowerCase().substring(0, 5)),
        ),
      );
      console.log('Cabeçalhos esperados encontrados:', cabecalhosEncontrados);
      console.log(
        'Cabeçalhos esperados NÃO encontrados:',
        cabecalhosEsperados.filter((c) => !cabecalhosEncontrados.includes(c)),
      );
    }

    for (let index = 0; index < dadosPlanilha.length; index++) {
      const linha = dadosPlanilha[index];

      // Pula linhas vazias ou com todos os valores null/undefined/vazios
      if (!linha || Object.keys(linha).length === 0) {
        if (index < 10) {
          console.log(`Linha ${index + 1}: Pula linha completamente vazia`);
        }
        linhasPuladas++;
        continue;
      }

      // Verifica se a linha tem pelo menos um valor não vazio
      // Ignora chaves que são texto do cabeçalho do relatório
      const chavesIgnorar = [
        'SMUL - SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO',
      ];
      const valoresIgnorar = [
        'Sistema de Agendamento Eletrônico',
        'Relatório de Agendamentos',
      ];

      const temValores = Object.entries(linha).some(([chave, valor]) => {
        // Ignora chaves específicas do cabeçalho
        if (chavesIgnorar.includes(chave)) return false;
        if (valor === null || valor === undefined || valor === '') return false;
        // Ignora valores que são texto do cabeçalho
        if (typeof valor === 'string' && valoresIgnorar.includes(valor.trim()))
          return false;
        return true;
      });

      if (!temValores) {
        if (index < 10) {
          console.log(
            `Linha ${index + 1}: Pula linha com apenas cabeçalho ou valores ignorados`,
          );
        }
        linhasPuladas++;
        continue; // Pula linhas completamente vazias ou com apenas cabeçalho
      }

      try {
        // Função auxiliar para buscar valor em diferentes variações de chave
        const buscarValor = (obj: any, ...chaves: string[]): any => {
          for (const chave of chaves) {
            if (
              obj[chave] !== undefined &&
              obj[chave] !== null &&
              obj[chave] !== ''
            ) {
              return obj[chave];
            }
          }
          return null;
        };

        // Função auxiliar para buscar por palavra-chave parcial (case-insensitive)
        const buscarPorPalavraChave = (
          obj: any,
          palavrasChave: string[],
        ): any => {
          for (const key of Object.keys(obj)) {
            const keyLower = key.toLowerCase().trim();
            for (const palavra of palavrasChave) {
              const palavraLower = palavra.toLowerCase().trim();
              if (
                keyLower.includes(palavraLower) ||
                palavraLower.includes(keyLower)
              ) {
                const valor = obj[key];
                if (valor !== undefined && valor !== null && valor !== '') {
                  return valor;
                }
              }
            }
          }
          return null;
        };

        // Mapeia os dados da planilha conforme estrutura (linha 9 é cabeçalho):
        // A=Nro. Processo, C=Nro. Protocolo, D=CPF, H=Requerente, I=E-mail Munícipe, J=Tipo Agendamento,
        // K=Local de Atendimento, L=RF Técnico, M=Técnico, N=E-mail Técnico, Q=Agendado para

        // Verifica se os dados vieram com __EMPTY (cabeçalhos não encontrados)
        const temCabeçalhosVazios = Object.keys(linha).some((k) =>
          k.startsWith('__EMPTY'),
        );

        let processo,
          cpf,
          municipe,
          tipoAgendamento,
          coordenadoriaSigla,
          tecnicoNome,
          tecnicoRF,
          email,
          emailTecnico,
          dataHora;

        if (temCabeçalhosVazios) {
          // Mapeamento por índice: A=__EMPTY, B=__EMPTY_1, C=__EMPTY_2, D=__EMPTY_3, ... Q=__EMPTY_16
          processo = linha['__EMPTY'] || null; // Coluna A - Nro. Processo
          // __EMPTY_2 = Nro. Protocolo (C - não mapeamos)
          cpf = linha['__EMPTY_3'] || null; // Coluna D - CPF
          municipe = linha['__EMPTY_7'] || null; // Coluna H - Requerente
          email = linha['__EMPTY_8'] || null; // Coluna I - E-mail Munícipe
          tipoAgendamento = linha['__EMPTY_9'] || null; // Coluna J - Tipo Agendamento
          coordenadoriaSigla = linha['__EMPTY_10'] || null; // Coluna K - Local de Atendimento
          tecnicoRF = linha['__EMPTY_11'] || null; // Coluna L - RF Técnico
          tecnicoNome = linha['__EMPTY_12'] || null; // Coluna M - Técnico
          emailTecnico = linha['__EMPTY_13'] || null; // Coluna N - E-mail Técnico
          // Agendado para (Data/Hora) está na coluna Q (__EMPTY_16)
          dataHora = linha['__EMPTY_16'] || null;

          // Validação: Email do técnico deve conter @
          if (emailTecnico) {
            const emailTecStr = String(emailTecnico).trim();
            if (!emailTecStr.includes('@') || !emailTecStr.includes('.')) {
              emailTecnico = null;
            } else {
              emailTecnico = emailTecStr;
            }
          }

          // Validação: RF não deve ser uma data ou coordenadoria
          if (tecnicoRF) {
            const rfStr = String(tecnicoRF).trim();
            // Se parece uma data ou é igual à coordenadoria, não é RF válido
            if (
              /\d{2}\/\d{2}\/\d{4}/.test(rfStr) ||
              rfStr.includes(':') ||
              tecnicoRF instanceof Date ||
              rfStr === coordenadoriaSigla
            ) {
              tecnicoRF = null;
            }
          }

          // Validação: Email deve conter @
          if (email) {
            const emailStr = String(email).trim();
            if (!emailStr.includes('@') || !emailStr.includes('.')) {
              email = null;
            }
          }
        } else {
          // Tenta buscar pelos nomes exatos primeiro, depois por palavras-chave (cabeçalhos na linha 9)
          processo =
            buscarValor(
              linha,
              'Nro. Processo',
              'Nro Processo',
              'Número do Processo',
              'número do processo',
              'Processo',
              'processo',
              'PROCESSO',
            ) || buscarPorPalavraChave(linha, ['processo', 'nro', 'número']);

          cpf =
            buscarValor(linha, 'CPF', 'cpf', 'Cpf') ||
            buscarPorPalavraChave(linha, ['cpf']);

          municipe =
            buscarValor(linha, 'Requerente', 'requerente', 'REQUERENTE') ||
            buscarPorPalavraChave(linha, [
              'requerente',
              'munícipe',
              'municipe',
            ]);

          // E-mail do munícipe (coluna I)
          email =
            buscarValor(
              linha,
              'E-mail Munícipe',
              'E-mail munícipe',
              'e-mail munícipe',
              'E-mail',
              'E-Mail',
              'email',
              'Email',
              'EMAIL',
            ) || buscarPorPalavraChave(linha, ['email', 'e-mail', 'munícipe']);

          tipoAgendamento =
            buscarValor(
              linha,
              'Tipo Agendamento',
              'Tipo de Agendamento',
              'tipo agendamento',
              'tipo de agendamento',
              'Tipo',
              'tipo',
            ) || buscarPorPalavraChave(linha, ['tipo', 'agendamento']);

          coordenadoriaSigla =
            buscarValor(
              linha,
              'Local de Atendimento',
              'local de atendimento',
              'Local de Atendimento',
              'Coordenadoria',
              'coordenadoria',
              'COORDENADORIA',
            ) ||
            buscarPorPalavraChave(linha, [
              'coordenadoria',
              'local',
              'atendimento',
            ]);

          // RF Técnico (coluna L)
          tecnicoRF =
            buscarValor(
              linha,
              'RF Técnico',
              'RF técnico',
              'rf técnico',
              'RF',
              'rf',
              'Rf',
              'RF do técnico',
              'rf do técnico',
            ) || buscarPorPalavraChave(linha, ['rf', 'técnico']);

          tecnicoNome =
            buscarValor(
              linha,
              'Técnico',
              'técnico',
              'TECNICO',
              'Nome do técnico',
              'nome do técnico',
            ) || buscarPorPalavraChave(linha, ['técnico', 'tecnico', 'nome']);

          // E-mail do técnico (coluna N)
          emailTecnico =
            buscarValor(
              linha,
              'E-mail Técnico',
              'E-mail técnico',
              'e-mail técnico',
              'Email Técnico',
              'email técnico',
              'E-mail do Técnico',
              'e-mail do técnico',
            ) || null;
          
          // Validação: Email do técnico deve conter @
          if (emailTecnico) {
            const emailTecStr = String(emailTecnico).trim();
            if (!emailTecStr.includes('@') || !emailTecStr.includes('.')) {
              emailTecnico = null;
            } else {
              emailTecnico = emailTecStr;
            }
          }

          // Data e Hora: campo "Agendado para" (coluna Q)
          dataHora =
            buscarValor(
              linha,
              'Agendado para',
              'agendado para',
              'Agendado Para',
              'Data e Hora',
              'data e hora',
              'Data/Hora',
              'data/hora',
            ) ||
            buscarPorPalavraChave(linha, ['agendado', 'data', 'hora', 'para']);

          // Se ainda não encontrou, tenta buscar em todas as chaves da linha
          if (!dataHora) {
            for (const key of Object.keys(linha)) {
              const value = linha[key];
              const keyLower = key.toLowerCase();
              if (
                value &&
                (keyLower.includes('data') ||
                  keyLower.includes('hora') ||
                  keyLower.includes('agendado') ||
                  keyLower.includes('para'))
              ) {
                dataHora = value;
                break;
              }
            }
          }
        }

        // Limpa os valores
        processo = processo ? String(processo).trim() : null;
        cpf = cpf ? String(cpf).trim() : null;
        municipe = municipe ? String(municipe).trim() : null;
        // Padroniza o nome do munícipe (primeira letra de cada palavra em maiúscula)
        municipe = this.padronizarNome(municipe);
        tipoAgendamento = tipoAgendamento
          ? String(tipoAgendamento).trim()
          : null;
        coordenadoriaSigla = coordenadoriaSigla
          ? String(coordenadoriaSigla).trim()
          : null;
        tecnicoNome = tecnicoNome ? String(tecnicoNome).trim() : null;
        tecnicoRF = tecnicoRF ? String(tecnicoRF).trim() : null;
        email = email ? String(email).trim().toLowerCase() : null; // Email em minúsculas
        dataHora = dataHora ? String(dataHora).trim() : null;

        // Validação: data/hora é obrigatória
        // Também verifica se pelo menos um campo importante está preenchido (processo, cpf, municipe)
        const temDadosValidos = processo || cpf || municipe;

        if (
          !dataHora ||
          dataHora === 'null' ||
          dataHora === 'undefined' ||
          dataHora === ''
        ) {
          // Se não tem data/hora E não tem outros dados válidos, é uma linha vazia - pula sem contar como erro
          if (!temDadosValidos) {
            if (index < 10) {
              console.log(
                `Linha ${index + 1}: Pula linha sem data/hora e sem dados válidos`,
              );
            }
            linhasPuladas++;
            continue; // Pula linha completamente vazia sem contar como erro
          }
          // Se tem dados válidos mas não tem data/hora, conta como erro
          if (index < 10) {
            console.log(
              `Linha ${index + 1}: ERRO - Data/Hora não encontrada mas tem dados válidos. Chaves:`,
              Object.keys(linha),
            );
            console.log(`Dados:`, { processo, cpf, municipe });
          }
          erros++;
          continue;
        }

        // Se tem data/hora mas não tem outros dados, também pode ser uma linha de cabeçalho ou inválida
        if (!temDadosValidos && dataHora) {
          // Verifica se a data/hora parece válida (não é apenas um cabeçalho)
          const dataHoraStr = String(dataHora).trim();
          // Verifica se parece uma data válida (formato brasileiro ou ISO)
          const pareceDataValida =
            /\d{2}\/\d{2}\/\d{4}/.test(dataHoraStr) ||
            /^\d{4}-\d{2}-\d{2}/.test(dataHoraStr) ||
            dataHora instanceof Date;

          if (!pareceDataValida) {
            // Log para debug - pode ser uma linha válida que está sendo pulada incorretamente
            if (index < 10) {
              console.log(
                `Linha ${index + 1}: Pula linha com data/hora mas sem dados válidos. Data/Hora: "${dataHoraStr}", Dados:`,
                { processo, cpf, municipe },
              );
            }
            linhasPuladas++;
            continue; // Pula se não parece uma data válida
          }
        }

        // Parse da data/hora
        let dataHoraObj: Date;

        // Se já é um objeto Date, usa diretamente
        if (dataHora instanceof Date) {
          dataHoraObj = dataHora;
        }
        // Se for string, tenta fazer parse
        else if (typeof dataHora === 'string') {
          // Remove espaços extras
          const dataHoraLimpa = dataHora.trim();

          // Tenta formato brasileiro primeiro: DD/MM/YYYY HH:MM ou DD/MM/YYYY HH:MM:SS
          const matchBR = dataHoraLimpa.match(
            /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/,
          );
          if (matchBR) {
            const [, dia, mes, ano, hora, minuto, segundo] = matchBR;
            // Data/hora civil em Brasília → instante UTC correto no banco
            dataHoraObj = instanteCivilSaoPaulo(
              parseInt(ano, 10),
              parseInt(mes, 10) - 1,
              parseInt(dia, 10),
              parseInt(hora, 10),
              parseInt(minuto, 10),
              segundo ? parseInt(segundo, 10) : 0,
            );
          } else {
            const limpaFuso = dataHoraLimpa.trim();
            const temFusoExplicito =
              /Z$/i.test(limpaFuso) ||
              /[+-]\d{2}:\d{2}(:\d{2})?$/.test(limpaFuso);
            if (temFusoExplicito) {
              dataHoraObj = new Date(limpaFuso);
            } else {
              const parsedDate = new Date(limpaFuso);
              if (!isNaN(parsedDate.getTime())) {
                const ano = parsedDate.getFullYear();
                const mes = parsedDate.getMonth();
                const dia = parsedDate.getDate();
                const hora = parsedDate.getHours();
                const minuto = parsedDate.getMinutes();
                const segundo = parsedDate.getSeconds();
                dataHoraObj = instanteCivilSaoPaulo(
                  ano,
                  mes,
                  dia,
                  hora,
                  minuto,
                  segundo,
                );
              } else {
                dataHoraObj = parsedDate;
              }
            }
          }
        }
        // Se for número (serial do Excel)
        else if (typeof dataHora === 'number') {
          // Excel serial date: número de dias desde 1/1/1900
          // Para datas com hora, o número pode ser decimal
          const diasDesde1900 = Math.floor(dataHora);
          const fracaoDia = dataHora - diasDesde1900;

          // Cria a data base em UTC
          const dataBase = new Date(Date.UTC(1900, 0, 1)); // 1/1/1900 em UTC
          dataHoraObj = new Date(
            dataBase.getTime() + (diasDesde1900 - 2) * 86400 * 1000,
          ); // -2 porque Excel conta 1900 como ano bissexto
          // Adiciona a fração do dia (hora) em UTC
          if (fracaoDia > 0) {
            dataHoraObj = new Date(
              dataHoraObj.getTime() + fracaoDia * 86400 * 1000,
            );
          }
        } else {
          if (index < 3) {
            // Log apenas as primeiras 3 linhas
            console.log(
              `Linha ${index + 1}: Tipo de data/hora inválido. Valor:`,
              dataHora,
              'Tipo:',
              typeof dataHora,
            );
          }
          erros++;
          continue;
        }

        if (isNaN(dataHoraObj.getTime())) {
          if (index < 3) {
            // Log apenas as primeiras 3 linhas
            console.log(
              `Linha ${index + 1}: Data/Hora inválida após conversão. Valor original:`,
              dataHora,
              'Tipo:',
              typeof dataHora,
            );
          }
          erros++;
          continue;
        }
        const dataFim = this.calcularDataFim(dataHoraObj, 60);

        // Busca ou cria tipo de agendamento se necessário
        let tipoAgendamentoId: string | undefined;
        if (tipoAgendamento) {
          try {
            tipoAgendamentoId = await this.buscarOuCriarTipoPorTexto(
              String(tipoAgendamento),
            );
          } catch (error) {
            console.log(
              `Erro ao criar/buscar tipo de agendamento: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Busca coordenadoria pela sigla se fornecida, ou cria automaticamente se não existir
        let coordenadoriaIdFinal = coordenadoriaId;
        if (coordenadoriaSigla && !coordenadoriaIdFinal) {
          try {
            const coordenadoriaEncontrada =
              await this.coordenadoriasService.buscarPorSigla(
                String(coordenadoriaSigla).trim(),
              );
            if (coordenadoriaEncontrada) {
              coordenadoriaIdFinal = coordenadoriaEncontrada.id;
            } else {
              // Coordenadoria não encontrada, cria automaticamente
              try {
                const novaCoordenadoria =
                  await this.coordenadoriasService.criar({
                    sigla: String(coordenadoriaSigla).trim(),
                    nome: String(coordenadoriaSigla).trim(), // Usa a sigla como nome se não houver nome específico
                    status: true,
                  });
                coordenadoriaIdFinal = novaCoordenadoria.id;
                console.log(
                  `Coordenadoria ${coordenadoriaSigla} criada automaticamente`,
                );
              } catch (criarError) {
                // Se falhar ao criar (ex: sigla duplicada), tenta buscar novamente
                const coordenadoriaRecriada =
                  await this.coordenadoriasService.buscarPorSigla(
                    String(coordenadoriaSigla).trim(),
                  );
                if (coordenadoriaRecriada) {
                  coordenadoriaIdFinal = coordenadoriaRecriada.id;
                } else {
                  console.log(
                    `Erro ao criar coordenadoria ${coordenadoriaSigla}:`,
                    criarError instanceof Error
                      ? criarError.message
                      : String(criarError),
                  );
                }
              }
            }
          } catch (error) {
            console.log(
              `Erro ao buscar coordenadoria ${coordenadoriaSigla}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        }

        // Verifica se é "TÉCNICO RESERVA" ou busca/cria técnico por RF
        let tecnicoId = null;
        if (tecnicoNome) {
          const tecnicoNomeStr = String(tecnicoNome).trim();
          const tecnicoNomeUpper = tecnicoNomeStr.toUpperCase();

          if (
            tecnicoNomeUpper.includes('TÉCNICO RESERVA') ||
            tecnicoNomeUpper.includes('TECNICO RESERVA')
          ) {
            // Extrai a sigla da coordenadoria do texto "TÉCNICO RESERVA GTEC"
            const match = tecnicoNomeUpper.match(
              /T[ÉE]CNICO\s+RESERVA\s+(\w+)/,
            );
            if (match && match[1] && !coordenadoriaIdFinal) {
              const siglaCoordenadoria = match[1].trim();
              try {
                const coordenadoria =
                  await this.coordenadoriasService.buscarPorSigla(
                    siglaCoordenadoria,
                  );
                if (coordenadoria) {
                  coordenadoriaIdFinal = coordenadoria.id;
                } else {
                  // Coordenadoria não encontrada, cria automaticamente
                  try {
                    const novaCoordenadoria =
                      await this.coordenadoriasService.criar({
                        sigla: siglaCoordenadoria,
                        nome: siglaCoordenadoria, // Usa a sigla como nome se não houver nome específico
                        status: true,
                      });
                    coordenadoriaIdFinal = novaCoordenadoria.id;
                    console.log(
                      `Coordenadoria ${siglaCoordenadoria} criada automaticamente para TÉCNICO RESERVA`,
                    );
                  } catch (criarError) {
                    // Se falhar ao criar (ex: sigla duplicada), tenta buscar novamente
                    const coordenadoriaRecriada =
                      await this.coordenadoriasService.buscarPorSigla(
                        siglaCoordenadoria,
                      );
                    if (coordenadoriaRecriada) {
                      coordenadoriaIdFinal = coordenadoriaRecriada.id;
                    } else {
                      console.log(
                        `Erro ao criar coordenadoria ${siglaCoordenadoria} para TÉCNICO RESERVA:`,
                        criarError instanceof Error
                          ? criarError.message
                          : String(criarError),
                      );
                    }
                  }
                }
              } catch (error) {
                console.log(
                  `Erro ao buscar coordenadoria ${siglaCoordenadoria} para TÉCNICO RESERVA:`,
                  error instanceof Error ? error.message : String(error),
                );
              }
            }
            // Não atribui técnico - será atribuído manualmente pelo ponto focal
            tecnicoId = null;
          } else if (tecnicoRF) {
            // Se tem RF, busca ou cria técnico normalmente com a coordenadoria e email da planilha
            tecnicoId = await this.buscarOuCriarTecnicoPorRF(
              String(tecnicoRF),
              coordenadoriaIdFinal || undefined,
              emailTecnico || undefined,
            );
          }
        } else if (tecnicoRF) {
          // Se não tem nome do técnico mas tem RF, busca ou cria técnico normalmente com a coordenadoria e email da planilha
          tecnicoId = await this.buscarOuCriarTecnicoPorRF(
            String(tecnicoRF),
            coordenadoriaIdFinal || undefined,
            emailTecnico || undefined,
          );
        }

        // Validação final antes de criar
        if (!dataHoraObj || isNaN(dataHoraObj.getTime())) {
          console.log(
            `Linha ${index + 1}: Data/Hora inválida antes de criar agendamento`,
          );
          erros++;
          continue;
        }

        // Impede duplicata: mesmo processo + mesma data/hora
        const processoTrim = processo ? String(processo).trim() : '';
        if (processoTrim) {
          const existente = await this.prisma.agendamento.findFirst({
            where: {
              processo: processoTrim,
              dataHora: dataHoraObj,
            },
          });
          if (existente) {
            if (index < 5) {
              console.log(
                `Linha ${index + 1}: Duplicado (processo ${processoTrim} + data/hora já existente). Linha ignorada.`,
              );
            }
            duplicados++;
            continue;
          }
        }

        try {
          const processoImport = processo ? String(processo).trim() : '';
          const divisaoIdImport = await this.divisaoIdDoTecnico(tecnicoId);
          await this.prisma.agendamento.create({
            data: {
              municipe: municipe
                ? this.padronizarNome(String(municipe).trim())
                : null,
              cpf: cpf ? String(cpf).trim() : null,
              processo: processoImport || null,
              dataHora: dataHoraObj,
              dataFim,
              resumo: tipoAgendamento ? String(tipoAgendamento).trim() : null,
              tipoAgendamentoId,
              coordenadoriaId: coordenadoriaIdFinal || null,
              divisaoId: divisaoIdImport,
              tecnicoId,
              tecnicoRF: tecnicoRF ? String(tecnicoRF).trim() : null,
              email: email || null,
              importado: true,
              // Importação: sempre SOLICITADO até confirmação explícita de agendado.
              status: StatusAgendamento.SOLICITADO,
            },
          });

          importados++;
        } catch (dbError) {
          // Erro específico do banco de dados
          const errorMsg =
            dbError instanceof Error ? dbError.message : String(dbError);
          console.error(
            `Linha ${index + 1}: Erro ao criar no banco de dados:`,
            errorMsg,
          );
          if (dbError instanceof Error && dbError.stack) {
            console.error(`Stack trace:`, dbError.stack);
          }
          console.error(`Dados que causaram o erro:`, {
            processo,
            cpf,
            municipe,
            tipoAgendamento,
            coordenadoriaSigla,
            tecnicoNome,
            tecnicoRF,
            dataHora: dataHoraObj,
          });
          erros++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`Erro ao importar linha ${index + 1}:`, errorMessage);
        console.error(`Stack trace:`, errorStack);
        console.error(
          `Dados da linha que causou erro:`,
          JSON.stringify(linha, null, 2),
        );
        erros++;
      }
    }

    console.log(`📊 Resumo da importação:`);
    console.log(`   Total de linhas na planilha: ${dadosPlanilha.length}`);
    console.log(`   Linhas importadas com sucesso: ${importados}`);
    console.log(`   Linhas com erro: ${erros}`);
    console.log(`   Linhas duplicadas (ignoradas): ${duplicados}`);
    console.log(`   Linhas puladas (vazias/inválidas): ${linhasPuladas}`);
    console.log(
      `   Total processado: ${importados + erros + duplicados + linhasPuladas}`,
    );

    await this.registrarImportacaoPlanilha(importados, usuario?.id);

    return { importados, erros, duplicados };
  }

  async registrarImportacaoPlanilha(total: number, usuarioId?: string): Promise<void> {
    try {
      await this.prisma.logImportacaoPlanilha.create({
        data: { total, usuarioId: usuarioId ?? undefined },
      });
    } catch (e: unknown) {
      // P2021 = tabela não existe no banco; ignora sem quebrar a importação
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2021') {
        return;
      }
      throw e;
    }
  }

  async getUltimaImportacaoPlanilha(): Promise<{
    dataHora: Date;
    total: number;
    usuarioNome?: string | null;
  } | null> {
    try {
      const ultima = await this.prisma.logImportacaoPlanilha.findFirst({
        orderBy: { dataHora: 'desc' },
        include: { usuario: { select: { nome: true } } },
      });
      if (!ultima) return null;
      return {
        dataHora: ultima.dataHora,
        total: ultima.total,
        usuarioNome: ultima.usuario?.nome ?? null,
      };
    } catch (e: unknown) {
      // P2021 = tabela não existe no banco; retorna null para não quebrar a página
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2021') {
        return null;
      }
      throw e;
    }
  }

  /**
   * Importa agendamentos da planilha Outlook.
   * Estrutura: A=Tipo Atendimento, B=Visitante (munícipe), C=CPF, D=Horário, E=Técnico Responsável (nome texto), F=Unidade, G=Número Processo.
   * Linhas 1–3 (A1:G3) = título com "Data: DD/MM/AAAA". Linha 4 = cabeçalho, registros a partir da linha 5.
   */
  async importarPlanilhaOutlook(
    dadosPlanilha: any[],
    usuario?: Usuario,
    dataPlanilhaStr?: string,
  ): Promise<{ importados: number; erros: number; duplicados: number }> {
    let importados = 0;
    let erros = 0;
    let duplicados = 0;
    const HEADERS = [
      'Tipo de Atendimento',
      'Visitante',
      'CPF',
      'Horário',
      'Técnico Responsável',
      'Unidade',
      'Número do Processo',
    ] as const;

    if (!dadosPlanilha || !Array.isArray(dadosPlanilha)) {
      throw new Error('Dados da planilha Outlook inválidos');
    }

    for (let index = 0; index < dadosPlanilha.length; index++) {
      const row = dadosPlanilha[index];
      if (!row || typeof row !== 'object') {
        erros++;
        continue;
      }

      const get = (key: (typeof HEADERS)[number]): string | null => {
        const v = row[key];
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s === '' ? null : s;
      };
      const getRaw = (key: (typeof HEADERS)[number]): string | number | null => {
        const v = row[key];
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        const s = String(v).trim();
        return s === '' ? null : s;
      };

      const visitante = get('Visitante');
      const horarioRaw = getRaw('Horário');
      // Linha totalmente vazia: pula sem contar como erro
      if (!visitante && (horarioRaw === null || horarioRaw === undefined)) {
        continue;
      }
      // Pula linha de cabeçalho se vier no meio dos dados (ex.: "TIPO DE ATENDIMENTO", "VISITANTE")
      const tipoStr = get('Tipo de Atendimento');
      if (tipoStr && (tipoStr.toUpperCase() === 'TIPO DE ATENDIMENTO' || tipoStr === 'TIPO DE ATENDIMENTO')) {
        continue;
      }
      if (!visitante || horarioRaw === null || horarioRaw === undefined) {
        erros++;
        continue;
      }

      try {
        const tipoTexto = get('Tipo de Atendimento');
        let tipoAgendamentoId: string | undefined;
        if (tipoTexto) {
          tipoAgendamentoId = await this.buscarOuCriarTipoPorTexto(tipoTexto);
        }

        const unidadeStr = get('Unidade');
        let coordenadoriaId: string | undefined;
        if (unidadeStr) {
          const coordPorSigla = await this.coordenadoriasService.buscarPorSigla(unidadeStr);
          if (coordPorSigla) {
            coordenadoriaId = coordPorSigla.id;
          } else {
            const coordPorNome = await this.prisma.coordenadoria.findFirst({
              where: {
                OR: [
                  { sigla: { contains: unidadeStr } },
                  { nome: { contains: unidadeStr } },
                ],
                status: true,
              },
            });
            if (coordPorNome) coordenadoriaId = coordPorNome.id;
          }
        }

        const dataHora = this.parseDataHoraOutlook(horarioRaw, dataPlanilhaStr);
        if (!dataHora) {
          console.warn(
            `[Outlook import] Linha ${index + 5}: horário inválido (valor: ${JSON.stringify(horarioRaw)}, dataPlanilha: ${dataPlanilhaStr ?? 'não informada'})`,
          );
          erros++;
          continue;
        }

        const processoRaw = get('Número do Processo');
        const processoOutlook = processoRaw ? String(processoRaw).trim() : '';
        const cpf = get('CPF');
        const tecnicoResponsavelPlanilha = get('Técnico Responsável');

        const duplicado = await this.prisma.agendamento.findFirst({
          where: {
            processo: processoOutlook || undefined,
            dataHora,
            coordenadoriaId: coordenadoriaId || undefined,
            importadoOutlook: true,
          },
        });
        if (duplicado) {
          duplicados++;
          continue;
        }

        const umaHoraDepois = new Date(dataHora.getTime() + 60 * 60 * 1000);
        await this.prisma.agendamento.create({
          data: {
            municipe: visitante,
            cpf: cpf || undefined,
            processo: processoOutlook || undefined,
            dataHora,
            dataFim: umaHoraDepois,
            importado: true,
            importadoOutlook: true,
            tecnicoResponsavelPlanilha: tecnicoResponsavelPlanilha || undefined,
            tipoAgendamentoId: tipoAgendamentoId || undefined,
            coordenadoriaId: coordenadoriaId || undefined,
            tecnicoId: undefined,
            // Importação Outlook: sempre SOLICITADO até confirmação explícita.
            status: StatusAgendamento.SOLICITADO,
          },
        });
        importados++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Outlook import] Linha ${index + 5}: ${msg}`, e);
        erros++;
      }
    }

    await this.registrarImportacaoOutlook(importados, usuario?.id);
    return { importados, erros, duplicados };
  }

  private parseDataHoraOutlook(val: string | number, dataPlanilhaStr?: string): Date | null {
    // Excel serial time: fração do dia (0 = 00:00, 0.5 = 12:00, 0.54166... = 13:00)
    const num = typeof val === 'number' ? val : Number(String(val).replace(',', '.'));
    if (!Number.isNaN(num) && num >= 0 && num < 1) {
      const totalSegundos = num * 24 * 3600;
      const h = Math.floor(totalSegundos / 3600);
      const min = Math.round((totalSegundos % 3600) / 60);
      let dia: number, mes: number, ano: number;
      if (dataPlanilhaStr) {
        const parts = dataPlanilhaStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (parts) {
          dia = Number(parts[1]);
          mes = Number(parts[2]) - 1;
          ano = Number(parts[3]);
        } else {
          const hoje = new Date();
          ano = hoje.getFullYear();
          mes = hoje.getMonth();
          dia = hoje.getDate();
        }
      } else {
        const hoje = new Date();
        ano = hoje.getFullYear();
        mes = hoje.getMonth();
        dia = hoje.getDate();
      }
      const d = instanteCivilSaoPaulo(ano, mes, dia, h, min, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const s = String(val).trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
    const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(s);
    if (br) {
      const [, dia, mes, ano, h, min] = br;
      const d2 = instanteCivilSaoPaulo(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(h),
        Number(min),
        0,
      );
      return Number.isNaN(d2.getTime()) ? null : d2;
    }
    const soHorario = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (soHorario) {
      const [, h, min] = soHorario;
      let dia: number, mes: number, ano: number;
      if (dataPlanilhaStr) {
        const parts = dataPlanilhaStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (parts) {
          dia = Number(parts[1]);
          mes = Number(parts[2]) - 1;
          ano = Number(parts[3]);
        } else {
          const hoje = new Date();
          ano = hoje.getFullYear();
          mes = hoje.getMonth();
          dia = hoje.getDate();
        }
      } else {
        const hoje = new Date();
        ano = hoje.getFullYear();
        mes = hoje.getMonth();
        dia = hoje.getDate();
      }
      const seg = Number(soHorario[3] ?? 0);
      const d3 = instanteCivilSaoPaulo(
        ano,
        mes,
        dia,
        Number(h),
        Number(min),
        seg,
      );
      return Number.isNaN(d3.getTime()) ? null : d3;
    }
    return null;
  }

  async registrarImportacaoOutlook(total: number, usuarioId?: string): Promise<void> {
    try {
      await this.prisma.logImportacaoOutlook.create({
        data: { total, usuarioId: usuarioId ?? undefined },
      });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2021') {
        return;
      }
      throw e;
    }
  }

  async getUltimaImportacaoOutlook(): Promise<{
    dataHora: Date;
    total: number;
    usuarioNome?: string | null;
  } | null> {
    try {
      const ultima = await this.prisma.logImportacaoOutlook.findFirst({
        orderBy: { dataHora: 'desc' },
        include: { usuario: { select: { nome: true } } },
      });
      if (!ultima) return null;
      return {
        dataHora: ultima.dataHora,
        total: ultima.total,
        usuarioNome: ultima.usuario?.nome ?? null,
      };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2021') {
        return null;
      }
      throw e;
    }
  }

  /**
   * Dashboard: totais por semana, mês ou ano. KPIs no período; gráfico por dia (semana/mês) ou por mês (ano).
   * PF/COORD: apenas sua coordenadoria; ADM/DEV: todos ou filtro por coordenadoriaId.
   */
  async getDashboard(
    tipoPeriodo: 'semana' | 'mes' | 'ano' = 'ano',
    ano?: number,
    mes?: number,
    semanaInicio?: string,
    dataInicioQuery?: string,
    dataFimQuery?: string,
    coordenadoriaId?: string,
    divisaoId?: string,
    usuarioLogado?: Usuario,
  ): Promise<DashboardResponseDTO> {
    const anoFiltro = ano ?? new Date().getFullYear();
    let filtroCoordenadoria: string | undefined;
    let filtroDivisaoTecnico: string | undefined;
    let filtroPFCoordDashboard: string | undefined;
    let filtroTecnicoDashboard: { tecnicoId: string } | undefined;
    let dashboardDevTecSemDivisao = false;

    if (usuarioLogado) {
      if (usuarioLogado.permissao === 'PONTO_FOCAL') {
        filtroDivisaoTecnico = (usuarioLogado as any).divisaoId ?? undefined;
        filtroPFCoordDashboard =
          (usuarioLogado as any).divisao?.coordenadoriaId ?? undefined;
      } else if (usuarioLogado.permissao === 'COORDENADOR') {
        filtroCoordenadoria = (usuarioLogado as any).divisao?.coordenadoriaId ?? undefined;
        if (divisaoId) {
          filtroDivisaoTecnico = divisaoId;
        }
      } else if (usuarioLogado.permissao === 'DIRETOR') {
        filtroDivisaoTecnico = (usuarioLogado as any).divisaoId ?? undefined;
      } else if (usuarioLogado.permissao === 'TEC') {
        const esc = this.escopoListaAgendamentosParaTec(usuarioLogado);
        if (esc.modo === 'dev_impersona_tec_sem_divisao') {
          dashboardDevTecSemDivisao = true;
        } else if (esc.modo === 'dev_impersona_tec') {
          filtroDivisaoTecnico = esc.divisaoId;
        } else if (esc.modo === 'arthur') {
          filtroDivisaoTecnico = esc.divisaoArthurId;
        } else {
          filtroTecnicoDashboard = { tecnicoId: esc.usuarioId };
        }
      } else if (usuarioLogado.permissao === 'DEV') {
        const coordIdDev = await this.coordenadoriaIdDoUsuarioLogado(
          usuarioLogado,
        );
        if (coordIdDev) {
          filtroCoordenadoria = coordIdDev;
        } else if (divisaoId) {
          filtroDivisaoTecnico = divisaoId;
        } else if (coordenadoriaId) {
          filtroCoordenadoria = coordenadoriaId;
        }
      } else if (divisaoId) {
        filtroDivisaoTecnico = divisaoId;
      } else if (coordenadoriaId) {
        filtroCoordenadoria = coordenadoriaId;
      }
    } else if (divisaoId) {
      filtroDivisaoTecnico = divisaoId;
    } else if (coordenadoriaId) {
      filtroCoordenadoria = coordenadoriaId;
    }

    let dataInicio: Date;
    let dataFim: Date;

    if (dataInicioQuery?.trim() && dataFimQuery?.trim()) {
      const dIni = new Date(dataInicioQuery.trim());
      const dFim = new Date(dataFimQuery.trim());
      if (!Number.isNaN(dIni.getTime()) && !Number.isNaN(dFim.getTime())) {
        dataInicio = dIni;
        dataFim = dFim;
      } else {
        dataInicio = new Date(anoFiltro, 0, 1, 0, 0, 0, 0);
        dataFim = new Date(anoFiltro, 11, 31, 23, 59, 59, 999);
      }
    } else if (tipoPeriodo === 'semana') {
      if (semanaInicio?.trim()) {
        const parts = semanaInicio.trim().split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          dataInicio = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        } else {
          const d = new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          dataInicio = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
        }
      } else {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        dataInicio = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
      }
      dataFim = new Date(dataInicio);
      dataFim.setDate(dataFim.getDate() + 6);
      dataFim.setHours(23, 59, 59, 999);
    } else if (tipoPeriodo === 'mes' && mes != null && mes >= 1 && mes <= 12) {
      dataInicio = new Date(anoFiltro, mes - 1, 1, 0, 0, 0, 0);
      const ultimoDia = new Date(anoFiltro, mes, 0).getDate();
      dataFim = new Date(
        anoFiltro,
        mes - 1,
        ultimoDia,
        23,
        59,
        59,
        999,
      );
    } else {
      dataInicio = new Date(anoFiltro, 0, 1, 0, 0, 0, 0);
      dataFim = new Date(anoFiltro, 11, 31, 23, 59, 59, 999);
    }

    const anoMin = new Date().getFullYear() - 5;

    let filtroPorTecnicoDivisao: Prisma.AgendamentoWhereInput;
    if (dashboardDevTecSemDivisao) {
      filtroPorTecnicoDivisao = {
        AND: [
          { id: '00000000-0000-0000-0000-000000000000' },
          { id: { not: '00000000-0000-0000-0000-000000000000' } },
        ],
      };
    } else if (filtroTecnicoDashboard) {
      filtroPorTecnicoDivisao = { ...filtroTecnicoDashboard };
    } else if (
      usuarioLogado?.permissao === 'PONTO_FOCAL' &&
      filtroDivisaoTecnico &&
      filtroPFCoordDashboard
    ) {
      const envDivPre = this.divisaoPreProjetosEnv();
      const orDash: Prisma.AgendamentoWhereInput[] = [
        { tecnico: { divisaoId: filtroDivisaoTecnico } },
        { divisaoId: filtroDivisaoTecnico },
        { coordenadoriaId: filtroPFCoordDashboard, tecnicoId: null },
      ];
      if (envDivPre) {
        orDash.push({
          coordenadoriaId: filtroPFCoordDashboard,
          divisaoId: envDivPre,
        });
      }
      filtroPorTecnicoDivisao = { OR: orDash };
    } else {
      const porCoord = filtroCoordenadoria
        ? { coordenadoriaId: filtroCoordenadoria }
        : {};
      if (filtroDivisaoTecnico) {
        filtroPorTecnicoDivisao = {
          ...porCoord,
          OR: [
            { tecnico: { divisaoId: filtroDivisaoTecnico } },
            { divisaoId: filtroDivisaoTecnico },
          ],
        };
      } else {
        filtroPorTecnicoDivisao = { ...porCoord };
      }
    }

    const whereBase = {
      AND: [
        {
          dataHora: { gte: dataInicio, lte: dataFim },
          ...filtroPorTecnicoDivisao,
        },
        AgendamentosService.whereExcluirPreProjetoArthurNaListaAgendamentos(),
      ],
    };

    const whereAnoHistorico = {
      AND: [
        {
          dataHora: {
            gte: new Date(anoMin, 0, 1),
            lte: new Date(),
          },
          ...filtroPorTecnicoDivisao,
        },
        AgendamentosService.whereExcluirPreProjetoArthurNaListaAgendamentos(),
      ],
    };

    const [
      totalGeral,
      realizados,
      naoRealizados,
      apenasNaoRealizado,
      registrosPorMes,
      registrosPorAno,
      registrosMotivos,
    ] = await Promise.all([
      this.prisma.agendamento.count({ where: whereBase }),
      this.prisma.agendamento.count({
        where: {
          ...whereBase,
          status: { in: ['ATENDIDO', 'CONCLUIDO'] },
        },
      }),
      this.prisma.agendamento.count({
        where: {
          ...whereBase,
          status: { in: ['NAO_REALIZADO', 'CANCELADO'] },
        },
      }),
      this.prisma.agendamento.count({
        where: { ...whereBase, status: 'NAO_REALIZADO' },
      }),
      this.prisma.agendamento.findMany({
        where: whereBase,
        select: { dataHora: true },
      }),
      this.prisma.agendamento.findMany({
        where: whereAnoHistorico,
        select: { dataHora: true },
      }),
      this.prisma.agendamento.findMany({
        where: { ...whereBase, status: 'NAO_REALIZADO' },
        select: {
          motivoNaoAtendimentoId: true,
          motivoNaoAtendimento: {
            select: { id: true, texto: true },
          },
        },
      }),
    ]);

    const datasUnicas = new Set<string>();
    for (const r of registrosPorMes) {
      const d = new Date(r.dataHora);
      datasUnicas.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }
    const diasComAgendamentos = datasUnicas.size;

    let porMes: DashboardPorMesDTO[] = [];
    let porDia: DashboardPorDiaDTO[] | undefined;
    let porSemana: DashboardPorSemanaDTO[] | undefined;

    /** Retorna semana ISO (1-53) para uma data */
    const getISOWeek = (date: Date): number => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
      );
    };

    if (tipoPeriodo === 'ano') {
      const porMesMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) porMesMap.set(m, 0);
      for (const r of registrosPorMes) {
        const d = new Date(r.dataHora);
        porMesMap.set(
          d.getMonth() + 1,
          (porMesMap.get(d.getMonth() + 1) ?? 0) + 1,
        );
      }
      porMes = Array.from(porMesMap.entries()).map(([mes, total]) => ({
        mes,
        ano: anoFiltro,
        total,
      }));
      const porSemanaMap = new Map<number, number>();
      for (const r of registrosPorMes) {
        const w = getISOWeek(new Date(r.dataHora));
        porSemanaMap.set(w, (porSemanaMap.get(w) ?? 0) + 1);
      }
      porSemana = Array.from(porSemanaMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([semana, total]) => ({
          semana,
          label: `S${semana}`,
          total,
        }));
    } else if (tipoPeriodo === 'semana') {
      const labelsDia = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      const porDiaMap = new Map<number, number>();
      for (let i = 1; i <= 7; i++) porDiaMap.set(i, 0);
      for (const r of registrosPorMes) {
        const d = new Date(r.dataHora);
        const diaSemana = d.getDay();
        const segAdom = diaSemana === 0 ? 7 : diaSemana;
        porDiaMap.set(segAdom, (porDiaMap.get(segAdom) ?? 0) + 1);
      }
      porDia = Array.from(porDiaMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([dia, total]) => ({
          dia,
          label: labelsDia[dia - 1],
          total,
        }));
    } else if (tipoPeriodo === 'mes' && mes != null) {
      const ultimoDia = new Date(anoFiltro, mes, 0).getDate();
      const porDiaMap = new Map<number, number>();
      for (let i = 1; i <= ultimoDia; i++) porDiaMap.set(i, 0);
      for (const r of registrosPorMes) {
        const d = new Date(r.dataHora);
        const dia = d.getDate();
        porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1);
      }
      porDia = Array.from(porDiaMap.entries()).map(([dia, total]) => ({
        dia,
        label: String(dia),
        total,
      }));
      const numSemanasNoMes = Math.ceil(ultimoDia / 7);
      const porSemanaMap = new Map<number, number>();
      for (let i = 1; i <= numSemanasNoMes; i++) porSemanaMap.set(i, 0);
      for (const r of registrosPorMes) {
        const d = new Date(r.dataHora);
        const dia = d.getDate();
        const semanaNoMes = Math.ceil(dia / 7);
        porSemanaMap.set(
          semanaNoMes,
          (porSemanaMap.get(semanaNoMes) ?? 0) + 1,
        );
      }
      porSemana = Array.from(porSemanaMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([semana, total]) => ({
          semana,
          label: `Sem ${semana}`,
          total,
        }));
    }

    const porAnoMap = new Map<number, number>();
    for (const r of registrosPorAno) {
      const y = new Date(r.dataHora).getFullYear();
      if (y >= anoMin) porAnoMap.set(y, (porAnoMap.get(y) ?? 0) + 1);
    }
    const porAno: DashboardPorAnoDTO[] = Array.from(porAnoMap.entries())
      .map(([a, total]) => ({ ano: a, total }))
      .sort((a, b) => a.ano - b.ano);

    const motivosMap = new Map<string, { texto: string; total: number }>();
    for (const r of registrosMotivos) {
      const id = r.motivoNaoAtendimentoId ?? 'sem_motivo';
      const texto = r.motivoNaoAtendimento?.texto ?? 'Não informado';
      if (!motivosMap.has(id)) motivosMap.set(id, { texto, total: 0 });
      motivosMap.get(id)!.total += 1;
    }
    const motivosNaoRealizacao: DashboardMotivoNaoRealizacaoDTO[] = Array.from(
      motivosMap.entries(),
    ).map(([motivoId, v]) => ({
      motivoId: motivoId === 'sem_motivo' ? null : motivoId,
      motivoTexto: v.texto,
      total: v.total,
    }));

    return {
      totalGeral,
      realizados,
      naoRealizados,
      apenasNaoRealizado,
      diasComAgendamentos,
      porMes,
      porAno,
      ...(porDia != null && { porDia }),
      ...(porSemana != null && { porSemana }),
      motivosNaoRealizacao,
    };
  }
}
