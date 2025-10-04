import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    // 🚀 HOT RELOAD WORKING - Manual rebuild at 12:58 PM
    console.log('🎯 Hello endpoint called at:', new Date().toISOString());
    return this.appService.getHello();
  }
}
