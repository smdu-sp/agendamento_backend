import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { CadastroMunicipeDto } from './dto/cadastro-municipe.dto';
import { LoginMunicipeDto } from './dto/login-municipe.dto';
import { SolicitarRedefinicaoSenhaDto } from './dto/solicitar-redefinicao-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class MunicipesAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private async gerarTokenAcesso(conta: {
    id: string;
    email: string;
    nome: string;
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: conta.id,
        email: conta.email,
        nome: conta.nome,
        escopo: 'MUNICIPE',
      },
      {
        expiresIn: '7d',
        secret: process.env.JWT_SECRET,
      },
    );
  }

  async cadastrar(dto: CadastroMunicipeDto): Promise<{ access_token: string }> {
    const email = dto.email.trim().toLowerCase();
    const nome = dto.nome.trim();
    if (!nome) throw new BadRequestException('Nome é obrigatório.');

    const existente = await this.prisma.municipeConta.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existente) {
      throw new ForbiddenException('Já existe conta para este e-mail.');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const conta = await this.prisma.municipeConta.create({
      data: {
        nome,
        email,
        senhaHash,
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
    });

    const access_token = await this.gerarTokenAcesso(conta);

    this.emailService
      .enviarConfirmacaoCadastro(conta.nome, conta.email)
      .catch((error) =>
        console.error('[MUNICIPE] Falha ao enviar e-mail de cadastro:', error),
      );

    return { access_token };
  }

  async login(dto: LoginMunicipeDto): Promise<{ access_token: string }> {
    const email = dto.email.trim().toLowerCase();
    const conta = await this.prisma.municipeConta.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        senhaHash: true,
        status: true,
      },
    });

    if (!conta) throw new UnauthorizedException('Credenciais inválidas.');
    if (!conta.status)
      throw new UnauthorizedException('Conta desativada. Contate o suporte.');

    const senhaOk = await bcrypt.compare(dto.senha, conta.senhaHash);
    if (!senhaOk) throw new UnauthorizedException('Credenciais inválidas.');

    await this.prisma.municipeConta.update({
      where: { id: conta.id },
      data: { ultimoLogin: new Date() },
    });

    const access_token = await this.gerarTokenAcesso(conta);
    return { access_token };
  }

  async solicitarRedefinicaoSenha(
    dto: SolicitarRedefinicaoSenhaDto,
  ): Promise<{ mensagem: string; linkRedefinicao?: string }> {
    const email = dto.email.trim().toLowerCase();
    const conta = await this.prisma.municipeConta.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true },
    });

    // Resposta única para evitar enumeração de e-mails.
    const mensagem =
      'Se existir uma conta para este e-mail, enviaremos as instruções de redefinição.';

    if (!conta) return { mensagem };

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

    await this.prisma.municipeTokenRedefinicaoSenha.create({
      data: {
        contaId: conta.id,
        tokenHash,
        expiraEm,
      },
    });

    const frontendBase = (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      ''
    ).replace(
      /\/$/,
      '',
    );
    const linkRedefinicao = frontendBase
      ? `${frontendBase}/agendamento/portal/redefinir-senha?token=${token}`
      : undefined;

    if (linkRedefinicao) {
      console.log('[MUNICIPE] Link redefinição de senha:', linkRedefinicao);
    }

    this.emailService
      .enviarRedefinicaoSenha(conta.nome, conta.email, token)
      .catch((error) =>
        console.error(
          '[MUNICIPE] Falha ao enviar e-mail de redefinição de senha:',
          error,
        ),
      );

    if (process.env.ENVIRONMENT === 'local') {
      return { mensagem, linkRedefinicao };
    }

    return { mensagem };
  }

  async redefinirSenha(dto: RedefinirSenhaDto): Promise<{ mensagem: string }> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const agora = new Date();

    const registro = await this.prisma.municipeTokenRedefinicaoSenha.findFirst({
      where: {
        tokenHash,
        utilizadoEm: null,
        expiraEm: { gt: agora },
      },
      select: {
        id: true,
        contaId: true,
      },
    });

    if (!registro) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const novaSenhaHash = await bcrypt.hash(dto.novaSenha, 10);

    await this.prisma.$transaction([
      this.prisma.municipeConta.update({
        where: { id: registro.contaId },
        data: { senhaHash: novaSenhaHash },
      }),
      this.prisma.municipeTokenRedefinicaoSenha.update({
        where: { id: registro.id },
        data: { utilizadoEm: new Date() },
      }),
      this.prisma.municipeTokenRedefinicaoSenha.updateMany({
        where: {
          contaId: registro.contaId,
          utilizadoEm: null,
        },
        data: {
          utilizadoEm: new Date(),
        },
      }),
    ]);

    return { mensagem: 'Senha redefinida com sucesso.' };
  }
}
