import { NamespaceService } from './namespace.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TargetType } from '../../wal/dto/target-config.dto';

describe('NamespaceService', () => {

  let service: NamespaceService;
  let mockRepository: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockRepository = {
      findByName: jest.fn(),
      findEnabled: jest.fn(),
      findByBackend: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    mockConfigService = { get: jest.fn() };
    service = new NamespaceService(mockRepository, mockConfigService);
  });

  it('should throw error for delay exceeding max', async () => {
    mockRepository.findByName.mockResolvedValue({
      name: 'test-ns',
      backend: 'redis',
      enabled: true,
      maxMessageSize: 100,
      maxDelaySeconds: 1,
      targetConfig: { type: TargetType.HTTP_SERVICE },
    });
    const request = {
      namespace: 'test-ns',
      payload: { key: 'value' },
      lifecycle: { delay: 5 },
      target: {
        type: TargetType.HTTP_SERVICE,
        identifier: 'target-1',
        config: { url: 'http://localhost' },
      },
    };
    await expect(service.validateRequest('test-ns', request)).rejects.toThrow();
  });

  it('should throw error for target type mismatch', async () => {
    mockRepository.findByName.mockResolvedValue({
      name: 'test-ns',
      backend: 'redis',
      enabled: true,
      maxMessageSize: 100,
      maxDelaySeconds: 10,
      targetConfig: { type: TargetType.CACHE },
    });
    const request = {
      namespace: 'test-ns',
      payload: { key: 'value' },
      lifecycle: { delay: 5 },
      target: {
        type: TargetType.HTTP_SERVICE,
        identifier: 'target-1',
        config: { url: 'http://localhost' },
      },
    };
    await expect(service.validateRequest('test-ns', request)).rejects.toThrow();
  });

  it('should create a new namespace', async () => {
    mockRepository.exists.mockResolvedValue(false);
    mockRepository.create.mockResolvedValue({
      name: 'new-ns',
      backend: 'redis',
      enabled: true,
    });
    mockConfigService.get.mockReturnValueOnce(100).mockReturnValueOnce(10);
    const result = await service.createNamespace({
      name: 'new-ns',
      backend: 'redis',
    });
    expect(result).toBeDefined();
    expect(result.name).toBe('new-ns');
  });

  it('should not create namespace if already exists', async () => {
    mockRepository.exists.mockResolvedValue(true);
    await expect(
      service.createNamespace({ name: 'existing-ns', backend: 'redis' }),
    ).rejects.toThrow();
  });

  it('should update an existing namespace', async () => {
    mockRepository.exists.mockResolvedValue(true);
    mockRepository.update.mockResolvedValue({ name: 'test-ns', enabled: false });
    const result = await service.updateNamespace('test-ns', { enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('should not update namespace if not found', async () => {
    mockRepository.exists.mockResolvedValue(false);
    await expect(
      service.updateNamespace('missing-ns', { enabled: false }),
    ).rejects.toThrow();
  });

  it('should delete a namespace', async () => {
    mockRepository.exists.mockResolvedValue(true);
    mockRepository.delete.mockResolvedValue(true);
    const result = await service.deleteNamespace('test-ns');
    expect(result).toBe(true);
  });

  it('should not delete namespace if not found', async () => {
    mockRepository.exists.mockResolvedValue(false);
    await expect(service.deleteNamespace('missing-ns')).rejects.toThrow();
  });

  it('should get namespace stats', async () => {
    mockRepository.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    const result = await service.getNamespaceStats();
    expect(result.total).toBe(10);
    expect(result.enabled).toBe(7);
    expect(result.disabled).toBe(3);
    expect(result.byBackend.redis).toBe(5);
  });

});