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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgendamentosService } from './agendamentos.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { Usuario } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
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

  @Permissoes('ADM', 'DEV')
  @Post('criar')
  criar(
    @Body() createAgendamentoDto: CreateAgendamentoDto,
  ): Promise<AgendamentoResponseDTO> {
    return this.agendamentosService.criar(createAgendamentoDto);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA')
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
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'PONTO_FOCAL', 'COORDENADOR')
  @Get('dashboard')
  getDashboard(
    @Query('tipoPeriodo') tipoPeriodo?: 'semana' | 'mes' | 'ano',
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
    @Query('semanaInicio') semanaInicio?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('coordenadoriaId') coordenadoriaId?: string,
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
      usuario,
    );
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA')
  @Get('buscar-do-dia')
  buscarDoDia(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AgendamentoResponseDTO[]> {
    return this.agendamentosService.buscarDoDia(usuario);
  }

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA')
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

  @Permissoes('ADM', 'DEV', 'TEC', 'PONTO_FOCAL', 'COORDENADOR', 'PORTARIA')
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
        range: `A${linhaInicio}:Z1000`, // Começa na linha de cabeçalho (formato A9:Z1000)
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
}
