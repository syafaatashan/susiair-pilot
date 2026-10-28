import { Controller, Get } from '@nestjs/common'

/** Lightweight readiness probe.
 *  Unauthenticated (no JwtAuthGuard) so it can double as a warm-up target for
 *  the keepalive cron on Render's Free tier, which otherwise spins down after
 *  15 min of inactivity and adds ~50s of cold-start latency.
 */
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', ts: new Date().toISOString() }
  }
}
