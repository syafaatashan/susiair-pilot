import { Injectable } from '@nestjs/common'
import { loadDocumentsData } from '../common/data-loader.js'
import { APP_TODAY, daysBetween } from '../common/config.js'
import type { DocumentsData, DocumentStatus } from '../common/types.js'

@Injectable()
export class DocumentsService {
  private readonly data: DocumentsData

  constructor() {
    this.data = loadDocumentsData()
  }

  getDocuments(): DocumentStatus[] {
    const today = APP_TODAY
    const warningDays = this.data.thresholds.warningDays
    return this.data.documents.map((doc) => {
      // UTC-only arithmetic: a local-time Date would gain an hour across DST and
      // shift the badge by a day depending on the deploy host's timezone.
      const daysRemaining = daysBetween(today, doc.expiryDate)
      const status: DocumentStatus['status'] =
        daysRemaining <= 0 ? 'expired' : daysRemaining <= warningDays ? 'soon' : 'safe'
      return {
        id: doc.id,
        label: doc.label,
        expiryDate: doc.expiryDate,
        daysRemaining,
        status,
      }
    })
  }
}
