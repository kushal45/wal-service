import { seedNamespaces } from './namespace-seeds';
import { DataSource } from 'typeorm';

describe('Namespace Seeds', () => {
  class MockRepository {
    findOne = jest.fn();
    create = jest.fn();
    save = jest.fn();
  }

  let mockDataSource: DataSource;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = new MockRepository();
    mockDataSource = Object.create(DataSource.prototype);
    mockDataSource.getRepository = jest.fn().mockReturnValue(mockRepository);
  });

  it('should seed namespaces successfully', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockImplementation((data) => data);
    mockRepository.save.mockResolvedValue(true);
    await expect(seedNamespaces(mockDataSource)).resolves.toBeUndefined();
    expect(mockDataSource.getRepository).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(mockRepository.findOne).toHaveBeenCalled();
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should skip existing namespaces', async () => {
    mockRepository.findOne.mockResolvedValue({ id: 1 });
    await expect(seedNamespaces(mockDataSource)).resolves.toBeUndefined();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should handle errors during seeding', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockImplementation((data) => data);
    mockRepository.save.mockRejectedValue(new Error('DB error'));
    await expect(seedNamespaces(mockDataSource)).rejects.toThrow('DB error');
  });

  it('should handle invalid repository', async () => {
    mockDataSource.getRepository = jest.fn().mockReturnValueOnce(undefined);
    await expect(seedNamespaces(mockDataSource)).rejects.toThrow();
  });
});
