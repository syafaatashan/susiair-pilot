import { Injectable } from '@nestjs/common'
import { loadFlightHoursData } from '../common/data-loader.js'
import type { FlightHoursData } from '../common/types.js'

@Injectable()
export class PilotService {
  private readonly data: FlightHoursData

  constructor() {
    this.data = loadFlightHoursData()
  }

  getProfile() {
    return {
      name: this.data.pilot.name,
      totalFlightHours: this.data.pilot.totalFlightHours,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=128&h=128&q=80',
    }
  }
}
