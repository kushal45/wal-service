import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    // Hot reload verification string (change #1)
    return 'Hello World!';
  }
}
