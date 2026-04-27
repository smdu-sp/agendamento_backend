import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseUUIDPipe,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgendamentosService } from './agendamentos.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { CreateAgendamentoPreProjetoDto } from './dto/create-agendamento-pre-projeto.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { PreProjetoSolicitacaoResponseDto } from './dto/pre-projeto-solicitacao-response.dto';
import { SolicitacaoPreProjetoPaginadoDto } from './dto/solicitacao-pre-projeto-paginado.dto';
import { CriarAgendamentoSolicitacaoPreProjetoPortalDto } from './dto/criar-agendamento-solicitacao-pre-projeto-portal.dto';
import { CriarMensagemSolicitacaoPreProjetoDto } from './dto/criar-mensagem-solicitacao-pre-projeto.dto';
import { AvaliarSolicitacaoPreProjetoDto } from './dto/avaliar-solicitacao-pre-projeto.dto';
import { AtribuirTecnicoCoordenadoriaSolicitacaoPreProjetoDto } from './dto/atribuir-tecnico-coordenadoria-solicitacao-pre-projeto.dto';
import { StatusSolicitacaoPreProjeto } from '@prisma/client';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { IsPublic } from 'src/auth/decorators/is-public.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { MunicipeAtual } from 'src/auth/decorators/municipe-atual.decorator';
import { MunicipeJwtAuthGuard } from 'src/auth/guards/municipe-jwt-auth.guard';
import type { MunicipeJwtPayload } from 'src/auth/guards/municipe-jwt-auth.guard';
import { Usuario } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import {
  AgendamentoPaginadoResponseDTO,
  AgendamentoResponseDTO,
} from './dto/agendamento-response.dto';
import { DashboardResponseDTO } from './dto/dashboard-response.dto';
import * as XLSX from 'xlsx';

@ApiTags('Agendamentos')
@ApiBearerAuth()
@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @IsPublic()
  @Post('publico/pre-projetos')
  @ApiOperation({
    summary:
      'Solicitação pública — Pré-projetos (formulário Arthur Saboya / pre-projetos)',
  })
  criarSolicitacaoPreProjetos(
    @Body() dto: CreateAgendamentoPreProjetoDto,
    @Headers('authorization') authorization?: string,
  ): Promise<PreProjetoSolicitacaoResponseDto> {
    return this.agendamentosService.criarSolicitacaoPreProjetos(dto, authorization);
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Get('municipes/pre-projetos-chamados')
  @ApiOperation({
    summary:
      'Portal munícipe — lista chamados de pré-projetos (Arthur Saboya) vinculados à conta ou ao e-mail.',
  })
  listarChamadosPreProjetosMunicipe(
    @MunicipeAtual() municipe: MunicipeJwtPayload,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.agendamentosService.listarMinhasSolicitacoesPreProjetosMunicipe(
      municipe,
      +(pagina ?? 1) || 1,
      +(limite ?? 10) || 10,
    );
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Get('municipes/pre-projetos-chamados/:id')
  @ApiOperation({
    summary:
      'Portal munícipe — detalhe do chamado com histórico de mensagens (estilo GLPI).',
  })
  obterChamadoPreProjetosMunicipe(
    @Param('id', ParseUUIDPipe) id: string,
    @MunicipeAtual() municipe: MunicipeJwtPayload,
  ) {
    return this.agendamentosService.obterSolicitacaoDetalheMunicipe(id, municipe);
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Post('municipes/pre-projetos-chamados/:id/mensagens')
  @ApiOperation({
    summary: 'Portal munícipe — envia nova mensagem no chamado.',
  })
  enviarMensagemChamadoPreProjetosMunicipe(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CriarMensagemSolicitacaoPreProjetoDto,
    @MunicipeAtual() municipe: MunicipeJwtPayload,
  ) {
    return this.agendamentosService.adicionarMensagemMunicipeNaSolicitacao(
      id,
      municipe,
      dto.texto,
    );
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Post('municipes/pre-projetos-chamados/:id/marcar-solucionado')
  @ApiOperation({
    summary:
      'Portal munícipe — confirma resolução do atendimento e marca chamado como Solucionado.',
  })
  marcarChamadoPreProjetosMunicipeComoSolucionado(
    @Param('id', ParseUUIDPipe) id: string,
    @MunicipeAtual() municipe: MunicipeJwtPayload,
  ) {
    return this.agendamentosService.marcarSolicitacaoMunicipeComoSolucionada(
      id,
      municipe,
    );
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Post('municipes/pre-projetos-chamados/:id/avaliacao')
  @ApiOperation({
    summary:
      'Portal munícipe — registra avaliação do atendimento após chamado solucionado (1 a 5 estrelas).',
  })
  avaliarChamadoPreProjetosMunicipe(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AvaliarSolicitacaoPreProjetoDto,
    @MunicipeAtual() municipe: MunicipeJwtPayload,
  ) {
    return this.agendamentosService.avaliarSolicitacaoPreProjetoMunicipe(
      id,
      municipe,
      dto.nota,
      dto.comentario,
    );
  }

  @IsPublic()
  @UseGuards(MunicipeJwtAuthGuard)
  @ApiBearerAuth()
  @Post('municipes/pre-projetos-chamados/:id/cancelar-atendimento')
  @ApiOperation({
    summary:
      'Portal munícipe — cancela atendimento agendado e notifica equipe da Sala Arthur Saboya.',
  })
  cancelarAtendimentoPreProjetosMunicipe(
    @Param('id', ParseUUIDPipe) id: string,
    @MunicipeAtual() municipe: MunicipeJwtPayload,
  ) {
    return this.agendamentosService.cancelarAtendimentoSolicitacaoMunicipe(
      id,
      municipe,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR', 'TEC', 'ARTHUR_SABOYA')
  @Get('solicitacoes-pre-projetos/arthur-saboya/portal/buscar-tudo')
  @ApiOperation({
    summary:
      'Portal interno Arthur Saboya — pedidos de pré-projetos (ponto focal da divisão configurada ou ADM/DEV)',
  })
  buscarSolicitacoesPortalArthurSaboya(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    let statusFiltro: StatusSolicitacaoPreProjeto | undefined;
    const s = status?.trim().toUpperCase();
    if (s === 'SOLICITADO') {
      statusFiltro = StatusSolicitacaoPreProjeto.SOLICITADO;
    } else if (s === 'RESPONDIDO') {
      statusFiltro = StatusSolicitacaoPreProjeto.RESPONDIDO;
    } else if (s === 'AGUARDANDO_DATA') {
      statusFiltro = StatusSolicitacaoPreProjeto.AGUARDANDO_DATA;
    } else if (s === 'AGENDAMENTO_CRIADO') {
      statusFiltro = StatusSolicitacaoPreProjeto.AGENDAMENTO_CRIADO;
    }
    return this.agendamentosService.buscarSolicitacoesPreProjetosPortalArthurSaboya(
      +(pagina ?? 1) || 1,
      +(limite ?? 10) || 10,
      busca,
      usuario,
      statusFiltro,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR', 'TEC', 'ARTHUR_SABOYA')
  @Get('solicitacoes-pre-projetos/arthur-saboya/portal/:id')
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — detalhe do chamado com mensagens (histórico GLPI). Parâmetro :id = UUID ou protocolo (ex.: PP-AB12CD34).',
  })
  obterSolicitacaoPortalArthurSaboyaDetalhe(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.obterSolicitacaoPortalDetalheComMensagens(
      id,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'ARTHUR_SABOYA')
  @Post('solicitacoes-pre-projetos/arthur-saboya/portal/:id/mensagens')
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — envia mensagem no chamado (técnico da Sala Arthur Saboya, ADM ou DEV).',
  })
  enviarMensagemPortalArthurSaboya(
    @Param('id') id: string,
    @Body() dto: CriarMensagemSolicitacaoPreProjetoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.adicionarMensagemPortalArthurSaboya(
      id,
      dto.texto,
      usuario,
    );
  }

  @Permissoes('ARTHUR_SABOYA')
  @Post(
    'solicitacoes-pre-projetos/arthur-saboya/portal/:id/confirmar-resposta-enviada',
  )
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — confirma que a dúvida foi respondida por e-mail (status → Respondido).',
  })
  portalArthurSaboyaConfirmarRespostaEnviada(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.portalArthurSaboyaConfirmarRespostaEnviada(
      id,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL')
  @Post(
    'solicitacoes-pre-projetos/arthur-saboya/portal/:id/marcar-aguardando-data',
  )
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — marca solicitação como aguardando data/hora do munícipe.',
  })
  portalArthurSaboyaMarcarAguardandoData(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.portalArthurSaboyaMarcarAguardandoData(
      id,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'ARTHUR_SABOYA')
  @Post(
    'solicitacoes-pre-projetos/arthur-saboya/portal/:id/criar-agendamento',
  )
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — envia para a coordenadoria com data/hora e técnico da Sala Arthur (status da solicitação → Agendamento criado).',
  })
  portalArthurSaboyaCriarAgendamentoDaSolicitacao(
    @Param('id') id: string,
    @Body() dto: CriarAgendamentoSolicitacaoPreProjetoPortalDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.portalArthurSaboyaCriarAgendamentoDaSolicitacao(
      id,
      dto,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Post(
    'solicitacoes-pre-projetos/arthur-saboya/portal/:id/atribuir-tecnico-coordenadoria',
  )
  @ApiOperation({
    summary:
      'Portal Arthur Saboya — ponto focal/coordenador da coordenadoria atribui o técnico local no chamado encaminhado.',
  })
  portalArthurSaboyaAtribuirTecnicoCoordenadoria(
    @Param('id') id: string,
    @Body() dto: AtribuirTecnicoCoordenadoriaSolicitacaoPreProjetoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.agendamentosService.portalArthurSaboyaAtribuirTecnicoCoordenadoria(
      id,
      dto.tecnicoId,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('solicitacoes-pre-projetos/buscar-tudo')
  @ApiOperation({
    summary: 'Lista solicitações de pré-projetos (Arthur Saboya)',
  })
  buscarSolicitacoesPreProjetos(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<SolicitacaoPreProjetoPaginadoDto> {
    return this.agendamentosService.buscarSolicitacoesPreProjetosArthurSaboya(
      +(pagina ?? 1) || 1,
      +(limite ?? 10) || 10,
      busca,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(
    @Body() createAgendamentoDto: CreateAgendamentoDto,
  ): Promise<AgendamentoResponseDTO> {
    return this.agendamentosService.criar(createAgendamentoDto);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('buscar-tudo')
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('coordenadoriaId') coordenadoriaId?: string,
    @Query('tecnicoId') tecnicoId?: string,
    @Query('tipoProcesso') tipoProcesso?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AgendamentoPaginadoResponseDTO> {
    return this.agendamentosService.buscarTudo(
      +pagina,
      +limite,
      busca,
      status,
      dataInicio,
      dataFim,
      coordenadoriaId,
      tecnicoId,
      tipoProcesso,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR', 'DIRETOR')
  @Get('dashboard')
  getDashboard(
    @Query('tipoPeriodo') tipoPeriodo?: 'semana' | 'mes' | 'ano',
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
    @Query('semanaInicio') semanaInicio?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('coordenadoriaId') coordenadoriaId?: string,
    @Query('divisaoId') divisaoId?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<DashboardResponseDTO> {
    const periodo =
      tipoPeriodo === 'semana' || tipoPeriodo === 'mes' || tipoPeriodo === 'ano'
        ? tipoPeriodo
        : 'ano';
    return this.agendamentosService.getDashboard(
      periodo,
      ano ? +ano : undefined,
      mes ? +mes : undefined,
      semanaInicio,
      dataInicio,
      dataFim,
      coordenadoriaId,
      divisaoId,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('buscar-do-dia')
  buscarDoDia(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AgendamentoResponseDTO[]> {
    return this.agendamentosService.buscarDoDia(usuario);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('buscar-por-id/:id')
  buscarPorId(@Param('id') id: string): Promise<AgendamentoResponseDTO> {
    return this.agendamentosService.buscarPorId(id);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR')
  @Patch('atualizar/:id')
  atualizar(
    @Param('id') id: string,
    @Body() updateAgendamentoDto: UpdateAgendamentoDto,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AgendamentoResponseDTO> {
    return this.agendamentosService.atualizar(
      id,
      updateAgendamentoDto,
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV')
  @Delete('excluir/:id')
  excluir(@Param('id') id: string): Promise<{ excluido: boolean }> {
    return this.agendamentosService.excluir(id);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('ultima-importacao-planilha')
  getUltimaImportacaoPlanilha(): Promise<{
    dataHora: string;
    total: number;
    usuarioNome?: string | null;
  } | null> {
    return this.agendamentosService.getUltimaImportacaoPlanilha().then((r) =>
      r
        ? {
            dataHora: r.dataHora.toISOString(),
            total: r.total,
            usuarioNome: r.usuarioNome ?? null,
          }
        : null,
    );
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA', 'DIRETOR')
  @Get('ultima-importacao-outlook')
  getUltimaImportacaoOutlook(): Promise<{
    dataHora: string;
    total: number;
    usuarioNome?: string | null;
  } | null> {
    return this.agendamentosService.getUltimaImportacaoOutlook().then((r) =>
      r
        ? {
            dataHora: r.dataHora.toISOString(),
            total: r.total,
            usuarioNome: r.usuarioNome ?? null,
          }
        : null,
    );
  }

  @Permissoes('ADM', 'DEV')
  @Post('importar-planilha')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
        },
        coordenadoriaId: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('arquivo'))
  async importarPlanilha(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType:
              /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|application\/excel)$/,
          }),
        ],
      }),
    )
    arquivo: Express.Multer.File,
    @Body() body: { coordenadoriaId?: string },
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ importados: number; erros: number; duplicados: number }> {
    try {
      if (!arquivo) {
        throw new Error('Arquivo não fornecido');
      }

      // Lê o arquivo Excel
      const workbook = XLSX.read(arquivo.buffer, { type: 'buffer' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Planilha vazia ou inválida');
      }

      const primeiraAba = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeiraAba];

      if (!worksheet) {
        throw new Error('Não foi possível ler a planilha');
      }

      // Primeiro, verifica qual linha tem os cabeçalhos reais (estrutura: linha 9)
      // A, C, D, H, I, J, K, L, M, N, Q
      const linhasTeste = XLSX.utils.sheet_to_json(worksheet, {
        range: 'A1:Q20', // Lê as primeiras 20 linhas até coluna Q
        header: 1, // Retorna como array de arrays (não como objetos)
        defval: null,
      });

      console.log('Linhas de teste lidas:', linhasTeste.length);

      // Procura a linha que contém os cabeçalhos esperados
      let linhaCabeçalho = 8; // Padrão: linha 9 (índice 8)
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

      console.log('🔍 Procurando cabeçalhos nas primeiras 20 linhas...');

      for (let i = 0; i < linhasTeste.length; i++) {
        const linha = linhasTeste[i] as any[];
        if (linha && linha.length > 0) {
          // Filtra valores não vazios
          const valoresNaoVazios = linha.filter(
            (c) => c && String(c).trim() !== '',
          );

          if (valoresNaoVazios.length === 0) {
            continue; // Pula linhas completamente vazias
          }

          const linhaStr = linha
            .map((c) => String(c || '').trim())
            .join('|')
            .toLowerCase();

          // Verifica correspondência exata primeiro
          const matchesExatos = cabecalhosEsperados.filter((cab) =>
            linha.some((c) => {
              const celula = String(c || '').trim();
              return (
                celula === cab || celula.toLowerCase() === cab.toLowerCase()
              );
            }),
          );

          // Verifica correspondência parcial
          const matchesParciais = cabecalhosEsperados.filter((cab) => {
            const cabLower = cab.toLowerCase();
            const palavrasCab = cabLower.split(/\s+/);
            return palavrasCab.some(
              (palavra) => linhaStr.includes(palavra) && palavra.length >= 3,
            );
          });

          const matches =
            matchesExatos.length > 0 ? matchesExatos : matchesParciais;

          if (matches.length >= 4) {
            linhaCabeçalho = i;
            console.log(
              `✅ Cabeçalhos encontrados na linha ${i + 1} (índice ${i}):`,
              matches,
            );
            console.log(`   Conteúdo da linha:`, valoresNaoVazios);
            break;
          } else if (matches.length > 0) {
            console.log(
              `⚠️ Linha ${i + 1}: ${matches.length} cabeçalhos encontrados (esperado >= 4):`,
              matches,
            );
            console.log(`   Valores não vazios:`, valoresNaoVazios);
          }
        }
      }

      console.log(
        `📌 Usando linha ${linhaCabeçalho + 1} (índice ${linhaCabeçalho}) como cabeçalho`,
      );

      // A linha de cabeçalho é linhaCabeçalho + 1 (1-based)
      const linhaInicio = linhaCabeçalho + 1;

      console.log(`📊 Lendo planilha com cabeçalho na linha ${linhaInicio}`);

      // Lê a linha de cabeçalho para obter os nomes das colunas
      const linhaCabecalhoArray = linhasTeste[linhaCabeçalho] as any[];
      const nomesColunas = linhaCabecalhoArray.map((c) =>
        String(c || '').trim(),
      );

      console.log(
        '📋 Nomes das colunas detectados:',
        nomesColunas.filter((c) => c !== ''),
      );

      // Lê os dados como array de arrays começando da linha de cabeçalho
      // Isso evita o erro "invalid column -1" que acontece quando passamos array para header
      let dadosArray = XLSX.utils.sheet_to_json(worksheet, {
        range: `A${linhaInicio}:Z1048576`, // Começa na linha de cabeçalho e lê até o limite da planilha
        header: 1, // Retorna como array de arrays
        defval: null,
        raw: false,
      }) as any[][];

      // Se não conseguiu ler, tenta sem range
      if (!dadosArray || dadosArray.length === 0) {
        console.log('⚠️ Tentativa com range falhou, tentando sem range...');
        dadosArray = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Retorna como array de arrays
          defval: null,
          raw: false,
        }) as any[][];

        // Pula as linhas antes do cabeçalho
        if (dadosArray && dadosArray.length > linhaCabeçalho) {
          dadosArray = dadosArray.slice(linhaCabeçalho);
        }
      }

      // Converte array de arrays para objetos usando os nomes de colunas
      let dados: any[] = [];
      if (dadosArray && dadosArray.length > 0) {
        console.log('📋 Convertendo array de arrays para objetos...');

        // A primeira linha do array deve ser o cabeçalho
        const cabecalhoLinha = dadosArray[0] as any[];

        // Se a primeira linha não corresponde ao cabeçalho esperado, usa o cabeçalho detectado
        const usarCabecalhoDetectado =
          !cabecalhoLinha ||
          !cabecalhoLinha.some((c) =>
            nomesColunas.includes(String(c || '').trim()),
          );

        const nomesColunasFinais = usarCabecalhoDetectado
          ? nomesColunas
          : cabecalhoLinha.map((c) => String(c || '').trim());

        console.log(
          '📋 Usando nomes de colunas:',
          nomesColunasFinais.filter((c) => c !== ''),
        );

        // Converte as linhas de dados para objetos
        // Começa do índice 1 porque o índice 0 é o cabeçalho (linha 9)
        // O índice 1 corresponde à primeira linha de dados (linha 10)
        for (let i = 1; i < dadosArray.length; i++) {
          const linha = dadosArray[i] as any[];
          if (!linha || linha.length === 0) continue;

          const objeto: any = {};
          nomesColunasFinais.forEach((nome, index) => {
            if (nome && nome.trim() !== '') {
              objeto[nome] = linha[index] !== undefined ? linha[index] : null;
            }
          });

          // Só adiciona se o objeto tiver pelo menos um valor não nulo
          if (
            Object.values(objeto).some(
              (v) => v !== null && v !== undefined && String(v).trim() !== '',
            )
          ) {
            dados.push(objeto);
          }
        }
      }

      // Remove a primeira linha APENAS se ela for EXATAMENTE o cabeçalho (verificação de segurança)
      // Verifica se TODOS os valores da primeira linha correspondem aos cabeçalhos esperados
      if (dados && dados.length > 0 && !Array.isArray(dados[0])) {
        const primeiraLinha = dados[0];
        const valoresPrimeiraLinha = Object.values(primeiraLinha).map((v) =>
          String(v || '')
            .trim()
            .toLowerCase(),
        );
        const cabecalhosEsperadosLower = cabecalhosEsperados.map((c) =>
          c.trim().toLowerCase(),
        );

        // Verifica se TODOS os valores não vazios da primeira linha correspondem a cabeçalhos
        // Isso evita remover linhas de dados que possam conter palavras dos cabeçalhos
        const valoresNaoVazios = valoresPrimeiraLinha.filter((v) => v !== '');
        if (valoresNaoVazios.length > 0) {
          const todosSaoCabecalhos = valoresNaoVazios.every((valor) =>
            cabecalhosEsperadosLower.some(
              (cab) => valor === cab || valor.includes(cab),
            ),
          );

          // Só remove se TODOS os valores forem cabeçalhos E houver pelo menos 3 correspondências
          if (todosSaoCabecalhos && valoresNaoVazios.length >= 3) {
            console.log('⚠️ Primeira linha era cabeçalho, removendo...');
            console.log('   Valores da primeira linha:', valoresNaoVazios);
            dados = dados.slice(1);
          }
        }
      }

      console.log(
        `Total de linhas lidas da planilha: ${dados ? dados.length : 0}`,
      );
      if (dados && dados.length > 0) {
        const cabecalhos = Object.keys(dados[0]);
        console.log('Cabeçalhos encontrados:', cabecalhos);
        console.log('Total de cabeçalhos:', cabecalhos.length);

        // Verifica se encontrou os cabeçalhos esperados
        const cabecalhosEsperados = [
          'Nro. Processo',
          'Nro.Protocolo',
          'CPF',
          'Requerente',
          'Tipo Agendamento',
          'Local de Atendimento',
          'Técnico',
          'RF',
          'E-mail',
          'Agendado para',
        ];
        const encontrados = cabecalhosEsperados.filter((cab) =>
          cabecalhos.some((c) =>
            c.toLowerCase().includes(cab.toLowerCase().substring(0, 5)),
          ),
        );
        console.log('Cabeçalhos esperados encontrados:', encontrados);

        // Mostra as primeiras 3 linhas para debug
        for (let i = 0; i < Math.min(3, dados.length); i++) {
          console.log(
            `Linha ${i + 1} de dados (amostra):`,
            JSON.stringify(dados[i], null, 2),
          );
        }
      } else {
        console.log(
          'Nenhum dado encontrado na planilha após todas as tentativas',
        );
      }

      if (!dados || dados.length === 0) {
        return { importados: 0, erros: 0, duplicados: 0 };
      }

      return this.agendamentosService.importarPlanilha(
        dados,
        body?.coordenadoriaId,
        usuario,
      );
    } catch (error) {
      console.error('Erro ao importar planilha:', error);
      throw error;
    }
  }

  @Permissoes('ADM', 'DEV')
  @Post('importar-planilha-outlook')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('arquivo'))
  async importarPlanilhaOutlook(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|application\/excel)$/,
          }),
        ],
      }),
    )
    arquivo: Express.Multer.File,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ importados: number; erros: number; duplicados: number }> {
    if (!arquivo) throw new Error('Arquivo não fornecido');
    const workbook = XLSX.read(arquivo.buffer, { type: 'buffer' });
    if (!workbook.SheetNames?.length) throw new Error('Planilha vazia ou inválida');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) throw new Error('Não foi possível ler a planilha');

    // Linhas 1–3, colunas A–G: texto com "Data: DD/MM/AAAA" (ex.: "SMUL | Agendamentos - Data: 26/02/2026")
    const linhas1a3 = XLSX.utils.sheet_to_json(worksheet, {
      range: 'A1:G3',
      header: 1,
      defval: '',
    }) as unknown as (string | number)[][];
    let dataPlanilhaStr: string | null = null;
    const textoTopo: string = (Array.isArray(linhas1a3) ? linhas1a3.flat() : [])
      .map((c) => String(c ?? '').trim())
      .join(' ');
    const matchData = textoTopo.match(/Data:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (matchData) {
      const [, d, m, a] = matchData;
      dataPlanilhaStr = `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${a!}`;
    }

    const headerOutlook = [
      'Tipo de Atendimento',
      'Visitante',
      'CPF',
      'Horário',
      'Técnico Responsável',
      'Unidade',
      'Número do Processo',
    ];
    const dados = XLSX.utils.sheet_to_json(worksheet, {
      range: 4,
      header: headerOutlook,
      defval: null,
    });
    if (!dados || dados.length === 0) {
      return { importados: 0, erros: 0, duplicados: 0 };
    }
    return this.agendamentosService.importarPlanilhaOutlook(
      dados,
      usuario,
      dataPlanilhaStr ?? undefined,
    );
  }
}
