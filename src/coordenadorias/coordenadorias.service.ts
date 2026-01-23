import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCoordenadoriaDto } from './dto/create-coordenadoria.dto';
import { UpdateCoordenadoriaDto } from './dto/update-coordenadoria.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Coordenadoria } from '@prisma/client';
import { AppService } from 'src/app.service';
import {
  CoordenadoriaPaginadoResponseDTO,
  CoordenadoriaResponseDTO,
} from './dto/coordenadoria-response.dto';

@Injectable()
export class CoordenadoriasService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  async criar(
    createCoordenadoriaDto: CreateCoordenadoriaDto,
  ): Promise<CoordenadoriaResponseDTO> {
    const coordenadoriaExistente = await this.prisma.coordenadoria.findUnique({
      where: { sigla: createCoordenadoriaDto.sigla },
    });
    if (coordenadoriaExistente)
      throw new ForbiddenException('Sigla já cadastrada.');

    const coordenadoria: Coordenadoria =
      await this.prisma.coordenadoria.create({
        data: {
          ...createCoordenadoriaDto,
          status: createCoordenadoriaDto.status ?? true,
        },
      });

    if (!coordenadoria)
      throw new InternalServerErrorException(
        'Não foi possível criar a coordenadoria, tente novamente.',
      );
    return coordenadoria;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
  ): Promise<CoordenadoriaPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
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
    const total: number = await this.prisma.coordenadoria.count({
      where: searchParams,
    });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const coordenadorias: Coordenadoria[] =
      await this.prisma.coordenadoria.findMany({
        where: searchParams,
        orderBy: { sigla: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      });
    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: coordenadorias,
    };
  }

  async buscarPorId(id: string): Promise<CoordenadoriaResponseDTO> {
    const coordenadoria: Coordenadoria =
      await this.prisma.coordenadoria.findUnique({ where: { id } });
    if (!coordenadoria) throw new NotFoundException('Coordenadoria não encontrada.');
    return coordenadoria;
  }

  async buscarPorSigla(sigla: string): Promise<CoordenadoriaResponseDTO> {
    const coordenadoria: Coordenadoria =
      await this.prisma.coordenadoria.findUnique({ where: { sigla } });
    return coordenadoria;
  }

  async listaCompleta(): Promise<CoordenadoriaResponseDTO[]> {
    const lista: Coordenadoria[] = await this.prisma.coordenadoria.findMany({
      where: { status: true },
      orderBy: { sigla: 'asc' },
    });
    return lista;
  }

  async atualizar(
    id: string,
    updateCoordenadoriaDto: UpdateCoordenadoriaDto,
  ): Promise<CoordenadoriaResponseDTO> {
    if (updateCoordenadoriaDto.sigla) {
      const coordenadoria = await this.buscarPorSigla(
        updateCoordenadoriaDto.sigla,
      );
      if (coordenadoria && coordenadoria.id !== id)
        throw new ForbiddenException('Sigla já cadastrada.');
    }

    const coordenadoriaAtualizada: Coordenadoria =
      await this.prisma.coordenadoria.update({
        data: updateCoordenadoriaDto,
        where: { id },
      });
    return coordenadoriaAtualizada;
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.coordenadoria.update({
      data: { status: false },
      where: { id },
    });
    return { desativado: true };
  }
}
