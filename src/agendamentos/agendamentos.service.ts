import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Agendamento, StatusAgendamento, Usuario } from '@prisma/client';
import { AppService } from 'src/app.service';
import {
  AgendamentoPaginadoResponseDTO,
  AgendamentoResponseDTO,
} from './dto/agendamento-response.dto';
import {
  DashboardResponseDTO,
  DashboardPorMesDTO,
  DashboardPorAnoDTO,
  DashboardMotivoNaoRealizacaoDTO,
} from './dto/dashboard-response.dto';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { CoordenadoriasService } from 'src/coordenadorias/coordenadorias.service';

@Injectable()
export class AgendamentosService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
    private usuariosService: UsuariosService,
    private coordenadoriasService: CoordenadoriasService,
  ) {}

  /**
   * Converte RF para login (ex: 8544409 -> d854440)
   */
  private rfParaLogin(rf: string): string {
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
   */
  private async buscarOuCriarTecnicoPorRF(
    rf: string,
    coordenadoriaId?: string,
  ): Promise<string | null> {
    if (!rf) return null;

    const login = this.rfParaLogin(rf);
    if (!login) return null;

    try {
      // Busca usuário existente pelo login (independente da permissão)
      const usuario = await this.usuariosService.buscarPorLogin(login);
      if (usuario) {
        // Busca o usuário completo do Prisma para verificar coordenadoriaId
        const usuarioCompleto = await this.prisma.usuario.findUnique({
          where: { id: usuario.id },
          select: { id: true, coordenadoriaId: true, nome: true, login: true },
        });

        // Se o técnico já existe mas não tem coordenadoria e uma foi fornecida, atualiza
        if (
          coordenadoriaId &&
          usuarioCompleto &&
          !usuarioCompleto.coordenadoriaId
        ) {
          try {
            await this.prisma.usuario.update({
              where: { id: usuarioCompleto.id },
              data: { coordenadoriaId },
            });
            console.log(
              `Coordenadoria ${coordenadoriaId} atribuída ao técnico ${usuarioCompleto.nome} (${usuarioCompleto.login})`,
            );
          } catch (error) {
            console.log(
              `Erro ao atualizar coordenadoria do técnico ${usuarioCompleto.login}:`,
              error.message,
            );
          }
        }
        return usuario.id;
      }

      // Se não existe, tenta buscar no LDAP e criar automaticamente
      let dadosLDAP: { login: string; nome: string; email: string } | null =
        null;

      try {
        dadosLDAP = await this.usuariosService.buscarNovo(login);
      } catch (error) {
        // Se não encontrou no LDAP, cria usuário básico com permissão TEC
        console.log(
          `Técnico com RF ${rf} não encontrado no LDAP. Criando usuário básico...`,
        );

        // Cria nome baseado no login (ex: d854440 -> D854440)
        const nomeBasico = login.charAt(0).toUpperCase() + login.slice(1);
        // Cria email básico (ex: d854440@smul.prefeitura.sp.gov.br)
        const emailBasico = `${login}@smul.prefeitura.sp.gov.br`;

        dadosLDAP = {
          login: login,
          nome: nomeBasico,
          email: emailBasico,
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
              coordenadoriaId: coordenadoriaId || undefined,
            },
            { permissao: 'ADM' } as Usuario, // Admin temporário para criação
          );
          console.log(
            `Técnico ${dadosLDAP.nome} (${dadosLDAP.login}) criado automaticamente com permissão TEC${coordenadoriaId ? ` e coordenadoria ${coordenadoriaId}` : ''}`,
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

  async criar(
    createAgendamentoDto: CreateAgendamentoDto,
  ): Promise<AgendamentoResponseDTO> {
    const { tipoAgendamentoTexto, ...restDto } = createAgendamentoDto;
    let tipoAgendamentoId = restDto.tipoAgendamentoId;
    if (tipoAgendamentoTexto?.trim()) {
      tipoAgendamentoId = await this.buscarOuCriarTipoPorTexto(
        tipoAgendamentoTexto.trim(),
      );
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

    const agendamento: Agendamento = await this.prisma.agendamento.create({
      data: {
        ...restDto,
        tipoAgendamentoId,
        municipe: restDto.municipe
          ? this.padronizarNome(restDto.municipe)
          : null,
        tecnicoId,
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
          },
        },
      },
    });

    return agendamento as AgendamentoResponseDTO;
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
    usuarioLogado?: Usuario,
  ): Promise<AgendamentoPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Filtros baseados na permissão do usuário
    let filtroCoordenadoria: string | undefined;
    if (usuarioLogado) {
      if (
        usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR'
      ) {
        // Ponto Focal e Coordenador veem agendamentos da sua coordenadoria
        if (!usuarioLogado.coordenadoriaId) {
          return { total: 0, pagina: 0, limite: 0, data: [] };
        }
        filtroCoordenadoria = usuarioLogado.coordenadoriaId;
      } else if (usuarioLogado.permissao === 'TEC') {
        // Técnico só vê seus próprios agendamentos
        tecnicoId = usuarioLogado.id;
      }
      // ADM, DEV e PORTARIA veem todos
    }

    const searchParams = {
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
            gte: new Date(dataInicio + 'T00:00:00.000Z'), // Início do dia em UTC
            lte: new Date(dataFim + 'T23:59:59.999Z'), // Fim do dia em UTC
          },
        }),
      ...(filtroCoordenadoria && {
        coordenadoriaId: filtroCoordenadoria,
      }),
      ...(coordenadoriaId && {
        coordenadoriaId,
      }),
      ...(tecnicoId && {
        tecnicoId,
      }),
    };

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
          },
        },
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: agendamentos as AgendamentoResponseDTO[],
    };
  }

  /**
   * Busca agendamentos do dia atual
   */
  async buscarDoDia(
    usuarioLogado?: Usuario,
  ): Promise<AgendamentoResponseDTO[]> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    let filtroCoordenadoria: string | undefined;
    let filtroTecnico: string | undefined;
    let incluirSemTecnico = false;

    if (usuarioLogado) {
      if (
        usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR'
      ) {
        filtroCoordenadoria = usuarioLogado.coordenadoriaId;
        incluirSemTecnico = true;
      } else if (usuarioLogado.permissao === 'TEC') {
        filtroTecnico = usuarioLogado.id;
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
      // Para ponto focal, não filtra por técnico (mostra todos da coordenadoria, com ou sem técnico)
      // Para outros, não precisa fazer nada especial
    }

    if (filtroTecnico) {
      whereClause.tecnicoId = filtroTecnico;
    }

    const agendamentos = await this.prisma.agendamento.findMany({
      where: whereClause,
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
      select: { coordenadoriaId: true },
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
      if (!usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Você não possui coordenadoria atribuída.',
        );
      }
      if (agendamentoAtual.coordenadoriaId !== usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Você só pode atualizar agendamentos da sua coordenadoria.',
        );
      }
      if (
        updateAgendamentoDto.coordenadoriaId &&
        updateAgendamentoDto.coordenadoriaId !== usuarioLogado.coordenadoriaId
      ) {
        throw new ForbiddenException(
          'Você não pode alterar a coordenadoria do agendamento.',
        );
      }
    }

    let tecnicoId = updateAgendamentoDto.tecnicoId;

    // Validação: Ponto Focal e Coordenador só podem atribuir técnicos da sua coordenadoria
    if (
      usuarioLogado &&
      (usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR') &&
      tecnicoId
    ) {
      const tecnico = await this.prisma.usuario.findUnique({
        where: { id: tecnicoId },
        select: { coordenadoriaId: true, permissao: true },
      });

      if (!tecnico) {
        throw new NotFoundException('Técnico não encontrado.');
      }

      if (tecnico.permissao !== 'TEC') {
        throw new ForbiddenException('O usuário selecionado não é um técnico.');
      }

      if (tecnico.coordenadoriaId !== usuarioLogado.coordenadoriaId) {
        throw new ForbiddenException(
          'Você só pode atribuir técnicos da sua coordenadoria.',
        );
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
          select: { coordenadoriaId: true },
        });

        if (
          tecnico &&
          tecnico.coordenadoriaId !== usuarioLogado.coordenadoriaId
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
          },
        },
      },
    });

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
          // __EMPTY_13 = E-mail Técnico (N - não mapeamos para agendamento)
          // Agendado para (Data/Hora) está na coluna Q (__EMPTY_16)
          dataHora = linha['__EMPTY_16'] || null;

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
            // Cria a data como UTC para salvar exatamente como está na planilha
            // Isso evita conversões automáticas de timezone que causam diferença de horas
            dataHoraObj = new Date(
              Date.UTC(
                parseInt(ano),
                parseInt(mes) - 1, // Mês é 0-indexed
                parseInt(dia),
                parseInt(hora),
                parseInt(minuto),
                segundo ? parseInt(segundo) : 0,
              ),
            );
          } else {
            // Tenta parse direto (formato ISO ou outros)
            const parsedDate = new Date(dataHoraLimpa);
            if (!isNaN(parsedDate.getTime())) {
              // Extrai os componentes da data e cria como UTC
              // Isso garante que a hora será salva exatamente como interpretada
              const ano = parsedDate.getFullYear();
              const mes = parsedDate.getMonth();
              const dia = parsedDate.getDate();
              const hora = parsedDate.getHours();
              const minuto = parsedDate.getMinutes();
              const segundo = parsedDate.getSeconds();
              dataHoraObj = new Date(
                Date.UTC(ano, mes, dia, hora, minuto, segundo),
              );
            } else {
              dataHoraObj = parsedDate;
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
            // Se tem RF, busca ou cria técnico normalmente com a coordenadoria da planilha
            tecnicoId = await this.buscarOuCriarTecnicoPorRF(
              String(tecnicoRF),
              coordenadoriaIdFinal || undefined,
            );
          }
        } else if (tecnicoRF) {
          // Se não tem nome do técnico mas tem RF, busca ou cria técnico normalmente com a coordenadoria da planilha
          tecnicoId = await this.buscarOuCriarTecnicoPorRF(
            String(tecnicoRF),
            coordenadoriaIdFinal || undefined,
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
          await this.prisma.agendamento.create({
            data: {
              municipe: municipe
                ? this.padronizarNome(String(municipe).trim())
                : null,
              cpf: cpf ? String(cpf).trim() : null,
              processo: processo ? String(processo).trim() : null,
              dataHora: dataHoraObj,
              dataFim,
              resumo: tipoAgendamento ? String(tipoAgendamento).trim() : null,
              tipoAgendamentoId,
              coordenadoriaId: coordenadoriaIdFinal || null,
              tecnicoId,
              tecnicoRF: tecnicoRF ? String(tecnicoRF).trim() : null,
              email: email || null,
              importado: true,
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

    return { importados, erros, duplicados };
  }

  /**
   * Dashboard: totais por mês, por ano, realizados, não realizados e motivos.
   * PF/COORD: apenas sua coordenadoria; ADM/DEV: todos ou filtro por coordenadoriaId.
   */
  async getDashboard(
    ano?: number,
    coordenadoriaId?: string,
    usuarioLogado?: Usuario,
  ): Promise<DashboardResponseDTO> {
    const anoFiltro = ano ?? new Date().getFullYear();
    let filtroCoordenadoria: string | undefined;

    if (usuarioLogado) {
      if (
        usuarioLogado.permissao === 'PONTO_FOCAL' ||
        usuarioLogado.permissao === 'COORDENADOR'
      ) {
        filtroCoordenadoria = usuarioLogado.coordenadoriaId ?? undefined;
      } else if (coordenadoriaId) {
        filtroCoordenadoria = coordenadoriaId;
      }
    } else if (coordenadoriaId) {
      filtroCoordenadoria = coordenadoriaId;
    }

    const inicioAno = new Date(anoFiltro, 0, 1, 0, 0, 0, 0);
    const fimAno = new Date(anoFiltro, 11, 31, 23, 59, 59, 999);
    const anoMin = new Date().getFullYear() - 5;

    const whereBase = {
      dataHora: { gte: inicioAno, lte: fimAno },
      ...(filtroCoordenadoria && { coordenadoriaId: filtroCoordenadoria }),
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
        where: {
          dataHora: {
            gte: new Date(anoMin, 0, 1),
            lte: new Date(),
          },
          ...(filtroCoordenadoria && {
            coordenadoriaId: filtroCoordenadoria,
          }),
        },
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

    const porMesMap = new Map<number, number>();
    for (let m = 1; m <= 12; m++) porMesMap.set(m, 0);
    const datasUnicas = new Set<string>();
    for (const r of registrosPorMes) {
      const d = new Date(r.dataHora);
      porMesMap.set(
        d.getMonth() + 1,
        (porMesMap.get(d.getMonth() + 1) ?? 0) + 1,
      );
      datasUnicas.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }
    const diasComAgendamentos = datasUnicas.size;
    const porMes: DashboardPorMesDTO[] = Array.from(porMesMap.entries()).map(
      ([mes, total]) => ({ mes, ano: anoFiltro, total }),
    );

    const porAnoMap = new Map<number, number>();
    for (const r of registrosPorAno) {
      const y = new Date(r.dataHora).getFullYear();
      if (y >= anoMin) porAnoMap.set(y, (porAnoMap.get(y) ?? 0) + 1);
    }
    const porAno: DashboardPorAnoDTO[] = Array.from(porAnoMap.entries())
      .map(([ano, total]) => ({ ano, total }))
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
      motivosNaoRealizacao,
    };
  }
}
