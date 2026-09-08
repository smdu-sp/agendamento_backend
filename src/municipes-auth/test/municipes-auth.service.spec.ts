import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MunicipesAuthService } from '../municipes-auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/email/email.service';

describe('MunicipesAuthService', () => {
  let service: MunicipesAuthService;
  let prisma: { municipeConta: { findUnique: jest.Mock; create: jest.Mock } };
  let emailService: { enviarTentativaCadastroDuplicado: jest.Mock; enviarConfirmacaoCadastro: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MunicipesAuthService,
        {
          provide: PrismaService,
          useValue: {
            municipeConta: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('token-fake'),
          },
        },
        {
          provide: EmailService,
          useValue: {
            enviarTentativaCadastroDuplicado: jest.fn().mockResolvedValue(true),
            enviarConfirmacaoCadastro: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(MunicipesAuthService);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
  });

  describe('cadastrar', () => {
    it('não lança erro e não cria conta quando o e-mail já existe', async () => {
      prisma.municipeConta.findUnique.mockResolvedValue({
        id: 'conta-existente',
        nome: 'Maria Existente',
        email: 'maria@example.com',
      });

      const resultado = await service.cadastrar({
        nome: 'Outro Nome',
        email: 'maria@example.com',
        senha: 'senha123',
        turnstileToken: 'token',
      });

      expect(resultado).toEqual({ access_token: null, emailEnviado: true });
      expect(prisma.municipeConta.create).not.toHaveBeenCalled();
      expect(emailService.enviarTentativaCadastroDuplicado).toHaveBeenCalledWith(
        'Maria Existente',
        'maria@example.com',
      );
    });

    it('cria a conta e retorna um access_token quando o e-mail é novo', async () => {
      prisma.municipeConta.findUnique.mockResolvedValue(null);
      prisma.municipeConta.create.mockResolvedValue({
        id: 'nova-conta',
        nome: 'Novo Usuário',
        email: 'novo@example.com',
      });

      const resultado = await service.cadastrar({
        nome: 'Novo Usuário',
        email: 'novo@example.com',
        senha: 'senha123',
        turnstileToken: 'token',
      });

      expect(resultado.access_token).toBe('token-fake');
      expect(prisma.municipeConta.create).toHaveBeenCalled();
      expect(emailService.enviarTentativaCadastroDuplicado).not.toHaveBeenCalled();
    });
  });
});
