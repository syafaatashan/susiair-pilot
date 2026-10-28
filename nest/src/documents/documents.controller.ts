import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/jwt-auth.guard.js'
import { DocumentsService } from './documents.service.js'

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  getDocuments() {
    return this.documentsService.getDocuments()
  }
}
