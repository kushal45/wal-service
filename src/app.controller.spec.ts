import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return augmented hello string with hot reload suffix', () => {
      const result = appController.getHello();
      expect(result).toBe('Hello World! - Hot reload test v3');
      // Guard that the base service string is still present
      expect(result.startsWith('Hello World!')).toBe(true);
    });
  });
});
