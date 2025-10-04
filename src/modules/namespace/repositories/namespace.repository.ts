import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Namespace } from '../entities/namespace.entity';

@Injectable()
export class NamespaceRepository {
  constructor(
    @InjectRepository(Namespace)
    private readonly repository: Repository<Namespace>,
  ) {}

  async findByName(name: string): Promise<Namespace | null> {
    return this.repository.findOne({ where: { name } });
  }

  async findEnabled(): Promise<Namespace[]> {
    return this.repository.find({ 
      where: { enabled: true },
      order: { name: 'ASC' },
    });
  }

  async findByBackend(backend: 'kafka' | 'sqs' | 'redis'): Promise<Namespace[]> {
    return this.repository.find({
      where: { backend, enabled: true },
      order: { name: 'ASC' },
    });
  }

  async create(namespaceData: Partial<Namespace>): Promise<Namespace> {
    const namespace = this.repository.create(namespaceData);
    return this.repository.save(namespace);
  }

  async update(name: string, updateData: Partial<Namespace>): Promise<Namespace> {
    await this.repository.update({ name }, updateData);
    const updated = await this.findByName(name);
    if (!updated) {
      throw new Error(`Namespace ${name} not found after update`);
    }
    return updated;
  }

  async delete(name: string): Promise<boolean> {
    const result = await this.repository.delete({ name });
    return (result.affected ?? 0) > 0;
  }

  async exists(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { name } });
    return count > 0;
  }

  async count(where?: FindOptionsWhere<Namespace>): Promise<number> {
    return this.repository.count({ where });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    enabled?: boolean;
    backend?: 'kafka' | 'sqs' | 'redis';
  }): Promise<{ namespaces: Namespace[]; total: number }> {
    const query = this.repository.createQueryBuilder('namespace');

    if (options?.enabled !== undefined) {
      query.andWhere('namespace.enabled = :enabled', { enabled: options.enabled });
    }

    if (options?.backend) {
      query.andWhere('namespace.backend = :backend', { backend: options.backend });
    }

    query.orderBy('namespace.name', 'ASC');

    if (options?.skip) {
      query.skip(options.skip);
    }

    if (options?.take) {
      query.take(options.take);
    }

    const [namespaces, total] = await query.getManyAndCount();

    return { namespaces, total };
  }
}