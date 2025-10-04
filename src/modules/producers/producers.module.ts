import { Module, DynamicModule, ModuleMetadata } from '@nestjs/common';
import { ProducerFactoryService } from './services/producer-factory.service';

export interface ProducersModuleOptions {
  isGlobal?: boolean;
}

@Module({})
export class ProducersModule {
  static forRoot(options: ProducersModuleOptions = {}): DynamicModule {
    const module: DynamicModule = {
      module: ProducersModule,
      providers: [ProducerFactoryService],
      exports: [ProducerFactoryService],
    };

    if (options.isGlobal) {
      module.global = true;
    }

    return module;
  }
}