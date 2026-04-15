import { Injectable } from '@nestjs/common';
import { transporter } from 'src/lib/nodemailer';

@Injectable()
export class EmailService {
  private getRemetente(): string {
    return (
      process.env.MAIL_FROM ||
      process.env.MAIL_USER ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      'noreply@prefeitura.sp.gov.br'
    );
  }

  private getFrontendBase(): string {
    return (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  async enviarConfirmacaoCadastro(nome: string, email: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2>Cadastro confirmado</h2>
        <p>Olá, ${nome}.</p>
        <p>Seu cadastro no Portal de Agendamentos foi realizado com sucesso.</p>
        <p>Agora você pode acessar sua conta com o e-mail informado.</p>
      </div>
    `;

    await transporter.sendMail({
      from: this.getRemetente(),
      to: email,
      subject: 'Cadastro confirmado - Portal de Agendamentos',
      html,
      text: `Olá, ${nome}. Seu cadastro no Portal de Agendamentos foi realizado com sucesso.`,
    });
  }

  async enviarRedefinicaoSenha(
    nome: string,
    email: string,
    token: string,
  ): Promise<void> {
    const link = `${this.getFrontendBase()}/agendamento/portal/redefinir-senha?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2>Redefinição de senha</h2>
        <p>Olá, ${nome}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Use o link abaixo para criar uma nova senha:</p>
        <p><a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a></p>
        <p>Este link expira em 30 minutos.</p>
        <p>Se você não fez esta solicitação, ignore este e-mail.</p>
      </div>
    `;

    await transporter.sendMail({
      from: this.getRemetente(),
      to: email,
      subject: 'Redefinição de senha - Portal de Agendamentos',
      html,
      text: `Olá, ${nome}. Redefina sua senha pelo link: ${link}. Este link expira em 30 minutos.`,
    });
  }
}
