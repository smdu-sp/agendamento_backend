import { CreateUsuarioDto } from '../dto/create-usuario.dto';
import { UpdateUsuarioDto } from '../dto/update-usuario.dto';
import { UsuarioResponseDTO } from '../dto/usuario-response.dto';
import { AppService } from 'src/app.service';
import { SguService } from 'src/prisma/sgu.service';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, Usuario } from '@prisma/client';
import { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Client as LdapClient } from 'ldapts';

describe('Usuarios.service testes unitários', () => {
  let service: UsuariosService;
  let prisma: PrismaService;
  let sgu: SguService;
  let app: AppService;

  const MockPrismaService = {
    usuario: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const MockAppService = {
    verificaPagina: jest
      .fn()
      .mockImplementation((pagina, limite) => [pagina, limite]),
    verificaLimite: jest
      .fn()
      .mockImplementation((pagina, limite, total) => [pagina, limite]),
  };

  const mockLdapService = {
    bind: jest.fn(),
    search: jest.fn(),
    unbind: jest.fn(),
  };

  const mockLdapBind = jest.fn();
  const mockLdapSearch = jest.fn();
  const mockLdapUnbind = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    mockLdapBind.mockReset();
    mockLdapSearch.mockReset();
    mockLdapUnbind.mockReset();

    jest.spyOn(LdapClient.prototype, 'bind').mockImplementation(mockLdapBind);
    jest
      .spyOn(LdapClient.prototype, 'search')
      .mockImplementation(mockLdapSearch);
    jest
      .spyOn(LdapClient.prototype, 'unbind')
      .mockImplementation(mockLdapUnbind);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: MockPrismaService,
        },
        {
          provide: SguService,
          useValue: MockPrismaService,
        },
        {
          provide: AppService,
          useValue: MockAppService,
        },
      ],
    }).compile();
    service = module.get<UsuariosService>(UsuariosService);
    prisma = module.get<PrismaService>(PrismaService);
    sgu = module.get<SguService>(SguService);
    app = module.get<AppService>(AppService);
  });

  it('os serviços deverão estar definidos', () => {
    expect(service).toBeDefined();
    expect(prisma).toBeDefined();
    expect(app).toBeDefined();
    expect(sgu).toBeDefined();
  });

  //listagem de usuarios
  it('deverá listar todos os usuários do banco de dados', async () => {
    const mockUsuarios = [
      {
        id: '1',
        nome: 'João Silva',
        nomeSocial: 'lukuzinha',
        login: 'joao.silva',
        email: 'joao.silva@example.com',
        status: true,
        avatar: 'avatar1.png',
        permissao: $Enums.Permissao.DEV,
        ultimoLogin: new Date('2025-03-24T10:00:00Z'),
        criadoEm: new Date('2025-01-01T10:00:00Z'),
        atualizadoEm: new Date('2025-03-24T10:00:00Z'),
      },
      {
        id: '2',
        nome: 'Maria Souza',
        nomeSocial: 'lukuzinha',
        login: 'maria.souza',
        email: 'maria.souza@example.com',
        status: true,
        avatar: 'avatar2.png',
        permissao: $Enums.Permissao.ADM,
        ultimoLogin: new Date('2025-03-24T11:00:00Z'),
        criadoEm: new Date('2025-02-01T11:00:00Z'),
        atualizadoEm: new Date('2025-03-24T11:00:00Z'),
      },
      {
        id: '3',
        nome: 'Carlos Pereira',
        nomeSocial: 'lukuzinha',
        login: 'carlos.pereira',
        email: 'carlos.pereira@example.com',
        status: false,
        avatar: 'avatar3.png',
        permissao: $Enums.Permissao.ADM,
        ultimoLogin: new Date('2025-03-24T12:00:00Z'),
        criadoEm: new Date('2025-03-01T12:00:00Z'),
        atualizadoEm: new Date('2025-03-24T12:00:00Z'),
      },
    ];

    (prisma.usuario.findMany as jest.Mock).mockResolvedValue(mockUsuarios);
    const result = await service.listaCompleta();

    expect(result).not.toBe(null);
    expect(result).toEqual(mockUsuarios);
  });

  //criação de usuários
  it('deverá verificar se um usuário pode ser criado', async () => {
    const mockCreateUser: CreateUsuarioDto = {
      nome: 'Carlos Pereira',
      nomeSocial: 'Carlão',
      login: 'carlos.pereira',
      email: 'carlos.pereira@example.com',
      status: false,
      avatar: 'avatar3.png',
      permissao: $Enums.Permissao.DEV,
    };

    const mockResponseUser: UsuarioResponseDTO = {
      id: '3',
      nome: 'Carlos Pereira',
      nomeSocial: 'Carlão',
      login: 'carlos.pereira',
      email: 'carlos.pereira@example.com',
      status: false,
      avatar: 'avatar3.png',
      permissao: $Enums.Permissao.DEV,
      ultimoLogin: new Date('2025-03-24T12:00:00Z'),
      criadoEm: new Date('2025-03-01T12:00:00Z'),
      atualizadoEm: new Date('2025-03-24T12:00:00Z'),
    };

    const mockUserLogado: Usuario = {
      id: '3',
      nome: 'Carlos Pereira',
      nomeSocial: 'lukuzinha',
      login: 'carlos.pereira',
      email: 'carlos.pereira@example.com',
      permissao: $Enums.Permissao.ADM,
      status: true,
      avatar: 'avatar3.png',
      ultimoLogin: new Date('2025-03-24T12:00:00Z'),
      criadoEm: new Date('2025-03-01T12:00:00Z'),
      atualizadoEm: new Date('2025-03-24T12:00:00Z'),
    };

    jest.spyOn(service, 'buscarPorEmail').mockResolvedValue(null);
    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(null);
    jest
      .spyOn(service, 'validaPermissaoCriador')
      .mockReturnValue($Enums.Permissao.DEV);

    (prisma.usuario.create as jest.Mock).mockResolvedValue(mockResponseUser);

    const result = await service.criar(mockCreateUser, mockUserLogado);

    expect(result).not.toBeNull();
    expect(result).toEqual(mockResponseUser);
    expect(service.buscarPorEmail).toHaveBeenCalledWith(mockCreateUser.email);
    expect(service.buscarPorLogin).toHaveBeenCalledWith(mockCreateUser.login);
    expect(prisma.usuario.create).toHaveBeenCalledWith({
      data: mockCreateUser,
    });
  });

  //buscar todos usuários
  it('deverá buscar todos os usuários', async () => {
    const mockUsuarios = [
      {
        id: '1',
        nome: 'João Silva',
        nomeSocial: 'lukuzinha',
        login: 'joao.silva',
        email: 'joao.silva@example.com',
        status: true,
        avatar: 'avatar1.png',
        permissao: $Enums.Permissao.DEV,
        ultimoLogin: new Date('2025-03-24T10:00:00Z'),
        criadoEm: new Date('2025-01-01T10:00:00Z'),
        atualizadoEm: new Date('2025-03-24T10:00:00Z'),
      },
      {
        id: '2',
        nome: 'Maria Souza',
        nomeSocial: 'lukuzinha',
        login: 'maria.souza',
        email: 'maria.souza@example.com',
        status: true,
        avatar: 'avatar2.png',
        permissao: $Enums.Permissao.ADM,
        ultimoLogin: new Date('2025-03-24T11:00:00Z'),
        criadoEm: new Date('2025-02-01T11:00:00Z'),
        atualizadoEm: new Date('2025-03-24T11:00:00Z'),
      },
      {
        id: '3',
        nome: 'Carlos Pereira',
        nomeSocial: 'lukuzinha',
        login: 'carlos.pereira',
        email: 'carlos.pereira@example.com',
        status: false,
        avatar: 'avatar3.png',
        permissao: $Enums.Permissao.ADM,
        ultimoLogin: new Date('2025-03-24T12:00:00Z'),
        criadoEm: new Date('2025-03-01T12:00:00Z'),
        atualizadoEm: new Date('2025-03-24T12:00:00Z'),
      },
    ];

    const mockPaginacao = {
      total: 3,
      pagina: 1,
      limite: 10,
      data: mockUsuarios,
    };

    const mockParams = {
      usuario: null,
      pagina: 1,
      limite: 10, // Alterado de string para número
      status: '1',
      busca: 'example',
    };

    (prisma.usuario.count as jest.Mock).mockResolvedValue(3);
    jest.spyOn(app, 'verificaPagina').mockReturnValue([1, 10]);
    (prisma.usuario.findMany as jest.Mock).mockResolvedValue(mockUsuarios);

    const result = await service.buscarTudo(
      mockParams.pagina,
      mockParams.limite,
      mockParams.busca,
      mockParams.status,
    );

    expect(result).not.toBeNull();
    expect(result).toEqual(mockPaginacao);

    expect(prisma.usuario.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { nome: { contains: expect.any(String) } },
          { nomeSocial: { contains: expect.any(String) } },
          { login: { contains: expect.any(String) } },
          { email: { contains: expect.any(String) } },
        ],
      },
    });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nome: { contains: mockParams.busca } },
          { nomeSocial: { contains: mockParams.busca } },
          { login: { contains: mockParams.busca } },
          { email: { contains: mockParams.busca } },
        ],
        status: undefined,
      },
      skip: (mockParams.pagina - 1) * mockParams.limite,
      take: mockParams.limite,
      orderBy: { nome: 'asc' },
    });
  });
  //buscar usuario por id
  it('deverá buscar um usuario pelo id', async () => {
    const mockResponseUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(
      mockResponseUser,
    );

    const result = await service.buscarPorId('123456');

    expect(result).not.toBe(null);
    expect(result).toEqual(mockResponseUser);
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        id: '123456',
      },
    });
  });

  //buscar usuario por email
  it('deverá buscar um usuario pelo email', async () => {
    const mockResponseUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(
      mockResponseUser,
    );

    const result = await service.buscarPorEmail('joao.silva@example.com');

    expect(result).not.toBe(null);
    expect(result).toEqual(mockResponseUser);
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'joao.silva@example.com',
      },
    });
  });

  //buscar usuario por login
  it('deverá buscar um usuario pelo login', async () => {
    const mockResponseUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(
      mockResponseUser,
    );

    const result = await service.buscarPorLogin('joao.silva');

    expect(result).not.toBe(null);
    expect(result).toEqual(mockResponseUser);
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        login: 'joao.silva',
      },
    });
  });

  //atualizar usuario
  it('deverá atualizar um usuario', async () => {
    const mockUserAtualizar: Usuario = {
      id: '3',
      nome: 'Carlos Pereira',
      nomeSocial: 'lukuzinha',
      login: 'carlos.pereira',
      email: 'carlos.pereira@example.com',
      permissao: $Enums.Permissao.ADM,
      status: true,
      avatar: 'avatar3.png',
      ultimoLogin: new Date('2025-03-24T12:00:00Z'),
      criadoEm: new Date('2025-03-01T12:00:00Z'),
      atualizadoEm: new Date('2025-03-24T12:00:00Z'),
    };

    const updateParams: UpdateUsuarioDto = {
      login: 'carlaoperereira',
      avatar: 'avatar5.png',
      permissao: mockUserAtualizar.permissao,
    };

    const mockUserAtualizado: Usuario = {
      id: '3',
      nome: 'Carlos Pereira',
      nomeSocial: 'lukuzinha',
      login: 'carlaopereira',
      email: 'carlos.pereira@example.com',
      permissao: $Enums.Permissao.ADM,
      status: true,
      avatar: 'avatar5.png',
      ultimoLogin: new Date('2025-03-24T12:00:00Z'),
      criadoEm: new Date('2025-03-01T12:00:00Z'),
      atualizadoEm: new Date('2025-03-24T12:00:00Z'),
    };

    jest.spyOn(service, 'buscarPorId').mockResolvedValue(mockUserAtualizar);
    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(null);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(
      mockUserAtualizar,
    );
    jest
      .spyOn(service, 'validaPermissaoCriador')
      .mockReturnValue(mockUserAtualizar.permissao);
    (prisma.usuario.update as jest.Mock).mockResolvedValue(mockUserAtualizado);

    const result = await service.atualizar(
      mockUserAtualizar,
      mockUserAtualizar.id,
      updateParams,
    );

    expect(result).not.toBe(null);
    expect(result).toEqual(mockUserAtualizado);

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
      },
      data: updateParams,
    });
  });

  //excluir usuario
  it('deve excluir um usuário', async () => {
    const mockExcUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.update as jest.Mock).mockResolvedValue({
      desativado: true,
    });

    const result = await service.excluir(mockExcUser.id);

    expect(result).not.toBe(null);
    expect(result).toEqual({ desativado: true });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
      },
      data: { status: false },
    });
  });

  //autorizar usuario
  it('deverá autorizar um usuario', async () => {
    const mockAutUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.update as jest.Mock).mockResolvedValue(mockAutUser);

    const result = await service.autorizaUsuario(mockAutUser.id);

    expect(result).not.toBe(null);
    expect(result).toEqual({ autorizado: true });
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: mockAutUser.id },
      data: { status: true },
    });
  });

  //validar usuario
  it('deve validar um usuario', async () => {
    const mockValidUser: UsuarioResponseDTO = {
      id: '123456',
      nome: 'João da Silva',
      nomeSocial: 'João',
      login: 'joao.silva',
      email: 'joao.silva@example.com',
      status: true,
      avatar: 'https://example.com/avatar.jpg',
      permissao: $Enums.Permissao.ADM,
      ultimoLogin: new Date('2025-03-25T12:00:00Z'),
      criadoEm: new Date('2023-01-01T00:00:00Z'),
      atualizadoEm: new Date('2025-03-25T12:00:00Z'),
    };

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockValidUser);

    const result = await service.validaUsuario(mockValidUser.id);

    expect(result).not.toBe(null);
    expect(result).toEqual(mockValidUser);
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
      },
    });
  });

  //buscar por nome
  it('deverá buscar um usuario pelo nome', async () => {
    const mockLdapResponse = {
      searchEntries: [
        {
          name: 'João Silva',
          mail: 'joao.silva@example.com',
          samaccountname: 'joao.silva',
        },
      ],
    };

    mockLdapBind.mockResolvedValue(undefined);
    mockLdapSearch.mockResolvedValue(mockLdapResponse);

    const result = await service.buscarPorNome('João Silva');

    expect(result).toEqual({
      nome: 'João Silva',
      email: 'joao.silva@example.com',
      login: 'joao.silva',
    });

    expect(mockLdapBind).toHaveBeenCalledWith(
      `${process.env.USER_LDAP}${process.env.LDAP_DOMAIN}`,
      process.env.PASS_LDAP,
    );
  });

  //buscar novo erro
  it('deverá lançar erro ao falhar conexão LDAP', async () => {
    mockLdapBind.mockRejectedValue(new Error('Erro de conexão'));

    await expect(service.buscarPorNome('Nome Inválido')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  //buscar novo
  it('deverá buscar um novo usuario via LDAP', async () => {
    const mockLdapResponse = {
      searchEntries: [
        {
          name: 'Novo Usuário',
          mail: 'novo@example.com',
        },
      ],
    };

    mockLdapBind.mockResolvedValue(undefined);
    mockLdapSearch.mockResolvedValue(mockLdapResponse);
    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(null);

    const result = await service.buscarNovo('novousuario');

    expect(result).toEqual({
      login: 'novousuario',
      nome: 'Novo Usuário',
      email: 'novo@example.com',
    });
  });

  //buscar user inativo
  it('deverá reativar usuario existente inativo', async () => {
    const mockUsuarioInativo: UsuarioResponseDTO = {
      id: '1',
      nome: 'Usuário Inativo',
      login: 'usuarioexistente',
      email: 'inativo@example.com',
      status: false,
      avatar: 'avatar-inativo.png',
      permissao: $Enums.Permissao.PORTARIA,
      ultimoLogin: new Date('2024-01-01'),
      criadoEm: new Date('2024-01-01'),
      atualizadoEm: new Date('2024-01-01'),
      nomeSocial: undefined,
    };

    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(mockUsuarioInativo);

    const mockUsuarioReativado = { ...mockUsuarioInativo, status: true };
    MockPrismaService.usuario.update.mockResolvedValue(mockUsuarioReativado);

    const result = await service.buscarNovo('usuarioexistente');

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: true },
    });

    expect(result).toEqual(
      expect.objectContaining({
        login: 'usuarioexistente',
        status: true,
      }),
    );
  });

  //reativar user
  it('deverá lançar erro ao não encontrar usuário no LDAP', async () => {
    mockLdapBind.mockResolvedValue(undefined);
    mockLdapSearch.mockRejectedValue(new Error('Não encontrado'));
    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(null);

    await expect(service.buscarNovo('inexistente')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  //user não encontrado
  it('deverá lançar erro se usuário não encontrado no LDAP', async () => {
    mockLdapBind.mockResolvedValue(undefined);
    mockLdapSearch.mockResolvedValue({ searchEntries: [] });
    jest.spyOn(service, 'buscarPorLogin').mockResolvedValue(null);

    await expect(service.buscarNovo('invalidlogin')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
