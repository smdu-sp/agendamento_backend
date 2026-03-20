import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDivisaoDto } from './dto/create-divisao.dto';
import { UpdateDivisaoDto } from './dto/update-divisao.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppService } from 'src/app.service';
import {
  DivisaoPaginadoResponseDTO,
  DivisaoResponseDTO,
} from './dto/divisao-response.dto';

@Injectable()
export class DivisoesService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  private readonly selectDivisao = {
    id: true,
    sigla: true,
    nome: true,
    status: true,
    criadoEm: true,
    atualizadoEm: true,
    coordenadoriaId: true,
    coordenadoria: {
      select: { id: true, sigla: true, nome: true },
    },
  };

  async criar(dto: CreateDivisaoDto): Promise<DivisaoResponseDTO> {
    const existente = await this.prisma.divisao.findUnique({
      where: { sigla: dto.sigla },
    });
    if (existente) throw new ForbiddenException('Sigla já cadastrada.');

    const divisao = await this.prisma.divisao.create({
      data: { ...dto, status: dto.status ?? true },
      select: this.selectDivisao,
    });
    if (!divisao)
      throw new InternalServerErrorException(
        'Não foi possível criar a divisão, tente novamente.',
      );
    return divisao;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
    coordenadoriaId?: string,
  ): Promise<DivisaoPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
      ...(coordenadoriaId && { coordenadoriaId }),
      ...(busca && {
        OR: [
          { sigla: { contains: busca } },
          { nome: { contains: busca } },
        ],
      }),
      ...(status &&
        status !== '' && {
          status:
            status === 'ATIVO' ? true : status === 'INATIVO' ? false : undefined,
        }),
    };
    const total = await this.prisma.divisao.count({ where: searchParams });
    if (total === 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const divisoes = await this.prisma.divisao.findMany({
      where: searchParams,
      orderBy: { sigla: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
      select: this.selectDivisao,
    });
    return { total: +total, pagina: +pagina, limite: +limite, data: divisoes };
  }

  async buscarPorId(id: string): Promise<DivisaoResponseDTO> {
    const divisao = await this.prisma.divisao.findUnique({
      where: { id },
      select: this.selectDivisao,
    });
    if (!divisao) throw new NotFoundException('Divisão não encontrada.');
    return divisao;
  }

  async buscarPorSigla(sigla: string): Promise<DivisaoResponseDTO | null> {
    return this.prisma.divisao.findUnique({
      where: { sigla },
      select: this.selectDivisao,
    });
  }

  async listaCompleta(coordenadoriaId?: string): Promise<DivisaoResponseDTO[]> {
    return this.prisma.divisao.findMany({
      where: { status: true, ...(coordenadoriaId && { coordenadoriaId }) },
      orderBy: { sigla: 'asc' },
      select: this.selectDivisao,
    });
  }

  async atualizar(
    id: string,
    dto: UpdateDivisaoDto,
  ): Promise<DivisaoResponseDTO> {
    if (dto.sigla) {
      const existente = await this.buscarPorSigla(dto.sigla);
      if (existente && existente.id !== id)
        throw new ForbiddenException('Sigla já cadastrada.');
    }
    const divisao = await this.prisma.divisao.update({
      data: dto,
      where: { id },
      select: this.selectDivisao,
    });
    return divisao;
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.divisao.update({
      data: { status: false },
      where: { id },
    });
    return { desativado: true };
  }
}
