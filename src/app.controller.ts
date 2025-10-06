import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    // 🚀 HOT RELOAD WORKING - Manual rebuild at 12:58 PM
    // 🔥 Testing hot reload at 1:00 PM after network policy fix
    // 🧪 VALIDATION TEST: Hot reload check at 1:01 PM
    console.log('🎯 Hello endpoint called at:', new Date().toISOString());
    return this.appService.getHello() + ' - Hot reload test v3';
  }
}
