import { Module } from '@nestjs/common';
import { TiposAgendamentoService } from './tipos-agendamento.service';
import { TiposAgendamentoController } from './tipos-agendamento.controller';

@Module({
  controllers: [TiposAgendamentoController],
  providers: [TiposAgendamentoService],
  exports: [TiposAgendamentoService],
})
export class TiposAgendamentoModule {}
