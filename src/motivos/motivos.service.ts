import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMotivoDto } from './dto/create-motivo.dto';
import { UpdateMotivoDto } from './dto/update-motivo.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Motivo } from '@prisma/client';
import { AppService } from 'src/app.service';
import {
  MotivoPaginadoResponseDTO,
  MotivoResponseDTO,
} from './dto/motivo-response.dto';

@Injectable()
export class MotivosService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  async criar(createMotivoDto: CreateMotivoDto): Promise<MotivoResponseDTO> {
    const motivoExistente = await this.prisma.motivo.findUnique({
      where: { texto: createMotivoDto.texto },
    });
    if (motivoExistente)
      throw new ForbiddenException('Motivo já cadastrado.');

    const motivo: Motivo = await this.prisma.motivo.create({
      data: {
        ...createMotivoDto,
        status: createMotivoDto.status ?? true,
      },
    });

    if (!motivo)
      throw new InternalServerErrorException(
        'Não foi possível criar o motivo, tente novamente.',
      );
    return motivo;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
  ): Promise<MotivoPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const searchParams = {
      ...(busca && {
        texto: { contains: busca },
      }),
      ...(status &&
        status !== '' && {
          status:
            status === 'ATIVO' ? true : status === 'INATIVO' ? false : undefined,
        }),
    };
    const total: number = await this.prisma.motivo.count({
      where: searchParams,
    });
    if (total == 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const motivos: Motivo[] = await this.prisma.motivo.findMany({
      where: searchParams,
      orderBy: { texto: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: motivos,
    };
  }

  async buscarPorId(id: string): Promise<MotivoResponseDTO> {
    const motivo: Motivo = await this.prisma.motivo.findUnique({
      where: { id },
    });
    if (!motivo) throw new NotFoundException('Motivo não encontrado.');
    return motivo;
  }

  async listaCompleta(): Promise<MotivoResponseDTO[]> {
    const lista: Motivo[] = await this.prisma.motivo.findMany({
      where: { status: true },
      orderBy: { texto: 'asc' },
    });
    return lista;
  }

  async atualizar(
    id: string,
    updateMotivoDto: UpdateMotivoDto,
  ): Promise<MotivoResponseDTO> {
    if (updateMotivoDto.texto) {
      const motivo = await this.prisma.motivo.findUnique({
        where: { texto: updateMotivoDto.texto },
      });
      if (motivo && motivo.id !== id)
        throw new ForbiddenException('Motivo já cadastrado.');
    }

    const motivoAtualizado: Motivo = await this.prisma.motivo.update({
      data: updateMotivoDto,
      where: { id },
    });
    return motivoAtualizado;
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.motivo.update({
      data: { status: false },
      where: { id },
    });
    return { desativado: true };
  }
}
