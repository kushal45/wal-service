import { Module, DynamicModule, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NamespaceService } from './services/namespace.service';
import { NamespaceRepository } from './repositories/namespace.repository';
import { Namespace } from './entities/namespace.entity';

@Module({})
export class NamespaceModule {
  static forRoot(): DynamicModule {
    const logger = new Logger('NamespaceModule');
    const skipDb = process.env.SKIP_DB === 'true';
    
    if (skipDb) {
      logger.warn('SKIP_DB enabled: NamespaceModule loaded without database dependencies.');
      return {
        module: NamespaceModule,
        providers: [
          // Provide a mock service or skip providers when database is disabled
        ],
        exports: [],
      };
    }

    return {
      module: NamespaceModule,
      imports: [
        TypeOrmModule.forFeature([Namespace]),
      ],
      providers: [
        NamespaceService,
        NamespaceRepository,
      ],
      exports: [
        NamespaceService,
        NamespaceRepository,
      ],
    };
  }
}