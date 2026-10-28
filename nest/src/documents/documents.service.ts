import { Injectable } from '@nestjs/common'
import { loadDocumentsData } from '../common/data-loader.js'
import type { DocumentsData, DocumentStatus } from '../common/types.js'

@Injectable()
export class DocumentsService {
  private readonly data: DocumentsData

  constructor() {
    this.data = loadDocumentsData()
  }

  getDocuments(): DocumentStatus[] {
    const today = this.parseDate(process.env.APP_TODAY ?? this.data.today)
    const warningDays = this.data.thresholds.warningDays
    return this.data.documents.map((doc) => {
      const expiry = this.parseDate(doc.expiryDate)
      const daysRemaining = this.daysBetween(today, expiry)
      let status: 'safe' | 'soon' | 'expired'
      if (daysRemaining <= 0) status = 'expired'
      else if (daysRemaining <= warningDays) status = 'soon'
      else status = 'safe'
      return {
        id: doc.id,
        label: doc.label,
        expiryDate: doc.expiryDate,
        daysRemaining,
        status,
      }
    })
  }

  private parseDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00')
  }

  private daysBetween(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }
}
