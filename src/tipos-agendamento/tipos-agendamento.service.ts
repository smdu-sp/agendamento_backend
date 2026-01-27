import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTipoAgendamentoDto } from './dto/create-tipo-agendamento.dto';
import { UpdateTipoAgendamentoDto } from './dto/update-tipo-agendamento.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TipoAgendamento } from '@prisma/client';
import { AppService } from 'src/app.service';
import {
  TipoAgendamentoPaginadoResponseDTO,
  TipoAgendamentoResponseDTO,
} from './dto/tipo-agendamento-response.dto';

@Injectable()
export class TiposAgendamentoService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  async criar(createDto: CreateTipoAgendamentoDto): Promise<TipoAgendamentoResponseDTO> {
    const existente = await this.prisma.tipoAgendamento.findUnique({
      where: { texto: createDto.texto },
    });
    if (existente) throw new ForbiddenException('Tipo de agendamento já cadastrado.');

    const item = await this.prisma.tipoAgendamento.create({
      data: { ...createDto, status: createDto.status ?? true },
    });
    if (!item) throw new InternalServerErrorException('Não foi possível criar o tipo de agendamento.');
    return item;
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: string,
  ): Promise<TipoAgendamentoPaginadoResponseDTO> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);
    const where = {
      ...(busca && { texto: { contains: busca } }),
      ...(status && status !== '' && {
        status: status === 'ATIVO' ? true : status === 'INATIVO' ? false : undefined,
      }),
    };
    const total = await this.prisma.tipoAgendamento.count({ where });
    if (total === 0) return { total: 0, pagina: 0, limite: 0, data: [] };
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);
    const data = await this.prisma.tipoAgendamento.findMany({
      where,
      orderBy: { texto: 'asc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return { total: +total, pagina: +pagina, limite: +limite, data };
  }

  async buscarPorId(id: string): Promise<TipoAgendamentoResponseDTO> {
    const item = await this.prisma.tipoAgendamento.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Tipo de agendamento não encontrado.');
    return item;
  }

  async listaCompleta(): Promise<TipoAgendamentoResponseDTO[]> {
    return this.prisma.tipoAgendamento.findMany({
      where: { status: true },
      orderBy: { texto: 'asc' },
    });
  }

  async atualizar(id: string, updateDto: UpdateTipoAgendamentoDto): Promise<TipoAgendamentoResponseDTO> {
    if (updateDto.texto) {
      const existente = await this.prisma.tipoAgendamento.findUnique({
        where: { texto: updateDto.texto },
      });
      if (existente && existente.id !== id) throw new ForbiddenException('Tipo de agendamento já cadastrado.');
    }
    return this.prisma.tipoAgendamento.update({ data: updateDto, where: { id } });
  }

  async excluir(id: string): Promise<{ desativado: boolean }> {
    await this.prisma.tipoAgendamento.update({ data: { status: false }, where: { id } });
    return { desativado: true };
  }
}
