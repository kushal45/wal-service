import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NamespaceService } from './services/namespace.service';
import { NamespaceRepository } from './repositories/namespace.repository';
import { Namespace } from './entities/namespace.entity';

@Module({})
export class NamespaceModule {
  static forRoot(): DynamicModule {
    return {
      module: NamespaceModule,
      imports: [TypeOrmModule.forFeature([Namespace])],
      providers: [NamespaceService, NamespaceRepository],
      exports: [NamespaceService, NamespaceRepository],
    };
  }
}
