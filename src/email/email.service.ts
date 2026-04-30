import { Injectable, Logger } from '@nestjs/common';
import { transporter } from 'src/lib/nodemailer';
import { buildEmailHtml } from './email-templates';

const MAX_TENTATIVAS = 5;

type MailOptions = Parameters<typeof transporter.sendMail>[0];

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private getFrontendBase(): string {
    const url = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
    if (!url) {
      this.logger.warn(
        'FRONTEND_URL não configurado — links dos e-mails apontarão para localhost. ' +
          'Defina FRONTEND_URL no .env de produção.',
      );
      return 'http://localhost:3001';
    }
    return url.replace(/\/$/, '');
  }

  private getRemetente(): string {
    return process.env.MAIL_FROM || 'noreply@prefeitura.sp.gov.br';
  }

  private getBccEnv(): string | undefined {
    return process.env.MAIL_BCC?.trim() || undefined;
  }

  private formatarDataHora(d: Date): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      partes.find((p) => p.type === type)?.value ?? '';

    return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}h${get('minute')}`;
  }

  private async enviarComRetry(
    options: MailOptions,
    contexto?: string,
  ): Promise<boolean> {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        await transporter.sendMail(options);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (tentativa === MAX_TENTATIVAS) {
          this.logger.error(
            `[Email${contexto ? ` | ${contexto}` : ''}] Falha após ${MAX_TENTATIVAS} tentativas: ${msg}`,
          );
          return false;
        }
        const aguardar = 1000 * 2 ** (tentativa - 1);
        this.logger.warn(
          `[Email${contexto ? ` | ${contexto}` : ''}] Tentativa ${tentativa}/${MAX_TENTATIVAS} falhou: ${msg}. Aguardando ${aguardar / 1000}s...`,
        );
        await new Promise((r) => setTimeout(r, aguardar));
      }
    }
    return false;
  }

  async enviarConfirmacaoCadastro(
    nome: string,
    email: string,
    enviarBcc = true,
  ): Promise<boolean> {
    const base = this.getFrontendBase();
    const linkPreProjeto = `${base}/agendamento/pre-projetos`;

    const html = buildEmailHtml({
      evento: 'cadastro',
      titulo: 'Cadastro realizado com sucesso!',
      saudacao: `Olá, ${nome}.`,
      paragrafos: [
        'Seu cadastro no Portal de Agendamentos foi realizado com sucesso.',
        'Agora você pode acessar sua conta e submeter solicitações de pré-projeto para análise da Sala Arthur Saboya.',
      ],
      botao: { texto: 'Enviar solicitação de pré-projeto', url: linkPreProjeto },
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: email,
        subject: 'Cadastro confirmado — Portal de Agendamentos',
        html,
        text: `Olá, ${nome}. Seu cadastro foi realizado com sucesso. Acesse: ${linkPreProjeto}`,
        bcc: enviarBcc ? this.getBccEnv() : undefined,
      },
      `cadastro:${email}`,
    );
  }

  async enviarRedefinicaoSenha(
    nome: string,
    email: string,
    token: string,
    enviarBcc = false,
  ): Promise<boolean> {
    const base = this.getFrontendBase();
    const link = `${base}/agendamento/portal/redefinir-senha?token=${token}`;

    const html = buildEmailHtml({
      evento: 'redefinicao-senha',
      titulo: 'Redefinição de senha',
      saudacao: `Olá, ${nome}.`,
      paragrafos: [
        'Recebemos uma solicitação para redefinir a senha da sua conta.',
        'Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>30 minutos</strong>.',
        'Se você não fez esta solicitação, ignore este e-mail — sua senha permanece inalterada.',
      ],
      botao: { texto: 'Redefinir minha senha', url: link },
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: email,
        subject: 'Redefinição de senha — Portal de Agendamentos',
        html,
        text: `Olá, ${nome}. Redefina sua senha: ${link} (expira em 30 minutos).`,
        bcc: enviarBcc ? this.getBccEnv() : undefined,
      },
      `redefinicao-senha:${email}`,
    );
  }

  async enviarNovoChamadoPreProjeto(params: {
    nome: string;
    email: string;
    protocolo: string;
    solicitacaoId: string;
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const base = this.getFrontendBase();
    const linkConsulta = `${base}/agendamento/portal/consulta`;

    const html = buildEmailHtml({
      evento: 'novo-chamado',
      titulo: 'Sua solicitação foi recebida',
      saudacao: `Olá, ${params.nome}.`,
      paragrafos: [
        `Recebemos sua solicitação de pré-projeto com o protocolo <strong>${params.protocolo}</strong>.`,
        'Nossa equipe irá analisar o chamado e entrará em contato em breve.',
        'Você pode acompanhar o andamento pelo portal a qualquer momento.',
      ],
      botao: { texto: 'Acompanhar minha solicitação', url: linkConsulta },
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: params.email,
        subject: `Solicitação recebida — ${params.protocolo}`,
        html,
        text: `Olá, ${params.nome}. Sua solicitação ${params.protocolo} foi recebida. Acompanhe em: ${linkConsulta}`,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `novo-chamado:${params.protocolo}`,
    );
  }

  async enviarNovaMensagemNaSolicitacao(params: {
    nome: string;
    email: string;
    protocolo: string;
    solicitacaoId: string;
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const base = this.getFrontendBase();
    const linkConsulta = `${base}/agendamento/portal/consulta/${params.solicitacaoId}`;

    const html = buildEmailHtml({
      evento: 'nova-mensagem',
      titulo: 'Nova mensagem em sua solicitação',
      saudacao: `Olá, ${params.nome}.`,
      paragrafos: [
        `Há uma nova mensagem na sua solicitação <strong>${params.protocolo}</strong>.`,
        'Acesse o portal para visualizar e responder.',
      ],
      botao: { texto: 'Ver mensagem', url: linkConsulta },
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: params.email,
        subject: `Nova mensagem — ${params.protocolo}`,
        html,
        text: `Olá, ${params.nome}. Há uma nova mensagem na solicitação ${params.protocolo}. Acesse: ${linkConsulta}`,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `nova-mensagem:${params.protocolo}`,
    );
  }

  async enviarAgendamentoConfirmadoMunicipe(params: {
    nome: string;
    email: string;
    protocolo: string;
    solicitacaoId: string;
    dataAgendamento: Date;
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const base = this.getFrontendBase();
    const linkConsulta = `${base}/agendamento/portal/consulta/${params.solicitacaoId}`;
    const dataFormatada = this.formatarDataHora(params.dataAgendamento);

    const html = buildEmailHtml({
      evento: 'agendamento-confirmado',
      titulo: 'Atendimento agendado',
      saudacao: `Olá, ${params.nome}.`,
      paragrafos: [
        `Seu atendimento referente ao protocolo <strong>${params.protocolo}</strong> foi agendado.`,
      ],
      lista: [
        { label: 'Protocolo', valor: params.protocolo },
        { label: 'Data e hora', valor: dataFormatada },
      ],
      botao: { texto: 'Ver detalhes', url: linkConsulta },
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: params.email,
        subject: `Atendimento agendado — ${params.protocolo}`,
        html,
        text: `Olá, ${params.nome}. Atendimento ${params.protocolo} agendado para ${dataFormatada}. Detalhes: ${linkConsulta}`,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `agendamento:${params.protocolo}`,
    );
  }

  async enviarAtribuicaoTecnicoArthurSaboya(params: {
    nomeTecnico: string;
    emailTecnico: string;
    protocolo: string;
    nomeMunicipe: string;
    dataAgendamento: Date;
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const dataFormatada = this.formatarDataHora(params.dataAgendamento);

    const html = buildEmailHtml({
      evento: 'tecnico-atribuido',
      titulo: 'Novo atendimento atribuído a você',
      saudacao: `Olá, ${params.nomeTecnico}.`,
      paragrafos: ['Você foi designado como técnico responsável pelo seguinte atendimento:'],
      lista: [
        { label: 'Protocolo', valor: params.protocolo },
        { label: 'Munícipe', valor: params.nomeMunicipe },
        { label: 'Data e hora', valor: dataFormatada },
      ],
    });

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: params.emailTecnico,
        subject: `Atendimento atribuído — ${params.protocolo}`,
        html,
        text: `Olá, ${params.nomeTecnico}. Você foi designado técnico do atendimento ${params.protocolo} (${params.nomeMunicipe}) em ${dataFormatada}.`,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `tecnico-atribuido:${params.protocolo}`,
    );
  }

  async enviarNotificacaoCancelamentoAtendimentoArthurSaboya(params: {
    protocolo: string;
    nomeMunicipe: string;
    emailMunicipe: string;
    dataAgendamento?: Date | null;
    destinatarios: string[];
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const destinatariosUnicos = Array.from(
      new Set(
        params.destinatarios
          .map((v) => String(v || '').trim().toLowerCase())
          .filter((v) => !!v),
      ),
    );
    if (destinatariosUnicos.length === 0) return false;

    const dataHora = params.dataAgendamento
      ? this.formatarDataHora(params.dataAgendamento)
      : 'não informada';

    const html = buildEmailHtml({
      evento: 'cancelamento',
      titulo: 'Cancelamento de atendimento',
      saudacao: 'O munícipe solicitou o cancelamento do atendimento agendado.',
      paragrafos: [],
      lista: [
        { label: 'Protocolo', valor: params.protocolo },
        { label: 'Munícipe', valor: params.nomeMunicipe },
        { label: 'E-mail do munícipe', valor: params.emailMunicipe },
        { label: 'Data/hora agendada', valor: dataHora },
      ],
    });

    const text =
      `Cancelamento de atendimento (Arthur Saboya)\n\n` +
      `Protocolo: ${params.protocolo}\n` +
      `Munícipe: ${params.nomeMunicipe}\n` +
      `E-mail: ${params.emailMunicipe}\n` +
      `Data/hora agendada: ${dataHora}`;

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: destinatariosUnicos.join(','),
        subject: `[Arthur Saboya] Cancelamento de atendimento — ${params.protocolo}`,
        html,
        text,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `cancelamento:${params.protocolo}`,
    );
  }

  async enviarEncerramentoChamadoPreProjeto(params: {
    nome: string;
    email: string;
    protocolo: string;
    solicitacaoId: string;
    encerradoPor: 'MUNICIPE' | 'EQUIPE_ARTHUR';
    enviarBcc?: boolean;
  }): Promise<boolean> {
    const base = this.getFrontendBase();
    const linkConsulta = `${base}/agendamento/portal/consulta/${params.solicitacaoId}`;
    const encerramentoPorMunicipe = params.encerradoPor === 'MUNICIPE';

    const html = buildEmailHtml({
      evento: 'chamado-encerrado',
      titulo: 'Chamado encerrado',
      saudacao: `Olá, ${params.nome}.`,
      paragrafos: encerramentoPorMunicipe
        ? [
            `Seu chamado <strong>${params.protocolo}</strong> foi encerrado conforme sua confirmação de resolução.`,
            'Caso precise de novo atendimento, você pode abrir uma nova solicitação no portal.',
          ]
        : [
            `Seu chamado <strong>${params.protocolo}</strong> foi encerrado pela equipe da Sala Arthur Saboya.`,
            'Se necessário, você pode abrir uma nova solicitação no portal.',
          ],
      botao: { texto: 'Ver histórico do chamado', url: linkConsulta },
    });

    const textoEncerramento = encerramentoPorMunicipe
      ? 'encerrado por você'
      : 'encerrado pela equipe da Sala Arthur Saboya';

    return this.enviarComRetry(
      {
        from: this.getRemetente(),
        to: params.email,
        subject: `Chamado encerrado — ${params.protocolo}`,
        html,
        text:
          `Olá, ${params.nome}. Seu chamado ${params.protocolo} foi ${textoEncerramento}. ` +
          `Histórico: ${linkConsulta}`,
        bcc: (params.enviarBcc ?? true) ? this.getBccEnv() : undefined,
      },
      `chamado-encerrado:${params.protocolo}:${params.encerradoPor}`,
    );
  }
}
