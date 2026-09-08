import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard';
import { TurnstileService } from '../turnstile.service';

function mockContext(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body, ip: '127.0.0.1' }),
    }),
  } as unknown as ExecutionContext;
}

describe('TurnstileGuard', () => {
  it('rejeita quando o token está ausente', async () => {
    const turnstileService = { verificar: jest.fn() } as unknown as TurnstileService;
    const guard = new TurnstileGuard(turnstileService);

    await expect(guard.canActivate(mockContext({}))).rejects.toThrow(BadRequestException);
    expect(turnstileService.verificar).not.toHaveBeenCalled();
  });

  it('rejeita quando a verificação falha', async () => {
    const turnstileService = {
      verificar: jest.fn().mockResolvedValue(false),
    } as unknown as TurnstileService;
    const guard = new TurnstileGuard(turnstileService);

    await expect(
      guard.canActivate(mockContext({ turnstileToken: 'token-invalido' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite quando a verificação passa', async () => {
    const turnstileService = {
      verificar: jest.fn().mockResolvedValue(true),
    } as unknown as TurnstileService;
    const guard = new TurnstileGuard(turnstileService);

    await expect(
      guard.canActivate(mockContext({ turnstileToken: 'token-valido' })),
    ).resolves.toBe(true);
    expect(turnstileService.verificar).toHaveBeenCalledWith('token-valido', '127.0.0.1');
  });
});
