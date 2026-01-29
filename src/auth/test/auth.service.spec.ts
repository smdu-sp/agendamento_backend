import { Usuario } from '@prisma/client';
import { UsuarioPayload } from 'src/auth/models/UsuarioPayload';
import { UsuarioToken } from 'src/auth/models/UsuarioToken';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from 'src/auth/auth.service';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppService } from 'src/app.service';

describe('AuthService Tests', () => {
  let service: AuthService;
  let usuariosService: UsuariosService;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let app: AppService;

  const mockUsuario: Usuario = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    nome: 'Teste Usuário',
    nomeSocial: 'luluzinha',
    login: 'teste.usuario',
    email: 'teste@example.com',
    permissao: 'PORTARIA',
    status: true,
    avatar: 'http://avatar.com/teste',
    ultimoLogin: new Date('2023-11-14'),
    criadoEm: new Date('2023-11-13'),
    atualizadoEm: new Date('2023-11-14'),
  };

  const mockUsuarioUpdateLogin: Usuario = {
    ...mockUsuario,
    ultimoLogin: new Date(),
  };

  const mockUsuarioJwt = {
    ...mockUsuario,
    permissao: mockUsuario.permissao,
  };

  const mockTokens: UsuarioToken = {
    access_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NTQ3MjQ4MDAsInBlcm1pc3NvIjoiVVNSIn0.4tC299X2vFQ2uodzNVv9RJm0u8Y4XkX9X5J9w7zD6E4',
    refresh_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhY2ViZDgxMi0wOTg3LTQ1NmYtYTQwZS02MjVmODk0NzY1NDIiLCJlbWFpbCI6InVzdWFyaW9AdGVzdGUuY29tIiwiZXhwIjoxNzA2NDgwMDAwLCJyb2xlcyI6WyJVU1VBUklPIiwiQURNSU4iXX0.1Qa-3x4L5D6vV8w9x0y1z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            usuario: {
              findUnique: jest.fn(),
              update: jest.fn().mockResolvedValue(mockUsuario),
            },
          },
        },
        {
          provide: AppService,
          useValue: {
            verificaPagina: jest
              .fn()
              .mockImplementation((pagina, limite) => [pagina, limite]),
            verificaLimite: jest
              .fn()
              .mockImplementation((pagina, limite, total) => [pagina, limite]),
          },
        },
        {
          provide: UsuariosService,
          useValue: {
            buscarPorLogin: jest.fn().mockResolvedValue(mockUsuario),
            atualizarUltimoLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest
              .fn()
              .mockResolvedValueOnce(
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NTQ3MjQ4MDAsInBlcm1pc3NvIjoiVVNSIn0.4tC299X2vFQ2uodzNVv9RJm0u8Y4XkX9X5J9w7zD6E4',
              )
              .mockResolvedValueOnce(
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhY2ViZDgxMi0wOTg3LTQ1NmYtYTQwZS02MjVmODk0NzY1NDIiLCJlbWFpbCI6InVzdWFyaW9AdGVzdGUuY29tIiwiZXhwIjoxNzA2NDgwMDAwLCJyb2xlcyI6WyJVU1VBUklPIiwiQURNSU4iXX0.1Qa-3x4L5D6vV8w9x0y1z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S',
              ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usuariosService = module.get<UsuariosService>(UsuariosService);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);
    app = module.get<AppService>(AppService);
  });

  it('os serviços deverão ser definidos', () => {
    expect(service).toBeDefined();
    expect(usuariosService).toBeDefined();
    expect(jwtService).toBeDefined();
    expect(prisma).toBeDefined();
    expect(app).toBeDefined();
  });

  it('deverá retornar tokens e atualizar último login', async () => {
    jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);
    (prisma.usuario.update as jest.Mock).mockResolvedValue(mockUsuario);
    (usuariosService.atualizarUltimoLogin as jest.Mock).mockResolvedValue(
      mockUsuarioUpdateLogin,
    );

    const result = await service.login(mockUsuario);

    expect(result).toEqual(mockTokens);
    expect(service.getTokens).toHaveBeenCalledWith(mockUsuario);
  });

  it('deverá retornar novos tokens', async () => {
    jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);

    const result = await service.refresh(mockUsuario);

    expect(result).toEqual(mockTokens);
    expect(service.getTokens).toHaveBeenCalledWith(mockUsuario);
  });

  it('deverá gerar tokens com payload correto', async () => {
    process.env.JWT_SECRET = 'test_secret';
    process.env.RT_SECRET = 'test_rt_secret';

    const signAsyncSpy = jest
      .spyOn(jwtService, 'signAsync')
      .mockResolvedValueOnce(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2NTQ3MjQ4MDAsInBlcm1pc3NvIjoiVVNSIn0.4tC299X2vFQ2uodzNVv9RJm0u8Y4XkX9X5J9w7zD6E4',
      )
      .mockResolvedValueOnce(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhY2ViZDgxMi0wOTg3LTQ1NmYtYTQwZS02MjVmODk0NzY1NDIiLCJlbWFpbCI6InVzdWFyaW9AdGVzdGUuY29tIiwiZXhwIjoxNzA2NDgwMDAwLCJyb2xlcyI6WyJVU1VBUklPIiwiQURNSU4iXX0.1Qa-3x4L5D6vV8w9x0y1z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S',
      );

    const result = await service.getTokens(mockUsuarioJwt);

    expect(result).toEqual(mockTokens);
    expect(signAsyncSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: mockUsuario.id,
        login: mockUsuario.login,
      }),
      {
        expiresIn: '15m',
        secret: 'test_secret',
      },
    );
    expect(signAsyncSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: mockUsuario.id,
      }),
      {
        expiresIn: '7d',
        secret: 'test_rt_secret',
      },
    );
  });

  it('deverá validar usuário local em ambiente de desenvolvimento', async () => {
    process.env.ENVIRONMENT = 'local';
    (usuariosService.buscarPorLogin as jest.Mock).mockResolvedValue(
      mockUsuario,
    );

    const result = await service.validateUser(
      mockUsuario.login,
      'any_password',
    );

    expect(result).toEqual(mockUsuario);
    expect(usuariosService.buscarPorLogin).toHaveBeenCalledWith(
      mockUsuario.login,
    );

    delete process.env.ENVIRONMENT;
  });

  it('deverá rejeitar usuário não encontrado', async () => {
    (usuariosService.buscarPorLogin as jest.Mock).mockResolvedValue(null);

    await expect(
      service.validateUser('invalid_login', 'any_password'),
    ).rejects.toThrow('Credenciais incorretas.');
  });
});
